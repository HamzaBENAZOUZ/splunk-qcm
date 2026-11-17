// Import d'un fichier de cours PDF ou EPUB dans l'onglet Books : lecture du fichier et découpage en chapitres,
// entièrement sur l'appareil (rien n'est envoyé ailleurs que dans les tables privées de l'utilisateur).
//
//  - EPUB : ordre de lecture (spine) + sommaire du livre (nav EPUB 3 ou toc.ncx EPUB 2) ;
//  - PDF  : signets du fichier (outline) ; à défaut les titres repérés (grande police, « Chapitre 3 »…) ;
//           à défaut des tranches de pages.
// Les bibliothèques (pdf.js, JSZip) sont dans vendor/ et ne sont chargées qu'au moment d'un import :
// elles marchent hors ligne et dans l'application Android, qui les embarque.
const VENDOR = new URL("../vendor/", import.meta.url);
const MAX_CH = 45000;              // au-delà, un chapitre est coupé en parties (lecture et écoute plus confortables)

let pdfjsP = null, zipP = null;
function loadPdfjs() {
  return (pdfjsP ||= import(new URL("pdfjs/pdf.min.mjs", VENDOR).href).then(m => {
    m.GlobalWorkerOptions.workerSrc = new URL("pdfjs/pdf.worker.min.mjs", VENDOR).href;
    return m;
  }).catch(e => { pdfjsP = null; throw e; }));
}
function loadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  return (zipP ||= new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = new URL("jszip/jszip.min.js", VENDOR).href;
    s.onload = () => (window.JSZip ? ok(window.JSZip) : ko(new Error("JSZip")));
    s.onerror = () => { zipP = null; ko(new Error("JSZip")); };
    document.head.appendChild(s);
  }));
}

/* ---------------- outils communs ---------------- */
const norm = s => String(s || "").replace(/[­​﻿]/g, "").replace(/\s+/g, " ").trim();
const escH = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const key = s => norm(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const blocksLen = bs => bs.reduce((a, b) => a + b.x.length, 0);

/** Blocs ({t: h|p|li|pre, x}) → HTML du lecteur Books. */
export function blocksToHtml(blocks) {
  let out = "", inList = false;
  for (const b of blocks) {
    if (b.t === "li" && !inList) { out += "<ul>"; inList = true; }
    if (b.t !== "li" && inList) { out += "</ul>"; inList = false; }
    if (b.t === "h") out += `<h3>${escH(b.x)}</h3>`;
    else if (b.t === "li") out += `<li>${escH(b.x)}</li>`;
    else if (b.t === "pre") out += `<pre><code>${escH(b.x)}</code></pre>`;
    else out += `<p>${escH(b.x)}</p>`;
  }
  return out + (inList ? "</ul>" : "");
}

/** Langue probable du texte (pour la voix) : français ou anglais. */
export function detectLang(text) {
  const w = (String(text).slice(0, 60000).toLowerCase().match(/\p{L}+/gu) || []);
  const FR = new Set("le la les des est une et dans pour que qui avec sur pas du au aux ce cette sont vous nous il elle".split(" "));
  const EN = new Set("the and is of to in that with for on are this be it you as by from or an".split(" "));
  let fr = 0, en = 0;
  for (const x of w) { if (FR.has(x)) fr++; if (EN.has(x)) en++; }
  return fr > en ? "fr" : "en";
}

/** Choisit le niveau du sommaire qui donne des chapitres (les « Parties » sont dépliées, leur titre devient la section). */
function pickLevel(tree, section = null, depth = 0) {
  if (tree.length === 1 && tree[0].children.length && depth < 3) {
    const [p] = tree;
    return [{ ...p, section, children: [] }, ...pickLevel(p.children, section, depth + 1)];
  }
  const out = [];
  for (const e of tree) {
    const expand = e.children.length && depth < 3 && (tree.length < 4 || /^(part(ie)?|unit[ée]?|module|livre|book|tome)\b/i.test(e.title));
    out.push({ ...e, section, children: [] });
    if (expand) for (const c of e.children) out.push({ ...c, section: e.title, children: [] });
  }
  return out;
}

/** Nettoie la liste : titre en double retiré du texte, chapitres vides fusionnés, gros chapitres coupés. */
function finish(chs, t) {
  let list = chs.map(c => {
    const bs = c.blocks.slice();
    while (bs.length && bs[0].t === "h" && (key(bs[0].x) === key(c.title) || key(c.title).endsWith(key(bs[0].x)) || key(bs[0].x).endsWith(key(c.title)))) bs.shift();
    return { ...c, title: norm(c.title).slice(0, 200) || "…", blocks: bs };
  });
  // chapitre presque vide (page de partie, page blanche) : son titre passe en section du suivant
  const kept = [];
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (blocksLen(c.blocks) < 40) { if (list[i + 1] && !list[i + 1].section) list[i + 1].section = c.title; continue; }
    kept.push(c);
  }
  list = kept;
  const out = [];
  for (const c of list) {
    if (blocksLen(c.blocks) <= MAX_CH) { out.push(c); continue; }
    const parts = []; let cur = [], len = 0;
    for (const b of c.blocks) {
      if (len + b.x.length > MAX_CH * 0.8 && cur.length) { parts.push(cur); cur = []; len = 0; }
      cur.push(b); len += b.x.length;
    }
    if (cur.length) parts.push(cur);
    parts.forEach((bs, i) => out.push({ ...c, title: `${c.title} (${t("part")} ${i + 1}/${parts.length})`, blocks: bs }));
  }
  return out.map((c, i) => ({ n: i + 1, title: c.title, section: c.section ? norm(c.section).slice(0, 200) : null, blocks: c.blocks }));
}

/** Petite image (data: URL JPEG, 240 px de large) à partir d'un Blob image ou d'un canvas. */
async function thumb(src) {
  try {
    let img = src;
    if (src instanceof Blob) {
      const url = URL.createObjectURL(src);
      img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
      URL.revokeObjectURL(url);
    }
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    const W = 240, H = Math.round(Math.min(h * W / w, 400));
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, Math.round(h * W / w));
    return c.toDataURL("image/jpeg", 0.75);
  } catch { return null; }
}

/* ---------------- EPUB ---------------- */
const tags = (n, name) => [...n.getElementsByTagNameNS("*", name)];
function joinPath(base, href) {
  const parts = (base ? base.split("/") : []).concat(href.split("/")), out = [];
  for (const p of parts) { if (p === "..") out.pop(); else if (p && p !== ".") out.push(p); }
  return out.join("/");
}
const dirOf = p => p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
function splitHref(from, href) {
  const [p, frag] = String(href || "").split("#");
  let path = p;
  try { path = decodeURIComponent(p); } catch { /* */ }
  return { path: p ? joinPath(dirOf(from), path) : from, frag: frag || "" };
}
function parseXml(s, html = false) {
  let d = new DOMParser().parseFromString(s, html ? "application/xhtml+xml" : "application/xml");
  if (d.getElementsByTagName("parsererror").length) d = new DOMParser().parseFromString(s, "text/html");
  return d;
}

const SKIP = /^(script|style|head|title|svg|math|object|iframe|img|audio|video|noscript|template)$/;
const BLOCKS = /^(p|div|section|article|h[1-6]|li|pre|blockquote|dd|dt|figcaption|td|th|tr|table|tbody|thead|ul|ol|dl|header|footer|aside|figure|nav|main|body|hr|caption|center|address)$/;

/** Parcourt un document XHTML : flux de jetons {a: ancre} et {t, x} (blocs de texte). */
function epubTokens(doc, path, push) {
  push({ a: path });
  const body = doc.body || tags(doc, "body")[0] || doc.documentElement;
  const hasBlock = el => [...el.children].some(c => BLOCKS.test(c.localName.toLowerCase()));
  const anchors = el => {
    if (el.id) push({ a: path + "#" + el.id });
    const nm = el.getAttribute && el.getAttribute("name");
    if (nm && el.localName.toLowerCase() === "a") push({ a: path + "#" + nm });
  };
  const textBlock = (el, t, lv) => {
    anchors(el); el.querySelectorAll && el.querySelectorAll("[id], a[name]").forEach(anchors);
    const x = norm(el.textContent); if (x) push(lv ? { t, x, lv } : { t, x });
  };
  const walk = el => {
    const tag = el.localName.toLowerCase();
    if (SKIP.test(tag)) { anchors(el); return; }
    if (tag === "pre") { anchors(el); const x = (el.textContent || "").replace(/\s+$/, ""); if (x.trim()) push({ t: "pre", x }); return; }
    if (/^h[1-6]$/.test(tag)) return textBlock(el, "h", +tag[1]);
    if (!hasBlock(el)) {
      if (tag === "body" || tag === "section" || tag === "div" || tag === "article" || tag === "li" || tag === "td" || BLOCKS.test(tag) || el === body) return textBlock(el, tag === "li" ? "li" : "p");
      return textBlock(el, "p");
    }
    anchors(el);
    let buf = "";
    const flush = () => { const x = norm(buf); if (x) push({ t: tag === "li" ? "li" : "p", x }); buf = ""; };
    for (const n of el.childNodes) {
      if (n.nodeType === 3) buf += n.nodeValue;
      else if (n.nodeType === 1) {
        if (BLOCKS.test(n.localName.toLowerCase()) || SKIP.test(n.localName.toLowerCase())) { flush(); walk(n); }
        else { n.querySelectorAll && [n, ...n.querySelectorAll("[id], a[name]")].forEach(anchors); buf += n.textContent; }
      }
    }
    flush();
  };
  walk(body);
}

async function parseEpub(file, onStep, t) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const names = Object.keys(zip.files), lower = new Map(names.map(n => [n.toLowerCase(), n]));
  const entry = p => zip.file(p) || zip.file(lower.get(String(p).toLowerCase()) || "\0");
  const read = async p => { const f = entry(p); return f ? f.async("string") : null; };
  const cont = await read("META-INF/container.xml");
  const opfPath = cont && tags(parseXml(cont), "rootfile")[0]?.getAttribute("full-path");
  const opfTxt = opfPath && await read(opfPath);
  if (!opfTxt) throw new Error(t("badEpub"));
  const opf = parseXml(opfTxt);
  const meta = n => norm(tags(opf, n)[0]?.textContent);
  const items = new Map();
  for (const it of tags(opf, "item")) {
    items.set(it.getAttribute("id"), { path: splitHref(opfPath, it.getAttribute("href")).path, type: it.getAttribute("media-type") || "", props: it.getAttribute("properties") || "" });
  }
  const spineEl = tags(opf, "spine")[0];
  const spine = tags(opf, "itemref").map(r => items.get(r.getAttribute("idref"))).filter(x => x && /html|xml/i.test(x.type)).map(x => x.path);
  if (!spine.length) throw new Error(t("badEpub"));

  // Sommaire : nav EPUB 3, sinon toc.ncx EPUB 2
  let tree = [];
  const navItem = [...items.values()].find(x => /\bnav\b/.test(x.props));
  if (navItem) {
    const src = await read(navItem.path);
    if (src) {
      const d = parseXml(src, true), navs = tags(d, "nav");
      const nav = navs.find(n => (n.getAttribute("epub:type") || n.getAttributeNS("http://www.idpf.org/2007/ops", "type") || "").includes("toc")) || navs[0];
      const ol = nav && [...nav.children].find(c => /^(ol|ul)$/i.test(c.localName));
      const rd = list => [...list.children].filter(li => li.localName.toLowerCase() === "li").map(li => {
        const a = [...li.children].find(c => /^(a|span)$/i.test(c.localName));
        const sub = [...li.children].find(c => /^(ol|ul)$/i.test(c.localName));
        const h = a && a.getAttribute("href");
        return { title: norm(a ? a.textContent : li.textContent), ...(h ? splitHref(navItem.path, h) : { path: "", frag: "" }), children: sub ? rd(sub) : [] };
      });
      if (ol) tree = rd(ol);
    }
  }
  if (!tree.length) {
    const ncxItem = items.get(spineEl && spineEl.getAttribute("toc")) || [...items.values()].find(x => /ncx/.test(x.type));
    const src = ncxItem && await read(ncxItem.path);
    if (src) {
      const d = parseXml(src);
      const map = tags(d, "navMap")[0];
      const rd = el => [...el.children].filter(c => c.localName === "navPoint").map(np => ({
        title: norm([...np.children].find(c => c.localName === "navLabel")?.textContent),
        ...splitHref(ncxItem.path, [...np.children].find(c => c.localName === "content")?.getAttribute("src") || ""),
        children: rd(np),
      }));
      if (map) tree = rd(map);
    }
  }
  // Texte de chaque fichier, dans l'ordre de lecture
  const tokens = [];
  for (let i = 0; i < spine.length; i++) {
    onStep && onStep(i + 1, spine.length);
    const src = await read(spine[i]); if (!src) continue;
    epubTokens(parseXml(src, true), spine[i], x => tokens.push(x));
  }
  const fulltext = tokens.filter(x => x.x).map(x => x.x).join(" ");
  if (fulltext.length < 50) throw new Error(t("noText"));

  const modes = {};
  const entries = pickLevel(tree.filter(e => e.title || e.children.length)).filter(e => e.path);
  if (entries.length >= 2) modes.toc = () => {
    const want = new Map();
    entries.forEach((e, i) => { const k = e.frag ? e.path + "#" + e.frag : e.path; if (!want.has(k)) want.set(k, []); want.get(k).push(i); });
    const started = new Set();
    let cur = { title: t("front"), section: null, blocks: [], front: true };
    const chs = [cur];
    for (const tk of tokens) {
      if (tk.a) {
        for (const i of want.get(tk.a) || []) {
          if (started.has(i)) continue;
          started.add(i);
          const e = entries[i];
          if (!cur.blocks.length && !cur.front) { cur.section = cur.section || cur.title; cur.title = e.title; if (e.section) cur.section = e.section; }
          else { cur = { title: e.title, section: e.section, blocks: [] }; chs.push(cur); }
        }
        continue;
      }
      cur.blocks.push({ t: tk.t, x: tk.x });
    }
    if (chs[0].front && blocksLen(chs[0].blocks) < 1500) chs.shift();
    return chs.length >= 2 ? chs : null;
  };
  // Titres du texte (h1, sinon h2…) : utile quand le livre est en un seul fichier sans vrai sommaire
  const hs = tokens.filter(x => x.t === "h");
  const lvl = [1, 2, 3, 4].find(l => { const c = hs.filter(h => h.lv === l).length; return c >= 3 && c <= 600; });
  if (lvl) modes.headings = () => {
    let cur = { title: t("front"), section: null, blocks: [], front: true };
    const chs = [cur];
    for (const tk of tokens) {
      if (tk.a) continue;
      if (tk.t === "h" && tk.lv <= lvl) {
        if (!cur.front && !cur.blocks.length) { cur.section = cur.title; cur.title = tk.x; continue; }
        cur = { title: tk.x, section: null, blocks: [] }; chs.push(cur); continue;
      }
      cur.blocks.push({ t: tk.t, x: tk.x });
    }
    if (blocksLen(chs[0].blocks) < 1500) chs.shift();
    return chs;
  };
  // Un chapitre par fichier du livre, les petits fichiers regroupés avec le suivant
  modes.files = () => {
    const chs = []; let cur = null;
    for (const tk of tokens) {
      if (tk.a && !tk.a.includes("#")) {
        if (!cur || blocksLen(cur.blocks) > 600) { cur = { title: "", section: null, blocks: [] }; chs.push(cur); }
        continue;
      }
      if (tk.a || !cur) continue;
      if (!cur.title && tk.t === "h") cur.title = tk.x;
      cur.blocks.push({ t: tk.t, x: tk.x });
    }
    chs.forEach((c, i) => { if (!c.title) c.title = `${t("section")} ${i + 1}`; });
    return chs;
  };
  const tocN = modes.toc ? (modes.toc() || []).length : 0;
  if (!tocN) delete modes.toc;
  const files = modes.files().length;
  if (modes.headings && files >= modes.headings().length) delete modes.headings;
  const method = modes.toc && (tocN >= 3 || !modes.headings) ? "toc" : modes.headings ? "headings" : "files";
  const split = mode => finish((modes[mode] || modes[method])() || modes.files(), t);

  let cover = null;
  const coverId = tags(opf, "meta").find(m => m.getAttribute("name") === "cover")?.getAttribute("content");
  const cv = [...items.values()].find(x => /cover-image/.test(x.props)) || items.get(coverId)
    || [...items.values()].find(x => /^image\//.test(x.type) && /cover/i.test(x.path));
  if (cv && /^image\//.test(cv.type) && entry(cv.path)) cover = await thumb(new Blob([await entry(cv.path).async("uint8array")], { type: cv.type }));

  const langMeta = meta("language").toLowerCase();
  return {
    kind: "epub", method, modes: Object.keys(modes), split, cover,
    title: meta("title") || file.name.replace(/\.[^.]+$/, ""), author: meta("creator") || "",
    lang: /^fr/.test(langMeta) ? "fr" : /^en/.test(langMeta) ? "en" : detectLang(fulltext),
    chapters: split(method),
  };
}

/* ---------------- PDF ---------------- */
const BULLET = /^[•▪●◦·▸►‣⁃∙]\s*/;
const MEDIAN = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };

/** Lignes d'une page : regroupe les morceaux de texte de pdf.js par position verticale. */
function pageLines(items) {
  const lines = []; let cur = null;
  for (const it of items) {
    if (typeof it.str !== "string") continue;
    const tr = it.transform, x = tr[4], y = tr[5], size = Math.abs(tr[3]) || Math.hypot(tr[2], tr[3]) || it.height || 10;
    if (!it.str.trim()) { if (cur && it.hasEOL) cur.eol = true; else if (cur && it.str) cur.text += " "; continue; }
    if (!cur || cur.eol || Math.abs(y - cur.y) > Math.max(2, Math.min(size, cur.size) * 0.55)) {
      cur = { y, x, xEnd: x + (it.width || 0), size, text: it.str, best: it.str.trim().length, eol: false };
      lines.push(cur);
    } else {
      const gap = x - cur.xEnd;
      if (gap > size * 0.18 && !/\s$/.test(cur.text) && !/^\s/.test(it.str)) cur.text += " ";
      cur.text += it.str; cur.xEnd = Math.max(cur.xEnd, x + (it.width || 0));
      if (it.str.trim().length > cur.best) { cur.best = it.str.trim().length; cur.size = size; }   // taille du plus long morceau
    }
    if (it.hasEOL) cur.eol = true;
  }
  return lines.map(l => ({ ...l, text: norm(l.text) })).filter(l => l.text);
}

async function parsePdf(file, onStep, t) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
  const N = doc.numPages, pages = [];
  for (let i = 1; i <= N; i++) {
    onStep && onStep(i, N);
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    pages.push(pageLines(tc.items));
    page.cleanup();
  }
  // En-têtes et pieds de page répétés, numéros de page : retirés
  const sig = l => l.text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ");
  const cnt = new Map();
  for (const ls of pages) for (const l of new Set([...ls.slice(0, 2), ...ls.slice(-2)].map(sig))) cnt.set(l, (cnt.get(l) || 0) + 1);
  const rep = new Set([...cnt].filter(([, c]) => c >= Math.max(3, N * 0.3)).map(([k]) => k));
  for (let i = 0; i < N; i++) {
    const ls = pages[i];
    pages[i] = ls.filter((l, j) => {
      const edge = j < 2 || j >= ls.length - 2;
      return !(edge && (rep.has(sig(l)) || /^(page\s*)?\d{1,4}(\s*(\/|sur|of)\s*\d{1,4})?$/i.test(l.text)));
    });
  }
  const all = pages.flat();
  const totalChars = all.reduce((a, l) => a + l.text.length, 0);
  if (totalChars < 100) throw new Error(t("noText"));
  // Taille du texte courant (pondérée par le nombre de caractères)
  const sizes = new Map();
  for (const l of all) { const s = Math.round(l.size * 2) / 2; sizes.set(s, (sizes.get(s) || 0) + l.text.length); }
  const body = [...sizes].sort((a, b) => b[1] - a[1])[0][0];
  const HEAD_RX = /^(chapitre|chapter|partie|part|module|le[çc]on|lesson|unit[ée]?|s[ée]ance|section)\s+([\dIVXLC]+|[a-z]+)\b/i;

  // Blocs (titres, paragraphes, puces) avec leur page et leur hauteur sur la page
  const blocks = [];
  for (let p = 0; p < N; p++) {
    const ls = pages[p];
    const gaps = []; for (let j = 1; j < ls.length; j++) { const d = ls[j - 1].y - ls[j].y; if (d > 0 && Math.abs(ls[j].size - body) < 1) gaps.push(d); }
    const lead = MEDIAN(gaps) || body * 1.3;
    const maxEnd = Math.max(...ls.map(l => l.xEnd), 0), minX = Math.min(...ls.map(l => l.x), Infinity);
    let cur = null;
    for (let j = 0; j < ls.length; j++) {
      const l = ls[j], prev = ls[j - 1];
      const big = l.size >= body * 1.18 && l.text.length <= 140;
      const isHead = big || (HEAD_RX.test(l.text) && l.text.length <= 90 && (!prev || prev.y - l.y > lead * 1.3));
      const bullet = BULLET.test(l.text);
      const text = l.text.replace(BULLET, "");
      let fresh = !cur || isHead || cur.t === "h" || bullet;
      if (!fresh && prev) {
        const d = prev.y - l.y;
        if (d > lead * 1.45 || d < -2) fresh = true;
        else if (prev.xEnd < maxEnd - (maxEnd - minX) * 0.15) fresh = true;      // ligne courte : fin de paragraphe ou intertitre
        else if (Math.abs(l.size - prev.size) > 1.5) fresh = true;
      }
      if (isHead && cur && cur.t === "h" && prev && !HEAD_RX.test(l.text) && Math.abs(prev.size - l.size) < 0.6 && prev.y - l.y < l.size * 2.2) {
        cur.x += " " + text; continue;                         // titre sur deux lignes
      }
      if (fresh) {
        cur = { t: isHead ? "h" : bullet ? "li" : "p", x: text, page: p, y: l.y, size: l.size, rx: isHead && HEAD_RX.test(l.text) };
        blocks.push(cur);
      } else {
        cur.x = /\p{L}-$/u.test(cur.x) && /^\p{Ll}/u.test(text) ? cur.x.slice(0, -1) + text : cur.x + " " + text;
      }
    }
  }
  // Paragraphe coupé par un changement de page : recollé
  for (let i = blocks.length - 1; i > 0; i--) {
    const a = blocks[i - 1], b = blocks[i];
    if (b.page === a.page + 1 && a.t === "p" && b.t === "p" && !/[.!?:»”"]$/.test(a.x) && /^\p{Ll}/u.test(b.x) && blocks.findIndex(x => x.page === b.page) === i) {
      a.x = /\p{L}-$/u.test(a.x) ? a.x.slice(0, -1) + b.x : a.x + " " + b.x; blocks.splice(i, 1);
    }
  }
  const fulltext = blocks.map(b => b.x).join(" ");

  // Découpage 1 : signets du PDF
  let outline = [];
  try {
    const ol = await doc.getOutline();
    const rd = async list => {
      const out = [];
      for (const it of list || []) {
        let page = null, y = Infinity;
        try {
          const dest = typeof it.dest === "string" ? await doc.getDestination(it.dest) : it.dest;
          if (Array.isArray(dest) && dest[0] != null) {
            page = typeof dest[0] === "number" ? dest[0] : await doc.getPageIndex(dest[0]);
            if (dest[1] && dest[1].name === "XYZ" && typeof dest[3] === "number") y = dest[3];
            if (dest[1] && /^FitB?H$/.test(dest[1].name || "") && typeof dest[2] === "number") y = dest[2];
          }
        } catch { /* signet sans destination */ }
        out.push({ title: norm(it.title), page, y, children: await rd(it.items) });
      }
      return out;
    };
    outline = await rd(ol);
  } catch { outline = []; }

  // Signet sans position sur la page (« Fit ») : on cherche son titre sur la page pour couper au bon endroit
  const locate = s => {
    if (s.page == null) return s;
    const kt = key(s.title);
    if (kt.length < 3) return s;
    const hit = blocks.find(b => (b.page === s.page || b.page === s.page + 1) && b.x.length < 200 && (key(b.x) === kt || key(b.x).includes(kt) || kt.includes(key(b.x)) && key(b.x).length > 3));
    if (!hit) return s;
    const title = key(hit.x) === kt ? hit.x : s.title;       // le texte de la page a les bons espaces
    return s.y === Infinity ? { ...s, page: hit.page, y: hit.y + 1, title } : { ...s, title };
  };
  const fromStarts = starts => {
    // starts : [{title, section, page, y}] triés ; chaque bloc va au dernier début qui le précède
    starts = starts.filter(s => s.page != null && s.page >= 0 && s.page < N)
      .sort((a, b) => a.page - b.page || b.y - a.y);
    if (starts.length < 2) return null;
    const chs = [{ title: t("front"), section: null, blocks: [], front: true }, ...starts.map(s => ({ title: s.title, section: s.section, blocks: [] }))];
    let k = 0;
    for (const b of blocks) {
      while (k < starts.length && (starts[k].page < b.page || (starts[k].page === b.page && starts[k].y >= b.y - 2))) k++;
      chs[k].blocks.push(b);
    }
    if (blocksLen(chs[0].blocks) < 1500) chs.shift();
    return chs;
  };
  const modes = {};
  const flat = pickLevel(outline.filter(e => e.title));
  if (flat.filter(e => e.page != null).length >= 2) modes.outline = () => fromStarts(flat.map(e => locate({ ...e })));
  // Découpage 2 : titres repérés dans le texte
  const heads = blocks.filter(b => b.t === "h");
  if (heads.length) {
    const lv = [...new Set(heads.map(h => Math.round(h.size * 2) / 2))].sort((a, b) => b - a);
    let pickSz = null;
    for (const s of lv) {
      const c = heads.filter(h => h.size >= s - 0.25).length;
      if (c >= 3 && c <= Math.max(6, N * 1.2)) { pickSz = s; break; }
    }
    const rxHeads = heads.filter(h => h.rx);
    const chosen = rxHeads.length >= 3 ? rxHeads : pickSz != null ? heads.filter(h => h.size >= pickSz - 0.25) : [];
    if (chosen.length >= 3) modes.headings = () => fromStarts(chosen.map(h => ({ title: h.x, section: null, page: h.page, y: h.y + 1 })));
  }
  // Découpage 3 : tranches de pages
  const byPages = step => () => {
    const starts = [];
    for (let p = 0; p < N; p += step) starts.push({ title: `${t("pages")} ${p + 1}–${Math.min(N, p + step)}`, section: null, page: p, y: Infinity });
    const chs = starts.map(s => ({ title: s.title, section: null, blocks: [] }));
    for (const b of blocks) chs[Math.min(chs.length - 1, Math.floor(b.page / step))].blocks.push(b);
    return chs;
  };
  modes.pages10 = byPages(10);
  modes.pages20 = byPages(20);
  modes.pages5 = byPages(5);

  let cover = null;
  try {
    const p1 = await doc.getPage(1), vp0 = p1.getViewport({ scale: 1 });
    const vp = p1.getViewport({ scale: 360 / vp0.width });
    const c = document.createElement("canvas"); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    await p1.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    cover = await thumb(c);
  } catch { /* pas de couverture */ }
  let info = {};
  try { info = (await doc.getMetadata()).info || {}; } catch { /* */ }
  doc.destroy();

  const split = mode => {
    const r = (modes[mode] && modes[mode]()) || modes.pages10();
    return finish(r.map(c => ({ ...c, blocks: c.blocks.map(({ t: tt, x }) => ({ t: tt, x })) })), t);
  };
  const method = modes.outline ? "outline" : modes.headings ? "headings" : "pages10";
  const title = norm(info.Title);
  return {
    kind: "pdf", method, modes: Object.keys(modes), split, cover,
    title: title && !/^(untitled|sans titre|microsoft word|document\d*$|\(?anonymous\)?$)/i.test(title) && !/\.(docx?|pdf|pptx?)$/i.test(title) ? title : file.name.replace(/\.[^.]+$/, ""),
    author: /^\(?anonymous\)?$|^unknown$/i.test(norm(info.Author)) ? "" : norm(info.Author), lang: detectLang(fulltext), chapters: split(method),
  };
}

/** Lit un fichier PDF ou EPUB et le découpe en chapitres. t : textes de l'interface (badEpub, noText, front, part, pages, section). */
export async function parseDocument(file, onStep, t) {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;   // %PDF
  const isZip = head[0] === 0x50 && head[1] === 0x4b;                                             // PK
  if (isPdf) return parsePdf(file, onStep, t);
  if (isZip) return parseEpub(file, onStep, t);
  throw new Error(t("badType"));
}
