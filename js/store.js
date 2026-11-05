// Couche données : Supabase (production) ou navigateur (mode local).
// Les deux exposent la même interface.
import { idbGet, idbSet, idbClear, offlineEnabled, setOfflineEnabled, isNetErr, withTimeout, autonomous, setAutonomous } from "./offline.js";

const DOMAIN_OF = {1:1,2:1,3:2,4:3,5:4,6:5,7:6,8:7,9:8,     // modules du cours Packt -> thèmes SPLK-1001 (1-8)
  11:1,12:2,13:3,14:4,15:5,16:6,17:7,18:8,                    // questions originales SPLK-1001 par thème
  101:11,102:12,103:13,104:14,105:15,106:16,107:17,108:18,109:19,110:20};  // SPLK-1002 : thèmes 11-20 (= 1 à 10)

// Copie locale des quiz sauvegardés et des marques : ces fonctions marchent même si les tables
// saved_quizzes (v4) ou flags (v6) n'ont pas encore été créées dans Supabase, ou sans réseau.
const LS_SAVED_SB = "splunk-saved-quizzes:sb", LS_FLAGS_SB = "splunk-flags:sb";
const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };
/** Table absente côté Supabase (migration pas encore exécutée). */
/** Tables Supabase du QCM Splunk : préfixe splunk_, pour cohabiter avec les tables du CISSP dans une même base. */
const T = { chapters: "splunk_chapters", questions: "splunk_questions", attempts: "splunk_attempts", answers: "splunk_answers",
  saved_quizzes: "splunk_saved_quizzes", flags: "splunk_flags" };
const isMissingTable = e => !!e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST202" ||
  /does not exist|could not find the table|schema cache/i.test(e.message || ""));
const softErr = e => isNetErr(e) || isMissingTable(e);

/** UUID v4 (crypto.randomUUID n'existe que sur les pages https). */
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() :
  "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));

/** Lit toutes les lignes d'une requête Supabase, par pages de 1000 (limite par défaut de l'API). */
async function fetchAll(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

/** Garde, pour chaque question, uniquement la réponse la plus récente. */
export function latestByQuestion(answers) {
  const map = new Map();
  for (const a of answers) {
    const prev = map.get(a.question_id);
    if (!prev || new Date(a.created_at) > new Date(prev.created_at)) map.set(a.question_id, a);
  }
  return map;
}

// ------------------------------------------------------------------ Supabase
export class SupabaseStore {
  constructor(url, key) {
    this.kind = "supabase";
    this.sb = window.supabase.createClient(url, key);
    this.offline = false;   // vrai quand les données viennent de la copie hors ligne
  }
  async session() {
    // Mode autonome : aucune connexion, aucune authentification, on reprend le compte enregistré sur l'appareil.
    if (autonomous()) {
      const user = await idbGet("user");
      if (user) { this.offline = true; this.autonomous = true; return { user, offline: true }; }
      setAutonomous(false);   // copie incomplète : on revient au mode normal
    }
    try {
      // Hors ligne avec un jeton expiré, getSession() peut attendre longtemps : on borne l'attente.
      const { data } = await withTimeout(this.sb.auth.getSession(), navigator.onLine ? 15000 : 3000);
      if (data.session) {
        if (offlineEnabled()) idbSet("user", { id: data.session.user.id, email: data.session.user.email }).catch(() => {});
        return data.session;
      }
    } catch (e) { if (!isNetErr(e)) throw e; }
    // Pas de session utilisable : si le contenu a été téléchargé et qu'on est hors ligne, on continue avec.
    if (offlineEnabled() && !(await this.reachable())) {
      const user = await idbGet("user");
      if (user) { this.offline = true; return { user, offline: true }; }
    }
    return null;
  }
  /** Supabase répond-il ? */
  async reachable() {
    if (!navigator.onLine) return false;
    try { await withTimeout(fetch(this.sb.supabaseUrl + "/auth/v1/health", { headers: { apikey: this.sb.supabaseKey } }), 5000); return true; }
    catch { return false; }
  }
  onAuth(cb) {
    this.sb.auth.onAuthStateChange((e, s) => {
      if (!s && this.offline && (this.autonomous || e !== "SIGNED_OUT")) return;   // hors ligne / autonome : on garde la session locale
      cb(s);
    });
  }
  /** Retour de la connexion : envoie ce qui a été fait hors ligne et repasse en ligne. */
  async goOnline() {
    if (!this.offline || this.autonomous || !(await this.reachable())) return false;
    const { data } = await this.sb.auth.getSession();
    if (!data.session) return false;
    await this.syncOutbox();
    this.offline = false;
    return true;
  }
  async signIn(email, password) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }
  async signUp(email, password) {
    const redirect = location.origin + location.pathname;
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { emailRedirectTo: redirect } });
    if (error) throw error;
    return data.session ? "signed-in" : "check-email";
  }
  async resetPassword(email) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw error;
  }
  async updatePassword(password) {
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) throw error;
  }
  async signOut() {
    // Les questions téléchargées ne restent pas sur l'appareil après une déconnexion.
    await this.clearOffline();
    try { localStorage.removeItem(LS_SAVED_SB); localStorage.removeItem(LS_FLAGS_SB); } catch { /* */ }
    try { await this.sb.auth.signOut(); } catch { /* hors ligne */ }
  }

  // ---------------------------------------------------------- hors ligne
  /** Télécharge le contenu et la progression sur l'appareil (IndexedDB). */
  async downloadOffline(content) {
    // Les tables facultatives (quiz sauvegardés v4, marques v6) peuvent manquer : le hors-ligne marche quand même.
    const opt = p => p.catch(e => { console.warn("hors ligne : table facultative indisponible", e); return []; });
    const [attempts, answers, saved, flags] = await Promise.all([this._attempts(), this._answers(),
      opt(this._listSaved()), opt(this._flags())]);
    const s = await this.session();
    await idbSet("content", { ...content, at: Date.now() });
    await Promise.all([idbSet("attempts", attempts), idbSet("answers", answers), idbSet("saved", saved), idbSet("flags", flags),
      idbSet("user", { id: s.user.id, email: s.user.email })]);
    setOfflineEnabled(true);
  }
  async clearOffline() { setOfflineEnabled(false); setAutonomous(false); await idbClear(); }
  async offlineInfo() {
    const c = await idbGet("content"), out = (await idbGet("outbox")) || [];
    return { at: c ? c.at : null, n: c ? c.questions.length : 0, pending: out.length };
  }
  async _queue(op) { const out = (await idbGet("outbox")) || []; out.push(op); await idbSet("outbox", out); }
  /** Envoie à Supabase ce qui a été fait hors ligne. Renvoie le nombre d'opérations envoyées. */
  async syncOutbox() {
    let out = (await idbGet("outbox")) || [];
    if (!out.length) return 0;
    const { data } = await this.sb.auth.getSession();
    if (!data.session) return 0;
    let n = 0;
    while (out.length) {
      const op = out[0];
      try {
        if (op.op === "attempt") {
          const r = await this.sb.from(T.attempts).upsert(op.attempt, { onConflict: "id", ignoreDuplicates: true });
          if (r.error) throw r.error;
          if (op.answers.length) { const r2 = await this.sb.from(T.answers).insert(op.answers); if (r2.error) throw r2.error; }
        } else if (op.op === "putSaved") await this._putSaved(op.entry);
        else if (op.op === "delSaved") await this._deleteSaved(op.id);
        else if (op.op === "flag") await this._setFlag(op.qid, op.on);
      } catch (e) {
        if (isNetErr(e)) break;          // toujours hors ligne : on réessaiera plus tard
        console.error("sync", op, e);     // erreur définitive : on abandonne cette opération
      }
      out = out.slice(1); n++;
      await idbSet("outbox", out);
    }
    if (n) this.offline = false;
    return n;
  }
  /** Essaie le réseau ; en cas d'échec réseau et si le contenu est téléchargé, utilise la copie locale. */
  async _try(net, key, fallback) {
    if (!this.offline) {
      try {
        const v = await net();
        if (offlineEnabled() && key) idbSet(key, v).catch(() => {});
        return v;
      } catch (e) {
        if (!isNetErr(e) || !offlineEnabled()) throw e;
        this.offline = true;
      }
    }
    if (!offlineEnabled()) throw new Error("offline");
    return fallback();
  }

  async loadContent() {
    return this._try(async () => {
      const v = await this._loadContent();
      if (offlineEnabled()) idbSet("content", { ...v, at: Date.now() }).catch(() => {});  // copie hors ligne tenue à jour
      return v;
    }, null, async () => {
      const c = await idbGet("content");
      if (!c) throw new Error("offline");
      return { chapters: c.chapters, questions: c.questions };
    });
  }
  async _loadContent() {
    const [ch, qs] = await Promise.all([
      this.sb.from(T.chapters).select("*").order("id"),
      fetchAll(() => this.sb.from(T.questions).select("*").order("chapter_id").order("number")),
    ]);
    if (ch.error) throw ch.error;
    return { chapters: ch.data, questions: qs };
  }
  async attempts() {
    return this._try(() => this._attempts(), "attempts", async () => {
      const out = ((await idbGet("outbox")) || []).filter(o => o.op === "attempt").map(o => o.attempt);
      return [...out, ...((await idbGet("attempts")) || [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
    });
  }
  async _attempts() {
    const { data, error } = await this.sb.from(T.attempts).select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    return data;
  }
  async answers() {
    return this._try(() => this._answers(), "answers", async () => {
      const out = ((await idbGet("outbox")) || []).filter(o => o.op === "attempt").flatMap(o => o.answers);
      return [...out, ...((await idbGet("answers")) || [])];
    });
  }
  _answers() {
    return fetchAll(() => this.sb.from(T.answers)
      .select("question_id,is_correct,created_at").order("created_at", { ascending: false }));
  }
  async saveAttempt(attempt, answers) {
    if (!this.offline) {
      try { return await this._saveAttempt(attempt, answers); }
      catch (e) { if (!isNetErr(e) || !offlineEnabled()) throw e; this.offline = true; }
    }
    // Hors ligne : mis de côté, envoyé à Supabase au retour de la connexion.
    const id = uuid(), now = new Date().toISOString();
    await this._queue({ op: "attempt", attempt: { ...attempt, id, created_at: now },
      answers: answers.map(a => ({ ...a, attempt_id: id, created_at: now })) });
    return id;
  }
  async _saveAttempt(attempt, answers) {
    const { data, error } = await this.sb.from(T.attempts).insert(attempt).select("id").single();
    if (error) throw error;
    if (answers.length) {
      const rows = answers.map(a => ({ ...a, attempt_id: data.id }));
      const r = await this.sb.from(T.answers).insert(rows);
      if (r.error) throw r.error;
    }
    return data.id;
  }
  // Quiz sauvegardés (table saved_quizzes, migration v4)
  async listSaved() {
    try {
      const v = await this._try(() => this._listSaved(), "saved", async () => (await idbGet("saved")) || lsGet(LS_SAVED_SB, []));
      lsSet(LS_SAVED_SB, v);
      return v;
    } catch (e) {
      if (softErr(e)) { console.warn("quiz sauvegardés : copie locale", e); return lsGet(LS_SAVED_SB, []); }
      throw e;
    }
  }
  async putSaved(entry) {
    lsSet(LS_SAVED_SB, [entry, ...lsGet(LS_SAVED_SB, []).filter(x => x.id !== entry.id)]);
    try { await this._savedOp({ op: "putSaved", entry }, () => this._putSaved(entry)); }
    catch (e) { if (!softErr(e)) throw e; console.warn("quiz sauvegardé sur l'appareil seulement", e); }
  }
  async deleteSaved(id) {
    lsSet(LS_SAVED_SB, lsGet(LS_SAVED_SB, []).filter(x => x.id !== id));
    try { await this._savedOp({ op: "delSaved", id }, () => this._deleteSaved(id)); }
    catch (e) { if (!softErr(e)) throw e; }
  }
  async _savedOp(op, net) {
    if (offlineEnabled()) {   // copie locale tenue à jour dans tous les cas
      let list = (await idbGet("saved")) || [];
      list = list.filter(x => x.id !== (op.entry ? op.entry.id : op.id));
      if (op.entry) list.unshift(op.entry);
      await idbSet("saved", list);
    }
    if (!this.offline) {
      try { return await net(); }
      catch (e) { if (!isNetErr(e) || !offlineEnabled()) throw e; this.offline = true; }
    }
    // une seule écriture en attente par quiz sauvegardé
    const key = op.entry ? op.entry.id : op.id;
    let out = (await idbGet("outbox")) || [];
    out = out.filter(o => !((o.op === "putSaved" && o.entry.id === key) || (o.op === "delSaved" && o.id === key)));
    out.push(op); await idbSet("outbox", out);
  }
  // Questions marquées « à réviser » (table flags, migration v6)
  async flags() {
    try {
      const v = await this._try(() => this._flags(), "flags", async () => {
        let ids = new Set((await idbGet("flags")) || lsGet(LS_FLAGS_SB, []));
        for (const o of (await idbGet("outbox")) || []) if (o.op === "flag") o.on ? ids.add(o.qid) : ids.delete(o.qid);
        return [...ids];
      });
      lsSet(LS_FLAGS_SB, v);
      return v;
    } catch (e) {
      if (softErr(e)) { console.warn("marques : copie locale", e); return lsGet(LS_FLAGS_SB, []); }
      throw e;
    }
  }
  async _flags() {
    const { data, error } = await this.sb.from(T.flags).select("question_id");
    if (error) throw error;
    return data.map(r => r.question_id);
  }
  async _setFlag(qid, on) {
    const r = on ? await this.sb.from(T.flags).upsert({ question_id: qid }, { onConflict: "user_id,question_id", ignoreDuplicates: true })
                 : await this.sb.from(T.flags).delete().eq("question_id", qid);
    if (r.error) throw r.error;
  }
  async setFlag(qid, on) {
    const loc = new Set(lsGet(LS_FLAGS_SB, [])); on ? loc.add(qid) : loc.delete(qid); lsSet(LS_FLAGS_SB, [...loc]);
    try { await this._setFlagRemote(qid, on); }
    catch (e) { if (!softErr(e)) throw e; console.warn("marque gardée sur l'appareil seulement", e); }
  }
  async _setFlagRemote(qid, on) {
    if (offlineEnabled()) {
      const ids = new Set((await idbGet("flags")) || []);
      on ? ids.add(qid) : ids.delete(qid);
      await idbSet("flags", [...ids]);
    }
    if (!this.offline) {
      try { return await this._setFlag(qid, on); }
      catch (e) { if (!isNetErr(e) || !offlineEnabled()) throw e; this.offline = true; }
    }
    let out = (await idbGet("outbox")) || [];
    out = out.filter(o => !(o.op === "flag" && o.qid === qid));
    out.push({ op: "flag", qid, on }); await idbSet("outbox", out);
  }
  async _listSaved() {
    const { data, error } = await this.sb.from(T.saved_quizzes).select("data").order("updated_at", { ascending: false }).limit(20);
    if (error) throw error;
    return data.map(r => r.data);
  }
  async _putSaved(entry) {
    const { error } = await this.sb.from(T.saved_quizzes)
      .upsert({ id: entry.id, data: entry, updated_at: new Date().toISOString() }, { onConflict: "user_id,id" });
    if (error) throw error;
  }
  async _deleteSaved(id) {
    const { error } = await this.sb.from(T.saved_quizzes).delete().eq("id", id);
    if (error) throw error;
  }
  async resetProgress() {
    const s = await this.session();
    const { error } = await this.sb.from(T.attempts).delete().eq("user_id", s.user.id);
    if (error) throw error;
  }
}

// ------------------------------------------------------------------ Local
const LS_KEY = "splunk-qcm-progress-v1";
const FLAGS_KEY = "splunk-flags:mode local";
const SAVED_KEY = "splunk-saved-quizzes:mode local";  // même clé qu'avant : les sauvegardes existantes sont reprises

export class LocalStore {
  constructor(dataUrl) {
    this.kind = "local";
    this.dataUrl = dataUrl;
  }
  _read() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || { attempts: [], answers: [] }; }
    catch { return { attempts: [], answers: [] }; }
  }
  _write(v) { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch { /* stockage indisponible */ } }
  async session() { return { user: { email: "mode local" } }; }
  onAuth() {}
  async signOut() {}

  async loadContent() {
    const res = await fetch(this.dataUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`Impossible de lire ${this.dataUrl} (HTTP ${res.status}). Configurez Supabase dans js/config.js ou ajoutez le fichier local.`);
    const raw = await res.json();
    // Section « Practice Tests » : fichier facultatif à côté de questions.json
    try {
      const r2 = await fetch(this.dataUrl.replace(/[^/]+$/, "practice.json"), { cache: "no-store" });
      if (r2.ok) raw.push(...await r2.json());
    } catch { /* pas de section practice en local */ }
    const chapters = raw.map(c => ({ id: c.chapter, title: c.title, title_fr: c.title_fr || null, domain: DOMAIN_OF[c.chapter] ?? null }));
    const questions = [];
    for (const c of raw) for (const q of c.questions) {
      questions.push({
        id: c.chapter * 1000 + q.n, chapter_id: c.chapter, number: q.n, question: q.q,
        options: q.opts, correct: q.ans, explanation: q.exp,
        multi: q.ans.length > 1 || /(choose|select) all that apply/i.test(q.q),
        question_fr: q.q_fr || null, options_fr: q.opts_fr || null, explanation_fr: q.exp_fr || null,
        scenario: q.scenario || null, scenario_fr: q.scenario_fr || null,
      });
    }
    return { chapters, questions };
  }
  async attempts() { return [...this._read().attempts].sort((a, b) => b.created_at.localeCompare(a.created_at)); }
  async answers() { return this._read().answers; }
  async saveAttempt(attempt, answers) {
    const db = this._read();
    const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
    const now = new Date().toISOString();
    db.attempts.push({ ...attempt, id, created_at: now });
    for (const a of answers) db.answers.push({ ...a, attempt_id: id, created_at: now });
    this._write(db);
    return id;
  }
  async resetProgress() { this._write({ attempts: [], answers: [] }); }
  // Questions marquées : en mode local, dans le navigateur
  async flags() { try { return JSON.parse(localStorage.getItem(FLAGS_KEY)) || []; } catch { return []; } }
  async setFlag(qid, on) {
    const ids = new Set(await this.flags()); on ? ids.add(qid) : ids.delete(qid);
    localStorage.setItem(FLAGS_KEY, JSON.stringify([...ids]));
  }
  // Quiz sauvegardés : en mode local, dans le navigateur
  async listSaved() { try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch { return []; } }
  async putSaved(entry) {
    const list = [entry, ...(await this.listSaved()).filter(x => x.id !== entry.id)];
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  }
  async deleteSaved(id) {
    localStorage.setItem(SAVED_KEY, JSON.stringify((await this.listSaved()).filter(x => x.id !== id)));
  }
}
