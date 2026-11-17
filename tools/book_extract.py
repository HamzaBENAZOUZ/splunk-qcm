#!/usr/bin/env python3
"""
Découpe un livre (EPUB ou PDF) en chapitres pour l'onglet « Books ».

    python3 tools/book_extract.py LIVRE.epub|LIVRE.pdf private/books/<id>.json [--id <id>]

Sortie (JSON, à garder dans private/ : jamais publié sur GitHub) :
{
  "id": "mastering-splunk", "title": "...", "author": "...", "lang": "en",
  "chapters": [ {"n": 1, "section": "Section 1: ...", "title": "...", "html": "<p>…</p>…"} ]
}

Le HTML produit est volontairement simple (h3, p, ul/ol/li, pre, strong, em, a) :
c'est ce que l'appli affiche, lit à voix haute et traduit.

EPUB : un chapitre = un <h1>/<h2> (selon ce que le livre utilise le plus), dans l'ordre du « spine ».
       Les paragraphes en gras deviennent des sous-titres, les puces « ● ○ ■ » des listes,
       les paragraphes serrés (line-height, sans marge) des blocs de code.
PDF  : un chapitre = une entrée de premier niveau du sommaire (signets) du PDF ;
       sans signets, on coupe sur les lignes « Chapter N » / « Chapitre N ».
"""
import html
import json
import re
import sys
import warnings
import zipfile
from pathlib import Path

BULLETS = "●○■•▪◦–-"


def css_rules(css):
    rules = {}
    for m in re.finditer(r"\.([\w-]+)\s*\{([^}]*)\}", css):
        props = {}
        for decl in m.group(2).split(";"):
            if ":" in decl:
                k, v = decl.split(":", 1)
                props[k.strip()] = v.strip()
        rules[m.group(1)] = props
    return rules


def esc(t):
    return html.escape(t, quote=False)


# ---------------------------------------------------------------- EPUB
def epub_extract(path):
    from bs4 import BeautifulSoup, NavigableString, Tag, XMLParsedAsHTMLWarning

    warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

    z = zipfile.ZipFile(path)
    container = z.read("META-INF/container.xml").decode()
    opf_path = re.search(r'full-path="([^"]+)"', container).group(1)
    base = opf_path.rsplit("/", 1)[0] + "/" if "/" in opf_path else ""
    opf = BeautifulSoup(z.read(opf_path), "xml")
    meta = {
        "title": (opf.find("dc:title") or opf.find("title")).get_text(strip=True),
        "author": ", ".join(c.get_text(" ", strip=True).strip(" ,") for c in opf.find_all(["dc:creator", "creator"])),
        "lang": (opf.find("dc:language") or opf.find("language")).get_text(strip=True) if (opf.find("dc:language") or opf.find("language")) else "en",
    }
    manifest = {i["id"]: i["href"] for i in opf.find_all("item")}
    spine = [manifest[r["idref"]] for r in opf.find_all("itemref")]
    css = "".join(z.read(base + h).decode("utf-8", "ignore") for h in manifest.values() if h.endswith(".css"))
    rules = css_rules(css)

    def props(el):
        p = {}
        for c in el.get("class", []) or []:
            p.update(rules.get(c, {}))
        return p

    def margin_left(el):
        m = re.match(r"([\d.]+)%", props(el).get("margin-left", "0%"))
        return float(m.group(1)) if m else 0.0

    def inline(el):
        """HTML en ligne simplifié (strong/em/a) d'un élément."""
        out = []
        for ch in el.children:
            if isinstance(ch, NavigableString):
                out.append(esc(str(ch)))
            elif isinstance(ch, Tag):
                if ch.name in ("br",):
                    out.append("\n")
                    continue
                inner = inline(ch)
                p = props(ch)
                if ch.name == "a" and ch.get("href", "").startswith("http"):
                    out.append(f'<a href="{html.escape(ch["href"])}" target="_blank" rel="noopener">{inner}</a>')
                elif ch.name in ("b", "strong") or p.get("font-weight") == "bold":
                    out.append(f"<strong>{inner}</strong>" if inner.strip() else inner)
                elif ch.name in ("i", "em") or p.get("font-style") == "italic":
                    out.append(f"<em>{inner}</em>" if inner.strip() else inner)
                else:
                    out.append(inner)
        s = "".join(out)
        s = s.replace(" ", " ")
        s = re.sub(r"</strong>(\s*)<strong>", r"\1", s)
        return s

    def clean(s):
        return re.sub(r"[ \t]+", " ", s).strip()

    # Repère la table des matières (« Section N: … » suivi de « N. Titre »)
    sections_of = {}
    blocks = []  # (kind, payload)
    for href in spine:
        soup = BeautifulSoup(z.read(base + href), "lxml")
        body = soup.body
        if not body:
            continue
        for el in body.find_all(["h1", "h2", "p", "ol", "ul", "pre"]):
            if el.find_parent(["ol", "ul", "pre"]) is not None and el.name != "ol" and el.name != "ul":
                continue
            if el.name in ("ol", "ul") and el.find_parent(["ol", "ul"]) is not None:
                continue
            blocks.append(el)

    # Chapitres = niveau de titre le plus fréquent
    lvl = max(("h1", "h2"), key=lambda h: sum(1 for b in blocks if b.name == h))

    # TOC : lignes « Section … » et « 12. Titre »
    cur_section = ""
    for b in blocks:
        t = clean(b.get_text(" "))
        if b.name == lvl:
            break
        m = re.match(r"^(Section\s+\d+\s*:.*|Part\s+\d+.*|Partie\s+\d+.*)$", t, re.I)
        if m:
            cur_section = t
            continue
        m = re.match(r"^(\d+)\.\s+(.*)$", t)
        if m:
            sections_of[norm(m.group(2))] = cur_section

    chapters = []
    cur = None
    list_stack = []  # pile de ("ul", profondeur)
    code_buf = []
    parts = []

    def flush_code():
        if code_buf:
            parts.append("<pre><code>" + "\n".join(code_buf) + "</code></pre>")
            code_buf.clear()

    def close_lists(depth=0):
        while len(list_stack) > depth:
            parts.append(list_stack.pop()[1])

    def end_chapter():
        flush_code()
        close_lists()
        if cur is not None:
            cur["html"] = "\n".join(p for p in parts if p.strip())
            chapters.append(cur)
        parts.clear()

    for b in blocks:
        if b.name == lvl:
            end_chapter()
            title = clean(b.get_text(""))
            cur = {"n": len(chapters) + 1, "section": sections_of.get(norm(title), ""), "title": title}
            continue
        if cur is None:
            continue
        if b.name in ("ol", "ul"):
            flush_code()
            close_lists()
            items = []
            for li in b.find_all("li", recursive=False):
                items.append("<li>" + clean(inline(li)) + "</li>")
            if items:
                parts.append(f"<{b.name}>" + "".join(items) + f"</{b.name}>")
            continue
        if b.name == "pre":
            flush_code()
            close_lists()
            parts.append("<pre><code>" + esc(b.get_text()) + "</code></pre>")
            continue
        text = clean(b.get_text(" "))
        if not text:
            continue
        p = props(b)
        raw = inline(b)
        first = text[0]
        if first in BULLETS[:5] and len(text) > 1:
            flush_code()
            depth = max(1, round(margin_left(b) / 10.14)) if margin_left(b) else 1
            # retire la puce en conservant les balises ouvertes avant elle
            body_html = clean(re.sub(r"^\*\s*", "", strip_leading_bullet(raw)))
            while list_stack and list_stack[-1][0] > depth:
                parts.append(list_stack.pop()[1])
            if not list_stack:
                if depth > 1 and parts and re.search(r"</li></[ou]l>$", parts[-1]):
                    # sous-liste d'une liste qui précède : on l'imbrique dans son dernier élément
                    tail = parts[-1][-5:]
                    parts[-1] = parts[-1][:-10]
                    list_stack.append((depth, "</li></ul></li>" + tail))
                else:
                    list_stack.append((depth, "</li></ul>"))
                parts.append("<ul><li>")
            elif depth > list_stack[-1][0]:
                list_stack.append((depth, "</li></ul>"))
                parts.append("<ul><li>")
            else:
                parts.append("</li><li>")
            parts.append(body_html)
            continue
        is_code = "line-height" in p and p.get("margin-top", "0") in ("0", "0.72em") and p.get("font-weight") != "bold"
        if is_code:
            close_lists()
            code_buf.append(esc(b.get_text()).replace(" ", " ").rstrip())
            continue
        flush_code()
        close_lists()
        is_heading = (p.get("font-weight") == "bold" or re.fullmatch(r"\s*<strong>.*</strong>\s*", raw, re.S)) and len(text) < 120
        if is_heading:
            parts.append("<h3>" + esc(clean(b.get_text(""))) + "</h3>")
        else:
            parts.append("<p>" + clean(raw) + "</p>")
    end_chapter()
    for c in chapters:
        h = c["html"]
        h = re.sub(r"\*{2,}", "", h)                                    # restes de Markdown (« **Titre:** »)
        h = re.sub(r"<li>\s+", "<li>", h)
        h = re.sub(r"\s+</li>", "</li>", h)
        h = re.sub(r"<ul><li></li><li>", "<ul><li>", h)
        h = re.sub(r"</li></ol>\s*<ol><li>", "</li><li>", h)
        h = re.sub(r"<ol><li></li></ol>", "", h)                          # éléments vides
        h = re.sub(r"<ol><li>(<ul>.*?</ul>)</li></ol>", r"\1", h)        # sous-liste seule dans une liste numérotée
        h = re.sub(r"<pre><code>([A-Z][^\[\n<]{2,40}:)\s*(?=\[)", r"<p><strong>\1</strong></p>\n<pre><code>", h)  # « Add a Stanza: »          # listes numérotées coupées par une sous-liste
        h = re.sub(r"\s*<h3>(Section|Part|Partie)\s+\d+\s*:?</h3>\s*<p>[^<]*</p>\s*$", "", h)   # intercalaire de partie
        h = merge_config_paras(h)
        c["html"] = h.strip()
    return meta, chapters


CONF_LINE = r"(?:\[[^\]<\n]+\]|[A-Za-z_][\w.:\-]*\s*=[^<\n]*)"


def merge_config_paras(h):
    """Paragraphs that are lines of a .conf file -> one <pre> block (label kept in bold before it)."""
    pat = re.compile(r"(?:<p>(?:<strong>[^<]{2,40}:</strong>\s*)?" + CONF_LINE + r"</p>\s*){2,}")

    def repl(m):
        lines, label = [], ""
        for para in re.findall(r"<p>(.*?)</p>", m.group(0), re.S):
            lab = re.match(r"<strong>([^<]+)</strong>\s*", para)
            if lab:
                if lines:
                    lines.append("")
                label = label or lab.group(1)
                para = para[lab.end():]
            lines.append(para.strip())
        head = f"<p><strong>{label}</strong></p>\n" if label else ""
        return head + "<pre><code>" + "\n".join(lines) + "</code></pre>\n"
    return pat.sub(repl, h)


def strip_leading_bullet(raw):
    # supprime la première puce et les espaces qui suivent, même si elle est dans une balise
    m = re.search("[" + BULLETS[:5] + "]", raw)
    if not m:
        return raw
    rest = raw[m.end():]
    rest = re.sub(r"^(\s|</?strong>|</?em>)*", lambda mm: "".join(re.findall(r"<strong>|<em>", mm.group(0))), rest)
    return rest


def norm(t):
    return re.sub(r"[^a-z0-9]+", "", t.lower().replace("’", "'"))


# ---------------------------------------------------------------- PDF
def pdf_extract(path):
    from pypdf import PdfReader

    r = PdfReader(path)
    info = r.metadata or {}
    meta = {"title": (info.get("/Title") or Path(path).stem), "author": info.get("/Author") or "", "lang": "en"}
    pages = [(pg.extract_text() or "") for pg in r.pages]

    starts = []  # (page_index, title)
    try:
        for o in r.outline:
            if isinstance(o, list):
                continue
            starts.append((r.get_destination_page_number(o), o.title.strip()))
    except Exception:
        starts = []
    if len(starts) < 2:
        for i, txt in enumerate(pages):
            m = re.search(r"^\s*(Chapter|Chapitre|CHAPTER)\s+(\d+|[IVXL]+)\b.*$", txt, re.M)
            if m:
                starts.append((i, m.group(0).strip()))
    if not starts:
        starts = [(0, meta["title"])]
    chapters = []
    for k, (pi, title) in enumerate(starts):
        end = starts[k + 1][0] if k + 1 < len(starts) else len(pages)
        text = "\n".join(pages[pi:end])
        chapters.append({"n": k + 1, "section": "", "title": title, "html": text_to_html(text)})
    return meta, chapters


def text_to_html(text):
    """Texte brut d'un PDF -> paragraphes / listes simples."""
    text = re.sub(r"-\n(?=[a-z])", "", text)            # mots coupés en fin de ligne
    paras = re.split(r"\n\s*\n|(?<=[.:!?])\n(?=[A-Z●•○■\d])", text)
    out, in_list = [], False
    for p in paras:
        p = re.sub(r"\s*\n\s*", " ", p).strip()
        if not p or re.fullmatch(r"\d+", p):          # numéros de page
            continue
        if p[0] in BULLETS[:5]:
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append("<li>" + esc(p[1:].strip()) + "</li>")
            continue
        if in_list:
            out.append("</ul>")
            in_list = False
        if len(p) < 80 and not p.endswith((".", ",", ";", ":")) and p[0].isupper():
            out.append("<h3>" + esc(p) + "</h3>")
        else:
            out.append("<p>" + esc(p) + "</p>")
    if in_list:
        out.append("</ul>")
    return "\n".join(out)


def slug(t):
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")[:40]


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    book_id = sys.argv[sys.argv.index("--id") + 1] if "--id" in sys.argv else None
    meta, chapters = (pdf_extract if src.lower().endswith(".pdf") else epub_extract)(src)
    short_title = meta["title"].split(":")[0].strip()
    book = {
        "id": book_id or slug(short_title),
        "title": short_title,
        "subtitle": meta["title"][len(short_title):].lstrip(": ").strip(),
        "author": meta["author"],
        "lang": meta["lang"][:2],
        "source": Path(src).suffix.lstrip(".").lower(),
        "chapters": chapters,
    }
    Path(dst).parent.mkdir(parents=True, exist_ok=True)
    Path(dst).write_text(json.dumps(book, ensure_ascii=False, indent=1), encoding="utf-8")
    words = sum(len(re.sub(r"<[^>]+>", " ", c["html"]).split()) for c in chapters)
    print(f"{book['id']}: {len(chapters)} chapitres, {words} mots -> {dst}")


if __name__ == "__main__":
    main()
