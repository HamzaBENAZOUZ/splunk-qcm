#!/usr/bin/env python3
"""Génère les fichiers d'import SQL à partir de private/questions.json et private/practice.json.

Usage :  python3 tools/json_to_sql.py

Produit :
  private/seed_questions.sql   SPLK-1001 : quiz du cours Packt (1-9) + questions originales (11-18)
  private/seed_practice.sql    SPLK-1002 : questions originales (101-110)

Les textes sont encodés en base64 : l'éditeur SQL de Supabase ne peut donc
pas mal interpréter les apostrophes, $, ;, -- ou autres caractères.
À exécuter APRÈS supabase/schema.sql. L'import est idempotent (pas de doublons).
"""
import base64
import json
import pathlib
import re
import textwrap

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "private" / "questions.json"
SRC_PRACTICE = ROOT / "private" / "practice.json"
OUT = ROOT / "private"

# Module / chapitre -> thème de l'examen SPLK-1001 (blueprint officiel, 8 thèmes)
DOMAIN = {1: 1, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8}           # modules Packt -> thèmes SPLK-1001
DOMAIN.update({10 + t: t for t in range(1, 9)})                          # 11-18 : questions originales SPLK-1001
DOMAIN.update({100 + t: 10 + t for t in range(1, 11)})                   # 101-110 : SPLK-1002, thèmes 11-20


def b64(obj) -> str:
    raw = base64.b64encode(json.dumps(obj, ensure_ascii=False).encode("utf-8")).decode("ascii")
    return "\n".join(textwrap.wrap(raw, 100))


def chapters_sql(data) -> str:
    rows = [{"id": c["chapter"], "title": c["title"], "title_fr": c.get("title_fr"), "domain": DOMAIN.get(c["chapter"])} for c in data]
    return (
        "insert into public.splunk_chapters (id, title, domain, title_fr)\n"
        "select (e->>'id')::int, e->>'title', (e->>'domain')::int, e->>'title_fr'\n"
        f"from jsonb_array_elements(convert_from(decode('\n{b64(rows)}\n', 'base64'), 'UTF8')::jsonb) as e\n"
        "on conflict (id) do update set title = excluded.title, domain = excluded.domain, title_fr = excluded.title_fr;\n"
    )


def chapter_questions_sql(c) -> str:
    rows = []
    for item in c["questions"]:
        multi = len(item["ans"]) > 1 or bool(re.search(r"(choose|select) all (that|answers that) apply", item["q"], re.I))
        rows.append({"n": item["n"], "q": item["q"], "opts": item["opts"], "ans": item["ans"],
                     "exp": item["exp"], "multi": multi,
                     "q_fr": item.get("q_fr"), "opts_fr": item.get("opts_fr"), "exp_fr": item.get("exp_fr"),
                     "sc": item.get("scenario"), "sc_fr": item.get("scenario_fr")})
    return (
        f"-- Chapitre {c['chapter']} : {len(rows)} questions\n"
        "insert into public.splunk_questions (chapter_id, number, question, options, correct, explanation, multi,\n"
        "  question_fr, options_fr, explanation_fr, scenario, scenario_fr)\n"
        f"select {c['chapter']}, (e->>'n')::int, e->>'q', e->'opts', e->'ans', e->>'exp', (e->>'multi')::boolean,\n"
        "  e->>'q_fr', nullif(e->'opts_fr', 'null'::jsonb), e->>'exp_fr', e->>'sc', e->>'sc_fr'\n"
        f"from jsonb_array_elements(convert_from(decode('\n{b64(rows)}\n', 'base64'), 'UTF8')::jsonb) as e\n"
        "on conflict (chapter_id, number) do update set question = excluded.question, options = excluded.options,\n"
        "  correct = excluded.correct, explanation = excluded.explanation, multi = excluded.multi,\n"
        "  question_fr = excluded.question_fr, options_fr = excluded.options_fr, explanation_fr = excluded.explanation_fr,\n"
        "  scenario = excluded.scenario, scenario_fr = excluded.scenario_fr;\n"
    )


def build(data, chapters, title, count_label="questions_importees", where="") -> str:
    parts = [f"-- {title}\n-- Généré par tools/json_to_sql.py.\n",
             chapters_sql(data)]
    parts += [chapter_questions_sql(c) for c in data if c["chapter"] in chapters]
    parts.append(f"select count(*) as {count_label} from public.splunk_questions{where};\n")
    return "\n".join(parts)


def main() -> None:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    n = sum(len(c["questions"]) for c in data)
    (OUT / "seed_questions.sql").write_text(
        build(data, [c["chapter"] for c in data], f"SPLK-1001 ({n} questions)"), encoding="utf-8")
    print(f"{n} questions -> seed_questions.sql")
    if SRC_PRACTICE.exists():
        pr = json.loads(SRC_PRACTICE.read_text(encoding="utf-8"))
        n = sum(len(c["questions"]) for c in pr)
        (OUT / "seed_practice.sql").write_text(
            build(pr, [c["chapter"] for c in pr], f"SPLK-1002 ({n} questions originales)",
                  "questions_practice_importees", " where chapter_id > 100"), encoding="utf-8")
        print(f"{n} questions -> seed_practice.sql")


if __name__ == "__main__":
    main()
