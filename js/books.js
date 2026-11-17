// Onglet « Books » : les livres de l'utilisateur, à lire chapitre par chapitre en anglais ou en français,
// à écouter (synthèse vocale paragraphe par paragraphe) et à réviser avec un quiz à la fin de chaque chapitre.
//
// Le contenu des livres n'est PAS dans ce dépôt public : il est dans Supabase (tables splunk_books et
// splunk_book_chapters, lisibles uniquement par leur propriétaire) ou, en mode local, dans private/books/
// (dossier ignoré par git). Les chapitres ouverts sont gardés dans IndexedDB pour la lecture hors ligne
// et effacés à la déconnexion. La progression (chapitres lus, meilleur score aux quiz) est gardée sur
// l'appareil et synchronisée avec la table splunk_book_progress.
import { idbGet, idbSet, isNetErr, withTimeout } from "./offline.js";
import * as src from "./doc-files.js";

const T_BOOKS = "splunk_books", T_CH = "splunk_book_chapters", T_PROG = "splunk_book_progress";
const PKEY = "splunk-books-v1", PREF = "splunk-books-prefs", DL = "splunk-books-dl:";
const RATES = [0.8, 0.9, 1, 1.15, 1.3, 1.5];

const L = {
  fr: {
    lib: "Bibliothèque", libSub: "Tes livres : lecture, écoute et quiz à la fin de chaque chapitre.",
    empty: "Aucun livre pour l'instant.", notReady: "La bibliothèque n'est pas encore activée sur ton compte (tables Supabase manquantes).",
    loadErr: "Impossible de charger les livres", offlineNo: "Hors ligne : ce contenu n'a pas encore été téléchargé sur cet appareil.",
    chapters: "chapitres", chapter: "Chapitre", read: "lus", quizAvg: "moyenne aux quiz", start: "Commencer la lecture", cont: "Continuer",
    dl: "Télécharger pour lire hors ligne", dlBusy: "Téléchargement…", dlDone: "Disponible hors ligne", dlOk: "Livre téléchargé sur cet appareil",
    back: "Retour", toc: "Sommaire", listen: "Écouter le chapitre", resume: "Reprendre l'écoute", content: "Langue du texte",
    notes: "Note de vérification", notesSub: "Points du livre corrigés ou précisés d'après la documentation Splunk.",
    quiz: "Quiz du chapitre", quizRetry: "Refaire le quiz", markRead: "Marquer comme lu", isRead: "Lu",
    prev: "Chapitre précédent", next: "Chapitre suivant", backCh: "Revenir au chapitre", best: "Meilleur score",
    score: "Ton score", qOf: "Question {i} sur {n}", correct: "Bonne réponse", wrong: "Mauvaise réponse", finish: "Voir mon score",
    perfect: "Parfait !", good: "Bien joué.", again: "À revoir : relis le chapitre puis retente le quiz.",
    play: "Lecture", pause: "Pause", prevP: "Paragraphe précédent", nextP: "Paragraphe suivant", speed: "Vitesse", close: "Fermer le lecteur",
    noVoice: "La lecture à voix haute n'est pas disponible sur ce navigateur.", noVoiceFr: "Pas de voix française disponible ici : lecture en anglais.",
    link: "lien", tapHint: "Touchez un paragraphe pour l'écouter à partir de là.", font: "Taille du texte", listenQ: "Écouter",
    synced: "Progression synchronisée", by: "par",
    imp: "Ajouter un livre (.book.json)", impBusy: "Import… {i}/{n} chapitres", impOk: "Livre « {t} » ajouté à ta bibliothèque",
    badFile: "Ce fichier n'est pas un livre préparé pour l'appli (.book.json).",
    up: "Importer un cours (PDF ou EPUB)", upHint: "Le fichier est découpé en chapitres sur cet appareil, puis le texte est enregistré dans ton compte (privé).",
    upRead: "Lecture du fichier… page {i}/{n}", upReadE: "Lecture du fichier… {i}/{n}", upLoad: "Chargement du lecteur PDF / EPUB…",
    upTitle: "Vérifie le découpage", upName: "Titre", upAuthor: "Auteur", upVoice: "Langue de la voix", upSplit: "Découpage",
    upSave: "Enregistrer dans ma bibliothèque", upCancel: "Annuler", upSaving: "Enregistrement… {i}/{n} chapitres", upOk: "« {t} » est dans ta bibliothèque",
    m_toc: "sommaire du livre", m_files: "un chapitre par fichier du livre (pas de sommaire)", m_outline: "signets du PDF",
    m_headings: "titres repérés dans le texte", m_pages5: "toutes les 5 pages", m_pages10: "toutes les 10 pages", m_pages20: "toutes les 20 pages",
    min: "min", upNote: "Les images et tableaux complexes ne sont pas repris : seul le texte est gardé.",
    badType: "Ce fichier n'est ni un PDF ni un EPUB.", badEpub: "Cet EPUB est illisible ou abîmé.",
    noText: "Aucun texte trouvé : c'est sans doute un PDF scanné (des images de pages), qui ne peut pas être lu à voix haute.",
    front: "Début du document", part: "partie", pages: "Pages", section: "Section",
    imported: "Importé", srcFile: "Fichier d'origine", srcApp: "copie gardée dans l'appli", srcHandle: "lien vers le fichier sur ce PC",
    srcCopy: "copie gardée dans ce navigateur", srcNone: "pas sur cet appareil", resplit: "Redécouper le fichier",
    srcGone: "Le fichier d'origine n'est plus disponible ici (déplacé, renommé ou importé depuis un autre appareil). Choisis-le à nouveau.",
    del: "Supprimer ce livre", delSure: "Confirmer la suppression", delOk: "Livre supprimé", voice: "Voix",
  },
  en: {
    lib: "Library", libSub: "Your books: read, listen and take a quiz at the end of every chapter.",
    empty: "No books yet.", notReady: "The library is not enabled on your account yet (Supabase tables missing).",
    loadErr: "Could not load the books", offlineNo: "Offline: this content has not been downloaded to this device yet.",
    chapters: "chapters", chapter: "Chapter", read: "read", quizAvg: "quiz average", start: "Start reading", cont: "Continue",
    dl: "Download to read offline", dlBusy: "Downloading…", dlDone: "Available offline", dlOk: "Book downloaded to this device",
    back: "Back", toc: "Contents", listen: "Listen to the chapter", resume: "Resume listening", content: "Text language",
    notes: "Fact-check note", notesSub: "Points from the book corrected or clarified against the Splunk documentation.",
    quiz: "Chapter quiz", quizRetry: "Retake the quiz", markRead: "Mark as read", isRead: "Read",
    prev: "Previous chapter", next: "Next chapter", backCh: "Back to the chapter", best: "Best score",
    score: "Your score", qOf: "Question {i} of {n}", correct: "Correct", wrong: "Wrong answer", finish: "See my score",
    perfect: "Perfect!", good: "Well done.", again: "Worth another look: reread the chapter and retake the quiz.",
    play: "Play", pause: "Pause", prevP: "Previous paragraph", nextP: "Next paragraph", speed: "Speed", close: "Close the player",
    noVoice: "Text-to-speech is not available in this browser.", noVoiceFr: "No French voice here: reading in English.",
    link: "link", tapHint: "Tap a paragraph to listen from there.", font: "Text size", listenQ: "Listen",
    synced: "Progress synced", by: "by",
    imp: "Add a book (.book.json)", impBusy: "Importing… {i}/{n} chapters", impOk: "“{t}” added to your library",
    badFile: "This file is not a book prepared for the app (.book.json).",
    up: "Import a course (PDF or EPUB)", upHint: "The file is split into chapters on this device, then the text is saved to your (private) account.",
    upRead: "Reading the file… page {i}/{n}", upReadE: "Reading the file… {i}/{n}", upLoad: "Loading the PDF / EPUB reader…",
    upTitle: "Check the chapters", upName: "Title", upAuthor: "Author", upVoice: "Voice language", upSplit: "Split by",
    upSave: "Save to my library", upCancel: "Cancel", upSaving: "Saving… {i}/{n} chapters", upOk: "“{t}” is in your library",
    m_toc: "the book's table of contents", m_files: "one chapter per file in the book (no table of contents)", m_outline: "PDF bookmarks",
    m_headings: "headings found in the text", m_pages5: "every 5 pages", m_pages10: "every 10 pages", m_pages20: "every 20 pages",
    min: "min", upNote: "Images and complex tables are left out: only the text is kept.",
    badType: "This file is neither a PDF nor an EPUB.", badEpub: "This EPUB is unreadable or damaged.",
    noText: "No text found: this is probably a scanned PDF (page images), which cannot be read aloud.",
    front: "Start of the document", part: "part", pages: "Pages", section: "Section",
    imported: "Imported", srcFile: "Original file", srcApp: "copy kept in the app", srcHandle: "link to the file on this PC",
    srcCopy: "copy kept in this browser", srcNone: "not on this device", resplit: "Split the file again",
    srcGone: "The original file is no longer available here (moved, renamed or imported from another device). Pick it again.",
    del: "Delete this book", delSure: "Confirm deletion", delOk: "Book deleted", voice: "Voice",
  },
};

const rdj = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const wrj = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };

export function createBooks({ store, getLang, esc, toast, userId, tts }) {
  let P = rdj(PKEY) || {};
  P.books ||= {}; P.last ||= {}; P.pos ||= {}; P.dirty ||= {};
  const prefs = { lang: null, rate: 1, font: 1, ...(rdj(PREF) || {}) };
  let lib = null;                 // liste des livres (sommaires)
  const full = new Map();         // mode local : livre complet par id
  const mem = new Map();          // chapitres déjà chargés (id|n)
  let root = null, pushTimer = null, busy = false;
  let player = null;              // { segs, i, playing, token, lang }
  let quizState = null;
  let draft = null;               // import PDF / EPUB en cours de vérification

  const uiLang = () => (getLang() === "en" ? "en" : "fr");
  const t = (k, v) => { let s = L[uiLang()][k] ?? k; if (v) for (const x in v) s = s.replace(`{${x}}`, v[x]); return s; };
  const cLang = () => (prefs.lang === "en" || prefs.lang === "fr" ? prefs.lang : uiLang());
  const savePrefs = () => wrj(PREF, prefs);
  const remote = () => store && store.kind === "supabase" && store.sb && userId();
  const pick = (o, k, lang = cLang()) => (lang === "fr" && o[k + "_fr"]) || o[k] || "";
  // Livre importé depuis un PDF / EPUB : source « upload:pdf:fr » (type de fichier, langue du texte)
  const upl = b => { const m = /^upload:(\w+):(\w+)/.exec((b && b.source) || ""); return m ? { kind: m[1], lang: m[2] } : null; };
  const voiceOf = b => (prefs.voice && prefs.voice[b.id]) || upl(b).lang;

  /* ---------------- données ---------------- */
  async function fetchLocal() {
    const r = await fetch("private/books/index.json", { cache: "no-store" });
    if (!r.ok) return [];
    const ids = await r.json(), out = [];
    for (const id of ids) {
      const r2 = await fetch(`private/books/${encodeURIComponent(id)}.book.json`, { cache: "no-store" });
      if (!r2.ok) continue;
      const b = await r2.json(); full.set(b.id, b);
      out.push({ ...b, version: "local", chapters: b.chapters.map(({ n, section, section_fr, title, title_fr }) => ({ n, section, section_fr, title, title_fr })) });
    }
    return out;
  }
  async function loadLib(force = false) {
    if (lib && !force) return lib;
    if (store.kind !== "supabase") return (lib = await fetchLocal());
    if (!store.offline) {
      try {
        const { data, error } = await withTimeout(store.sb.from(T_BOOKS)
          .select("id,title,title_fr,subtitle,subtitle_fr,author,source,cover,position,toc,updated_at").order("position"), 15000);
        if (error) throw error;
        lib = (data || []).map(({ toc, ...b }) => ({ ...b, chapters: toc || [], version: b.updated_at }));
        idbSet("books:lib", lib).catch(() => {});
        return lib;
      } catch (e) {
        if (!isNetErr(e)) throw e;
      }
    }
    const c = await idbGet("books:lib");
    if (!c) throw Object.assign(new Error(t("offlineNo")), { offline: true });
    return (lib = c);
  }
  const book = id => (lib || []).find(b => b.id === id);
  async function loadChapter(b, n) {
    const key = b.id + "|" + n;
    if (mem.has(key)) return mem.get(key);
    if (full.has(b.id)) { const c = full.get(b.id).chapters.find(x => x.n === n); mem.set(key, c); return c; }
    const cached = await idbGet("book:" + key);
    if (cached && cached.v === b.version) { mem.set(key, cached.ch); return cached.ch; }
    if (!store.offline) {
      try {
        const { data, error } = await withTimeout(store.sb.from(T_CH).select("*").eq("book_id", b.id).eq("n", n).maybeSingle(), 20000);
        if (error) throw error;
        if (data) { mem.set(key, data); idbSet("book:" + key, { v: b.version, ch: data }).catch(() => {}); return data; }
      } catch (e) { if (!isNetErr(e)) throw e; }
    }
    if (cached) { mem.set(key, cached.ch); return cached.ch; }
    throw Object.assign(new Error(t("offlineNo")), { offline: true });
  }
  async function downloadBook(b) {
    if (full.has(b.id)) return;
    const { data, error } = await store.sb.from(T_CH).select("*").eq("book_id", b.id).order("n");
    if (error) throw error;
    for (const ch of data) { mem.set(b.id + "|" + ch.n, ch); await idbSet("book:" + b.id + "|" + ch.n, { v: b.version, ch }); }
    wrj(DL + b.id, b.version);
  }
  const downloaded = b => full.has(b.id) || rdj(DL + b.id) === b.version;

  /** Ajoute (ou met à jour) un livre dans le compte à partir d'un fichier .book.json préparé par tools/book_build.py. */
  async function importBook(file, onStep) {
    const b = JSON.parse(await file.text());
    if (!b || typeof b.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(b.id) || !Array.isArray(b.chapters) || !b.chapters.length || !b.title)
      throw new Error(t("badFile"));
    for (const c of b.chapters) if (!Number.isInteger(c.n) || !c.title || !c.html_en) throw new Error(t("badFile"));
    return uploadBook(b, onStep);
  }
  /** Enregistre un livre complet (fiche + chapitres) dans les tables privées de l'utilisateur. */
  async function uploadBook(b, onStep) {
    const toc = b.chapters.map(({ n, section, section_fr, title, title_fr }) => ({ n, section, section_fr, title, title_fr }));
    const row = { id: b.id, title: b.title, title_fr: b.title_fr || null, subtitle: b.subtitle || null, subtitle_fr: b.subtitle_fr || null,
      author: b.author || null, source: b.source || null, cover: b.cover || null, toc, updated_at: new Date().toISOString() };
    if (b.position != null) row.position = b.position;
    const { error } = await store.sb.from(T_BOOKS).upsert(row, { onConflict: "id" });
    if (error) throw error;
    const rows = b.chapters.map(c => ({ book_id: b.id, n: c.n, section: c.section || null, section_fr: c.section_fr || null, title: c.title,
      title_fr: c.title_fr || null, html_en: c.html_en, html_fr: c.html_fr || null, quiz: c.quiz || [], notes: c.notes || null }));
    for (let i = 0; i < rows.length; i += 6) {
      onStep && onStep(Math.min(i + 6, rows.length), rows.length);
      const r = await store.sb.from(T_CH).upsert(rows.slice(i, i + 6), { onConflict: "book_id,n" });
      if (r.error) throw r.error;
    }
    const keep = new Set(b.chapters.map(c => c.n));
    const old = await store.sb.from(T_CH).select("n").eq("book_id", b.id);
    const gone = (old.data || []).map(x => x.n).filter(n => !keep.has(n));
    if (gone.length) await store.sb.from(T_CH).delete().eq("book_id", b.id).in("n", gone);
    lib = null; mem.clear();
    return b;
  }
  /** Supprime un livre importé (fiche, chapitres et progression en cascade) et son fichier d'origine gardé ici. */
  async function deleteBook(b) {
    const { error } = await store.sb.from(T_BOOKS).delete().eq("id", b.id);
    if (error) throw error;
    await src.remove(userId(), b.id);
    delete P.books[b.id]; delete P.last[b.id];
    for (const k of Object.keys(P.pos)) if (k.startsWith(b.id + "|")) delete P.pos[k];
    for (const k of Object.keys(P.dirty)) if (k.startsWith(b.id + "|")) delete P.dirty[k];
    wrj(PKEY, P); wrj(DL + b.id, null);
    lib = null; mem.clear();
  }

  /* ---------------- progression ---------------- */
  const rec = (id, n) => ((P.books[id] ||= {})[n] ||= {});
  function saveP(id, n) {
    if (id != null) P.dirty[id + "|" + n] = 1;
    wrj(PKEY, P);
    if (!remote()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => push().catch(e => console.warn("books push", e)), 800);
  }
  async function push() {
    if (!remote() || busy || navigator.onLine === false) return;
    const keys = Object.keys(P.dirty); if (!keys.length) return;
    busy = true;
    try {
      const now = new Date().toISOString();
      const rows = keys.map(k => {
        const i = k.lastIndexOf("|"), id = k.slice(0, i), n = +k.slice(i + 1), r = rec(id, n);
        return { user_id: userId(), book_id: id, n, read_at: r.r ? new Date(r.r).toISOString() : null, best: r.b ?? null, total: r.t ?? null, updated_at: now };
      });
      const { error } = await store.sb.from(T_PROG).upsert(rows, { onConflict: "user_id,book_id,n" });
      if (error) throw error;
      keys.forEach(k => delete P.dirty[k]); wrj(PKEY, P);
    } finally { busy = false; }
  }
  async function sync() {
    if (!remote() || store.offline || navigator.onLine === false) return;
    try {
      const { data, error } = await store.sb.from(T_PROG).select("book_id,n,read_at,best,total");
      if (error) throw error;
      const seen = new Set();
      for (const row of data || []) {
        const r = rec(row.book_id, row.n), k = row.book_id + "|" + row.n; seen.add(k);
        const rAt = row.read_at ? Date.parse(row.read_at) : 0;
        if (rAt && !r.r) r.r = rAt;
        if (row.best != null && (r.b == null || row.best > r.b)) { r.b = row.best; r.t = row.total; }
        if ((r.r && !rAt) || (r.b != null && (row.best == null || r.b > row.best))) P.dirty[k] = 1;
      }
      for (const id in P.books) for (const n in P.books[id]) if (!seen.has(id + "|" + n)) P.dirty[id + "|" + n] = 1;
      wrj(PKEY, P);
      await push();
      if (root && root.isConnected && root.querySelector(".bk-lib, .bk-book")) render(root, location.hash);
    } catch (e) { console.warn("books sync", e); }
  }
  function forget() {
    stop(); wrj(PKEY, null); P = { books: {}, last: {}, pos: {}, dirty: {} };
    try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith(DL)) localStorage.removeItem(k); } } catch { /* */ }
    lib = null; mem.clear(); full.clear();
  }
  addEventListener("online", () => push().catch(() => {}));

  function stats(b) {
    const pr = P.books[b.id] || {}; let read = 0, sum = 0, cnt = 0;
    for (const c of b.chapters) { const r = pr[c.n]; if (!r) continue; if (r.r) read++; if (r.b != null && r.t) { sum += r.b / r.t; cnt++; } }
    return { read, total: b.chapters.length, avg: cnt ? Math.round((sum / cnt) * 100) : null };
  }
  const nextChapter = b => {
    const last = P.last[b.id];
    if (last && b.chapters.some(c => c.n === last)) return last;
    const pr = P.books[b.id] || {};
    return (b.chapters.find(c => !(pr[c.n] && pr[c.n].r)) || b.chapters[0]).n;
  };

  /* ---------------- rendu ---------------- */
  async function render(el, hash = location.hash) {
    root = el;
    const parts = hash.replace(/^#\/?/, "").split("/").slice(1).map(decodeURIComponent);
    const [id, nStr, sub] = parts;
    if (!(id && nStr)) stop();
    root.innerHTML = `<div class="boot"><p class="mono">&gt; books<span class="cursor">_</span></p></div>`;
    try {
      await loadLib();
      if (!id) return renderLib();
      const b = book(id);
      if (!b) { location.hash = "#/books"; return; }
      if (!nStr) return renderBook(b);
      const n = +nStr;
      if (!b.chapters.some(c => c.n === n)) { location.hash = "#/books/" + encodeURIComponent(b.id); return; }
      const ch = await loadChapter(b, n);
      if (sub === "quiz") return renderQuiz(b, ch);
      return renderChapter(b, ch);
    } catch (e) {
      console.error(e);
      const missing = /PGRST205|42P01|does not exist|schema cache/i.test((e && (e.code || "") + " " + (e.message || "")) || "");
      root.innerHTML = `<section class="panel error-panel"><h2 class="mono">${esc(t("loadErr"))}</h2>
        <p>${esc(missing ? t("notReady") : e.message || String(e))}</p>
        ${id ? `<p><a class="btn btn-ghost btn-sm" href="#/books">← ${esc(t("lib"))}</a></p>` : ""}</section>`;
    }
  }

  const ring = (p, label) => `<div class="sv-ring bk-ring" style="--p:${Math.round(p * 100)}"><span class="mono">${esc(label)}</span></div>`;
  const coverImg = (b, cls = "bk-cover") => b.cover
    ? `<img class="${cls}" src="${esc(b.cover)}" alt="" loading="lazy">`
    : `<div class="${cls} bk-cover-ph mono" aria-hidden="true">${esc((b.title || "?").slice(0, 1))}</div>`;

  function renderLib() {
    const books = lib || [];
    root.innerHTML = `<div class="bk-lib">
      <header class="bk-head"><div><p class="kicker mono">// books</p><h1>${esc(t("lib"))}</h1><p class="muted bk-sub">${esc(t("libSub"))}</p></div></header>
      ${books.length ? `<div class="bk-grid">${books.map(b => {
        const s = stats(b), n = nextChapter(b), p = s.total ? s.read / s.total : 0;
        return `<article class="panel bk-card">
          <a class="bk-card-link" href="#/books/${encodeURIComponent(b.id)}">${coverImg(b)}</a>
          <div class="bk-card-body">
            <h2><a href="#/books/${encodeURIComponent(b.id)}">${esc(pick(b, "title", uiLang()))}</a></h2>
            ${b.author ? `<p class="muted bk-author">${esc(t("by"))} ${esc(b.author)}</p>` : ""}
            ${upl(b) ? `<p class="bk-badge mono">${esc(upl(b).kind.toUpperCase())} · ${esc(t("imported"))}</p>` : ""}
            <div class="bar bk-bar"><span style="width:${Math.round(p * 100)}%"></span></div>
            <p class="muted mono bk-meta">${s.read}/${s.total} ${esc(t("chapters"))} ${esc(t("read"))}${s.avg != null ? ` · ${s.avg} % ${esc(t("quizAvg"))}` : ""}</p>
            <a class="btn btn-primary btn-sm" href="#/books/${encodeURIComponent(b.id)}/${n}">${esc(s.read || P.last[b.id] ? t("cont") : t("start"))} · ${esc(t("chapter"))} ${n}</a>
          </div></article>`;
      }).join("")}</div>` : `<section class="panel"><p class="muted">${esc(t("empty"))}</p></section>`}
      ${store.kind === "supabase" && !store.offline ? `<section class="panel bk-up-cta">
        <div><h2>📄 ${esc(t("up"))}</h2><p class="muted">${esc(t("upHint"))}</p></div>
        <button class="btn btn-primary" id="bk-up">${esc(t("up"))}</button>
        <input type="file" id="bk-up-inp" accept="${src.ACCEPT}" hidden></section>` : ""}
      ${store.kind === "supabase" && !store.offline ? `<p class="bk-imp"><label class="btn btn-ghost btn-sm">📚 ${esc(t("imp"))}
        <input type="file" id="bk-imp" accept=".json,application/json" hidden></label></p>` : ""}
    </div>`;
    const upBtn = root.querySelector("#bk-up");
    if (upBtn) upBtn.onclick = () => startUpload(root.querySelector("#bk-up-inp")).catch(e => { console.error(e); toast(e.message || String(e), "err"); });
    const inp = root.querySelector("#bk-imp");
    if (inp) inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const lab = inp.parentElement; lab.classList.add("disabled");
      try {
        const b = await importBook(f, (i, n) => { lab.firstChild.textContent = "⏳ " + t("impBusy", { i, n }) + " "; });
        toast(t("impOk", { t: b.title_fr && uiLang() === "fr" ? b.title_fr : b.title }), "ok");
        await loadLib(true);
      } catch (e) { console.error(e); toast(e.message || String(e), "err"); }
      renderLib();
    };
  }

  function renderBook(b) {
    const s = stats(b), n = nextChapter(b), pr = P.books[b.id] || {}, ul = uiLang();
    const groups = [];
    for (const c of b.chapters) {
      const sec = pick(c, "section", ul) || "";
      if (!groups.length || groups[groups.length - 1].sec !== sec) groups.push({ sec, list: [] });
      groups[groups.length - 1].list.push(c);
    }
    const canDl = store.kind === "supabase" && !store.offline;
    root.innerHTML = `<div class="bk-book">
      <p class="bk-crumbs mono"><a href="#/books">← ${esc(t("lib"))}</a></p>
      <header class="panel bk-hero">
        ${coverImg(b, "bk-cover bk-cover-lg")}
        <div class="bk-hero-body">
          <h1>${esc(pick(b, "title", ul))}</h1>
          ${pick(b, "subtitle", ul) ? `<p class="muted bk-sub">${esc(pick(b, "subtitle", ul))}</p>` : ""}
          ${b.author ? `<p class="muted bk-author">${esc(t("by"))} ${esc(b.author)}</p>` : ""}
          <div class="bk-hero-stats">${ring(s.total ? s.read / s.total : 0, Math.round(s.total ? (s.read / s.total) * 100 : 0) + "%")}
            <div class="mono"><strong>${s.read}/${s.total}</strong> ${esc(t("chapters"))} ${esc(t("read"))}${s.avg != null ? `<br><strong>${s.avg} %</strong> ${esc(t("quizAvg"))}` : ""}</div></div>
          <div class="row bk-hero-acts">
            <a class="btn btn-primary" href="#/books/${encodeURIComponent(b.id)}/${n}">${esc(s.read || P.last[b.id] ? t("cont") : t("start"))} · ${esc(t("chapter"))} ${n}</a>
            ${store.kind === "supabase" ? (downloaded(b)
              ? `<span class="bk-dl-ok mono">✓ ${esc(t("dlDone"))}</span>`
              : `<button class="btn btn-ghost btn-sm" id="bk-dl" ${canDl ? "" : "disabled"}>📥 ${esc(t("dl"))}</button>`) : ""}
          </div>
          ${upl(b) ? `<div class="bk-src">
            <p class="muted mono bk-src-info">${esc(upl(b).kind.toUpperCase())} · ${esc(t("srcFile"))} : <span id="bk-src-name">…</span></p>
            ${canDl ? `<div class="row"><button class="btn btn-ghost btn-sm" id="bk-resplit">✂ ${esc(t("resplit"))}</button>
              <button class="btn btn-ghost btn-sm bk-del" id="bk-del">🗑 ${esc(t("del"))}</button>
              <input type="file" id="bk-up-inp" accept="${src.ACCEPT}" hidden></div>` : ""}
          </div>` : ""}
        </div>
      </header>
      <h2 class="bk-toc-title mono">${esc(t("toc"))}</h2>
      ${groups.map(g => `<section class="bk-sec">
        ${g.sec ? `<h3 class="bk-sec-title">${esc(g.sec)}</h3>` : ""}
        <ol class="bk-toc">${g.list.map(c => {
          const r = pr[c.n] || {};
          return `<li><a href="#/books/${encodeURIComponent(b.id)}/${c.n}" class="bk-toc-row${r.r ? " done" : ""}${c.n === n ? " cur" : ""}">
            <span class="bk-num mono">${c.n}</span><span class="bk-toc-t">${esc(pick(c, "title", ul))}</span>
            <span class="bk-toc-s mono">${r.b != null ? `<span class="bk-score${r.b === r.t ? " full" : ""}">${r.b}/${r.t}</span>` : ""}${r.r ? `<span class="bk-check" title="${esc(t("isRead"))}">✓</span>` : ""}</span>
          </a></li>`;
        }).join("")}</ol></section>`).join("")}
    </div>`;
    const dl = root.querySelector("#bk-dl");
    if (dl) dl.onclick = async () => {
      dl.disabled = true; dl.textContent = t("dlBusy");
      try { await downloadBook(b); toast(t("dlOk"), "ok"); } catch (e) { console.error(e); toast(e.message || String(e), "err"); }
      renderBook(b);
    };
    if (upl(b)) bookSource(b);
  }

  /* ---------------- import d'un cours PDF / EPUB ---------------- */
  /** Fichier d'origine d'un livre importé : où il est gardé, redécoupage, suppression du livre. */
  async function bookSource(b) {
    const uid = userId(), r = await src.info(uid, b.id);
    const nm = root.querySelector("#bk-src-name"); if (!nm) return;
    nm.textContent = r ? `${r.name} (${t({ app: "srcApp", handle: "srcHandle", copy: "srcCopy" }[r.kind] || "srcNone")})` : t("srcNone");
    let known = !!r;
    const rs = root.querySelector("#bk-resplit"), inp = root.querySelector("#bk-up-inp");
    if (rs) rs.onclick = async () => {
      try {
        if (!known) return await startUpload(inp, b);
        let file;
        try { file = await src.open(uid, b.id); }
        catch (e) { if (e.code !== "gone") throw e; known = false; nm.textContent = t("srcNone"); toast(t("srcGone"), "warn"); return; }
        await startUpload(inp, b, { file, keep: null });
      } catch (e) { console.error(e); toast(e.message || String(e), "err"); }
    };
    const del = root.querySelector("#bk-del");
    if (del) del.onclick = async () => {
      if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = "⚠ " + t("delSure"); return; }
      del.disabled = true;
      try { await deleteBook(b); toast(t("delOk"), "ok"); location.hash = "#/books"; }
      catch (e) { console.error(e); toast(e.message || String(e), "err"); del.disabled = false; }
    };
  }

  const slug = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "cours";
  const minutes = c => Math.max(1, Math.round(c.blocks.reduce((a, x) => a + x.x.length, 0) / 1000));

  /** Choix du fichier, lecture et découpage (sur l'appareil), puis écran de vérification. replace : livre à redécouper. */
  async function startUpload(input, replace = null, given = null) {
    const picked = given || await src.pickFile(input);
    if (!picked) return;
    stop();
    root.innerHTML = `<div class="bk-up"><section class="panel bk-up-busy">
      <p class="mono" id="bk-up-msg">⏳ ${esc(t("upLoad"))}</p><div class="bar"><span id="bk-up-bar" style="width:0%"></span></div>
      <p class="muted mono">${esc(picked.file.name)}</p></section></div>`;
    window.scrollTo(0, 0);
    try {
      const mod = await import("./doc-import.js");
      const res = await mod.parseDocument(picked.file, (i, n) => {
        const m = root.querySelector("#bk-up-msg"), bar = root.querySelector("#bk-up-bar");
        if (m) m.textContent = "⏳ " + t("upReadE", { i, n });
        if (bar) bar.style.width = Math.round((i / n) * 100) + "%";
      }, t);
      const u = replace && upl(replace);
      draft = { res, picked, replace, html: mod.blocksToHtml, mode: res.method, chapters: res.chapters,
        title: replace ? replace.title : res.title, author: replace ? replace.author || "" : res.author || "", lang: u ? u.lang : res.lang };
      renderDraft();
    } catch (e) {
      console.error(e); toast(e.message || String(e), "err");
      if (replace) renderBook(replace); else renderLib();
    }
  }

  function renderDraft() {
    const d = draft; if (!d) return renderLib();
    const chs = d.chapters;
    root.innerHTML = `<div class="bk-up">
      <p class="bk-crumbs mono"><a href="#/books">← ${esc(t("lib"))}</a></p>
      <header class="bk-head"><div><p class="kicker mono">// import ${esc(d.res.kind)}</p><h1>${esc(t("upTitle"))}</h1>
        <p class="muted bk-sub">${esc(d.picked.file.name)} · ${chs.length} ${esc(t("chapters"))}</p></div></header>
      <section class="panel bk-up-form">
        ${d.res.cover ? `<img class="bk-cover" src="${esc(d.res.cover)}" alt="">` : ""}
        <div class="bk-up-fields">
          <label class="bk-up-f"><span class="mono muted">${esc(t("upName"))}</span><input id="bk-up-title" maxlength="200" value="${esc(d.title)}"></label>
          <label class="bk-up-f"><span class="mono muted">${esc(t("upAuthor"))}</span><input id="bk-up-author" maxlength="200" value="${esc(d.author)}"></label>
          <div class="row bk-up-sel">
            <label class="bk-up-f"><span class="mono muted">${esc(t("upVoice"))}</span><select id="bk-up-lang">
              <option value="fr" ${d.lang === "fr" ? "selected" : ""}>Français</option><option value="en" ${d.lang === "en" ? "selected" : ""}>English</option></select></label>
            <label class="bk-up-f"><span class="mono muted">${esc(t("upSplit"))}</span>${d.res.split
              ? `<select id="bk-up-mode">${d.res.modes.map(m => `<option value="${m}" ${m === d.mode ? "selected" : ""}>${esc(t("m_" + m))}</option>`).join("")}</select>`
              : `<span class="mono">${esc(t("m_" + d.mode))}</span>`}</label>
          </div>
        </div>
      </section>
      <p class="muted bk-up-note">${esc(t("upNote"))}</p>
      <ol class="bk-toc bk-up-list">${chs.map(c => `<li><div class="bk-toc-row">
        <span class="bk-num mono">${c.n}</span>
        <span class="bk-toc-t">${c.section ? `<small class="muted">${esc(c.section)} · </small>` : ""}${esc(c.title)}</span>
        <span class="bk-toc-s mono muted">≈ ${minutes(c)} ${esc(t("min"))}</span></div></li>`).join("")}</ol>
      <div class="row bk-up-acts"><button class="btn btn-primary" id="bk-up-save">✓ ${esc(t("upSave"))}</button>
        <button class="btn btn-ghost" id="bk-up-cancel">${esc(t("upCancel"))}</button></div>
    </div>`;
    const keepFields = () => {
      d.title = root.querySelector("#bk-up-title").value; d.author = root.querySelector("#bk-up-author").value;
      d.lang = root.querySelector("#bk-up-lang").value;
    };
    const mode = root.querySelector("#bk-up-mode");
    if (mode) mode.onchange = () => { keepFields(); d.mode = mode.value; d.chapters = d.res.split(mode.value); renderDraft(); };
    root.querySelector("#bk-up-cancel").onclick = () => { const r = d.replace; draft = null; if (r) renderBook(r); else renderLib(); };
    const save = root.querySelector("#bk-up-save");
    save.onclick = async () => {
      keepFields();
      save.disabled = true;
      const title = d.title.trim() || d.res.title, rep = d.replace;
      const id = rep ? rep.id : "u-" + slug(title) + "-" + Math.random().toString(36).slice(2, 8);
      const b = {
        id, title, author: d.author.trim() || null, source: `upload:${d.res.kind}:${d.lang}`,
        cover: d.res.cover || (rep && rep.cover) || null, position: rep ? rep.position : 1000 + (lib || []).length,
        chapters: d.chapters.map(c => ({ n: c.n, title: c.title, section: c.section, html_en: d.html(c.blocks), quiz: [] })),
      };
      try {
        await uploadBook(b, (i, n) => { save.textContent = "⏳ " + t("upSaving", { i, n }); });
        if (d.picked.keep) await d.picked.keep(userId(), id);
        if (prefs.voice) { delete prefs.voice[id]; savePrefs(); }
        draft = null;
        toast(t("upOk", { t: title }), "ok");
        await loadLib(true);
        const target = "#/books/" + encodeURIComponent(id);
        if (location.hash === target) render(root, target); else location.hash = target;
      } catch (e) {
        console.error(e); toast(e.message || String(e), "err");
        save.disabled = false; save.textContent = "✓ " + t("upSave");
      }
    };
    window.scrollTo(0, 0);
  }

  /* ---------------- lecture d'un chapitre ---------------- */
  function renderChapter(b, ch) {
    stop();
    const u = upl(b), lang = u ? voiceOf(b) : cLang(), n = ch.n, i = b.chapters.findIndex(c => c.n === n);
    const prev = b.chapters[i - 1], next = b.chapters[i + 1];
    P.last[b.id] = n; wrj(PKEY, P);
    const r = rec(b.id, n), html = (!u && lang === "fr" && ch.html_fr) || ch.html_en || "";
    const notes = ch.notes && (ch.notes[lang] || ch.notes.en);
    const base = `#/books/${encodeURIComponent(b.id)}`;
    const pos = P.pos[b.id + "|" + n] || 0;
    root.innerHTML = `<div class="bk-reader" style="--bk-font:${prefs.font}">
      <p class="bk-crumbs mono"><a href="#/books">${esc(t("lib"))}</a> › <a href="${base}">${esc(pick(b, "title", uiLang()))}</a></p>
      <header class="bk-ch-head">
        <p class="kicker mono">${esc(pick(ch, "section", lang))}${pick(ch, "section", lang) ? " · " : ""}${esc(t("chapter"))} ${n}/${b.chapters.length}</p>
        <h1 class="bk-ch-title" lang="${lang}">${esc(pick(ch, "title", lang))}</h1>
        <div class="bk-tools">
          ${u ? `<div class="seg" role="group" aria-label="${esc(t("upVoice"))}" title="${esc(t("upVoice"))}">
            <span class="seg-lab mono muted">${esc(t("voice"))}</span>
            <button class="seg-btn mono" data-voice="fr" aria-pressed="${lang === "fr"}">FR</button>
            <button class="seg-btn mono" data-voice="en" aria-pressed="${lang === "en"}">EN</button>
          </div>` : `<div class="seg" role="group" aria-label="${esc(t("content"))}">
            <button class="seg-btn mono" data-clang="en" aria-pressed="${lang === "en"}">EN</button>
            <button class="seg-btn mono" data-clang="fr" aria-pressed="${lang === "fr"}" ${ch.html_fr ? "" : "disabled"}>FR</button>
          </div>`}
          <div class="seg" role="group" aria-label="${esc(t("font"))}">
            <button class="seg-btn mono" data-font="-1" title="${esc(t("font"))}">A−</button>
            <button class="seg-btn mono" data-font="1" title="${esc(t("font"))}">A+</button>
          </div>
          ${tts.can ? `<button class="btn btn-primary btn-sm" id="bk-listen">🔊 ${esc(pos ? t("resume") : t("listen"))}</button>` : ""}
          ${r.r ? `<span class="bk-read-tag mono">✓ ${esc(t("isRead"))}</span>` : ""}
        </div>
      </header>
      <article class="bk-content" lang="${lang}">${html}</article>
      ${notes ? `<aside class="bk-notes" lang="${lang}"><h3 class="mono">⚑ ${esc(t("notes"))}</h3><p class="muted bk-notes-sub">${esc(t("notesSub"))}</p>${notes}</aside>` : ""}
      <footer class="bk-end panel">
        <div class="row bk-end-main">
          ${ch.quiz && ch.quiz.length ? `<a class="btn btn-primary" href="${base}/${n}/quiz">✎ ${esc(t("quiz"))} (${ch.quiz.length})</a>` : ""}
          ${r.b != null ? `<span class="mono muted">${esc(t("best"))} : <strong>${r.b}/${r.t}</strong></span>` : ""}
          ${r.r ? "" : `<button class="btn btn-ghost btn-sm" id="bk-mark">✓ ${esc(t("markRead"))}</button>`}
        </div>
        <nav class="row bk-pn">
          ${prev ? `<a class="btn btn-ghost btn-sm" href="${base}/${prev.n}">← ${esc(t("prev"))}</a>` : "<span></span>"}
          ${next ? `<a class="btn btn-ghost btn-sm" href="${base}/${next.n}">${esc(t("next"))} →</a>` : ""}
        </nav>
      </footer>
    </div>
    <div class="bk-player" id="bk-player" hidden role="region" aria-label="Audio">
      <button class="icon-btn" data-pl="prev" title="${esc(t("prevP"))}" aria-label="${esc(t("prevP"))}">⏮</button>
      <button class="icon-btn bk-pl-main" data-pl="toggle" title="${esc(t("play"))}" aria-label="${esc(t("play"))}">▶</button>
      <button class="icon-btn" data-pl="next" title="${esc(t("nextP"))}" aria-label="${esc(t("nextP"))}">⏭</button>
      <span class="bk-pl-pos mono" id="bk-pl-pos"></span>
      <button class="btn btn-ghost btn-xs mono" data-pl="rate" title="${esc(t("speed"))}">${prefs.rate}×</button>
      <button class="icon-btn" data-pl="close" title="${esc(t("close"))}" aria-label="${esc(t("close"))}">✕</button>
    </div>`;

    root.querySelectorAll("[data-clang]").forEach(btn => btn.onclick = () => {
      if (btn.disabled) return; prefs.lang = btn.dataset.clang; savePrefs(); renderChapter(b, ch);
    });
    root.querySelectorAll("[data-voice]").forEach(btn => btn.onclick = () => {
      (prefs.voice ||= {})[b.id] = btn.dataset.voice; savePrefs(); renderChapter(b, ch);
    });
    root.querySelectorAll("[data-font]").forEach(btn => btn.onclick = () => {
      prefs.font = Math.min(1.5, Math.max(0.85, Math.round((prefs.font + 0.1 * +btn.dataset.font) * 100) / 100)); savePrefs();
      root.querySelector(".bk-reader").style.setProperty("--bk-font", prefs.font);
    });
    const mark = () => { if (!rec(b.id, n).r) { rec(b.id, n).r = Date.now(); saveP(b.id, n); } };
    const mk = root.querySelector("#bk-mark");
    if (mk) mk.onclick = () => { mark(); renderChapter(b, ch); };
    // Arrivé en bas du chapitre : il compte comme lu.
    const end = root.querySelector(".bk-end");
    if ("IntersectionObserver" in window && end) {
      const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting) && root.querySelector(".bk-reader")) { mark(); io.disconnect(); } }, { threshold: 0.6 });
      setTimeout(() => io.observe(end), 1500);
    }
    setupPlayer(b, ch, lang, mark);
    window.scrollTo(0, 0);
  }

  /* ---------------- lecteur audio (paragraphe par paragraphe) ---------------- */
  function speechText(el, lang) {
    let c = el;
    if (el.tagName === "LI" && el.querySelector("ul,ol")) { c = el.cloneNode(true); c.querySelectorAll("ul,ol").forEach(x => x.remove()); }
    return (c.textContent || "").replace(/https?:\/\/\S+/g, `(${t("link")})`).replace(/\s+/g, " ").trim()
      .replace(/^(.{2,80}?):\s/, (m, a) => (/[.!?]$/.test(a) ? m : a + ". "));
  }
  function setupPlayer(b, ch, lang, onEnd) {
    const bar = root.querySelector("#bk-player"), btn = root.querySelector("#bk-listen");
    if (!bar || !tts.can) return;
    const speakLang = lang === "fr" && !tts.canFr ? "en" : lang;
    const segs = [];
    root.querySelectorAll(".bk-ch-title, .bk-content h3, .bk-content p, .bk-content li, .bk-notes h3, .bk-notes p").forEach(el => {
      if (el.closest("pre") || el.classList.contains("bk-notes-sub")) return;
      const txt = speechText(el, lang); if (!txt) return;
      el.dataset.seg = segs.length; el.classList.add("bk-seg"); segs.push({ el, txt });
    });
    const key = b.id + "|" + ch.n;
    player = { segs, i: Math.min(P.pos[key] || 0, segs.length - 1), playing: false, token: 0, lang: speakLang };
    const posEl = bar.querySelector("#bk-pl-pos"), main = bar.querySelector(".bk-pl-main");
    const paint = () => {
      segs.forEach((s, j) => s.el.classList.toggle("bk-say", j === player.i && !bar.hidden));
      posEl.textContent = `${player.i + 1}/${segs.length}`;
      main.textContent = player.playing ? "⏸" : "▶";
      main.title = main.ariaLabel = t(player.playing ? "pause" : "play");
      bar.querySelector('[data-pl="rate"]').textContent = prefs.rate + "×";
    };
    const keep = () => { P.pos[key] = player.i; wrj(PKEY, P); };
    const play = j => {
      if (!player || j < 0 || j >= segs.length) return;
      player.i = j; player.playing = true; keep();
      const my = ++player.token; paint();
      const el = segs[j].el, rc = el.getBoundingClientRect();
      if (rc.top < 70 || rc.bottom > innerHeight - 140) el.scrollIntoView({ behavior: "smooth", block: "center" });
      tts.speak(segs[j].txt, player.lang, prefs.rate, () => {
        if (!player || my !== player.token) return;
        if (j + 1 < segs.length) play(j + 1);
        else { player.playing = false; player.i = 0; P.pos[key] = 0; wrj(PKEY, P); paint(); onEnd(); }
      });
    };
    const pause = () => { if (!player) return; player.token++; player.playing = false; tts.stop(); paint(); };
    const open = () => {
      bar.hidden = false; document.body.classList.add("bk-playing");
      if (lang === "fr" && !tts.canFr) toast(t("noVoiceFr"), "warn");
      play(player.i);
    };
    if (btn) btn.onclick = () => (bar.hidden ? open() : player.playing ? pause() : play(player.i));
    bar.onclick = e => {
      const a = e.target.closest("[data-pl]"); if (!a || !player) return;
      const k = a.dataset.pl;
      if (k === "toggle") player.playing ? pause() : play(player.i);
      else if (k === "prev") player.playing ? play(Math.max(0, player.i - 1)) : (player.i = Math.max(0, player.i - 1), keep(), paint());
      else if (k === "next") player.playing ? play(Math.min(segs.length - 1, player.i + 1)) : (player.i = Math.min(segs.length - 1, player.i + 1), keep(), paint());
      else if (k === "rate") { prefs.rate = RATES[(RATES.indexOf(prefs.rate) + 1) % RATES.length] || 1; savePrefs(); if (player.playing) play(player.i); else paint(); }
      else if (k === "close") { pause(); bar.hidden = true; document.body.classList.remove("bk-playing"); paint(); }
    };
    // Toucher un paragraphe pendant l'écoute : la lecture reprend à partir de là.
    root.querySelector(".bk-reader").addEventListener("click", e => {
      if (bar.hidden || e.target.closest("a, button")) return;
      const s = e.target.closest(".bk-seg"); if (s) play(+s.dataset.seg);
    });
  }
  function stop() {
    if (player) { player.token++; player.playing = false; player = null; tts.stop(); }
    document.body.classList.remove("bk-playing");
  }

  /* ---------------- quiz de fin de chapitre ---------------- */
  function renderQuiz(b, ch) {
    stop();
    const lang = cLang(), qs = ch.quiz || [], base = `#/books/${encodeURIComponent(b.id)}/${ch.n}`;
    if (!quizState || quizState.key !== b.id + "|" + ch.n) quizState = { key: b.id + "|" + ch.n, ans: {} };
    const A = quizState.ans, nAns = Object.keys(A).length, good = qs.filter((q, i) => A[i] === q.a).length;
    const L2 = q => q[lang] || q.en;
    const r = rec(b.id, ch.n);
    root.innerHTML = `<div class="bk-quiz">
      <p class="bk-crumbs mono"><a href="#/books/${encodeURIComponent(b.id)}">${esc(pick(b, "title", uiLang()))}</a> › <a href="${base}">${esc(t("chapter"))} ${ch.n}</a></p>
      <header class="bk-ch-head"><p class="kicker mono">${esc(t("quiz"))} · ${esc(t("chapter"))} ${ch.n}</p>
        <h1 lang="${lang}">${esc(pick(ch, "title", lang))}</h1>
        <div class="bk-tools"><div class="seg" role="group" aria-label="${esc(t("content"))}">
          <button class="seg-btn mono" data-clang="en" aria-pressed="${lang === "en"}">EN</button>
          <button class="seg-btn mono" data-clang="fr" aria-pressed="${lang === "fr"}">FR</button></div>
          ${r.b != null ? `<span class="mono muted">${esc(t("best"))} : <strong>${r.b}/${r.t}</strong></span>` : ""}</div>
      </header>
      ${qs.map((q, i) => {
        const x = L2(q), done = i in A;
        return `<section class="panel bk-q${done ? (A[i] === q.a ? " ok" : " ko") : ""}" lang="${lang}">
          <div class="bk-q-head"><p class="mono muted">${esc(t("qOf", { i: i + 1, n: qs.length }))}</p>
            ${tts.can ? `<button class="btn btn-ghost btn-xs btn-speak" data-qspeak="${i}">🔊 ${esc(t("listenQ"))}</button>` : ""}</div>
          <h3>${esc(x.q)}</h3>
          <div class="bk-opts">${x.o.map((o, j) => {
            const cls = done ? (j === q.a ? " correct" : j === A[i] ? " wrong" : "") : "";
            return `<button class="opt bk-opt${cls}" data-q="${i}" data-o="${j}" ${done ? "disabled" : ""}><span class="opt-key mono">${String.fromCharCode(65 + j)}</span><span>${esc(o)}</span></button>`;
          }).join("")}</div>
          ${done ? `<p class="bk-expl"><strong>${esc(A[i] === q.a ? "✓ " + t("correct") : "✗ " + t("wrong"))}.</strong> ${esc(x.e)}</p>` : ""}
        </section>`;
      }).join("")}
      ${nAns === qs.length && qs.length ? `<section class="panel bk-result">
        ${ring(good / qs.length, `${good}/${qs.length}`)}
        <div><h2>${esc(t("score"))} : ${good}/${qs.length}</h2><p class="muted">${esc(good === qs.length ? t("perfect") : good / qs.length >= 0.6 ? t("good") : t("again"))}</p>
        <div class="row"><button class="btn btn-ghost btn-sm" id="bk-retry">↻ ${esc(t("quizRetry"))}</button>
          <a class="btn btn-ghost btn-sm" href="${base}">← ${esc(t("backCh"))}</a>
          ${nextOf(b, ch.n) ? `<a class="btn btn-primary btn-sm" href="#/books/${encodeURIComponent(b.id)}/${nextOf(b, ch.n)}">${esc(t("next"))} →</a>` : ""}</div></div>
      </section>` : `<p class="row"><a class="btn btn-ghost btn-sm" href="${base}">← ${esc(t("backCh"))}</a></p>`}
    </div>`;
    root.querySelectorAll("[data-clang]").forEach(btn => btn.onclick = () => { prefs.lang = btn.dataset.clang; savePrefs(); renderQuiz(b, ch); });
    root.querySelectorAll(".bk-opt").forEach(btn => btn.onclick = () => {
      const i = +btn.dataset.q; if (i in A) return;
      A[i] = +btn.dataset.o;
      if (Object.keys(A).length === qs.length) {
        const score = qs.filter((q, k) => A[k] === q.a).length, rr = rec(b.id, ch.n);
        if (rr.b == null || score > rr.b) { rr.b = score; rr.t = qs.length; }
        if (!rr.r) rr.r = Date.now();
        saveP(b.id, ch.n);
      }
      const y = scrollY; renderQuiz(b, ch); window.scrollTo(0, y);
    });
    root.querySelectorAll("[data-qspeak]").forEach(btn => btn.onclick = () => {
      const i = +btn.dataset.qspeak, q = qs[i], x = L2(q), on = btn.classList.contains("on");
      tts.stop(); root.querySelectorAll(".btn-speak.on").forEach(z => z.classList.remove("on"));
      if (on) return;
      const sl = lang === "fr" && !tts.canFr ? "en" : lang, fr = sl === "fr";
      const opts = x.o.map((o, j) => `${String.fromCharCode(65 + j)}${fr ? " :" : ":"} ${o}.`).join(" ");
      let txt = `${x.q} ${opts}`;
      if (i in A) txt += ` ${fr ? "Bonne réponse" : "Correct answer"} ${String.fromCharCode(65 + q.a)}. ${x.e}`;
      btn.classList.add("on");
      tts.speak(txt, sl, prefs.rate, () => btn.classList.remove("on"));
    });
    const rt = root.querySelector("#bk-retry");
    if (rt) rt.onclick = () => { quizState = null; renderQuiz(b, ch); window.scrollTo(0, 0); };
  }
  const nextOf = (b, n) => { const i = b.chapters.findIndex(c => c.n === n); return b.chapters[i + 1] && b.chapters[i + 1].n; };

  return { render, sync, forget, stop };
}
