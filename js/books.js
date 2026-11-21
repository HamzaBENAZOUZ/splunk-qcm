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
import { forEar, codeForEar, SPEECH_V } from "./speech.js";
import { canCast, pairedTv, sendBook, sendChapter, setCastAction } from "./cast.js";

const T_BOOKS = "splunk_books", T_CH = "splunk_book_chapters", T_PROG = "splunk_book_progress";
const PKEY = "splunk-books-v1", PREF = "splunk-books-prefs", DL = "splunk-books-dl:", WC = "splunk-books-words";
// Temps estimé : lecture à l'œil (mots / minute) et écoute à voix haute à vitesse 1× (mots / minute, divisé par la vitesse choisie)
const WPM_READ = 220, WPM_LISTEN = 155;
const RATE_MIN = 0.5, RATE_MAX = 2.5, RATE_STEP = 0.1;
const RATE_PRESETS = [0.75, 1, 1.25, 1.5, 2];

const L = {
  fr: {
    lib: "Bibliothèque", libSub: "Tes livres : lecture, écoute et quiz à la fin de chaque chapitre.",
    empty: "Aucun livre pour l'instant.", notReady: "La bibliothèque n'est pas encore activée sur ton compte (tables Supabase manquantes).",
    loadErr: "Impossible de charger les livres", offlineNo: "Hors ligne : ce contenu n'a pas encore été téléchargé sur cet appareil.",
    chapters: "chapitres", chapter: "Chapitre", read: "lus", quizAvg: "moyenne aux quiz", start: "Commencer la lecture", cont: "Continuer",
    dl: "Télécharger pour lire hors ligne", dlBusy: "Téléchargement…", dlDone: "Disponible hors ligne", dlOk: "Livre téléchargé sur cet appareil",
    back: "Retour", toc: "Sommaire", listen: "Écouter le chapitre", resume: "Reprendre l'écoute", content: "Langue du texte",
    notes: "Note de vérification", notesSub: "Points du livre corrigés ou précisés d'après la documentation officielle.",
    quiz: "Quiz du chapitre", quizRetry: "Refaire le quiz", markRead: "Marquer comme lu", isRead: "Lu",
    prev: "Chapitre précédent", next: "Chapitre suivant", backCh: "Revenir au chapitre", best: "Meilleur score",
    score: "Ton score", pickN: "Choisis {n} réponses.", qOf: "Question {i} sur {n}", correct: "Bonne réponse", wrong: "Mauvaise réponse", finish: "Voir mon score",
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
    etaRead: "Temps de lecture estimé", etaListen: "Temps d'écoute estimé (à la vitesse {r}×)",
    min: "min", upNote: "Les images et tableaux complexes ne sont pas repris : seul le texte est gardé.",
    badType: "Ce fichier n'est ni un PDF ni un EPUB.", badEpub: "Cet EPUB est illisible ou abîmé.",
    noText: "Aucun texte trouvé : c'est sans doute un PDF scanné (des images de pages), qui ne peut pas être lu à voix haute.",
    front: "Début du document", part: "partie", pages: "Pages", section: "Section",
    imported: "Importé", srcFile: "Fichier d'origine", srcApp: "copie gardée dans l'appli", srcHandle: "lien vers le fichier sur ce PC",
    srcCopy: "copie gardée dans ce navigateur", srcNone: "pas sur cet appareil", resplit: "Redécouper le fichier",
    srcGone: "Le fichier d'origine n'est plus disponible ici (déplacé, renommé ou importé depuis un autre appareil). Choisis-le à nouveau.",
    del: "Supprimer ce livre", delSure: "Supprimer", delOk: "Livre supprimé", voice: "Voix", delQ: "Supprimer « {t} » ?",
    delTxt: "Le livre, ses {n} chapitres et ta progression seront effacés de ton compte, sur tous tes appareils. Cette action est définitive.",
    delUp: "Pour le retrouver, il faudra importer à nouveau le fichier.", delBook: "Pour le retrouver, il faudra réimporter son fichier .book.json.", cancel: "Annuler",
    prevS: "Phrase précédente", nextS: "Phrase suivante", settings: "Réglages de lecture", voiceOf: "Voix ({l})", auto: "Automatique",
    noVoices: "Aucune autre voix trouvée sur cet appareil.", tryV: "Essayer", slower: "Ralentir", faster: "Accélérer",
    para: "Paragraphe", sample: "Bonjour, voici la voix choisie pour la lecture de tes livres.", sampleEn: "Hello, this is the voice chosen to read your books.",
    sentOf: "Phrase {i} sur {n}", pPrev: "Précédent", pNext: "Suivant",
    tr: "Traduire en français", trOn: "Traduction automatique (sur l'appareil, par le navigateur) : le texte peut contenir des erreurs.",
    trBusy: "Traduction du chapitre… {i}/{n}", trDl: "Téléchargement du module de traduction du navigateur… {p} %", trRetry: "Traduire ce chapitre",
    trNo: "Traduction automatique indisponible ici : elle utilise le traducteur intégré de Chrome ou Edge récents sur ordinateur.",
    trErr: "La traduction automatique a échoué", trOff: "Texte original", trSlow: "le navigateur n'a pas répondu",
    trModel: "Téléchargement du traducteur hors ligne (une seule fois, 26 Mo)… {p} %",
    trOffline: "Traduction hors ligne sur le téléphone (moteur de Mozilla), gardée dans l'appli : le texte peut contenir des erreurs.",
    trWait: "Le service de traduction limite les demandes : reprise dans {s} s…",
    trOnline: "Traduction automatique en ligne (service de traduction de Google) : le texte peut contenir des erreurs.",
    trDevice: "Traduction automatique sur le téléphone : le texte peut contenir des erreurs.",
    chain: "Enchaîner automatiquement le chapitre suivant", awake: "Garder l'écran allumé pendant l'écoute", backLib: "Bibliothèque",
    bgT: "Écoute écran éteint", bgOk: "Prêt : la lecture continue appli fermée ou téléphone verrouillé, avec la notification de lecture.",
    bgNotif: "Notifications coupées : la commande lecture / pause n'apparaîtra pas en haut de l'écran.", bgNotifB: "Autoriser les notifications",
    bgBat: "Le téléphone peut couper la lecture quand l'écran est éteint.", bgBatB: "Batterie sans restriction",
    car: "Écouter dans la voiture (Android Auto)", carUpd: "Mettre à jour dans la voiture", carIn: "Dans la voiture",
    carBusy: "Envoi vers la voiture… {i}/{n}", carOk: "« {t} » est prêt dans Android Auto", carRm: "Retirer de la voiture",
    carRmOk: "Livre retiré d'Android Auto", carErr: "Envoi vers la voiture impossible", carRead: "{n} chapitre(s) écouté(s) en voiture marqué(s) comme lu(s)",
    tvListen: "Écouter sur {n}", phoneListen: "Sur le téléphone", tvBook: "Lire « {t} » sur la télé", tvCh: "Lire sur la télé à partir du chapitre {n}", tvBusy: "Préparation pour la télé… {i}/{n}", tvTrBg: "La télé lit déjà ; les chapitres suivants sont traduits en français sur le téléphone et lui sont envoyés au fur et à mesure.", tvRead: "{n} chapitre(s) écouté(s) sur la télé marqué(s) comme lu(s)",
  },
  en: {
    lib: "Library", libSub: "Your books: read, listen and take a quiz at the end of every chapter.",
    empty: "No books yet.", notReady: "The library is not enabled on your account yet (Supabase tables missing).",
    loadErr: "Could not load the books", offlineNo: "Offline: this content has not been downloaded to this device yet.",
    chapters: "chapters", chapter: "Chapter", read: "read", quizAvg: "quiz average", start: "Start reading", cont: "Continue",
    dl: "Download to read offline", dlBusy: "Downloading…", dlDone: "Available offline", dlOk: "Book downloaded to this device",
    back: "Back", toc: "Contents", listen: "Listen to the chapter", resume: "Resume listening", content: "Text language",
    notes: "Fact-check note", notesSub: "Points from the book corrected or clarified against the official documentation.",
    quiz: "Chapter quiz", quizRetry: "Retake the quiz", markRead: "Mark as read", isRead: "Read",
    prev: "Previous chapter", next: "Next chapter", backCh: "Back to the chapter", best: "Best score",
    score: "Your score", pickN: "Pick {n} answers.", qOf: "Question {i} of {n}", correct: "Correct", wrong: "Wrong answer", finish: "See my score",
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
    etaRead: "Estimated reading time", etaListen: "Estimated listening time (at {r}× speed)",
    min: "min", upNote: "Images and complex tables are left out: only the text is kept.",
    badType: "This file is neither a PDF nor an EPUB.", badEpub: "This EPUB is unreadable or damaged.",
    noText: "No text found: this is probably a scanned PDF (page images), which cannot be read aloud.",
    front: "Start of the document", part: "part", pages: "Pages", section: "Section",
    imported: "Imported", srcFile: "Original file", srcApp: "copy kept in the app", srcHandle: "link to the file on this PC",
    srcCopy: "copy kept in this browser", srcNone: "not on this device", resplit: "Split the file again",
    srcGone: "The original file is no longer available here (moved, renamed or imported from another device). Pick it again.",
    del: "Delete this book", delSure: "Delete", delOk: "Book deleted", voice: "Voice", delQ: "Delete “{t}”?",
    delTxt: "The book, its {n} chapters and your progress will be erased from your account, on all your devices. This cannot be undone.",
    delUp: "To get it back, you will have to import the file again.", delBook: "To get it back, you will have to re-import its .book.json file.", cancel: "Cancel",
    prevS: "Previous sentence", nextS: "Next sentence", settings: "Reading settings", voiceOf: "Voice ({l})", auto: "Automatic",
    noVoices: "No other voice found on this device.", tryV: "Try", slower: "Slower", faster: "Faster",
    para: "Paragraph", sample: "Bonjour, voici la voix choisie pour la lecture de tes livres.", sampleEn: "Hello, this is the voice chosen to read your books.",
    sentOf: "Sentence {i} of {n}", pPrev: "Previous", pNext: "Next",
    tr: "Translate to French", trOn: "Machine translation (on this device, by the browser): the text may contain mistakes.",
    trBusy: "Translating the chapter… {i}/{n}", trDl: "Downloading the browser's translation model… {p}%", trRetry: "Translate this chapter",
    trNo: "Machine translation is not available here: it uses the built-in translator of recent Chrome or Edge on desktop.",
    trErr: "Machine translation failed", trOff: "Original text", trSlow: "the browser did not respond",
    trModel: "Downloading the offline translator (only once, 26 MB)… {p}%",
    trOffline: "Offline translation on the phone (Mozilla engine), kept in the app: the text may contain mistakes.",
    trWait: "The translation service is limiting requests: resuming in {s} s…",
    trOnline: "Online machine translation (Google's translation service): the text may contain mistakes.",
    trDevice: "Machine translation on the phone: the text may contain mistakes.",
    chain: "Automatically continue with the next chapter", awake: "Keep the screen on while listening", backLib: "Library",
    bgT: "Screen-off listening", bgOk: "Ready: reading goes on with the app closed or the phone locked, with the playback notification.",
    bgNotif: "Notifications are off: the play / pause control will not show at the top of the screen.", bgNotifB: "Allow notifications",
    bgBat: "The phone may stop reading when the screen is off.", bgBatB: "Unrestricted battery",
    car: "Listen in the car (Android Auto)", carUpd: "Update in the car", carIn: "In the car",
    carBusy: "Sending to the car… {i}/{n}", carOk: "“{t}” is ready in Android Auto", carRm: "Remove from the car",
    carRmOk: "Book removed from Android Auto", carErr: "Could not send to the car", carRead: "{n} chapter(s) listened to in the car marked as read",
    tvListen: "Listen on {n}", phoneListen: "On the phone", tvBook: "Play “{t}” on the TV", tvCh: "Play on the TV from chapter {n}", tvBusy: "Preparing for the TV… {i}/{n}", tvTrBg: "The TV is already reading; the next chapters are translated into French on the phone and sent to it as they are ready.", tvRead: "{n} chapter(s) listened to on the TV marked as read",
  },
};

const rdj = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const wrj = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };

export function createBooks({ store, getLang, esc, toast, userId, tts }) {
  let P = rdj(PKEY) || {};
  P.books ||= {}; P.last ||= {}; P.pos ||= {}; P.dirty ||= {};
  const prefs = { lang: null, rate: 1, font: 1, ...(rdj(PREF) || {}) };
  prefs.vname ||= {};                                   // voix choisie par langue : { fr: id, en: id }
  const clampRate = r => Math.round(Math.min(RATE_MAX, Math.max(RATE_MIN, +r || 1)) * 100) / 100;
  prefs.rate = clampRate(prefs.rate);
  if (typeof prefs.chain !== "boolean") prefs.chain = !!window.AndroidMedia;   // appli : écoute enchaînée (voiture, écran éteint)
  // Écoute en arrière-plan dans l'appli Android : notification, écran verrouillé, boutons Bluetooth / volant / télécommande.
  const media = () => window.AndroidMedia || null;
  if (typeof prefs.awake !== "boolean") prefs.awake = true;
  // Écran allumé pendant l'écoute : l'appli Android garde l'écran allumé tant que la voix lit (FLAG_KEEP_SCREEN_ON),
  // le navigateur utilise la Screen Wake Lock API. Relâché à la pause, à l'arrêt et à la fin du chapitre.
  let awakeWant = false, wakeLock = null, wakeAsking = false;
  const askLock = () => {
    if (wakeLock || wakeAsking || !navigator.wakeLock || document.visibilityState !== "visible") return;
    wakeAsking = true;
    navigator.wakeLock.request("screen").then(l => {
      wakeAsking = false;
      if (!awakeWant) return l.release().catch(() => {});
      wakeLock = l; l.addEventListener("release", () => { if (wakeLock === l) wakeLock = null; });
    }).catch(() => { wakeAsking = false; /* refusé (économie d'énergie, onglet caché) */ });
  };
  const screenAwake = on => {
    on = !!on && prefs.awake;
    const m = media();
    if (m && typeof m.screen === "function") {
      if (on !== awakeWant) { awakeWant = on; try { m.screen(on); } catch { /* */ } }
      return;
    }
    awakeWant = on;
    if (on) askLock();
    else if (wakeLock) { const l = wakeLock; wakeLock = null; l.release().catch(() => {}); }
  };
  // le navigateur relâche le verrou quand l'onglet est caché : on le reprend au retour si la lecture continue
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && awakeWant) askLock(); });
  let mediaCtl = null;
  window.__mediaCmd = cmd => { if (mediaCtl && mediaCtl[cmd]) mediaCtl[cmd](); };
  addEventListener("keydown", e => {
    const k = { MediaPlayPause: "toggle", MediaPlay: "play", MediaPause: "pause", MediaStop: "pause", MediaTrackNext: "next", MediaTrackPrevious: "prev" }[e.key];
    if (k && mediaCtl) { e.preventDefault(); mediaCtl[k](); }
  });
  const say = (txt, lang, done) => tts.speak(txt, lang, prefs.rate, done, prefs.vname[lang] || "");
  let lib = null;                 // liste des livres (sommaires)
  const full = new Map();         // mode local : livre complet par id
  const mem = new Map();          // chapitres déjà chargés (id|n)
  let root = null, pushTimer = null, busy = false;
  let player = null;              // { segs, i, playing, token, lang }
  let quizState = null;
  let bgWarned = false;           // avertissement « notifications coupées » déjà montré
  let draft = null;               // import PDF / EPUB en cours de vérification

  const uiLang = () => (getLang() === "en" ? "en" : "fr");
  const t = (k, v) => { let s = L[uiLang()][k] ?? k; if (v) for (const x in v) s = s.replace(`{${x}}`, v[x]); return s; };
  const cLang = () => (prefs.lang === "en" || prefs.lang === "fr" ? prefs.lang : uiLang());
  const savePrefs = () => { wrj(PREF, prefs); carSettings(); };
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

  /* ---------------- temps de lecture / d'écoute estimé ---------------- */
  // Texte affiché pour ce chapitre (même choix de langue que le lecteur, hors traduction automatique)
  const shownHtml = (b, ch) => (!upl(b) && cLang() === "fr" && ch.html_fr) || ch.html_en || "";
  const countWords = html => {
    const txt = String(html).replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")
      .replace(/&[#\w]+;/g, " ");
    const m = txt.match(/[\p{L}\p{N}][\p{L}\p{N}'’_.-]*/gu);
    return m ? m.length : 0;
  };
  let wcMap = null;
  const wcKey = (b, n) => b.id + "|" + n + "|" + (upl(b) ? "u" : cLang());
  const wcGet = (b, n) => { wcMap = wcMap || rdj(WC) || {}; const e = wcMap[wcKey(b, n)]; return e && e.v === b.version ? e.w : null; };
  const wcSet = (b, n, w) => { wcMap = wcMap || rdj(WC) || {}; wcMap[wcKey(b, n)] = { v: b.version, w }; wrj(WC, wcMap); };
  const chWords = (b, ch) => { let w = wcGet(b, ch.n); if (w == null) { w = countWords(shownHtml(b, ch)); wcSet(b, ch.n, w); } return w; };
  const mins = x => Math.max(1, Math.round(x));
  /** « 📖 12 min · 🎧 18 min » : lecture à l'œil et écoute (selon la vitesse de lecture choisie). */
  function etaHtml(w, listen = true) {
    if (!w) return "";
    const r = mins(w / WPM_READ), l = mins(w / (WPM_LISTEN * prefs.rate));
    return `<span title="${esc(t("etaRead"))}">📖 ${r} ${esc(t("min"))}</span>`
      + (listen && tts.can ? ` · <span title="${esc(t("etaListen", { r: prefs.rate }))}">🎧 ${l} ${esc(t("min"))}</span>` : "");
  }
  const etaSpan = (b, n) => { const w = wcGet(b, n); return `<span class="bk-eta mono" data-eta="${esc(b.id)}|${n}">${w != null ? etaHtml(w) : ""}</span>`; };
  /** Remplit les temps encore inconnus (charge le chapitre une fois, puis le nombre de mots reste en mémoire). */
  function fillEta(el) {
    el.querySelectorAll(".bk-eta[data-eta]:empty").forEach(async s => {
      const [id, n] = [s.dataset.eta.slice(0, s.dataset.eta.lastIndexOf("|")), +s.dataset.eta.slice(s.dataset.eta.lastIndexOf("|") + 1)];
      const b = book(id); if (!b) return;
      try { const ch = await loadChapter(b, n); if (ch && s.isConnected) s.innerHTML = etaHtml(chWords(b, ch)); } catch { /* hors ligne : pas de temps */ }
    });
  }

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
    try { const c = car(); if (c) c.removeBook(b.id); } catch { /* */ }
    delete P.books[b.id]; delete P.last[b.id];
    for (const k of Object.keys(P.pos)) if (k.startsWith(b.id + "|")) delete P.pos[k];
    for (const k of Object.keys(P.dirty)) if (k.startsWith(b.id + "|")) delete P.dirty[k];
    wrj(PKEY, P); wrj(DL + b.id, null);
    lib = null; mem.clear();
  }

  /* ---------------- Android Auto ---------------- */
  // Dans l'appli Android, un livre peut être « mis dans la voiture » : son texte, découpé en phrases sur l'appareil,
  // est confié à l'appli (pont AndroidCar), qui le lit elle-même dans Android Auto, sans la page ni le réseau.
  const car = () => window.AndroidCar || null;
  function carSettings() {
    const c = car(); if (!c) return;
    try { c.settings(JSON.stringify({ rate: prefs.rate, voice: prefs.vname || {}, chain: prefs.chain })); } catch { /* ancienne appli */ }
  }
  const carV = b => String(b.version || "") + "~" + SPEECH_V;      // texte adapté à l'écoute : nouvelles règles = livre à renvoyer
  const carVersion = b => { const c = car(); try { return c ? c.bookVersion(b.id) || "" : ""; } catch { return ""; } };
  /** Phrases à lire pour un chapitre (même découpage que le lecteur de la page). */
  function speechOf(html, lang) {
    const doc = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html"), out = [];
    const ear = x => forEar(x, lang);
    doc.querySelectorAll("h3, p, li, pre").forEach(el => {
      if (el.tagName === "PRE") { const txt = codeForEar(el.textContent, lang); if (txt) out.push(txt); return; }
      if (el.closest("pre") || (el.tagName === "P" && el.closest("li"))) return;
      let raw = el.textContent || "";
      if (el.tagName === "LI" && el.querySelector("ul,ol")) {
        const c = el.cloneNode(true); c.querySelectorAll("ul,ol").forEach(x => x.remove());
        const txt = ear(cleanSpeech(c.textContent || "")); if (txt) out.push(txt); return;
      }
      for (const [a, z] of sentences(raw, lang)) { const txt = ear(cleanSpeech(raw.slice(a, z))); if (txt) out.push(txt); }
    });
    return out;
  }
  async function sendToCar(b, onStep) {
    const c = car(); if (!c) return;
    const u = upl(b), want = u ? voiceOf(b) : cLang(), chs = [];
    for (let i = 0; i < b.chapters.length; i++) {
      onStep && onStep(i + 1, b.chapters.length);
      const ch = await loadChapter(b, b.chapters[i].n);
      const lang = u ? want : (want === "fr" && ch.html_fr ? "fr" : "en");
      const html = u ? ch.html_en : (lang === "fr" ? ch.html_fr : ch.html_en);
      const title = pick(ch, "title", lang) || `${t("chapter")} ${ch.n}`;
      const segs = [forEar(title, lang) + ".", ...speechOf(html, lang)];
      if (!c.saveChapter(b.id, ch.n, JSON.stringify({ n: ch.n, title, lang, segs }))) throw new Error(t("carErr"));
      chs.push({ n: ch.n, title, words: segs.reduce((k, x) => k + (String(x).trim().match(/\S+/g) || []).length, 0) });
    }
    const ok = c.saveBook(JSON.stringify({ id: b.id, title: pick(b, "title", want), author: b.author || "", version: carV(b),
      cover: b.cover && /^data:image\/(png|jpe?g|webp);base64,/.test(b.cover) ? b.cover : "", chapters: chs }));
    if (!ok) throw new Error(t("carErr"));
    carSettings();
  }
  /** Chapitres écoutés jusqu'au bout dans la voiture : marqués comme lus ici (et synchronisés). */
  function carProgress() {
    const c = car(); if (!c) return;
    let list = [];
    try { list = JSON.parse(c.takeProgress() || "[]"); } catch { return; }
    let n = 0;
    for (const x of list) {
      if (!x || typeof x.book !== "string" || !Number.isInteger(x.n)) continue;
      const r = rec(x.book, x.n); if (!r.r) { r.r = x.at || Date.now(); n++; }
      P.last[x.book] = x.n; P.dirty[x.book + "|" + x.n] = 1;
    }
    if (list.length) { saveP(); if (n) toast(t("carRead", { n }), "ok"); }
  }

  /* ---------------- Google TV ---------------- */
  // Dans l'appli Android, un livre peut être lu sur la Google TV associée (voir js/cast.js) : le texte part sous forme
  // de blocs (titre, paragraphe, élément de liste, code) avec les phrases à lire, la télé l'affiche et le lit elle-même.
  /** Blocs d'un chapitre pour la télé : { k: "h3"|"p"|"li"|"pre", x: texte affiché, s: phrases lues }. */
  function blocksOf(html, lang) {
    const doc = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html"), out = [];
    doc.querySelectorAll("h3, p, li, pre").forEach(el => {
      if (el.tagName === "PRE") { const x = el.textContent || "", s = codeForEar(x, lang); out.push({ k: "pre", x, s: s ? [s] : [] }); return; }
      if (el.closest("pre") || (el.tagName === "P" && el.closest("li"))) return;
      let raw = el.textContent || "";
      if (el.tagName === "LI" && el.querySelector("ul,ol")) {
        const c = el.cloneNode(true); c.querySelectorAll("ul,ol").forEach(x => x.remove()); raw = c.textContent || "";
      }
      const s = [];
      for (const [a, z] of sentences(raw, lang)) { const txt = cleanSpeech(raw.slice(a, z)); if (txt) s.push(txt); }
      const x = raw.replace(/\s+/g, " ").trim();
      if (x) out.push({ k: el.tagName.toLowerCase(), x, s });
    });
    return out;
  }
  /** Chapitre traduit en français (traductions gardées sur l'appareil) ; wait = false : seulement si déjà traduit. */
  async function trHtml(b, ch, wait) {
    const key = trKey(b, ch.n);
    if (trCache.has(key)) return trCache.get(key);
    try {
      const doc = new DOMParser().parseFromString(`<h1>${esc(pick(ch, "title", "en"))}</h1><div>${ch.html_en || ""}</div>`, "text/html");
      const h1 = doc.querySelector("h1"), div = doc.querySelector("div");
      const jobs = trJobs(h1, div), data = (await trLoad(key)) || { v: 1, via: "", map: {} };
      data.map ||= {};
      jobs.forEach(j => { if (j.src in data.map) j.put(data.map[j.src]); });
      if (jobs.some(j => !(j.src in data.map))) {
        if (!wait) return null;
        if (!(await trRun(key, jobs, data, () => {}, () => true))) return null;
      }
      const r = { title: h1.textContent, html: div.innerHTML, via: data.via };
      trCache.set(key, r);
      return r;
    } catch (e) { console.warn("traduction pour la télé", e); return null; }
  }
  /** Langue voulue sur la télé : celle du lecteur (traduction comprise). */
  function tvLang(b) {
    const u = upl(b);
    if (!u) return cLang();
    return u.lang === "en" && prefs.tr && prefs.tr[b.id] ? "fr" : voiceOf(b);
  }
  /**
   * Livre préparé pour la télé. Texte français absent : le téléphone le traduit (même traducteur que le lecteur) ;
   * le chapitre de départ et le suivant tout de suite, les autres après l'envoi (liste `later`, renvoyés un par un).
   */
  async function tvPkg(b, start, onStep, want = tvLang(b), later = []) {
    const u = upl(b), chapters = [], canTr = trSupported();
    const si = Math.max(0, b.chapters.findIndex(c => c.n === start));
    for (let i = 0; i < b.chapters.length; i++) {
      onStep && onStep(i + 1, b.chapters.length);
      const ch = await loadChapter(b, b.chapters[i].n);
      const needTr = want === "fr" && (u ? u.lang === "en" : !ch.html_fr);
      let lang = u ? u.lang : (want === "fr" && ch.html_fr ? "fr" : "en");
      let html = u ? ch.html_en : (lang === "fr" ? ch.html_fr : ch.html_en);
      let title = pick(ch, "title", lang) || `${t("chapter")} ${ch.n}`;
      if (needTr && canTr) {
        const tr = await trHtml(b, ch, i === si || i === si + 1);
        if (tr) { lang = "fr"; html = tr.html; title = tr.title || title; }
        else later.push(ch.n);
      }
      chapters.push(tvChapterOf(ch.n, title, lang, html));
    }
    return { id: b.id, title: pick(b, "title", want), author: b.author || "", ui: uiLang(), rate: prefs.rate, lang: want,
      start, pos: P.pos[b.id + "|" + start] || 0, chapters };
  }
  const tvChapterOf = (n, title, lang, html) => ({ n, title, lang, blocks: [{ k: "h1", x: title, s: [title] }, ...blocksOf(html, lang)] });
  /** Chapitres écoutés jusqu'au bout sur la télé : marqués comme lus ici (et synchronisés). */
  function tvDone(id, ns) {
    let k = 0;
    for (const n of ns) { const r = rec(id, n); if (!r.r) { r.r = Date.now(); k++; } P.dirty[id + "|" + n] = 1; }
    saveP(); if (k) toast(t("tvRead", { n: k }), "ok");
  }
  let tvGen = 0;
  async function toTv(b, n, btn, want, frac) {
    stop();
    const gen = ++tvGen, later = [];
    btn = btn || document.createElement("button");
    const old = btn.innerHTML; btn.disabled = true;
    let sent = false, pkg = null;
    try {
      pkg = await tvPkg(b, n, (i, k) => { btn.textContent = btn.classList.contains("cast-top") ? `⏳ ${i}/${k}` : "⏳ " + t("tvBusy", { i, n: k }); }, want || tvLang(b), later);
      if (frac > 0) pkg.frac = frac;
      btn.textContent = "⏳ 📺";
      sent = await sendBook(pkg, { onDone: tvDone, relang: (lang, n2, f) => toTv(b, n2 ?? n, null, lang, f) });
    } catch (e) { console.error(e); toast(e.message || String(e), "err"); }
    if (btn.isConnected) { btn.disabled = false; btn.innerHTML = old; }
    // traduction des autres chapitres, dans l'ordre de lecture, envoyés à la télé dès qu'ils sont prêts
    if (!sent || !later.length) return;
    const order = [...later.filter(x => x >= n), ...later.filter(x => x < n)];
    toast(t("tvTrBg"), "info");
    for (const x of order) {
      if (gen !== tvGen) return;                      // un autre livre (ou l'autre langue) a été envoyé entre-temps
      try {
        const ch = await loadChapter(b, x), tr = await trHtml(b, ch, true);
        if (!tr || gen !== tvGen) continue;
        await sendChapter(b.id, tvChapterOf(x, tr.title || pick(ch, "title", "en"), "fr", tr.html));
      } catch (e) { console.warn("traduction pour la télé", e); }
    }
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
    setCastAction(null);
    carProgress();
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
            <div class="bk-go">${etaSpan(b, n)}<a class="btn btn-primary btn-sm" href="#/books/${encodeURIComponent(b.id)}/${n}">${esc(s.read || P.last[b.id] ? t("cont") : t("start"))} · ${esc(t("chapter"))} ${n}</a></div>
          </div></article>`;
      }).join("")}</div>` : `<section class="panel"><p class="muted">${esc(t("empty"))}</p></section>`}
      ${store.kind === "supabase" && !store.offline ? `<section class="panel bk-up-cta">
        <div><h2>📄 ${esc(t("up"))}</h2><p class="muted">${esc(t("upHint"))}</p></div>
        <button class="btn btn-primary" id="bk-up">${esc(t("up"))}</button>
        <input type="file" id="bk-up-inp" accept="${src.ACCEPT}" hidden></section>` : ""}
      ${store.kind === "supabase" && !store.offline ? `<p class="bk-imp"><label class="btn btn-ghost btn-sm">📚 ${esc(t("imp"))}
        <input type="file" id="bk-imp" accept=".json,application/json" hidden></label></p>` : ""}
    </div>`;
    fillEta(root);
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
      <p class="bk-crumbs mono"><a class="btn btn-ghost btn-sm bk-back" href="#/books">📚 ${esc(t("backLib"))}</a></p>
      <header class="panel bk-hero">
        ${coverImg(b, "bk-cover bk-cover-lg")}
        <div class="bk-hero-body">
          <h1>${esc(pick(b, "title", ul))}</h1>
          ${pick(b, "subtitle", ul) ? `<p class="muted bk-sub">${esc(pick(b, "subtitle", ul))}</p>` : ""}
          ${b.author ? `<p class="muted bk-author">${esc(t("by"))} ${esc(b.author)}</p>` : ""}
          <div class="bk-hero-stats">${ring(s.total ? s.read / s.total : 0, Math.round(s.total ? (s.read / s.total) * 100 : 0) + "%")}
            <div class="mono"><strong>${s.read}/${s.total}</strong> ${esc(t("chapters"))} ${esc(t("read"))}${s.avg != null ? `<br><strong>${s.avg} %</strong> ${esc(t("quizAvg"))}` : ""}</div></div>
          <div class="row bk-hero-acts">
            ${etaSpan(b, n)}
            <a class="btn btn-primary" href="#/books/${encodeURIComponent(b.id)}/${n}">${esc(s.read || P.last[b.id] ? t("cont") : t("start"))} · ${esc(t("chapter"))} ${n}</a>
            ${store.kind === "supabase" ? (downloaded(b)
              ? `<span class="bk-dl-ok mono">✓ ${esc(t("dlDone"))}</span>`
              : `<button class="btn btn-ghost btn-sm" id="bk-dl" ${canDl ? "" : "disabled"}>📥 ${esc(t("dl"))}</button>`) : ""}
          </div>
          ${upl(b) ? `<div class="bk-src">
            <p class="muted mono bk-src-info">${esc(upl(b).kind.toUpperCase())} · ${esc(t("srcFile"))} : <span id="bk-src-name">…</span></p>
            ${canDl ? `<div class="row"><button class="btn btn-ghost btn-sm" id="bk-resplit">✂ ${esc(t("resplit"))}</button>
              <input type="file" id="bk-up-inp" accept="${src.ACCEPT}" hidden></div>` : ""}
          </div>` : ""}
          ${car() ? (() => { const v = carVersion(b), fresh = v && v === carV(b);
            return `<div class="row bk-car">${v ? `<span class="bk-dl-ok mono">🚗 ${esc(t("carIn"))}${fresh ? " ✓" : ""}</span>` : ""}
              ${fresh ? "" : `<button class="btn btn-ghost btn-sm" id="bk-car" ${canDl || downloaded(b) ? "" : "disabled"}>🚗 ${esc(v ? t("carUpd") : t("car"))}</button>`}
              ${v ? `<button class="btn btn-ghost btn-xs" id="bk-car-rm">${esc(t("carRm"))}</button>` : ""}</div>`; })() : ""}
          ${canDl ? `<p class="bk-del-row"><button class="btn btn-ghost btn-sm bk-del" id="bk-del">🗑 ${esc(t("del"))}</button></p>` : ""}
        </div>
      </header>
      <h2 class="bk-toc-title mono">${esc(t("toc"))}</h2>
      ${groups.map(g => `<section class="bk-sec">
        ${g.sec ? `<h3 class="bk-sec-title">${esc(g.sec)}</h3>` : ""}
        <ol class="bk-toc">${g.list.map(c => {
          const r = pr[c.n] || {};
          return `<li><a href="#/books/${encodeURIComponent(b.id)}/${c.n}" class="bk-toc-row${r.r ? " done" : ""}${c.n === n ? " cur" : ""}">
            <span class="bk-num mono">${c.n}</span><span class="bk-toc-t">${esc(pick(c, "title", ul))}</span>
            <span class="bk-toc-s mono">${wcGet(b, c.n) ? `<span class="bk-toc-eta muted" title="${esc(t("etaRead"))}">${mins(wcGet(b, c.n) / WPM_READ)} ${esc(t("min"))}</span>` : ""}${r.b != null ? `<span class="bk-score${r.b === r.t ? " full" : ""}">${r.b}/${r.t}</span>` : ""}${r.r ? `<span class="bk-check" title="${esc(t("isRead"))}">✓</span>` : ""}</span>
          </a></li>`;
        }).join("")}</ol></section>`).join("")}
    </div>`;
    fillEta(root);
    const dl = root.querySelector("#bk-dl");
    if (dl) dl.onclick = async () => {
      dl.disabled = true; dl.textContent = t("dlBusy");
      try { await downloadBook(b); toast(t("dlOk"), "ok"); } catch (e) { console.error(e); toast(e.message || String(e), "err"); }
      renderBook(b);
    };
    const del = root.querySelector("#bk-del");
    if (del) del.onclick = () => confirmDelete(b);
    const cb = root.querySelector("#bk-car");
    if (cb) cb.onclick = async () => {
      cb.disabled = true;
      try {
        await sendToCar(b, (i, n) => { cb.textContent = "⏳ " + t("carBusy", { i, n }); });
        toast(t("carOk", { t: pick(b, "title", uiLang()) }), "ok");
      } catch (e) { console.error(e); toast(e.message || String(e), "err"); }
      renderBook(b);
    };
    const cr = root.querySelector("#bk-car-rm");
    if (cr) cr.onclick = () => { try { car().removeBook(b.id); toast(t("carRmOk"), "ok"); } catch { /* */ } renderBook(b); };
    // bouton 📺 du haut : envoie le livre (à partir du prochain chapitre à lire)
    if (canCast() && (canDl || downloaded(b))) setCastAction({ label: t("tvBook", { t: pick(b, "title", ul) }), run: btn => toTv(b, n, btn) });
    if (upl(b)) bookSource(b);
  }

  /** Fenêtre de confirmation avant de supprimer un livre (tous les livres, importés ou non). */
  function confirmDelete(b) {
    const title = pick(b, "title", uiLang());
    const ov = document.createElement("div");
    ov.className = "bk-modal-ov";
    ov.innerHTML = `<div class="panel bk-modal" role="alertdialog" aria-modal="true" aria-labelledby="bk-del-q">
      <h2 id="bk-del-q">🗑 ${esc(t("delQ", { t: title }))}</h2>
      <p>${esc(t("delTxt", { n: b.chapters.length }))}</p>
      <p class="muted">${esc(t(upl(b) ? "delUp" : "delBook"))}</p>
      <div class="row bk-modal-acts"><button class="btn btn-ghost" data-m="no">${esc(t("cancel"))}</button>
        <button class="btn btn-danger" data-m="yes">🗑 ${esc(t("delSure"))}</button></div></div>`;
    const prevFocus = document.activeElement;
    const close = () => { ov.remove(); removeEventListener("keydown", onKey); if (prevFocus && prevFocus.focus) prevFocus.focus(); };
    const onKey = e => { if (e.key === "Escape") close(); };
    addEventListener("keydown", onKey);
    ov.onclick = async e => {
      if (e.target === ov) return close();
      const m = e.target.closest("[data-m]"); if (!m) return;
      if (m.dataset.m === "no") return close();
      ov.querySelectorAll("button").forEach(x => (x.disabled = true));
      m.textContent = "⏳ " + t("delSure") + "…";
      try { await deleteBook(b); close(); toast(t("delOk"), "ok"); location.hash = "#/books"; }
      catch (err) { console.error(err); toast(err.message || String(err), "err"); close(); }
    };
    document.body.appendChild(ov);
    ov.querySelector('[data-m="no"]').focus();
  }

  /* ---------------- import d'un cours PDF / EPUB ---------------- */
  /** Fichier d'origine d'un livre importé : où il est gardé, redécoupage. */
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
      <p class="bk-crumbs mono"><a class="btn btn-ghost btn-sm bk-back" href="#/books">📚 ${esc(t("backLib"))}</a></p>
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
    const u = upl(b), n = ch.n, i = b.chapters.findIndex(c => c.n === n);
    // Chapitre sans texte français : traduction automatique par le navigateur (Translator API de Chrome / Edge), jamais enregistrée
    const canTr = trSupported();
    const wantFr = u ? !!(u.lang === "en" && prefs.tr && prefs.tr[b.id]) : (cLang() === "fr" && !ch.html_fr);
    const trOn = wantFr && canTr;
    const lang = trOn ? "fr" : u ? voiceOf(b) : (cLang() === "fr" && !ch.html_fr ? "en" : cLang());
    const prev = b.chapters[i - 1], next = b.chapters[i + 1];
    P.last[b.id] = n; wrj(PKEY, P);
    const r = rec(b.id, n), html = (!u && lang === "fr" && ch.html_fr) || ch.html_en || "";
    const notes = ch.notes && (ch.notes[lang] || ch.notes.en);
    const base = `#/books/${encodeURIComponent(b.id)}`;
    const pos = P.pos[b.id + "|" + n] || 0;
    const tvNow = canCast() ? pairedTv() : null;     // télé associée : « Écouter » part sur la télé, le téléphone reste possible
    root.innerHTML = `<div class="bk-reader" style="--bk-font:${prefs.font}">
      <p class="bk-crumbs mono"><a class="btn btn-ghost btn-sm bk-back" href="#/books">📚 ${esc(t("backLib"))}</a> <span><a href="${base}">${esc(pick(b, "title", uiLang()))}</a></span></p>
      <header class="bk-ch-head">
        <p class="kicker mono">${esc(pick(ch, "section", lang))}${pick(ch, "section", lang) ? " · " : ""}${esc(t("chapter"))} ${n}/${b.chapters.length}</p>
        <h1 class="bk-ch-title" lang="${lang}">${esc(pick(ch, "title", trOn ? "en" : lang))}</h1>
        <div class="bk-tools">
          ${u ? `${trOn ? "" : `<div class="seg" role="group" aria-label="${esc(t("upVoice"))}" title="${esc(t("upVoice"))}">
            <span class="seg-lab mono muted">${esc(t("voice"))}</span>
            <button class="seg-btn mono" data-voice="fr" aria-pressed="${lang === "fr"}">FR</button>
            <button class="seg-btn mono" data-voice="en" aria-pressed="${lang === "en"}">EN</button>
          </div>`}
          ${u.lang === "en" ? `<button class="btn btn-ghost btn-sm" id="bk-tr" aria-pressed="${trOn}" ${canTr ? "" : "disabled"} title="${esc(canTr ? t("tr") : t("trNo"))}">🌐 ${esc(trOn ? t("trOff") : t("tr"))}</button>` : ""}`
          : `<div class="seg" role="group" aria-label="${esc(t("content"))}">
            <button class="seg-btn mono" data-clang="en" aria-pressed="${lang === "en"}">EN</button>
            <button class="seg-btn mono" data-clang="fr" aria-pressed="${lang === "fr"}" ${ch.html_fr || canTr ? "" : "disabled"}
              title="${esc(ch.html_fr ? "Français" : canTr ? t("tr") : t("trNo"))}">FR${ch.html_fr ? "" : " 🌐"}</button>
          </div>`}
          <div class="seg" role="group" aria-label="${esc(t("font"))}">
            <button class="seg-btn mono" data-font="-1" title="${esc(t("font"))}">A−</button>
            <button class="seg-btn mono" data-font="1" title="${esc(t("font"))}">A+</button>
          </div>
          ${(w => `<span class="bk-eta mono" data-w="${w}">${etaHtml(w)}</span>`)(countWords(html))}
          ${tvNow ? `<button class="btn btn-primary btn-sm" id="bk-tvlisten">📺 ${esc(t("tvListen", { n: tvNow.name || "TV" }))}</button>` : ""}
          ${tts.can ? `<button class="btn ${tvNow ? "btn-ghost" : "btn-primary"} btn-sm" id="bk-listen">🔊 ${esc(tvNow ? t("phoneListen") : pos ? t("resume") : t("listen"))}</button>
            <button class="btn btn-ghost btn-sm" id="bk-set-open" title="${esc(t("settings"))}">⚙ ${esc(t("settings"))}</button>` : ""}
          ${r.r ? `<span class="bk-read-tag mono">✓ ${esc(t("isRead"))}</span>` : ""}
        </div>
      </header>
      ${trOn ? `<p class="bk-tr-note mono" id="bk-tr-note" role="status">🌐 ${esc(t("trOn"))}</p>` : ""}
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
    <section class="bk-set panel" id="bk-set" hidden role="dialog" aria-label="${esc(t("settings"))}">
      <div class="bk-set-head"><h3 class="mono">⚙ ${esc(t("settings"))}</h3>
        <button class="icon-btn" data-set="close" title="${esc(t("close"))}" aria-label="${esc(t("close"))}">✕</button></div>
      <label class="bk-set-f"><span class="mono muted" id="bk-voice-lab"></span>
        <span class="row bk-set-voice"><select id="bk-voice"></select>
        <button class="btn btn-ghost btn-sm" data-set="try">🔊 ${esc(t("tryV"))}</button></span></label>
      <p class="muted bk-set-none" id="bk-voice-none" hidden>${esc(t("noVoices"))}</p>
      <div class="bk-set-f"><span class="mono muted">${esc(t("speed"))} : <strong id="bk-rate-v"></strong></span>
        <div class="row bk-set-rate">
          <button class="btn btn-ghost btn-sm mono" data-set="slower" title="${esc(t("slower"))}" aria-label="${esc(t("slower"))}">−</button>
          <input type="range" id="bk-rate" min="${RATE_MIN}" max="${RATE_MAX}" step="0.05" aria-label="${esc(t("speed"))}">
          <button class="btn btn-ghost btn-sm mono" data-set="faster" title="${esc(t("faster"))}" aria-label="${esc(t("faster"))}">+</button>
        </div>
        <div class="row bk-set-pre">${RATE_PRESETS.map(x => `<button class="seg-btn mono" data-rate="${x}">${x}×</button>`).join("")}</div>
      </div>
      <label class="bk-set-chain"><input type="checkbox" id="bk-chain"> <span>${esc(t("chain"))}</span></label>
      <label class="bk-set-chain"><input type="checkbox" id="bk-awake"> <span>${esc(t("awake"))}</span></label>
      ${window.AndroidListen ? `<div class="bk-set-bg" id="bk-bg"></div>` : ""}
      <div class="bk-set-f"><span class="mono muted">${esc(t("para"))}</span>
        <div class="row"><button class="btn btn-ghost btn-sm" data-pl="prevp" title="${esc(t("prevP"))}">⏪ ${esc(t("pPrev"))}</button>
          <button class="btn btn-ghost btn-sm" data-pl="nextp" title="${esc(t("nextP"))}">${esc(t("pNext"))} ⏩</button></div></div>
    </section>
    <div class="bk-player" id="bk-player" hidden role="region" aria-label="Audio">
      <button class="icon-btn" data-pl="prev" title="${esc(t("prevS"))}" aria-label="${esc(t("prevS"))}">⏮</button>
      <button class="icon-btn bk-pl-main" data-pl="toggle" title="${esc(t("play"))}" aria-label="${esc(t("play"))}">▶</button>
      <button class="icon-btn" data-pl="next" title="${esc(t("nextS"))}" aria-label="${esc(t("nextS"))}">⏭</button>
      <span class="bk-pl-pos mono" id="bk-pl-pos"></span>
      <button class="btn btn-ghost btn-xs mono" data-pl="set" title="${esc(t("settings"))}" aria-label="${esc(t("settings"))}">⚙ <span id="bk-pl-rate">${prefs.rate}×</span></button>
      <button class="icon-btn" data-pl="close" title="${esc(t("close"))}" aria-label="${esc(t("close"))}">✕</button>
    </div>`;

    root.querySelectorAll("[data-clang]").forEach(btn => btn.onclick = () => {
      if (btn.disabled) return; prefs.lang = btn.dataset.clang; savePrefs(); renderChapter(b, ch);
    });
    const trb = root.querySelector("#bk-tr");
    if (trb) trb.onclick = () => { (prefs.tr ||= {})[b.id] = !trOn; savePrefs(); renderChapter(b, ch); };
    root.querySelectorAll("[data-voice]").forEach(btn => btn.onclick = () => {
      (prefs.voice ||= {})[b.id] = btn.dataset.voice; savePrefs(); renderChapter(b, ch);
    });
    root.querySelectorAll("[data-font]").forEach(btn => btn.onclick = () => {
      prefs.font = Math.min(1.5, Math.max(0.85, Math.round((prefs.font + 0.1 * +btn.dataset.font) * 100) / 100)); savePrefs();
      root.querySelector(".bk-reader").style.setProperty("--bk-font", prefs.font);
    });
    const mark = () => { if (!rec(b.id, n).r) { rec(b.id, n).r = Date.now(); saveP(b.id, n); } };
    if (canCast()) setCastAction({ label: t("tvCh", { n }), run: btn => toTv(b, n, btn) });
    const tvl = root.querySelector("#bk-tvlisten");
    if (tvl) tvl.onclick = () => toTv(b, n, tvl);
    const mk = root.querySelector("#bk-mark");
    if (mk) mk.onclick = () => { mark(); renderChapter(b, ch); };
    // Arrivé en bas du chapitre : il compte comme lu.
    const end = root.querySelector(".bk-end");
    if ("IntersectionObserver" in window && end) {
      const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting) && root.querySelector(".bk-reader")) { mark(); io.disconnect(); } }, { threshold: 0.6 });
      setTimeout(() => io.observe(end), 1500);
    }
    window.scrollTo(0, 0);
    if (!trOn) return setupPlayer(b, ch, lang, mark);
    translateChapter(b, ch).then(ok => {
      const h = root.querySelector(".bk-reader .bk-ch-title");
      if (!h || h.dataset.ch !== String(n)) return;
      setupPlayer(b, ch, ok ? "fr" : "en", mark);
    });
  }

  /* ---------------- traduction automatique ---------------- */
  // Moteurs, dans l'ordre :
  //  - appli Android : traducteur hors ligne intégré (moteur Bergamot de Mozilla en WebAssembly, modèle EN→FR
  //    téléchargé une fois par l'appli), sinon en secours la traduction de l'appli (Android, puis Google en ligne) ;
  //  - navigateur : Translator API de Chrome / Edge.
  // Chaque chapitre traduit est gardé (appli : fichiers de l'appli ; navigateur : IndexedDB) et n'est plus jamais retraduit ;
  // une traduction interrompue reprend là où elle s'était arrêtée.
  const trCache = new Map();          // chapitres prêts pendant la session : { title, html, via }
  let trP = null;
  const natTr = () => (window.AndroidTranslate && typeof window.AndroidTranslate.translate === "function" ? window.AndroidTranslate : null);
  const trWait = new Map();
  window.__trDone = (id, res, err) => { const w = trWait.get(id); if (!w) return; trWait.delete(id); res ? w.ok(res) : w.ko(new Error(err || "?")); };
  let trSeq = 0;
  /** Traduction de l'appli (Android sur l'appareil, sinon Google en ligne). */
  const appEngine = {
    via: "online", pack: 9000,
    many(list) {
      const id = "t" + (++trSeq);
      return new Promise((ok, ko) => {
        trWait.set(id, { ok, ko });
        setTimeout(() => { if (trWait.delete(id)) ko(new Error("timeout")); }, 240000);
        try { natTr().translate(id, JSON.stringify(list)); } catch (e) { trWait.delete(id); ko(e); }
      }).then(r => { try { this.via = natTr().via() || "online"; } catch { /* */ } return r; });
    },
  };
  /** Traducteur hors ligne (Bergamot) : modèle téléchargé par l'appli, servi à la page sous __models/. */
  let bgP = null, offlineBroken = false;      // moteur hors ligne en panne sur ce téléphone : secours en ligne pour la session
  function offlineEngine(onModel) {
    const A = natTr();
    if (!A || typeof A.modelState !== "function" || offlineBroken) return Promise.reject(new Error("no offline model"));
    if (bgP) return bgP;
    bgP = (async () => {
      if (A.modelState() !== "ready") {
        await new Promise((ok, ko) => {
          window.__trModel = (p, err) => { if (p < 0) ko(new Error(err || "?")); else if (p >= 100) ok(); else onModel && onModel(p); };
          A.modelDownload();
        });
      }
      const m = await import("../vendor/bergamot/translator.js");
      const T = new m.BatchTranslator({ registryUrl: "__models/registry.json", workers: 2, batchSize: 16, downloadTimeout: 0, pivotLanguage: null });
      const eng = {
        via: "offline", pack: 2500,
        many: list => Promise.all(list.map(text => T.translate({ from: "en", to: "fr", text, html: false }).then(r => r.target.text))),
      };
      await withTimeout(eng.many(["Ready."]), 120000);   // charge le modèle (et vérifie que le moteur marche)
      return eng;
    })().catch(e => { bgP = null; if (!/HTTP|fetch|network|Failed/i.test(e.message || "")) offlineBroken = true; throw e; });
    return bgP;
  }
  function trSupported() { return !!natTr() || (typeof self !== "undefined" && "Translator" in self && typeof self.Translator.create === "function"); }
  async function browserEngine(onDl) {
    if (trP) return trP;
    const av = await withTimeout(self.Translator.availability({ sourceLanguage: "en", targetLanguage: "fr" }), 8000);
    if (av === "unavailable") throw new Error(t("trNo"));
    // Pas de réponse pendant 20 s (ni téléchargement en cours) : on abandonne plutôt que de bloquer la lecture
    let last = Date.now();
    const create = self.Translator.create({
      sourceLanguage: "en", targetLanguage: "fr",
      monitor(m) { m.addEventListener("downloadprogress", e => { last = Date.now(); onDl && onDl(Math.round((e.loaded || 0) * 100)); }); },
    });
    const watchdog = new Promise((_, ko) => { const id = setInterval(() => { if (Date.now() - last > 20000) { clearInterval(id); ko(new Error("timeout")); } }, 1000); create.finally(() => clearInterval(id)); });
    trP = Promise.race([create, watchdog]).then(tr => ({ via: "browser", pack: 1, many: async list => [await tr.translate(list[0])] }))
      .catch(e => { trP = null; throw e; });
    return trP;
  }
  /** Moteur à utiliser ; dans l'appli, le hors ligne d'abord, la traduction en ligne en secours. */
  async function translator(status) {
    if (!natTr()) return browserEngine(p => status(t("trDl", { p })));
    try { return await offlineEngine(p => status(t("trModel", { p }))); }
    catch (e) { console.warn("traducteur hors ligne", e); return appEngine; }
  }
  const trNote = via => t(via === "offline" ? "trOffline" : via === "online" ? "trOnline" : via === "device" ? "trDevice" : "trOn");

  // Traductions gardées : { v, via, map: { texte anglais: texte français } } par chapitre
  const trKey = (b, n) => `${b.id}|${n}`;
  async function trLoad(key) {
    try {
      const A = natTr();
      if (A && typeof A.load === "function") { const s = A.load(key); return s ? JSON.parse(s) : null; }
      return (await idbGet("tr:" + key)) || null;
    } catch { return null; }
  }
  async function trSave(key, data) {
    try {
      const A = natTr();
      if (A && typeof A.save === "function") A.save(key, JSON.stringify(data));
      else await idbSet("tr:" + key, data);
    } catch { /* stockage plein ou indisponible : la traduction reste affichée */ }
  }
  /** Morceaux à traduire d'un chapitre : bloc entier, ou seulement le texte hors code si le contenu est mélangé. */
  function trJobs(h1, art) {
    const els = [h1, ...art.querySelectorAll("h3, p, li, td, th, blockquote, dt, dd")].filter(el => el && !el.closest("pre"));
    const jobs = [];
    for (const el of els) {
      if (!el.querySelector("code, ul, ol, table, p")) { const src = el.textContent.replace(/\s+/g, " ").trim(); if (src) jobs.push({ src, put: v => { el.textContent = v; } }); continue; }
      for (const tn of [...el.childNodes].filter(x => x.nodeType === 3 || (x.nodeType === 1 && /^(a|strong|em|b|i|span)$/i.test(x.tagName)))) {
        const raw = tn.textContent; if (!raw.trim()) continue;
        jobs.push({ src: raw.replace(/\s+/g, " ").trim(), put: v => { tn.textContent = (/^\s/.test(raw) ? " " : "") + v + (/\s$/.test(raw) ? " " : ""); } });
      }
    }
    return jobs;
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  /** Traduit les morceaux manquants par paquets, en gardant chaque paquet terminé ; limite de débit : attente puis reprise. */
  async function trRun(key, jobs, data, status, alive) {
    let tr = null;
    const todo = jobs.filter(j => !(j.src in data.map));
    let k = 0, waits = 0;
    while (k < todo.length) {
      if (!alive()) return false;
      if (!tr) tr = await translator(status);
      const part = [];
      for (let len = 0; k + part.length < todo.length && (part.length < 1 || (tr.pack > 1 && len + todo[k + part.length].src.length < tr.pack)); ) {
        len += todo[k + part.length].src.length; part.push(todo[k + part.length]);
      }
      status(t("trBusy", { i: jobs.length - todo.length + k + part.length, n: jobs.length }));
      let out;
      try { out = await tr.many(part.map(j => j.src)); }
      catch (e) {
        // Google limite le débit (429) : on attend puis on reprend où on en était (rien n'est perdu)
        if (/429|HTTP 5\d\d|timeout/.test(e.message || "") && waits < 4 && alive()) {
          const s = (window.__trWaitS || 30) * ++waits;
          for (let x = s; x > 0 && alive(); x--) { status(t("trWait", { s: x })); await sleep(1000); }
          continue;
        }
        throw e;
      }
      if (!alive()) return false;
      data.via = tr.via;
      part.forEach((j, x) => { if (typeof out[x] === "string" && out[x].trim()) { data.map[j.src] = out[x]; j.put(out[x]); } });
      k += part.length;
      await trSave(key, data);
    }
    return true;
  }
  /** Traduit en place le titre et le texte du chapitre affiché (le code n'est pas traduit). */
  async function translateChapter(b, ch) {
    const key = trKey(b, ch.n), art = root.querySelector(".bk-content"), h1 = root.querySelector(".bk-ch-title");
    const note = root.querySelector("#bk-tr-note");
    h1.dataset.ch = String(ch.n);
    const status = msg => { if (note && note.isConnected) note.textContent = "🌐 " + msg; };
    const hit = trCache.get(key);
    if (hit) { h1.textContent = hit.title; art.innerHTML = hit.html; status(trNote(hit.via)); prefetchTr(b, ch); return true; }
    try {
      const jobs = trJobs(h1, art);
      const data = (await trLoad(key)) || { v: 1, via: "", map: {} };
      data.map ||= {};
      if (!h1.isConnected) return false;
      jobs.forEach(j => { if (j.src in data.map) j.put(data.map[j.src]); });          // déjà traduit : affiché tout de suite
      if (!(await trRun(key, jobs, data, status, () => h1.isConnected))) return false;
      trCache.set(key, { title: h1.textContent, html: art.innerHTML, via: data.via });
      status(trNote(data.via));
      prefetchTr(b, ch);
      return true;
    } catch (e) {
      console.warn("traduction", e);
      if (!note || !note.isConnected) return false;
      note.innerHTML = `⚠ ${esc(t("trErr"))} : ${esc(e.message === "timeout" ? t("trSlow") : e.message || String(e))} <button class="btn btn-ghost btn-xs" id="bk-tr-retry">${esc(t("trRetry"))}</button>`;
      note.querySelector("#bk-tr-retry").onclick = () => renderChapter(b, ch);   // reprend là où la traduction s'est arrêtée
      return false;
    }
  }
  /** Appli : le chapitre suivant est traduit en arrière-plan (écoute enchaînée sans attente). */
  let prefetching = null;
  function prefetchTr(b, ch) {
    if (!natTr()) return;
    const nx = nextOf(b, ch.n);
    if (nx == null || prefetching === trKey(b, nx) || trCache.has(trKey(b, nx))) return;
    const key = trKey(b, nx); prefetching = key;
    setTimeout(async () => {
      try {
        const c2 = await loadChapter(b, nx);
        const doc = new DOMParser().parseFromString(`<h1>${esc(pick(c2, "title", "en"))}</h1><div>${c2.html_en || ""}</div>`, "text/html");
        const data = (await trLoad(key)) || { v: 1, via: "", map: {} }; data.map ||= {};
        await trRun(key, trJobs(doc.querySelector("h1"), doc.querySelector("div")), data, () => {}, () => prefetching === key);
      } catch (e) { console.warn("traduction du chapitre suivant", e); }
      finally { if (prefetching === key) prefetching = null; }
    }, 1500);
  }

  /* ---------------- lecteur audio (phrase par phrase) ---------------- */
  const cleanSpeech = s => s.replace(/\s+/g, " ").trim()
    .replace(/^(.{2,80}?):\s/, (m, a) => (/[.!?]$/.test(a) ? m : a + ". "));
  /** Découpe un texte en phrases : [[début, fin], …] (positions dans le texte), les très courtes collées à leur voisine. */
  function sentences(raw, lang) {
    const out = [];
    if (window.Intl && Intl.Segmenter) {
      for (const x of new Intl.Segmenter(lang, { granularity: "sentence" }).segment(raw)) out.push([x.index, x.index + x.segment.length]);
    } else {
      const rx = /[^.!?…]+(?:[.!?…]+["»”)\]]*\s*|$)/g; let m;
      while ((m = rx.exec(raw)) && m[0]) out.push([m.index, m.index + m[0].length]);
    }
    const res = [];
    for (const r of out) {
      const len = raw.slice(r[0], r[1]).trim().length;
      if (!len) { if (res.length) res[res.length - 1][1] = r[1]; continue; }
      const last = res[res.length - 1];
      if (last && (len < 14 || raw.slice(last[0], last[1]).trim().length < 14)) last[1] = r[1];
      else res.push([r[0], r[1]]);
    }
    return res.length ? res : [[0, raw.length]];
  }
  /** Plage DOM couvrant les caractères [a, b[ du texte d'un élément (pour surligner la phrase lue). */
  function textRange(el, a, b) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const r = document.createRange(); let pos = 0, n, okA = false;
    while ((n = w.nextNode())) {
      const L = n.nodeValue.length;
      if (!okA && a <= pos + L) { r.setStart(n, Math.max(0, a - pos)); okA = true; }
      if (okA && b <= pos + L) { r.setEnd(n, Math.max(0, b - pos)); return r; }
      pos += L;
    }
    return okA ? (r.setEndAfter(el.lastChild || el), r) : null;
  }
  const canHL = () => !!(window.CSS && CSS.highlights && window.Highlight);
  const clearHL = () => { if (canHL()) CSS.highlights.delete("bk-sent"); };

  function setupPlayer(b, ch, lang, onEnd) {
    const bar = root.querySelector("#bk-player"), btn = root.querySelector("#bk-listen"), set = root.querySelector("#bk-set");
    if (!bar || !tts.can) return;
    const speakLang = lang === "fr" && !tts.canFr ? "en" : lang;
    const segs = [];
    root.querySelectorAll(".bk-ch-title, .bk-content h3, .bk-content p, .bk-content li, .bk-content pre, .bk-notes h3, .bk-notes p").forEach(el => {
      if (el.tagName === "PRE") {
        const txt = codeForEar(el.textContent, speakLang);
        if (txt) { el.dataset.seg = segs.length; el.classList.add("bk-seg"); segs.push({ el, txt, a: null }); }
        return;
      }
      if (el.closest("pre") || el.classList.contains("bk-notes-sub")) return;
      const nested = el.tagName === "LI" && el.querySelector("ul,ol");
      const first = segs.length;
      if (nested) {
        const c = el.cloneNode(true); c.querySelectorAll("ul,ol").forEach(x => x.remove());
        const txt = cleanSpeech(c.textContent || ""); if (txt) segs.push({ el, txt, a: null });
      } else {
        const raw = el.textContent || "";
        for (const [a, z] of sentences(raw, lang)) { const txt = cleanSpeech(raw.slice(a, z)); if (txt) segs.push({ el, txt, a, z }); }
      }
      if (segs.length > first) { el.dataset.seg = first; el.classList.add("bk-seg"); }
    });
    if (!segs.length) return;
    const key = b.id + "|" + ch.n;
    player = { segs, i: Math.min(P.pos[key] || 0, segs.length - 1), playing: false, token: 0, lang: speakLang };
    const posEl = bar.querySelector("#bk-pl-pos"), main = bar.querySelector(".bk-pl-main");
    const paint = () => {
      const cur = segs[player.i], on = !bar.hidden;
      segs.forEach(s => s.el.classList.toggle("bk-say", on && s.el === cur.el));
      clearHL();
      if (on && canHL() && cur.a != null) { const r = textRange(cur.el, cur.a, cur.z); if (r) CSS.highlights.set("bk-sent", new Highlight(r)); }
      posEl.textContent = `${player.i + 1}/${segs.length}`;
      posEl.title = t("sentOf", { i: player.i + 1, n: segs.length });
      main.textContent = player.playing ? "⏸" : "▶";
      main.title = main.ariaLabel = t(player.playing ? "pause" : "play");
      bar.querySelector("#bk-pl-rate").textContent = prefs.rate + "×";
      screenAwake(on && player.playing);
      const m = media();
      if (m) try {
        if (on) m.update(!!player.playing, pick(ch, "title", lang) || `${t("chapter")} ${ch.n}`, `${pick(b, "title", uiLang())} · ${t("chapter")} ${ch.n}`);
        else m.end();
      } catch { /* ancienne appli */ }
    };
    const keep = () => { P.pos[key] = player.i; wrj(PKEY, P); };
    const play = j => {
      if (!player || j < 0 || j >= segs.length) return;
      player.i = j; player.playing = true; keep();
      const my = ++player.token; paint();
      const el = segs[j].el, rc = el.getBoundingClientRect();
      if (rc.top < (parseInt(document.documentElement.style.getPropertyValue("--tb-h")) || 60) + 56 || rc.bottom > innerHeight - 40) el.scrollIntoView({ behavior: "smooth", block: "center" });
      say(segs[j].txt, player.lang, () => {
        if (!player || my !== player.token) return;
        if (j + 1 < segs.length) play(j + 1);
        else {
          player.playing = false; player.i = 0; P.pos[key] = 0; wrj(PKEY, P); onEnd();
          const nx = prefs.chain && nextOf(b, ch.n);
          if (!nx) return paint();
          try { sessionStorage.setItem("bk-auto", b.id + "|" + nx); } catch { /* */ }
          location.hash = `#/books/${encodeURIComponent(b.id)}/${nx}`;        // la lecture reprend au début du chapitre suivant
        }
      });
    };
    const pause = () => { if (!player) return; player.token++; player.playing = false; tts.stop(); paint(); };
    const go = j => { j = Math.max(0, Math.min(segs.length - 1, j)); if (player.playing) play(j); else { player.i = j; keep(); paint(); } };
    const paraStart = (i, dir) => {
      const el = segs[i].el; let j = i;
      if (dir < 0) {
        while (j > 0 && segs[j - 1].el === el) j--;                 // début du paragraphe en cours…
        if (j === i && j > 0) { j--; const e2 = segs[j].el; while (j > 0 && segs[j - 1].el === e2) j--; }   // …ou du précédent
        return j;
      }
      while (j < segs.length - 1 && segs[j].el === el) j++;
      return j;
    };
    // position du lecteur : juste sous la barre de titre (sa hauteur change avec la largeur de l'écran)
    const tbH = () => { const tb = document.querySelector(".topbar"); document.documentElement.style.setProperty("--tb-h", (tb ? tb.offsetHeight : 0) + "px"); };
    tbH(); addEventListener("resize", tbH, { passive: true });
    const open = () => {
      bar.hidden = false; document.body.classList.add("bk-playing");
      if (lang === "fr" && !tts.canFr) toast(t("noVoiceFr"), "warn");
      else if (window.AndroidListen && !bgWarned) { try { if (!window.AndroidListen.notifOk()) { bgWarned = true; toast(t("bgNotif"), "warn"); } } catch { /* */ } }
      play(player.i);
    };
    if (btn) btn.onclick = () => (bar.hidden ? open() : player.playing ? pause() : play(player.i));
    bar.onclick = e => {
      const a = e.target.closest("[data-pl]"); if (!a || !player) return;
      const k = a.dataset.pl;
      if (k === "toggle") player.playing ? pause() : play(player.i);
      else if (k === "prev") go(player.i - 1);
      else if (k === "next") go(player.i + 1);
      else if (k === "set") toggleSet();
      else if (k === "close") { pause(); bar.hidden = true; set.hidden = true; document.body.classList.remove("bk-playing"); paint(); }
    };

    /* Réglages : voix parmi celles de l'appareil, vitesse (ralentir / accélérer), saut de paragraphe */
    const sel = set.querySelector("#bk-voice"), range = set.querySelector("#bk-rate");
    const fillVoices = () => {
      const vs = tts.voices ? tts.voices(speakLang) : [], cur = prefs.vname[speakLang] || "";
      set.querySelector("#bk-voice-lab").textContent = t("voiceOf", { l: speakLang === "fr" ? "français" : "English" });
      sel.innerHTML = `<option value="">${esc(t("auto"))}</option>` + vs.map(v => `<option value="${esc(v.id)}">${esc(v.label)}</option>`).join("");
      sel.value = vs.some(v => v.id === cur) ? cur : "";
      set.querySelector("#bk-voice-none").hidden = vs.length > 0;
    };
    const showRate = () => {
      range.value = prefs.rate;
      set.querySelector("#bk-rate-v").textContent = prefs.rate + "×";
      set.querySelectorAll("[data-rate]").forEach(x => x.setAttribute("aria-pressed", +x.dataset.rate === prefs.rate));
      paint();
    };
    const setRate = r => {
      prefs.rate = clampRate(r); savePrefs(); showRate();
      document.querySelectorAll(".bk-eta[data-w]").forEach(x => { x.innerHTML = etaHtml(+x.dataset.w); });
      if (player && player.playing) play(player.i);                 // la phrase en cours reprend à la nouvelle vitesse
    };
    // Appli Android : vérifie ce qui pourrait couper l'écoute écran éteint (notifications, économie de batterie)
    const fillBg = () => {
      const box = set.querySelector("#bk-bg"), L = window.AndroidListen; if (!box || !L) return;
      let n = true, bat = true; try { n = L.notifOk(); bat = L.batteryOk(); } catch { /* */ }
      box.innerHTML = `<h4>${esc(t("bgT"))}</h4>` + (n && bat ? `<p class="muted">✓ ${esc(t("bgOk"))}</p>` : "")
        + (n ? "" : `<p>⚠ ${esc(t("bgNotif"))}</p><button class="btn btn-ghost btn-sm" data-bg="notif">🔔 ${esc(t("bgNotifB"))}</button>`)
        + (bat ? "" : `<p>⚠ ${esc(t("bgBat"))}</p><button class="btn btn-ghost btn-sm" data-bg="bat">🔋 ${esc(t("bgBatB"))}</button>`);
      box.querySelectorAll("[data-bg]").forEach(x => x.onclick = () => { try { x.dataset.bg === "notif" ? L.openNotif() : L.openBattery(); } catch { /* */ } });
    };
    document.addEventListener("visibilitychange", function onVis() {
      if (!set.isConnected) return document.removeEventListener("visibilitychange", onVis);
      if (!document.hidden && !set.hidden) fillBg();              // retour des réglages du téléphone
    });
    const toggleSet = (force) => {
      set.hidden = force != null ? !force : !set.hidden;
      document.body.classList.toggle("bk-set-on", !set.hidden);
      if (!set.hidden) { fillVoices(); showRate(); fillBg(); }
    };
    // Réglages ouverts : un clic ailleurs sur la page les referme (ils ne bloquent jamais le reste)
    const offSet = e => {
      if (!set.isConnected) return document.removeEventListener("pointerdown", offSet, true);
      if (set.hidden || set.contains(e.target) || e.target.closest('[data-pl="set"], #bk-set-open')) return;
      toggleSet(false);
    };
    document.addEventListener("pointerdown", offSet, true);
    const so = root.querySelector("#bk-set-open");
    if (so) so.onclick = () => toggleSet();
    if (tts.onVoices) tts.onVoices(() => { if (!set.hidden && set.isConnected) fillVoices(); });
    sel.onchange = () => {
      prefs.vname[speakLang] = sel.value; savePrefs();
      if (player && player.playing) play(player.i);
    };
    range.oninput = () => { prefs.rate = clampRate(range.value); set.querySelector("#bk-rate-v").textContent = prefs.rate + "×"; };
    range.onchange = () => setRate(range.value);
    set.onclick = e => {
      const r = e.target.closest("[data-rate]"); if (r) return setRate(r.dataset.rate);
      const pl = e.target.closest("[data-pl]");
      if (pl && player) { if (bar.hidden) { bar.hidden = false; document.body.classList.add("bk-playing"); } go(paraStart(player.i, pl.dataset.pl === "prevp" ? -1 : 1)); return; }
      const a = e.target.closest("[data-set]"); if (!a) return;
      const k = a.dataset.set;
      if (k === "close") toggleSet(false);
      else if (k === "slower") setRate(prefs.rate - RATE_STEP);
      else if (k === "faster") setRate(prefs.rate + RATE_STEP);
      else if (k === "try") { pause(); say(speakLang === "fr" ? t("sample") : t("sampleEn"), speakLang, () => {}); }
    };
    // Toucher un paragraphe pendant l'écoute : la lecture reprend à partir de là.
    root.querySelector(".bk-reader").addEventListener("click", e => {
      if (bar.hidden || e.target.closest("a, button")) return;
      const s = e.target.closest(".bk-seg"); if (s) play(+s.dataset.seg);
    });
    const chain = set.querySelector("#bk-chain");
    chain.checked = prefs.chain;
    chain.onchange = () => { prefs.chain = chain.checked; savePrefs(); };
    const awake = set.querySelector("#bk-awake");
    awake.checked = prefs.awake;
    awake.onchange = () => { prefs.awake = awake.checked; savePrefs(); screenAwake(false); if (player && player.playing) screenAwake(true); };
    // Commandes venues de la notification, de l'écran verrouillé, du casque, du volant ou de la télécommande
    mediaCtl = {
      toggle: () => (bar.hidden ? open() : player.playing ? pause() : play(player.i)),
      play: () => (bar.hidden ? open() : player.playing || play(player.i)),
      pause: () => player && player.playing && pause(),
      next: () => player && go(player.i + 1),
      prev: () => player && go(player.i - 1),
    };
    let auto = null; try { auto = sessionStorage.getItem("bk-auto"); } catch { /* */ }
    if (auto === key) { try { sessionStorage.removeItem("bk-auto"); } catch { /* */ } player.i = 0; open(); }
  }
  function stop() {
    mediaCtl = null;
    if (player) { player.token++; player.playing = false; player = null; tts.stop(); const m = media(); if (m) try { m.end(); } catch { /* */ } }
    screenAwake(false);
    clearHL();
    document.body.classList.remove("bk-playing", "bk-set-on");
  }

  /* ---------------- quiz de fin de chapitre ---------------- */
  function renderQuiz(b, ch) {
    stop();
    const lang = cLang(), qs = ch.quiz || [], base = `#/books/${encodeURIComponent(b.id)}/${ch.n}`;
    if (!quizState || quizState.key !== b.id + "|" + ch.n) quizState = { key: b.id + "|" + ch.n, ans: {}, sel: {} };
    // q.a : index de la bonne réponse, ou tableau d'index pour les questions à plusieurs réponses (« Choose two »)
    const A = quizState.ans, S = quizState.sel, nAns = Object.keys(A).length;
    const isOk = (q, x) => Array.isArray(q.a) ? Array.isArray(x) && x.length === q.a.length && q.a.every(v => x.includes(v)) : x === q.a;
    const isGood = (q, j) => Array.isArray(q.a) ? q.a.includes(j) : j === q.a;
    const picked = (x, j) => Array.isArray(x) ? x.includes(j) : x === j;
    const good = qs.filter((q, i) => isOk(q, A[i])).length;
    const L2 = q => q[lang] || q.en;
    const r = rec(b.id, ch.n);
    root.innerHTML = `<div class="bk-quiz">
      <p class="bk-crumbs mono"><a class="btn btn-ghost btn-sm bk-back" href="#/books">📚 ${esc(t("backLib"))}</a> <span><a href="#/books/${encodeURIComponent(b.id)}">${esc(pick(b, "title", uiLang()))}</a> › <a href="${base}">${esc(t("chapter"))} ${ch.n}</a></span></p>
      <header class="bk-ch-head"><p class="kicker mono">${esc(t("quiz"))} · ${esc(t("chapter"))} ${ch.n}</p>
        <h1 lang="${lang}">${esc(pick(ch, "title", lang))}</h1>
        <div class="bk-tools"><div class="seg" role="group" aria-label="${esc(t("content"))}">
          <button class="seg-btn mono" data-clang="en" aria-pressed="${lang === "en"}">EN</button>
          <button class="seg-btn mono" data-clang="fr" aria-pressed="${lang === "fr"}">FR</button></div>
          ${r.b != null ? `<span class="mono muted">${esc(t("best"))} : <strong>${r.b}/${r.t}</strong></span>` : ""}</div>
      </header>
      ${qs.map((q, i) => {
        const x = L2(q), done = i in A;
        return `<section class="panel bk-q${done ? (isOk(q, A[i]) ? " ok" : " ko") : ""}" lang="${lang}">
          <div class="bk-q-head"><p class="mono muted">${esc(t("qOf", { i: i + 1, n: qs.length }))}</p>
            ${tts.can ? `<button class="btn btn-ghost btn-xs btn-speak" data-qspeak="${i}">🔊 ${esc(t("listenQ"))}</button>` : ""}</div>
          <h3>${esc(x.q)}</h3>
          <div class="bk-opts">${x.o.map((o, j) => {
            const cls = done ? (isGood(q, j) ? " correct" : picked(A[i], j) ? " wrong" : "") : (S[i] && S[i].includes(j) ? " selected" : "");
            return `<button class="opt bk-opt${cls}" data-q="${i}" data-o="${j}" ${done ? "disabled" : ""}><span class="opt-key mono">${String.fromCharCode(65 + j)}</span><span>${esc(o)}</span></button>`;
          }).join("")}</div>
          ${!done && Array.isArray(q.a) ? `<p class="mono muted small">${esc(t("pickN", { n: q.a.length }))}</p>` : ""}
          ${done ? `<p class="bk-expl"><strong>${esc(isOk(q, A[i]) ? "✓ " + t("correct") : "✗ " + t("wrong"))}.</strong> ${esc(x.e)}</p>` : ""}
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
      const i = +btn.dataset.q, o = +btn.dataset.o; if (i in A) return;
      if (Array.isArray(qs[i].a)) {   // plusieurs réponses : on valide quand le bon nombre de cases est coché
        const sel = S[i] || (S[i] = []), at = sel.indexOf(o);
        if (at >= 0) sel.splice(at, 1); else sel.push(o);
        if (sel.length === qs[i].a.length) A[i] = [...sel].sort((x, y) => x - y);
      } else A[i] = o;
      if (Object.keys(A).length === qs.length) {
        const score = qs.filter((q, k) => isOk(q, A[k])).length, rr = rec(b.id, ch.n);
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
      if (i in A) txt += ` ${fr ? "Bonne réponse" : "Correct answer"} ${[].concat(q.a).map(v => String.fromCharCode(65 + v)).join(fr ? " et " : " and ")}. ${x.e}`;
      btn.classList.add("on");
      say(txt, sl, () => btn.classList.remove("on"));
    });
    const rt = root.querySelector("#bk-retry");
    if (rt) rt.onclick = () => { quizState = null; renderQuiz(b, ch); window.scrollTo(0, 0); };
  }
  const nextOf = (b, n) => { const i = b.chapters.findIndex(c => c.n === n); return b.chapters[i + 1] && b.chapters[i + 1].n; };

  return { render, sync, forget, stop };
}
