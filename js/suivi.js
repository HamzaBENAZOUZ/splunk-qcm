// Onglet « Suivi » : planning de formation SPLK-1001 → 1002 → 1003 (3 scénarios), progression, examens, budget.
// L'avancement est gardé sur l'appareil (localStorage, même clé que l'ancien site suivi-splunk) et synchronisé
// avec la table splunk_suivi de Supabase (une ligne par utilisateur, la version la plus récente gagne).
import { DATA, EN } from "./suivi-data.js";

const SCENS = ["Optimiste", "Réaliste", "Pessimiste"];
const PHASES = ["0. Démarrage", "1. Certified User", "Pause Noël (allégée)", "2. Power User", "3. Admin"];
const TYPES = ["Cours", "Lab", "Révision", "Examen"];
const STORE_KEY = "splunk-suivi-v1", META_KEY = STORE_KEY + "-meta", TAB_KEY = STORE_KEY + "-tab";
const APP_ID = "splunk-training-tracker";
const TABLE = "splunk_suivi";

const L = {
  fr: {
    tabPlan: "Planning", tabProg: "Progression", tabExams: "Examens", tabBudget: "Budget", tabRes: "Ressources",
    settings: "Réglages du planning", scenario: "Scénario", startDate: "Date de début (lundi)", reset: "Tout décocher",
    search: "Rechercher une séance…", allPhases: "Toutes les phases", allTypes: "Tous les types", hideDone: "Masquer les séances faites", gotoNext: "Aller à la prochaine séance",
    week: "Semaine", sessions: "séances", late: "en retard", note: "Note", addNote: "+ note", noteph: "Tes notes sur cette séance…", noResults: "Aucune séance ne correspond aux filtres.",
    done: "Faites", pctSessions: "% séances", hPlanned: "Heures prévues", hDone: "Heures faites", pctHours: "% heures", phase: "Phase", total: "TOTAL",
    kSessions: "Séances faites", kHours: "Heures faites", kLate: "En retard", kNextExam: "Prochain examen", kEnd: "Fin du planning", of: "sur",
    nextTitle: "Prochaine séance", markDone: "Marquer comme faite", nothingLeft: "Toutes les séances sont faites. Bravo !", byPhase: "Progression par phase", compare: "Comparaison des scénarios",
    cExam1: "Examen SPLK-1001 (User)", cExam2: "Examen SPLK-1002 (Power User)", cExam3: "Examen SPLK-1003 (Admin)", cEnd: "Fin du planning", cWeeks: "Nombre de semaines", cHours: "Heures totales", cAvg: "Moyenne h/semaine",
    compareNote: "Pessimiste : en cas d'échec, un repassage est prévu une semaine après chaque examen (attente minimale de 7 jours). Chaque scénario a sa propre progression.",
    plannedDate: "Date prévue", format: "Format", prereq: "Prérequis", registered: "Inscrit", passed: "Réussi", retake: "Repassage éventuel",
    examNote: "À vérifier au moment de l'inscription (Pearson VUE, via ton compte splunk.com) : prix (130 $ par tentative, vérifié le 03/11/2026), format et prérequis peuvent évoluer. Réserve la date environ 3 semaines avant pour te fixer l'objectif.",
    budgetIntro: "Prix des examens vérifiés le 03/11/2026 sur splunk.com (Candidate Handbook v.10.20.26). Prix des cours Udemy : montant total indiqué par HB (120 €). Le taux de change est une hypothèse à ajuster.",
    rate: "Taux de change (1 $ = x €)", item: "Poste", amount: "Montant", inEur: "En €", status: "Statut du prix", source: "Source / remarque",
    budgetTotal: "TOTAL (tout réussi du 1er coup)", budgetRetake: "Par repassage éventuel",
    resNote: "Les sections et durées viennent des sommaires Udemy des 4 cours (Essentials 5 h 57, User 15 h 06, Power User 18 h 13, Admin 28 h 15). Chaque séance prévoit le temps vidéo + la manipulation sur la VM.",
    confirmReset: "Décocher toutes les séances du scénario « {s} » et effacer ses notes ?", resetDone: "Scénario remis à zéro",
    synced: "Synchronisé", syncing: "Synchronisation…", offline: "Hors ligne : enregistré ici, envoi au retour du réseau", err: "Erreur de synchronisation", local: "Enregistré sur cet appareil",
    pulled: "Suivi mis à jour depuis ton compte", h: "h",
  },
  en: {
    tabPlan: "Schedule", tabProg: "Progress", tabExams: "Exams", tabBudget: "Budget", tabRes: "Resources",
    settings: "Schedule settings", scenario: "Scenario", startDate: "Start date (Monday)", reset: "Uncheck all",
    search: "Search sessions…", allPhases: "All phases", allTypes: "All types", hideDone: "Hide completed sessions", gotoNext: "Go to next session",
    week: "Week", sessions: "sessions", late: "overdue", note: "Note", addNote: "+ note", noteph: "Your notes on this session…", noResults: "No session matches the filters.",
    done: "Done", pctSessions: "% sessions", hPlanned: "Planned hours", hDone: "Hours done", pctHours: "% hours", phase: "Phase", total: "TOTAL",
    kSessions: "Sessions done", kHours: "Hours done", kLate: "Overdue", kNextExam: "Next exam", kEnd: "Schedule ends", of: "of",
    nextTitle: "Next session", markDone: "Mark as done", nothingLeft: "Every session is done. Well done!", byPhase: "Progress by phase", compare: "Scenario comparison",
    cExam1: "SPLK-1001 exam (User)", cExam2: "SPLK-1002 exam (Power User)", cExam3: "SPLK-1003 exam (Admin)", cEnd: "Schedule ends", cWeeks: "Number of weeks", cHours: "Total hours", cAvg: "Average h/week",
    compareNote: "Pessimistic: if an exam is failed, a retake is planned one week later (7-day minimum wait). Each scenario keeps its own progress.",
    plannedDate: "Planned date", format: "Format", prereq: "Prerequisites", registered: "Registered", passed: "Passed", retake: "Possible retake",
    examNote: "Check when registering (Pearson VUE, via your splunk.com account): price ($130 per attempt, checked on 3 Nov 2026), format and prerequisites may change. Book the date about 3 weeks ahead to commit to the goal.",
    budgetIntro: "Exam prices checked on 3 Nov 2026 on splunk.com (Candidate Handbook v.10.20.26). Udemy course price: total amount given by HB (€120). The exchange rate is an assumption to adjust.",
    rate: "Exchange rate ($1 = x €)", item: "Item", amount: "Amount", inEur: "In €", status: "Price status", source: "Source / remark",
    budgetTotal: "TOTAL (everything passed first time)", budgetRetake: "Per possible retake",
    resNote: "Sections and durations come from the Udemy outlines of the 4 courses (Essentials 5 h 57, User 15 h 06, Power User 18 h 13, Admin 28 h 15). Each session includes video time + hands-on work on the VM.",
    confirmReset: "Uncheck every session of the “{s}” scenario and clear its notes?", resetDone: "Scenario reset",
    synced: "Synced", syncing: "Syncing…", offline: "Offline: saved here, will upload when back online", err: "Sync error", local: "Saved on this device",
    pulled: "Tracker updated from your account", h: "h",
  },
};
const SCEN_LABEL = { fr: { Optimiste: "Optimiste", Réaliste: "Réaliste", Pessimiste: "Pessimiste" }, en: { Optimiste: "Optimistic", Réaliste: "Realistic", Pessimiste: "Pessimistic" } };
const SCEN_DESC = {
  fr: { Optimiste: "Rythme soutenu : Lun/Mar/Mer/Jeu 1 h + Sam et Dim (1,5 à 2 h) ≈ 7,5 h/sem, tout réussi du 1er coup.",
    Réaliste: "Lun/Mer/Jeu 1 h + Sam 2 h + Dim 1,5 h ≈ 6,5 h/sem, semaine de Noël allégée.",
    Pessimiste: "Rythme réduit : 4 séances/sem (Lun, Mer, Sam, Dim) ≈ 5 h/sem, un dimanche de rattrapage toutes les 4 semaines, et un repassage prévu après chaque examen (si échec)." },
  en: { Optimiste: "Sustained pace: Mon/Tue/Wed/Thu 1 h + Sat and Sun (1.5 to 2 h) ≈ 7.5 h/week, everything passed first time.",
    Réaliste: "Mon/Wed/Thu 1 h + Sat 2 h + Sun 1.5 h ≈ 6.5 h/week, lighter Christmas week.",
    Pessimiste: "Reduced pace: 4 sessions/week (Mon, Wed, Sat, Sun) ≈ 5 h/week, one catch-up Sunday every 4 weeks, and a retake planned after each exam (if failed)." },
};
const PHASE_EN = { "0. Démarrage": "0. Getting started", "1. Certified User": "1. Certified User", "Pause Noël (allégée)": "Christmas break (lighter)", "2. Power User": "2. Power User", "3. Admin": "3. Admin" };
const TYPE_EN = { Cours: "Course", Lab: "Lab", Révision: "Review", Examen: "Exam" };
const EXAMS = [
  { code: "SPLK-1001", name: "Splunk Core Certified User", fmt: { fr: "60 questions, 60 min, QCM", en: "60 questions, 60 min, multiple choice" }, pre: { fr: "Aucun", en: "None" }, key: "cExam1" },
  { code: "SPLK-1002", name: "Splunk Core Certified Power User", fmt: { fr: "65 questions, 60 min, QCM", en: "65 questions, 60 min, multiple choice" }, pre: { fr: "Aucun (User recommandé)", en: "None (User recommended)" }, key: "cExam2" },
  { code: "SPLK-1003", name: "Splunk Enterprise Certified Admin", fmt: { fr: "56 questions, 60 min, QCM", en: "56 questions, 60 min, multiple choice" }, pre: { fr: "Avoir le Power User", en: "Power User required" }, key: "cExam3" },
];
const BUDGET = [
  { fr: "Examen SPLK-1001 Core Certified User", en: "SPLK-1001 Core Certified User exam", amt: 130, cur: "$", st: { fr: "Vérifié", en: "Verified" }, src: { fr: "splunk.com : « $130 USD per exam attempt »", en: "splunk.com: “$130 USD per exam attempt”" } },
  { fr: "Examen SPLK-1002 Core Certified Power User", en: "SPLK-1002 Core Certified Power User exam", amt: 130, cur: "$", st: { fr: "Vérifié", en: "Verified" }, src: { fr: "splunk.com : « $130 USD per exam attempt »", en: "splunk.com: “$130 USD per exam attempt”" } },
  { fr: "Examen SPLK-1003 Enterprise Certified Admin", en: "SPLK-1003 Enterprise Certified Admin exam", amt: 130, cur: "$", st: { fr: "Vérifié", en: "Verified" }, src: { fr: "splunk.com : « $130 USD per exam attempt »", en: "splunk.com: “$130 USD per exam attempt”" } },
  { fr: "4 cours Udemy (Essentials, User, Power User, Admin)", en: "4 Udemy courses (Essentials, User, Power User, Admin)", amt: 120, cur: "€", st: { fr: "Indiqué par HB", en: "Given by HB" }, src: { fr: "Montant total payé pour les 4 cours", en: "Total paid for the 4 courses" } },
  { fr: "Splunk Enterprise (essai 60 j puis licence Free)", en: "Splunk Enterprise (60-day trial then Free license)", amt: 0, cur: "€", st: { fr: "Vérifié", en: "Verified" }, src: { fr: "Gratuit", en: "Free" } },
  { fr: "VirtualBox + Ubuntu Server", en: "VirtualBox + Ubuntu Server", amt: 0, cur: "€", st: { fr: "Vérifié", en: "Verified" }, src: { fr: "Gratuit", en: "Free" } },
  { fr: "Jeu de données BOTS v1", en: "BOTS v1 dataset", amt: 0, cur: "€", st: { fr: "Vérifié", en: "Verified" }, src: { fr: "Gratuit (GitHub Splunk)", en: "Free (Splunk GitHub)" } },
];
const RES = [
  { fr: "Cours 1 – Splunk Essentials (Udemy)", en: "Course 1 – Splunk Essentials (Udemy)", u: "https://www.udemy.com/course/the-complete-splunk-essentials-course/" },
  { fr: "Cours 2 – Certified User SPLK-1001 (Udemy)", en: "Course 2 – Certified User SPLK-1001 (Udemy)", u: "https://www.udemy.com/course/the-complete-splunk-core-certified-user-course-splk-1001/" },
  { fr: "Cours 3 – Certified Power User (Udemy)", en: "Course 3 – Certified Power User (Udemy)", u: "https://www.udemy.com/course/the-complete-splunk-core-certified-power-user-course/" },
  { fr: "Cours 4 – Enterprise Certified Admin SPLK-1003 (Udemy)", en: "Course 4 – Enterprise Certified Admin SPLK-1003 (Udemy)", u: "https://www.udemy.com/course/splunk-enterprise-certified-admin-splk-1003-course/" },
  { fr: "Programmes officiels des examens (blueprints)", en: "Official exam blueprints", u: "https://www.splunk.com/en_us/training/certification.html" },
  { fr: "Jeu de données BOTS v1 (GitHub Splunk)", en: "BOTS v1 dataset (Splunk GitHub)", u: "https://github.com/splunk/botsv1" },
  { fr: "Splunk Enterprise – téléchargement (essai gratuit)", en: "Splunk Enterprise – download (free trial)", u: "https://www.splunk.com/en_us/download/splunk-enterprise.html" },
  { fr: "Inscription aux examens (Pearson VUE)", en: "Exam registration (Pearson VUE)", u: "https://home.pearsonvue.com/splunk" },
  { fr: "Splunk Candidate Handbook (prix, repassages)", en: "Splunk Candidate Handbook (prices, retakes)", u: "https://www.splunk.com/content/dam/splunk2/en_us/pdfs/training/splunk-certification-candidate-handbook.pdf" },
];

/* ---------- état ---------- */
function defaultState() {
  return { app: APP_ID, version: 1, startDate: "2026-11-09", scenario: "Réaliste",
    done: { Optimiste: {}, Réaliste: {}, Pessimiste: {} }, notes: { Optimiste: {}, Réaliste: {}, Pessimiste: {} }, exams: {}, rate: 0.86 };
}
export function normalize(s) {
  const out = defaultState();
  if (!s || typeof s !== "object") return out;
  if (typeof s.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.startDate)) out.startDate = s.startDate;
  if (SCENS.includes(s.scenario)) out.scenario = s.scenario;
  for (const sc of SCENS) {
    const dn = s.done && s.done[sc]; if (dn && typeof dn === "object") for (const k in dn) if (dn[k] === true && DATA[sc].rows[+k]) out.done[sc][k] = true;
    const nt = s.notes && s.notes[sc]; if (nt && typeof nt === "object") for (const k in nt) if (typeof nt[k] === "string" && nt[k].trim() && DATA[sc].rows[+k]) out.notes[sc][k] = nt[k].slice(0, 5000);
  }
  if (s.exams && typeof s.exams === "object") for (const e of EXAMS) { const x = s.exams[e.code]; if (x) out.exams[e.code] = { registered: !!x.registered, passed: !!x.passed }; }
  if (typeof s.rate === "number" && isFinite(s.rate) && s.rate >= 0) out.rate = s.rate;
  return out;
}
const rdj = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const wrj = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export function createSuivi({ store, getLang, toast, esc, userId }) {
  let S = normalize(rdj(STORE_KEY));
  let tab = (() => { try { return localStorage.getItem(TAB_KEY) || "plan"; } catch { return "plan"; } })();
  let openWeeks = null, root = null, status = "", busy = false, pushTimer = null;
  const filters = { q: "", phase: "", type: "", hide: false };
  const meta = () => rdj(META_KEY) || { updatedAt: 0, syncedAt: 0 };
  const setMeta = m => wrj(META_KEY, { ...meta(), ...m });
  const remote = () => store && store.kind === "supabase" && store.sb && userId();

  const lang = () => (getLang() === "en" ? "en" : "fr");
  const t = k => L[lang()][k] ?? k;
  const tx = s => (lang() === "en" ? EN[s] || s : s);
  const phaseL = p => (lang() === "en" ? PHASE_EN[p] || p : p);
  const typeL = x => (lang() === "en" ? TYPE_EN[x] || x : x);
  const locale = () => (lang() === "fr" ? "fr-FR" : "en-GB");
  const parseD = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (b, n) => { const d = new Date(b); d.setDate(d.getDate() + n); return d; };
  const dateOf = off => addDays(parseD(S.startDate), off);
  const todayD = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const fmtShort = d => d.toLocaleDateString(locale(), { day: "2-digit", month: "2-digit", year: "numeric" });
  const fmtDow = d => d.toLocaleDateString(locale(), { weekday: "short" });
  const fmtLong = d => d.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const num = (n, dg = 1) => Number(n).toLocaleString(locale(), { maximumFractionDigits: dg, minimumFractionDigits: 0 });
  const pct = n => Math.round(n * 100) + " %";
  const num2 = n => Number(n).toLocaleString(locale(), { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
  const money = (n, cur) => (cur === "$" ? (lang() === "fr" ? num2(n) + " $" : "$" + num2(n)) : (lang() === "fr" ? num2(n) + " €" : "€" + num2(n)));
  const rows = () => DATA[S.scenario].rows;
  const isDone = i => !!S.done[S.scenario][i];

  /* ---------- synchro ---------- */
  function save() {
    wrj(STORE_KEY, S); setMeta({ updatedAt: Date.now() });
    if (!remote()) return;
    status = "syncing"; paintStatus();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      if (busy) return save();
      busy = true;
      try { await push(); status = "synced"; } catch (e) { status = navigator.onLine === false ? "offline" : "err"; console.warn(e); }
      busy = false; paintStatus();
    }, 1000);
  }
  async function push() {
    const at = meta().updatedAt || Date.now();
    const { error } = await store.sb.from(TABLE).upsert({ user_id: userId(), data: { ...S, app: APP_ID, version: 1 }, updated_at: new Date(at).toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
    setMeta({ syncedAt: at });
  }
  async function sync(quiet = true) {
    if (!remote() || busy || navigator.onLine === false) { if (remote() && navigator.onLine === false) { status = "offline"; paintStatus(); } return; }
    busy = true; status = "syncing"; paintStatus();
    try {
      const { data, error } = await store.sb.from(TABLE).select("data,updated_at").eq("user_id", userId()).maybeSingle();
      if (error) throw error;
      const m = meta(), rAt = data ? Date.parse(data.updated_at) || 0 : 0, dirty = m.updatedAt > (m.syncedAt || 0);
      if (data && data.data && (!dirty || rAt > m.updatedAt)) {
        const next = normalize(data.data);
        if (JSON.stringify(next) !== JSON.stringify(S)) { S = next; wrj(STORE_KEY, S); openWeeks = null; if (root) render(); if (!quiet) toast(t("pulled"), "ok"); }
        setMeta({ updatedAt: rAt, syncedAt: rAt });
      } else if (!data || dirty) {
        if (!m.updatedAt) setMeta({ updatedAt: Date.now() });
        await push();
      }
      status = "synced";
    } catch (e) { status = navigator.onLine === false ? "offline" : "err"; console.warn(e); }
    busy = false; paintStatus();
  }
  function forget() { S = defaultState(); wrj(STORE_KEY, null); wrj(META_KEY, null); openWeeks = null; status = ""; }
  addEventListener("online", () => sync(true));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync(true); });

  function paintStatus() {
    const el = root && root.querySelector("#sv-status"); if (!el) return;
    const st = remote() ? status : "local";
    el.className = "sv-status mono " + st;
    el.textContent = st ? (st === "synced" ? "✓ " : st === "syncing" ? "⟳ " : st === "local" ? "✓ " : "⚠ ") + t(st) : "";
  }

  /* ---------- calculs ---------- */
  function nextIndex() { const r = rows(); for (let i = 0; i < r.length; i++) if (!isDone(i)) return i; return -1; }
  function stats(sc) {
    const r = DATA[sc].rows, dn = S.done[sc]; let n = 0, h = 0, H = 0, late = 0; const today = todayD().getTime();
    r.forEach((x, i) => { H += x[3]; if (dn[i]) { n++; h += x[3]; } else if (dateOf(x[2]).getTime() < today) late++; });
    return { n, N: r.length, h, H, late };
  }
  function examDates(sc) {
    const out = {};
    DATA[sc].rows.forEach((x, i) => {
      if (x[7] !== "Examen") return; const m = x[6].match(/SPLK-100\d/); if (!m) return; const code = m[0];
      if (x[6].startsWith("PASSAGE")) out[code] = { ...(out[code] || {}), first: x[2], idx: i }; else out[code] = { ...(out[code] || {}), retake: x[2] };
    });
    return out;
  }

  /* ---------- rendu ---------- */
  const TABS = [["plan", "tabPlan"], ["prog", "tabProg"], ["exams", "tabExams"], ["budget", "tabBudget"], ["res", "tabRes"]];
  function render(el) {
    if (el) root = el;
    if (!root) return;
    const s = stats(S.scenario);
    root.innerHTML = `
    <section class="sv">
      <div class="sv-head">
        <div class="sv-ring" style="--p:${Math.round((s.n / s.N) * 100)}"><span class="mono">${Math.round((s.n / s.N) * 100)}%</span></div>
        <div class="sv-head-txt">
          <p class="mono kicker">&gt; index=formation | stats count by cert</p>
          <h1 class="glitch">${lang() === "fr" ? "Suivi de formation" : "Training tracker"}</h1>
          <p class="muted sv-sub">SPLK-1001 → SPLK-1002 → SPLK-1003 · ${esc(SCEN_LABEL[lang()][S.scenario])} · ${s.n}/${s.N} ${esc(t("sessions"))} <span id="sv-status" class="sv-status mono"></span></p>
        </div>
      </div>
      <div class="seg sv-tabs" role="tablist">${TABS.map(([k, l]) => `<button class="seg-btn" role="tab" data-sv-tab="${k}" aria-pressed="${tab === k}" aria-selected="${tab === k}">${esc(t(l))}</button>`).join("")}</div>
      <div id="sv-body">${tab === "plan" ? planHtml() : tab === "prog" ? progHtml() : tab === "exams" ? examsHtml() : tab === "budget" ? budgetHtml() : resHtml()}</div>
    </section>`;
    paintStatus();
    bind();
  }

  function settingsHtml() {
    return `<details class="panel sv-settings"><summary class="mono">⚙ ${esc(t("settings"))} <span class="muted">· ${esc(SCEN_LABEL[lang()][S.scenario])} · ${esc(fmtShort(parseD(S.startDate)))}</span></summary>
      <div class="sv-set-row">
        <div class="sv-field"><span class="mono">${esc(t("scenario"))}</span><div class="seg sv-scen">${SCENS.map(sc => `<button class="seg-btn" data-scen="${sc}" aria-pressed="${sc === S.scenario}">${esc(SCEN_LABEL[lang()][sc])}</button>`).join("")}</div></div>
        <label class="sv-field"><span class="mono">${esc(t("startDate"))}</span><input type="date" id="sv-start" value="${S.startDate}"></label>
      </div>
      <p class="muted small">${esc(SCEN_DESC[lang()][S.scenario])}</p>
      <button class="btn btn-ghost btn-sm" id="sv-reset">${esc(t("reset"))}</button>
    </details>`;
  }

  function planHtml() {
    const r = rows(), q = filters.q.trim().toLowerCase(), today = todayD().getTime();
    const weeks = new Map(); r.forEach((x, i) => { if (!weeks.has(x[0])) weeks.set(x[0], []); weeks.get(x[0]).push(i); });
    const nxt = nextIndex(), nxtWeek = nxt >= 0 ? r[nxt][0] : null;
    if (openWeeks === null) { openWeeks = new Set(); if (nxtWeek !== null) { openWeeks.add(nxtWeek); openWeeks.add(nxtWeek + 1); } }
    let html = "", shown = 0;
    for (const [w, idx] of weeks) {
      const vis = idx.filter(i => {
        const x = r[i];
        if (filters.phase && x[1] !== filters.phase) return false; if (filters.type && x[7] !== filters.type) return false; if (filters.hide && isDone(i)) return false;
        if (q) { const hay = [x[4], x[5], x[6], tx(x[5]), tx(x[6]), phaseL(x[1]), typeL(x[7]), S.notes[S.scenario][i] || ""].join(" ").toLowerCase(); if (!hay.includes(q)) return false; }
        return true;
      });
      if (!vis.length) continue; shown += vis.length;
      const dn = idx.filter(isDone).length, first = dateOf(r[idx[0]][2]), last = dateOf(r[idx[idx.length - 1]][2]);
      const hrs = idx.reduce((a, i) => a + r[i][3], 0);
      const phases = [...new Set(idx.map(i => r[i][1]))].map(phaseL).join(" · ");
      const open = q || filters.phase || filters.type || openWeeks.has(w);
      html += `<details class="sv-week" data-week="${w}" ${open ? "open" : ""}><summary>
        <span class="sv-wk-title mono">${esc(t("week"))} ${w}</span><span class="sv-wk-meta mono muted">${fmtShort(first)} – ${fmtShort(last)} · ${idx.length} ${esc(t("sessions"))} · ${num(hrs)} ${t("h")}</span>
        <span class="sv-wk-phase mono">${esc(phases)}</span><span class="sv-wk-prog mono"><span class="bar"><span style="width:${(dn / idx.length) * 100}%"></span></span>${dn}/${idx.length}</span></summary>`;
      for (const i of vis) {
        const x = r[i], d = dateOf(x[2]), done = isDone(i), note = S.notes[S.scenario][i] || "";
        const late = !done && d.getTime() < today, isT = d.getTime() === today;
        html += `<div class="sv-sess${done ? " done" : ""}${isT ? " today" : ""}" id="sv-s-${i}">
          <label class="sv-cb"><input type="checkbox" data-done="${i}" ${done ? "checked" : ""} aria-label="${esc(tx(x[6]))}"><span></span></label>
          <div class="sv-date mono"><span class="sv-dow">${esc(fmtDow(d))}</span> ${fmtShort(d)}</div>
          <div class="sv-dur mono">${num(x[3])} ${t("h")}</div>
          <div class="sv-content"><span class="sv-badge mono t-${esc(x[7])}">${esc(typeL(x[7]))}</span>${esc(tx(x[6]))}${late ? `<span class="sv-late mono">${esc(t("late"))}</span>` : ""}</div>
          <div class="sv-sect"><span class="ch-num mono">${esc(x[4])}</span><span class="muted">${esc(tx(x[5]))}</span></div>
          <div class="sv-notecell"><button class="btn btn-ghost btn-xs${note ? " on" : ""}" data-note="${i}">${note ? "✎ " + esc(t("note")) : esc(t("addNote"))}</button></div>
          ${note ? `<div class="sv-note-prev mono">${esc(note)}</div>` : ""}
        </div>`;
      }
      html += `</details>`;
    }
    return `${settingsHtml()}
      <div class="sv-filters">
        <input type="search" id="sv-q" placeholder="${esc(t("search"))}" value="${esc(filters.q)}">
        <select id="sv-phase"><option value="">${esc(t("allPhases"))}</option>${PHASES.map(p => `<option value="${esc(p)}" ${filters.phase === p ? "selected" : ""}>${esc(phaseL(p))}</option>`).join("")}</select>
        <select id="sv-type"><option value="">${esc(t("allTypes"))}</option>${TYPES.map(p => `<option value="${esc(p)}" ${filters.type === p ? "selected" : ""}>${esc(typeL(p))}</option>`).join("")}</select>
        <label class="sv-chk"><input type="checkbox" id="sv-hide" ${filters.hide ? "checked" : ""}> ${esc(t("hideDone"))}</label>
        <button class="btn btn-ghost btn-sm" id="sv-goto">${esc(t("gotoNext"))}</button>
      </div>
      <div id="sv-weeks">${shown ? html : `<div class="panel muted mono" style="text-align:center">${esc(t("noResults"))}</div>`}</div>`;
  }

  function progHtml() {
    const s = stats(S.scenario), r = rows(), ed = examDates(S.scenario), today = todayD().getTime();
    const lastOff = Math.max(...r.map(x => x[2]));
    let nextExam = null;
    for (const e of EXAMS) { const x = ed[e.code]; if (!x) continue; if (!(S.exams[e.code] || {}).passed && !isDone(x.idx)) { nextExam = { e, d: dateOf(x.first) }; break; } }
    const kpi = (l, v, sub = "") => `<div class="stat"><span class="stat-val mono">${v}</span><span class="stat-lbl">${esc(l)}</span>${sub ? `<span class="stat-lbl">${sub}</span>` : ""}</div>`;
    const ni = nextIndex();
    let next;
    if (ni < 0) next = `<p>${esc(t("nothingLeft"))}</p>`;
    else { const x = r[ni], d = dateOf(x[2]);
      next = `<div class="sv-next"><div><div><span class="sv-badge mono t-${esc(x[7])}">${esc(typeL(x[7]))}</span><strong>${esc(tx(x[6]))}</strong></div>
        <div class="muted small">${esc(x[4])} · ${esc(tx(x[5]))}</div><div class="muted small mono">${esc(fmtLong(d))} · ${num(x[3])} ${t("h")}${d.getTime() < today ? ` <span class="sv-late">${esc(t("late"))}</span>` : ""}</div></div>
        <button class="btn btn-primary" id="sv-mark-next">✓ ${esc(t("markDone"))}</button></div>`; }
    let rowsH = "", tot = { n: 0, d: 0, h: 0, hd: 0 };
    for (const p of PHASES) {
      let n = 0, d = 0, h = 0, hd = 0; r.forEach((x, i) => { if (x[1] !== p) return; n++; h += x[3]; if (isDone(i)) { d++; hd += x[3]; } }); if (!n) continue;
      tot.n += n; tot.d += d; tot.h += h; tot.hd += hd;
      rowsH += `<tr><td>${esc(phaseL(p))}</td><td class="num">${d}/${n}</td><td class="num">${num(hd)}/${num(h)}</td><td class="num">${pct(h ? hd / h : 0)}</td></tr>`;
    }
    const comp = SCENS.map(sc => { const R = DATA[sc].rows, E = examDates(sc), w = Math.max(...R.map(x => x[0])), H = R.reduce((a, x) => a + x[3], 0);
      return { e: EXAMS.map(e => (E[e.code] ? fmtShort(dateOf(E[e.code].first)) : "—")), end: fmtShort(dateOf(Math.max(...R.map(x => x[2])))), w, H, avg: H / w }; });
    const line = (l, f) => `<tr><td>${esc(l)}</td>${comp.map(f).map(v => `<td class="num">${v}</td>`).join("")}</tr>`;
    return `<div class="stats sv-stats">
        ${kpi(t("kSessions"), `${s.n}<small>/${s.N}</small>`)}
        ${kpi(t("kHours"), `${num(s.h)}<small> ${t("h")}</small>`, `${t("of")} ${num(s.H)} ${t("h")} · ${pct(s.h / s.H)}`)}
        ${kpi(t("kLate"), `${s.late}`)}
        ${kpi(t("kNextExam"), nextExam ? esc(nextExam.e.code) : "—", nextExam ? esc(fmtShort(nextExam.d)) : "")}
      </div>
      <div class="sv-grid">
        <div class="panel sv-span"><h3 class="section-title mono">// ${esc(t("nextTitle"))}</h3>${next}</div>
        <div class="panel"><h3 class="section-title mono">// ${esc(t("byPhase"))}</h3><div class="sv-tw"><table><thead><tr><th>${esc(t("phase"))}</th><th class="num">${esc(t("sessions"))}</th><th class="num">${esc(t("h"))}</th><th class="num">%</th></tr></thead>
          <tbody>${rowsH}<tr class="sv-total"><td>${esc(t("total"))}</td><td class="num">${tot.d}/${tot.n}</td><td class="num">${num(tot.hd)}/${num(tot.h)}</td><td class="num">${pct(tot.hd / tot.h)}</td></tr></tbody></table></div></div>
        <div class="panel"><h3 class="section-title mono">// ${esc(t("compare"))}</h3><div class="sv-tw"><table><thead><tr><th></th>${SCENS.map(sc => `<th class="num${sc === S.scenario ? " sv-cur" : ""}">${esc(SCEN_LABEL[lang()][sc])}</th>`).join("")}</tr></thead>
          <tbody>${EXAMS.map((e, k) => line(t(e.key), c => c.e[k])).join("")}${line(t("cEnd"), c => c.end)}${line(t("cWeeks"), c => c.w)}${line(t("cHours"), c => num(c.H))}${line(t("cAvg"), c => num(c.avg))}</tbody></table></div>
          <p class="muted small">${esc(t("compareNote"))}</p></div>
      </div>
      <p class="muted small mono">${esc(t("kEnd"))} : ${esc(fmtShort(dateOf(lastOff)))}</p>`;
  }

  function examsHtml() {
    const ed = examDates(S.scenario);
    return `<div class="sv-exams">${EXAMS.map(e => { const x = ed[e.code] || {}, st = S.exams[e.code] || {};
      return `<div class="panel sv-exam${st.passed ? " passed" : ""}"><p class="ch-num mono">${esc(e.code)}</p><h3>${esc(e.name)}</h3>
        <p><span class="muted">${esc(t("plannedDate"))} : </span><strong>${x.first != null ? esc(fmtLong(dateOf(x.first))) : "—"}</strong></p>
        ${x.retake != null ? `<p class="muted small">${esc(t("retake"))} : ${esc(fmtLong(dateOf(x.retake)))}</p>` : ""}
        <p class="muted small">${esc(t("format"))} : ${esc(e.fmt[lang()])}<br>${esc(t("prereq"))} : ${esc(e.pre[lang()])}</p>
        <div class="sv-checks"><label class="sv-chk"><input type="checkbox" data-exam="${e.code}" data-k="registered" ${st.registered ? "checked" : ""}> ${esc(t("registered"))}</label>
        <label class="sv-chk"><input type="checkbox" data-exam="${e.code}" data-k="passed" ${st.passed ? "checked" : ""}> ${esc(t("passed"))}</label></div></div>`; }).join("")}</div>
      <p class="scenario">${esc(t("examNote"))}</p>`;
  }

  function budgetHtml() {
    let tot = 0;
    const body = BUDGET.map(b => { const eur = b.cur === "$" ? b.amt * S.rate : b.amt; tot += eur;
      return `<tr><td>${esc(b[lang()])}<div class="muted small sv-src">${esc(b.st[lang()])} · ${esc(b.src[lang()])}</div></td><td class="num">${money(b.amt, b.cur)}</td><td class="num">${money(eur, "€")}</td></tr>`; }).join("");
    return `<div class="panel"><p class="muted small">${esc(t("budgetIntro"))}</p>
      <label class="sv-field sv-rate"><span class="mono">${esc(t("rate"))}</span><input type="number" id="sv-rate" step="0.01" min="0" value="${S.rate}"></label>
      <div class="sv-tw"><table><thead><tr><th>${esc(t("item"))}</th><th class="num">${esc(t("amount"))}</th><th class="num">${esc(t("inEur"))}</th></tr></thead>
      <tbody>${body}<tr class="sv-total"><td>${esc(t("budgetTotal"))}</td><td></td><td class="num">${money(tot, "€")}</td></tr>
      <tr><td class="muted">${esc(t("budgetRetake"))}</td><td class="num muted">${money(130, "$")}</td><td class="num muted">${money(130 * S.rate, "€")}</td></tr></tbody></table></div></div>`;
  }

  function resHtml() {
    return `<div class="sv-res">${RES.map(r => `<a class="panel sv-res-item" href="${esc(r.u)}" target="_blank" rel="noopener"><strong>${esc(r[lang()])}</strong><span class="mono muted small">${esc(r.u.replace(/^https:\/\/(www\.)?/, "").split("/")[0])} ↗</span></a>`).join("")}</div>
      <p class="scenario">${esc(t("resNote"))}</p>`;
  }

  /* ---------- événements ---------- */
  function rerenderKeepScroll() { const y = scrollY; render(); scrollTo(0, y); }
  function bind() {
    root.querySelectorAll("[data-sv-tab]").forEach(b => (b.onclick = () => { tab = b.dataset.svTab; try { localStorage.setItem(TAB_KEY, tab); } catch {} render(); scrollTo({ top: 0 }); }));
    root.querySelectorAll("[data-scen]").forEach(b => (b.onclick = () => { S.scenario = b.dataset.scen; openWeeks = null; save(); render(); root.querySelector(".sv-settings").open = true; }));
    const on = (sel, ev, fn) => { const el = root.querySelector(sel); if (el) el.addEventListener(ev, fn); };
    on("#sv-start", "change", e => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) { S.startDate = e.target.value; save(); render(); } });
    on("#sv-reset", "click", () => { if (!confirm(t("confirmReset").replace("{s}", SCEN_LABEL[lang()][S.scenario]))) return; S.done[S.scenario] = {}; S.notes[S.scenario] = {}; save(); render(); toast(t("resetDone"), "ok"); });
    on("#sv-q", "input", e => { filters.q = e.target.value; const pos = e.target.selectionStart; rerenderKeepScroll(); const q = root.querySelector("#sv-q"); q.focus(); q.setSelectionRange(pos, pos); });
    on("#sv-phase", "change", e => { filters.phase = e.target.value; rerenderKeepScroll(); });
    on("#sv-type", "change", e => { filters.type = e.target.value; rerenderKeepScroll(); });
    on("#sv-hide", "change", e => { filters.hide = e.target.checked; rerenderKeepScroll(); });
    on("#sv-goto", "click", () => {
      const i = nextIndex(); if (i < 0) { toast(t("nothingLeft"), "ok"); return; }
      Object.assign(filters, { q: "", phase: "", type: "", hide: false }); openWeeks.add(rows()[i][0]); render();
      const el = root.querySelector("#sv-s-" + i); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); }
    });
    on("#sv-mark-next", "click", () => { const i = nextIndex(); if (i < 0) return; S.done[S.scenario][i] = true; save(); render(); });
    on("#sv-rate", "input", e => { const v = parseFloat(e.target.value); if (isFinite(v) && v >= 0) { S.rate = v; save(); const pos = e.target.selectionStart; render(); const r = root.querySelector("#sv-rate"); r.focus(); try { r.setSelectionRange(pos, pos); } catch {} } });
    root.querySelectorAll("details.sv-week").forEach(d => d.addEventListener("toggle", () => { const w = +d.dataset.week; d.open ? openWeeks.add(w) : openWeeks.delete(w); }));
    root.querySelectorAll("[data-done]").forEach(cb => cb.addEventListener("change", () => {
      const i = cb.dataset.done; if (cb.checked) S.done[S.scenario][i] = true; else delete S.done[S.scenario][i]; save(); rerenderKeepScroll();
    }));
    root.querySelectorAll("[data-exam]").forEach(cb => cb.addEventListener("change", () => {
      const x = S.exams[cb.dataset.exam] || (S.exams[cb.dataset.exam] = { registered: false, passed: false }); x[cb.dataset.k] = cb.checked; save(); render();
    }));
    root.querySelectorAll("[data-note]").forEach(b => (b.onclick = () => {
      const i = b.dataset.note, row = b.closest(".sv-sess"), ex = row.querySelector(".sv-note");
      if (ex) { ex.remove(); return; }
      const prev = row.querySelector(".sv-note-prev"); if (prev) prev.hidden = true;
      const div = document.createElement("div"); div.className = "sv-note";
      div.innerHTML = `<textarea placeholder="${esc(t("noteph"))}"></textarea>`; row.appendChild(div);
      const ta = div.querySelector("textarea"); ta.value = S.notes[S.scenario][i] || ""; ta.focus();
      ta.addEventListener("input", () => { const v = ta.value; if (v.trim()) S.notes[S.scenario][i] = v; else delete S.notes[S.scenario][i]; save();
        b.classList.toggle("on", !!v.trim()); b.textContent = v.trim() ? "✎ " + t("note") : t("addNote"); });
      ta.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== b && root.contains(ta)) rerenderKeepScroll(); }, 150));
    }));
  }

  return { render, sync, forget };
}
