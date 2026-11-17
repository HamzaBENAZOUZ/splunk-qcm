#!/usr/bin/env python3
"""
Assemble un livre pour l'onglet « Books » : texte d'origine + traduction + quiz.

    python3 tools/book_build.py private/books/<id>.json [--cover image.jpg] [--lang-dir private/books/<id>.fr]

Entrées (toutes dans private/, jamais publiées) :
  - private/books/<id>.json     : sortie de tools/book_extract.py (texte d'origine découpé en chapitres)
  - private/books/<id>.fr/*.txt : traductions et quiz, par lots de chapitres, au format :

        @@ch 12
        @title Titre traduit
        @html
        <p>Texte traduit…</p>
        @quiz
        [ {"a": 0, "en": {"q": "…", "o": ["…", "…", "…", "…"], "e": "…"},
                   "fr": {"q": "…", "o": ["…", "…", "…", "…"], "e": "…"}} ]

        @check
        {"en": "<p>Correction…</p>", "fr": "<p>Correction…</p>"}   (facultatif : note de vérification)

    (« a » = indice de la bonne réponse, « e » = explication.) Un fichier meta.txt facultatif donne
    @title_fr et @subtitle_fr.

Sortie : private/books/<id>.book.json (lu par le site en mode local, et importé dans Supabase depuis
l'onglet Books : « Ajouter un livre »). Met aussi à jour private/books/index.json.
"""
import base64
import io
import json
import re
import sys
from pathlib import Path

SECTIONS_FR = {
    "Introduction": "Introduction",
    "Strategizing Your Splunk Implementation": "Planifier votre mise en œuvre de Splunk",
    "Setting Up Splunk Environment": "Mettre en place l'environnement Splunk",
    "Harnessing Data Influx": "Maîtriser l'afflux de données",
    "Mastering Search and Analysis": "Maîtriser la recherche et l'analyse",
    "Crafting Visual Insights": "Créer des visualisations parlantes",
    "Mastery of Advanced Concepts": "Maîtrise des concepts avancés",
}


def section_fr(s, extra):
    m = re.match(r"^(Section|Part)\s+(\d+)\s*:\s*(.*)$", s or "")
    if not m:
        return extra.get(s, s)
    name = m.group(3).strip()
    return f"Partie {m.group(2)} : {extra.get(name, SECTIONS_FR.get(name, name))}"


def parse_lot(text):
    out = {}
    for block in re.split(r"^@@ch\s+", text, flags=re.M)[1:]:
        n = int(block.split("\n", 1)[0].strip())
        body = block.split("\n", 1)[1]
        parts = dict(re.findall(r"^@(\w+)[ \t]*\n?(.*?)(?=^@\w+|\Z)", body, flags=re.M | re.S))
        title = re.search(r"^@title\s+(.*)$", body, re.M)
        ch = {"title_fr": title.group(1).strip() if title else None,
              "html_fr": parts.get("html", "").strip() or None,
              "quiz": json.loads(parts["quiz"]) if parts.get("quiz", "").strip() else [],
              # Remarques de vérification (erreurs ou imprécisions du livre) : {"en": "<p>…</p>", "fr": "<p>…</p>"}
              "notes": json.loads(parts["check"]) if parts.get("check", "").strip() else None}
        out[n] = ch
    return out


def check_quiz(n, quiz):
    for i, q in enumerate(quiz):
        for L in ("en", "fr"):
            x = q[L]
            assert x["q"] and len(x["o"]) >= 2 and x["e"], f"ch {n} q{i+1} {L} incomplet"
        assert len(q["en"]["o"]) == len(q["fr"]["o"]), f"ch {n} q{i+1} : pas le même nombre d'options EN/FR"
        assert 0 <= q["a"] < len(q["en"]["o"]), f"ch {n} q{i+1} : réponse hors limites"


def cover_data_url(path, width=360):
    try:
        from PIL import Image
        im = Image.open(path).convert("RGB")
        im.thumbnail((width, width * 2))
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=72, optimize=True)
        data = buf.getvalue()
    except ImportError:
        data = Path(path).read_bytes()
    return "data:image/jpeg;base64," + base64.b64encode(data).decode()


def main():
    src = Path(sys.argv[1])
    book = json.loads(src.read_text(encoding="utf-8"))
    lang_dir = Path(sys.argv[sys.argv.index("--lang-dir") + 1]) if "--lang-dir" in sys.argv else src.with_suffix(".fr")
    if not lang_dir.exists():
        lang_dir = src.parent / (book["id"] + ".fr")
    tr = {}
    meta = {}
    for f in sorted(lang_dir.glob("*.txt")):
        txt = f.read_text(encoding="utf-8")
        if f.name == "meta.txt":
            meta = dict(re.findall(r"^@(\w+)\s+(.*)$", txt, re.M))
            continue
        tr.update(parse_lot(txt))
    extra_sections = json.loads(meta.get("sections", "{}"))
    out_ch = []
    for c in book["chapters"]:
        t = tr.get(c["n"], {})
        check_quiz(c["n"], t.get("quiz", []))
        out_ch.append({
            "n": c["n"],
            "section": c.get("section", ""),
            "section_fr": section_fr(c.get("section", ""), extra_sections) if c.get("section") else "",
            "title": c["title"],
            "title_fr": t.get("title_fr"),
            "html_en": c["html"],
            "html_fr": t.get("html_fr"),
            "quiz": t.get("quiz", []),
            "notes": t.get("notes"),
        })
    res = {
        "id": book["id"], "title": book["title"], "title_fr": meta.get("title_fr", book["title"]),
        "subtitle": book.get("subtitle", ""), "subtitle_fr": meta.get("subtitle_fr", ""),
        "author": re.sub(r"\s+,", ",", book.get("author", "")).strip(" ,"), "source": book.get("source", ""),
        "chapters": out_ch,
    }
    if "--cover" in sys.argv:
        res["cover"] = cover_data_url(sys.argv[sys.argv.index("--cover") + 1])
    dst = src.with_name(book["id"] + ".book.json")
    dst.write_text(json.dumps(res, ensure_ascii=False), encoding="utf-8")
    # Liste des livres pour le mode local du site (private/books/index.json)
    idx = dst.parent / "index.json"
    ids = json.loads(idx.read_text(encoding="utf-8")) if idx.exists() else []
    if book["id"] not in ids:
        ids.append(book["id"])
    idx.write_text(json.dumps(ids), encoding="utf-8")
    done = sum(1 for c in out_ch if c["html_fr"])
    nq = sum(len(c["quiz"]) for c in out_ch)
    print(f"{dst} : {len(out_ch)} chapitres, {done} traduits, {nq} questions de quiz")
    missing = [c["n"] for c in out_ch if not c["html_fr"] or not c["quiz"]]
    if missing:
        print("À compléter :", missing)


if __name__ == "__main__":
    main()
