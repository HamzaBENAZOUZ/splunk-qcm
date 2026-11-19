// Module Google TV : lire un livre sur la télé depuis le téléphone.
//
// La même appli Splunk Training est installée sur le téléphone et sur la Google TV (ou toute télé Android TV).
//  - Téléphone : « 📺 Lire sur la télé » (onglet Books). La première fois, il cherche les télés sur le Wi-Fi et s'associe
//    avec le code à 4 chiffres affiché sur la télé. L'association est gardée (même après redémarrage du téléphone ou de
//    la télé) jusqu'à « Dissocier ». Ensuite le livre part sur la télé, et le téléphone sert de télécommande.
//  - Télé : lecteur plein écran, texte en grand, phrase lue surlignée, lecture à voix haute par la télé,
//    chapitres enchaînés. Bouton 📺 en haut : téléphones associés, adresse de la télé, dissociation.
// Le transport (serveur local de la télé, recherche mDNS, jeton d'association) est dans l'appli Android
// (Cast.java, CastService.java, pont AndroidCast). Sur le site web, ce module ne fait rien.

const L = {
  fr: {
    cast: "Lire sur la télé", castTo: "Lire sur {n}", unpair: "Dissocier la télé", unpairQ: "Dissocier « {n} » ? Il faudra refaire l'association avec un code.",
    unpaired: "Télé dissociée", pairT: "Associer une télé", pairTxt: "Ouvre Splunk Training sur la Google TV, connectée au même Wi-Fi que ce téléphone.",
    searching: "Recherche des télés…", none: "Aucune télé trouvée.", again: "Relancer la recherche", manual: "Adresse affichée sur la télé (bouton 📺)",
    connect: "Se connecter", codeT: "Entre le code affiché sur la télé", ok: "Valider", cancel: "Annuler", close: "Fermer",
    badCode: "Code incorrect ({n} essai(s) restant(s))", expired: "Code expiré : recommence l'association.",
    noTv: "Télé injoignable. Vérifie que Splunk Training est ouvert sur la télé et que les deux appareils sont sur le même Wi-Fi.",
    paired: "Télé associée : {n}", busy: "Préparation… {i}/{n}", sending: "Envoi vers la télé…", sent: "Lecture lancée sur {n}",
    openTv: "Ouvre Splunk Training sur la télé : le livre démarrera tout seul.", lost: "La télé a dissocié ce téléphone : refais l'association.",
    chapter: "Chapitre", stopped: "Lecture arrêtée", idle: "En attente", loading: "Chargement…",
    prevCh: "Chapitre précédent", nextCh: "Chapitre suivant", prevS: "Phrase précédente", nextS: "Phrase suivante",
    play: "Lecture", pause: "Pause", stop: "Arrêter sur la télé", hide: "Masquer la télécommande", slower: "Plus lent", faster: "Plus rapide",
    // télé
    tvT: "Télé · téléphones associés", tvName: "Nom de la télé", tvAddr: "Adresse (association manuelle)", tvPhones: "Téléphones associés",
    tvNone: "Aucun téléphone associé. Sur le téléphone : Books › un livre › 📺 Lire sur la télé.", tvUnpair: "Dissocier", tvUnpairAll: "Tout dissocier",
    tvCode: "Code d'association", tvCodeFor: "Demandé par {p}. Entre ce code sur le téléphone.", tvPaired: "Téléphone associé : {p}",
    tvDone: "Livre terminé", tvFrom: "Envoyé depuis le téléphone",
    homeK: "mode télé", homeT: "Prête pour le téléphone", homeTxt: "Pas besoin de te connecter sur la télé : choisis un livre sur le téléphone, la télé l'affiche et le lit à voix haute.",
    homeHow: "Sur le téléphone : Books › un livre › 📺 Lire sur la télé.", homeFirst: "Première fois : choisis cette télé sur le téléphone, puis tape le code qui s'affichera ici.",
    homePaired: "Téléphone(s) associé(s) : {p}", homeManage: "Téléphones associés", homeLogin: "Se connecter sur la télé",
    menuT: "Télé", menuNone: "Aucune télé associée.", menuPair: "Associer une télé", menuChange: "Changer de télé",
    menuRemote: "Ouvrir la télécommande", lang: "Langue sur la télé (FR / EN)", relang: "Passage en {l} sur la télé…", trBg: "Traduction des chapitres suivants pour la télé…", menuHint: "Ouvre un livre ou un chapitre (onglet Books) pour l'envoyer sur la télé.",
  },
  en: {
    cast: "Play on TV", castTo: "Play on {n}", unpair: "Unpair the TV", unpairQ: "Unpair “{n}”? You will need to pair again with a code.",
    unpaired: "TV unpaired", pairT: "Pair a TV", pairTxt: "Open Splunk Training on the Google TV, on the same Wi-Fi as this phone.",
    searching: "Looking for TVs…", none: "No TV found.", again: "Search again", manual: "Address shown on the TV (📺 button)",
    connect: "Connect", codeT: "Enter the code shown on the TV", ok: "Confirm", cancel: "Cancel", close: "Close",
    badCode: "Wrong code ({n} attempt(s) left)", expired: "Code expired: start pairing again.",
    noTv: "TV unreachable. Check that Splunk Training is open on the TV and both devices are on the same Wi-Fi.",
    paired: "TV paired: {n}", busy: "Preparing… {i}/{n}", sending: "Sending to the TV…", sent: "Playing on {n}",
    openTv: "Open Splunk Training on the TV: the book will start by itself.", lost: "The TV unpaired this phone: pair again.",
    chapter: "Chapter", stopped: "Playback stopped", idle: "Waiting", loading: "Loading…",
    prevCh: "Previous chapter", nextCh: "Next chapter", prevS: "Previous sentence", nextS: "Next sentence",
    play: "Play", pause: "Pause", stop: "Stop on the TV", hide: "Hide the remote", slower: "Slower", faster: "Faster",
    tvT: "TV · paired phones", tvName: "TV name", tvAddr: "Address (manual pairing)", tvPhones: "Paired phones",
    tvNone: "No phone paired yet. On the phone: Books › a book › 📺 Play on TV.", tvUnpair: "Unpair", tvUnpairAll: "Unpair all",
    tvCode: "Pairing code", tvCodeFor: "Requested by {p}. Enter this code on the phone.", tvPaired: "Phone paired: {p}",
    tvDone: "Book finished", tvFrom: "Sent from the phone",
    homeK: "TV mode", homeT: "Ready for the phone", homeTxt: "No need to sign in on the TV: pick a book on the phone, the TV shows it and reads it aloud.",
    homeHow: "On the phone: Books › a book › 📺 Play on TV.", homeFirst: "First time: pick this TV on the phone, then type the code that will show up here.",
    homePaired: "Paired phone(s): {p}", homeManage: "Paired phones", homeLogin: "Sign in on the TV",
    menuT: "TV", menuNone: "No TV paired.", menuPair: "Pair a TV", menuChange: "Change TV",
    menuRemote: "Open the remote", lang: "Language on the TV (FR / EN)", relang: "Switching the TV to {l}…", trBg: "Translating the next chapters for the TV…", menuHint: "Open a book or a chapter (Books tab) to send it to the TV.",
  },
};

const bridge = () => window.AndroidCast || null;
let D = { getLang: () => "fr", esc: s => String(s), toast: () => {}, tts: null };
const lang = () => (D.getLang() === "en" ? "en" : "fr");
const t = (k, v) => { let s = L[lang()][k] ?? k; if (v) for (const x in v) s = s.replace(`{${x}}`, v[x]); return s; };
const esc = s => D.esc(s);

/* ---------------- pont avec l'appli ---------------- */
let seq = 0;
const waits = new Map();
window.__castRes = (id, status, body) => {
  const w = waits.get(id); if (!w) return;
  waits.delete(id);
  let data = {}; try { data = body ? JSON.parse(body) : {}; } catch { /* */ }
  w({ status, data });
};
const ask = fn => new Promise(res => {
  const id = "c" + (++seq);
  waits.set(id, res);
  try { fn(id); } catch { waits.delete(id); res({ status: 0, data: {} }); }
});
const handlers = {};
window.__castEvent = (type, data) => { (handlers[type] || []).slice().forEach(f => { try { f(data); } catch (e) { console.error(e); } }); };
const on = (type, f) => { (handlers[type] ||= []).push(f); return () => { handlers[type] = (handlers[type] || []).filter(x => x !== f); }; };

const tvSide = () => { const b = bridge(); try { return !!b && b.isTv(); } catch { return false; } };
/** Téléphone avec l'appli 2.7+ : le bouton « Lire sur la télé » est proposé. */
export const canCast = () => { const b = bridge(); try { return !!b && !b.isTv(); } catch { return false; } };
export function pairedTv() { try { const s = bridge().paired(); return s ? JSON.parse(s) : null; } catch { return null; } }

/* ---------------- téléphone : association ---------------- */
function modal(html) {
  const ov = document.createElement("div");
  ov.className = "bk-modal-ov";
  ov.innerHTML = `<div class="panel bk-modal cast-modal" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(ov);
  return ov;
}

/** Fenêtre d'association : recherche des télés, puis code. Renvoie {id, name} ou null. */
export function pairDialog() {
  const b = bridge(); if (!b) return Promise.resolve(null);
  return new Promise(resolve => {
    const ov = modal(`<h2>📺 ${esc(t("pairT"))}</h2>
      <div class="cast-step" data-step="find">
        <p class="muted">${esc(t("pairTxt"))}</p>
        <ul class="cast-list" id="cast-list"></ul>
        <p class="muted mono cast-scan" id="cast-scan">⏳ ${esc(t("searching"))}</p>
        <button class="btn btn-ghost btn-sm" id="cast-again" hidden>🔄 ${esc(t("again"))}</button>
        <details class="cast-manual"><summary class="muted">${esc(t("manual"))}</summary>
          <div class="row"><input id="cast-host" class="cast-inp mono" placeholder="192.168.1.20:47815" inputmode="url" autocomplete="off">
          <button class="btn btn-ghost btn-sm" id="cast-go">${esc(t("connect"))}</button></div></details>
      </div>
      <div class="cast-step" data-step="code" hidden>
        <p><strong id="cast-tvname"></strong></p>
        <label class="mono muted" for="cast-code">${esc(t("codeT"))}</label>
        <div class="row"><input id="cast-code" class="cast-inp cast-code-inp mono" inputmode="numeric" maxlength="4" autocomplete="one-time-code" pattern="[0-9]*">
        <button class="btn btn-primary" id="cast-ok">${esc(t("ok"))}</button></div>
      </div>
      <p class="cast-err" id="cast-err" role="alert" hidden></p>
      <div class="row bk-modal-acts"><button class="btn btn-ghost" data-m="no">${esc(t("cancel"))}</button></div>`);
    const $ = s => ov.querySelector(s);
    const list = $("#cast-list"), err = $("#cast-err");
    const found = new Map();
    let target = null, closed = false;
    const offs = [];
    const finish = v => {
      if (closed) return; closed = true;
      offs.forEach(f => f()); ov.remove(); removeEventListener("keydown", onKey); resolve(v);
    };
    const onKey = e => { if (e.key === "Escape") finish(null); };
    addEventListener("keydown", onKey);
    const fail = m => { err.textContent = m; err.hidden = !m; };
    const scan = () => {
      $("#cast-scan").hidden = false; $("#cast-again").hidden = true;
      try { b.discover(10000); } catch { /* */ }
    };
    offs.push(on("found", tv => {
      if (!tv || !tv.host || found.has(tv.id + "@" + tv.host)) return;
      found.set(tv.id + "@" + tv.host, tv);
      const li = document.createElement("li");
      li.innerHTML = `<button class="btn btn-ghost cast-tv">📺 <span>${esc(tv.name || "TV")}</span> <span class="muted mono">${esc(tv.host)}</span></button>`;
      li.firstChild.onclick = () => start(tv);
      list.appendChild(li);
    }));
    offs.push(on("scanEnd", () => {
      $("#cast-scan").hidden = !!found.size;
      if (!found.size) $("#cast-scan").textContent = t("none");
      $("#cast-again").hidden = false;
    }));
    const start = async tv => {
      fail("");
      ov.querySelectorAll(".cast-tv, #cast-go").forEach(x => (x.disabled = true));
      const r = await ask(id => b.pair(id, tv.host, +tv.port || 47815));
      ov.querySelectorAll(".cast-tv, #cast-go").forEach(x => (x.disabled = false));
      if (closed) return;
      if (r.status !== 200) return fail(t("noTv"));
      target = { ...tv, name: r.data.name || tv.name };
      $('[data-step="find"]').hidden = true; $('[data-step="code"]').hidden = false;
      $("#cast-tvname").textContent = "📺 " + (target.name || "TV");
      $("#cast-code").focus();
    };
    const confirm = async () => {
      const code = $("#cast-code").value.replace(/\D/g, "");
      if (code.length !== 4 || !target) return;
      fail(""); $("#cast-ok").disabled = true;
      const r = await ask(id => b.confirm(id, target.host, +target.port || 47815, code));
      $("#cast-ok").disabled = false;
      if (closed) return;
      if (r.status === 200) { D.toast(t("paired", { n: r.data.name || target.name }), "ok"); return finish(r.data); }
      if (r.status === 403) { $("#cast-code").value = ""; return fail(t("badCode", { n: r.data.left ?? "?" })); }
      if (r.status === 410) {
        $('[data-step="find"]').hidden = false; $('[data-step="code"]').hidden = true; target = null;
        return fail(t("expired"));
      }
      fail(t("noTv"));
    };
    $("#cast-again").onclick = () => { fail(""); scan(); };
    $("#cast-go").onclick = () => {
      const m = /^\s*([0-9a-z.\-:\[\]]+?)(?::(\d{2,5}))?\s*$/i.exec($("#cast-host").value || "");
      if (!m) return fail(t("noTv"));
      start({ id: "", name: m[1], host: m[1], port: +(m[2] || 47815) });
    };
    $("#cast-ok").onclick = confirm;
    $("#cast-code").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); if (e.target.value.length === 4) confirm(); });
    ov.onclick = e => { if (e.target === ov || e.target.closest('[data-m="no"]')) finish(null); };
    scan();
  });
}

/** Dissocie la télé (avec confirmation). */
export async function unpairTv() {
  const tv = pairedTv(); if (!tv) return false;
  if (!window.confirm(t("unpairQ", { n: tv.name || "TV" }))) return false;
  hideRemote();
  await ask(id => bridge().unpair(id));
  D.toast(t("unpaired"), "ok");
  return true;
}

/* ---------------- téléphone : envoi d'un livre et télécommande ---------------- */
async function call(method, path, body) {
  const r = await ask(id => bridge().call(id, method, path, body == null ? "" : JSON.stringify(body)));
  if (r.status === 401) { hideRemote(); D.toast(t("lost"), "warn"); }
  return r;
}

let remote = null;          // { el, timer, onDone, book }
let last = null;            // dernier livre envoyé : pour rouvrir la télécommande depuis le bouton 📺 du haut
let action = null;          // page en cours (livre ou chapitre) : { hash, label, run(btn) }

/** L'onglet Books indique ce que le bouton 📺 du haut peut envoyer sur la page affichée (null : rien). */
export function setCastAction(a) { action = a ? { ...a, hash: location.hash } : null; }

/* ---------------- téléphone : bouton 📺 en haut, sur toutes les pages ---------------- */
let topBtn = null;
function paintTopBtn() {
  if (!topBtn) return;
  const tv = pairedTv();
  topBtn.classList.toggle("on", !!tv);
  topBtn.title = topBtn.ariaLabel = tv ? `${t("menuT")} : ${tv.name || "TV"}` : t("menuPair");
}
async function phoneMenu() {
  let tv = pairedTv();
  if (!tv) { await pairDialog(); return paintTopBtn(); }
  const act = action && action.hash === location.hash ? action : null;
  const ov = modal(`<h2>📺 ${esc(tv.name || "TV")}</h2>
    <div class="cast-menu">
      ${act ? `<button class="btn btn-primary" data-k="send">📺 ${esc(act.label)}</button>` : `<p class="muted">${esc(t("menuHint"))}</p>`}
      ${last ? `<button class="btn btn-ghost" data-k="remote">🎛 ${esc(t("menuRemote"))}</button>` : ""}
      <button class="btn btn-ghost" data-k="change">🔄 ${esc(t("menuChange"))}</button>
      <button class="btn btn-ghost" data-k="unpair">✕ ${esc(t("unpair"))}</button>
    </div>
    <div class="row bk-modal-acts"><button class="btn btn-ghost" data-k="close">${esc(t("close"))}</button></div>`);
  const close = () => { ov.remove(); removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") close(); };
  addEventListener("keydown", onKey);
  ov.onclick = async e => {
    if (e.target === ov) return close();
    const b = e.target.closest("[data-k]"); if (!b) return;
    const k = b.dataset.k;
    close();
    if (k === "send") await act.run(topBtn);
    else if (k === "remote") showRemote(pairedTv() || tv, last);
    else if (k === "change") await pairDialog();
    else if (k === "unpair") await unpairTv();
    paintTopBtn();
  };
  const f = ov.querySelector("[data-k]"); if (f) f.focus();
}

/** Chapitre mis à jour (traduit en arrière-plan sur le téléphone) : remplacé dans le livre en cours sur la télé. */
export async function sendChapter(bookId, ch) {
  const r = await call("POST", "/chapter", { book: bookId, chapter: ch });
  return r.status === 200;
}

/**
 * Envoie un livre préparé par l'onglet Books :
 * { id, title, author, ui, rate, start: n, pos, chapters: [{ n, title, lang, blocks: [{ k, x, s: [phrases] }] }] }
 * opts.onDone(bookId, [n…]) : chapitres écoutés jusqu'au bout sur la télé.
 * opts.relang(lang, n, frac) : renvoyer le livre dans l'autre langue (bouton FR / EN de la télécommande).
 */
export async function sendBook(pkg, opts = {}) {
  let tv = pairedTv() || await pairDialog();
  if (!tv) return false;
  const r = await call("POST", "/play", pkg);
  if (r.status !== 200) { if (r.status !== 401) D.toast(t("noTv"), "err"); return false; }
  tv = pairedTv() || tv;
  D.toast(r.data.open === false ? t("openTv") : t("sent", { n: tv.name || "TV" }), r.data.open === false ? "warn" : "ok");
  last = { meta: { id: pkg.id, title: pkg.title, rate: pkg.rate, lang: pkg.lang }, onDone: opts.onDone, relang: opts.relang };
  showRemote(tv, last);
  paintTopBtn();
  return true;
}

function hideRemote() {
  if (!remote) return;
  clearInterval(remote.timer);
  remote.el.remove();
  document.body.classList.remove("cast-remote-on");
  remote = null;
}

function showRemote(tv, ctx) {
  hideRemote();
  const pkg = ctx.meta, onDone = ctx.onDone;
  const el = document.createElement("div");
  el.className = "cast-bar panel";
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", t("cast"));
  el.innerHTML = `<div class="cast-bar-info"><p class="mono cast-bar-tv">📺 ${esc(tv.name || "TV")}</p>
      <p class="cast-bar-t" id="cast-bar-t">${esc(pkg.title || "")}</p><p class="mono muted cast-bar-s" id="cast-bar-s">${esc(t("loading"))}</p></div>
    <div class="cast-bar-btns">
      <button class="icon-btn" data-c="prevch" title="${esc(t("prevCh"))}" aria-label="${esc(t("prevCh"))}">⏮</button>
      <button class="icon-btn" data-c="prev" title="${esc(t("prevS"))}" aria-label="${esc(t("prevS"))}">⏪</button>
      <button class="icon-btn cast-main" data-c="toggle" title="${esc(t("play"))}" aria-label="${esc(t("play"))}">⏯</button>
      <button class="icon-btn" data-c="next" title="${esc(t("nextS"))}" aria-label="${esc(t("nextS"))}">⏩</button>
      <button class="icon-btn" data-c="nextch" title="${esc(t("nextCh"))}" aria-label="${esc(t("nextCh"))}">⏭</button>
      <button class="icon-btn" data-c="slower" title="${esc(t("slower"))}" aria-label="${esc(t("slower"))}">−</button>
      <span class="mono cast-rate" id="cast-rate"></span>
      <button class="icon-btn" data-c="faster" title="${esc(t("faster"))}" aria-label="${esc(t("faster"))}">+</button>
      ${ctx.relang ? `<button class="btn btn-ghost btn-xs mono cast-lang" data-c="lang" title="${esc(t("lang"))}" aria-label="${esc(t("lang"))}">${esc((pkg.lang || "en").toUpperCase())}</button>` : ""}
      <button class="icon-btn" data-c="stop" title="${esc(t("stop"))}" aria-label="${esc(t("stop"))}">⏹</button>
      <button class="icon-btn" data-c="hide" title="${esc(t("hide"))}" aria-label="${esc(t("hide"))}">✕</button>
    </div>`;
  document.body.appendChild(el);
  document.body.classList.add("cast-remote-on");
  const seen = new Set();
  remote = { el, onDone, book: pkg.id, timer: 0, rate: pkg.rate || 1, st: null };
  const paint = s => {
    if (!remote || remote.el !== el) return;
    if (!s || s.closed) { el.querySelector("#cast-bar-s").textContent = t("stopped"); return; }
    if (s.loading) { el.querySelector("#cast-bar-s").textContent = s.open === false ? t("openTv") : t("loading"); return; }
    if (s.title) el.querySelector("#cast-bar-t").textContent = `${s.title} · ${s.ch || ""}`;
    el.querySelector("#cast-bar-s").textContent = s.finished ? t("tvDone")
      : `${s.playing ? "▶" : "⏸"} ${t("chapter")} ${s.n} (${(s.ci ?? 0) + 1}/${s.nCh || "?"}) · ${(s.k ?? 0) + 1}/${s.total || "?"}`;
    remote.st = s;
    if (s.rate) { remote.rate = s.rate; el.querySelector("#cast-rate").textContent = s.rate + "×"; }
    const lb = el.querySelector(".cast-lang"); if (lb && s.lang) lb.textContent = s.lang.toUpperCase();
    const main = el.querySelector(".cast-main");
    main.textContent = s.playing ? "⏸" : "▶"; main.title = main.ariaLabel = t(s.playing ? "pause" : "play");
    const fresh = (s.done || []).filter(n => !seen.has(n));
    fresh.forEach(n => seen.add(n));
    if (fresh.length && s.book === remote.book && remote.onDone) remote.onDone(s.book, fresh);
  };
  const poll = async () => {
    if (document.hidden || !remote || remote.el !== el) return;
    const r = await call("GET", "/state");
    if (r.status === 200) paint(r.data);
  };
  el.onclick = async e => {
    const a = e.target.closest("[data-c]"); if (!a) return;
    const c = a.dataset.c;
    if (c === "hide") return hideRemote();
    if (c === "lang") {
      // l'autre langue : le téléphone prépare (et traduit si besoin) le livre, puis le renvoie à la même place
      const st = remote.st || {}, cur = st.lang || pkg.lang || "en", to = cur === "fr" ? "en" : "fr";
      a.disabled = true; D.toast(t("relang", { l: to.toUpperCase() }), "info");
      try { await ctx.relang(to, st.n ?? null, st.total ? (st.k || 0) / st.total : 0); } finally { if (a.isConnected) a.disabled = false; }
      return;
    }
    let body = { c };
    if (c === "slower" || c === "faster") body = { c: "rate", v: Math.round(Math.min(2.5, Math.max(0.5, remote.rate + (c === "faster" ? 0.1 : -0.1))) * 100) / 100 };
    const r = await call("POST", "/cmd", body);
    if (r.status === 200) paint(r.data); else if (r.status !== 401) D.toast(t("noTv"), "err");
  };
  remote.timer = setInterval(poll, 2500);
  setTimeout(poll, 800);
}

/* ---------------- télé : lecteur plein écran ---------------- */
let tvp = null;          // { pkg, ci, k, segs, playing, token, rate, done:Set, el }

function tvReport(extra) {
  const b = bridge(); if (!b) return;
  let s = { closed: true };
  if (tvp) {
    const ch = tvp.pkg.chapters[tvp.ci];
    s = { book: tvp.pkg.id, title: tvp.pkg.title, n: ch.n, ch: ch.title, ci: tvp.ci, nCh: tvp.pkg.chapters.length,
      k: tvp.k, total: tvp.segs.length, playing: tvp.playing, rate: tvp.rate, done: [...tvp.done], finished: !!tvp.finished, lang: ch.lang || "en" };
  }
  try { b.state(JSON.stringify({ ...s, ...(extra || {}) })); } catch { /* */ }
}

function tvAwake(on) { try { window.AndroidMedia && window.AndroidMedia.screen(!!on); } catch { /* */ } }

function tvOpen(pkg) {
  tvStop(true);
  if (!pkg || !Array.isArray(pkg.chapters) || !pkg.chapters.length) return;
  const el = document.createElement("div");
  el.className = "cast-ov";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  document.body.appendChild(el);
  document.body.classList.add("cast-tv-on");
  try { bridge().overlay(true); } catch { /* */ }
  let ci = Math.max(0, pkg.chapters.findIndex(c => c.n === pkg.start));
  tvp = { pkg, ci, k: 0, segs: [], playing: false, token: 0, rate: +pkg.rate || 1, done: new Set(), el, finished: false };
  tvChapter(ci, Math.max(0, +pkg.pos || 0));
  if (pkg.frac > 0) tvp.k = Math.min(tvp.segs.length - 1, Math.floor(pkg.frac * tvp.segs.length));   // changement de langue : même endroit
  tvPlay(tvp.k);
}

function tvChapter(ci, k = 0) {
  const P = tvp, ch = P.pkg.chapters[ci];
  P.ci = ci; P.segs = []; P.finished = false;
  let head = -1;            // bloc titre : lu, et surligné dans l'en-tête (pas répété dans le texte)
  const blocks = (ch.blocks || []).map((bl, i) => {
    for (const s of bl.s || []) if (String(s).trim()) P.segs.push({ b: i, txt: String(s) });
    if (bl.k === "h1" && head < 0) { head = i; return ""; }
    const tag = bl.k === "h1" ? "h2" : bl.k === "h3" ? "h3" : bl.k === "li" ? "p" : bl.k === "pre" ? "pre" : "p";
    return `<${tag} class="cast-b${bl.k === "li" ? " cast-li" : ""}" data-b="${i}">${esc(bl.x || "")}</${tag}>`;
  }).join("");
  P.k = Math.min(k, Math.max(0, P.segs.length - 1));
  P.el.innerHTML = `<header class="cast-head">
      <div><p class="kicker mono">${esc(P.pkg.title || "")} · ${esc(t("chapter"))} ${ch.n} (${ci + 1}/${P.pkg.chapters.length})</p>
      <h1 class="cast-title${head >= 0 ? " cast-b" : ""}" data-b="${head}" lang="${esc(ch.lang || "en")}">${esc(ch.title || "")}</h1></div>
      <p class="mono cast-pos" id="cast-pos"></p></header>
    <article class="cast-text" lang="${esc(ch.lang || "en")}">${blocks}</article>
    <nav class="cast-ctl" aria-label="${esc(t("cast"))}">
      <button class="btn btn-ghost" data-c="prevch" title="${esc(t("prevCh"))}">⏮</button>
      <button class="btn btn-ghost" data-c="prev" title="${esc(t("prevS"))}">⏪</button>
      <button class="btn btn-primary cast-main" data-c="toggle">▶</button>
      <button class="btn btn-ghost" data-c="next" title="${esc(t("nextS"))}">⏩</button>
      <button class="btn btn-ghost" data-c="nextch" title="${esc(t("nextCh"))}">⏭</button>
      <span class="mono muted cast-rate" id="cast-tv-rate"></span>
      <button class="btn btn-ghost" data-c="stop" title="${esc(t("close"))}">✕ ${esc(t("close"))}</button>
    </nav>`;
  P.el.querySelector(".cast-ctl").onclick = e => { const a = e.target.closest("[data-c]"); if (a) tvCmd(a.dataset.c); };
  P.el.scrollTop = 0;
  tvPaint();
  setTimeout(() => { const m = P.el.querySelector(".cast-main"); if (m && tvp === P) m.focus({ preventScroll: true }); }, 50);
}

function tvPaint() {
  const P = tvp; if (!P) return;
  const cur = P.segs[P.k];
  P.el.querySelectorAll(".cast-b.bk-say").forEach(x => x.classList.remove("bk-say"));
  if (cur) {
    const b = P.el.querySelector(`.cast-b[data-b="${cur.b}"]`);
    if (b) {
      b.classList.add("bk-say");
      const r = b.getBoundingClientRect();
      if (r.top < innerHeight * 0.2 || r.bottom > innerHeight * 0.75) b.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }
  const pos = P.el.querySelector("#cast-pos");
  if (pos) pos.textContent = P.finished ? t("tvDone") : `${P.k + 1}/${P.segs.length || 1}`;
  const main = P.el.querySelector(".cast-main");
  if (main) { main.textContent = P.playing ? "⏸ " + t("pause") : "▶ " + t("play"); }
  const rt = P.el.querySelector("#cast-tv-rate"); if (rt) rt.textContent = P.rate + "×";
  tvAwake(P.playing);
  tvReport();
}

function tvPlay(k) {
  const P = tvp; if (!P || !D.tts || !D.tts.can) return tvPaint();
  if (!P.segs.length) return tvEndChapter();
  P.k = Math.max(0, Math.min(P.segs.length - 1, k)); P.playing = true; P.finished = false;
  const my = ++P.token;
  tvPaint();
  const ch = P.pkg.chapters[P.ci];
  const lng = ch.lang === "fr" && D.tts.canFr ? "fr" : "en";
  D.tts.speak(P.segs[P.k].txt, lng, P.rate, () => {
    if (tvp !== P || my !== P.token) return;
    if (P.k + 1 < P.segs.length) tvPlay(P.k + 1); else tvEndChapter();
  }, "");
}

function tvEndChapter() {
  const P = tvp; if (!P) return;
  P.done.add(P.pkg.chapters[P.ci].n);
  if (P.ci + 1 < P.pkg.chapters.length) { tvChapter(P.ci + 1, 0); return tvPlay(0); }
  P.playing = false; P.finished = true; P.k = 0;
  tvPaint();
}

function tvPause() {
  const P = tvp; if (!P) return;
  P.token++; P.playing = false;
  try { D.tts.stop(); } catch { /* */ }
  tvPaint();
}

function tvStop(silent) {
  if (!tvp) return;
  const P = tvp;
  P.token++;
  try { D.tts.stop(); } catch { /* */ }
  tvp = null;
  P.el.remove();
  document.body.classList.remove("cast-tv-on");
  tvAwake(false);
  try { bridge().overlay(false); } catch { /* */ }
  if (!silent) tvReport();
}

function tvCmd(c, v) {
  const P = tvp; if (!P) return;
  const move = j => { if (P.playing) tvPlay(j); else { P.k = Math.max(0, Math.min(P.segs.length - 1, j)); tvPaint(); } };
  if (c === "toggle") return P.playing ? tvPause() : tvPlay(P.finished ? 0 : P.k);
  if (c === "play") return P.playing || tvPlay(P.finished ? 0 : P.k);
  if (c === "pause") return P.playing && tvPause();
  if (c === "next") return move(P.k + 1);
  if (c === "prev") return move(P.k - 1);
  if (c === "nextch" || c === "prevch") {
    const ci = P.ci + (c === "nextch" ? 1 : -1);
    if (ci < 0 || ci >= P.pkg.chapters.length) return;
    const was = P.playing; P.token++;
    try { D.tts.stop(); } catch { /* */ }
    P.playing = false;
    tvChapter(ci, 0);
    return was ? tvPlay(0) : tvPaint();
  }
  if (c === "rate") { P.rate = Math.round(Math.min(2.5, Math.max(0.5, +v || 1)) * 100) / 100; return P.playing ? tvPlay(P.k) : tvPaint(); }
  if (c === "stop") return tvStop();
}

/** Chapitre traduit envoyé après coup par le téléphone : remplacé ; si c'est celui qui est lu, il reprend au même endroit. */
function tvTakeChapters() {
  const b = bridge(); if (!b || typeof b.takeChapter !== "function") return;
  for (let s; (s = b.takeChapter()); ) {
    let m; try { m = JSON.parse(s); } catch { continue; }
    const P = tvp;
    if (!P || !m || m.book !== P.pkg.id || !m.chapter) continue;
    const i = P.pkg.chapters.findIndex(c => c.n === m.chapter.n);
    if (i < 0) continue;
    P.pkg.chapters[i] = m.chapter;
    if (i !== P.ci) continue;
    const frac = P.segs.length ? P.k / P.segs.length : 0, was = P.playing;
    P.token++; try { D.tts.stop(); } catch { /* */ }
    P.playing = false;
    tvChapter(i, 0);
    P.k = Math.min(P.segs.length - 1, Math.floor(frac * P.segs.length));
    was ? tvPlay(P.k) : tvPaint();
  }
}

function tvTake() {
  const b = bridge(); if (!b) return;
  let s = ""; try { s = b.takePending(); } catch { /* */ }
  if (!s) return;
  try { tvOpen(JSON.parse(s)); } catch (e) { console.error("cast", e); }
}

/* ---------------- télé : code d'association et téléphones associés ---------------- */
let codeEl = null;
function tvShowCode(code, phone) {
  tvHideCode();
  if (!code) return;
  codeEl = document.createElement("div");
  codeEl.className = "cast-code";
  codeEl.setAttribute("role", "alert");
  codeEl.innerHTML = `<div class="panel cast-code-box"><p class="mono muted">📺 ${esc(t("tvCode"))}</p>
    <p class="cast-code-n mono">${esc(code)}</p><p class="muted">${esc(t("tvCodeFor", { p: phone || "?" }))}</p></div>`;
  document.body.appendChild(codeEl);
  setTimeout(tvHideCode, 3 * 60 * 1000);
}
function tvHideCode() { if (codeEl) { codeEl.remove(); codeEl = null; } }

let panel = null;
function tvPanel() {
  const b = bridge(); if (!b) return;
  let info = {}; try { info = JSON.parse(b.info() || "{}"); } catch { /* */ }
  if (panel) panel.remove();
  const phones = info.phones || [];
  panel = modal(`<h2>📺 ${esc(t("tvT"))}</h2>
    <p><span class="mono muted">${esc(t("tvName"))} :</span> <strong>${esc(info.name || "TV")}</strong></p>
    <p><span class="mono muted">${esc(t("tvAddr"))} :</span> <strong class="mono">${esc(info.ip || "?")}${info.port ? ":" + info.port : ""}</strong></p>
    <h3 class="mono">${esc(t("tvPhones"))}</h3>
    ${phones.length ? `<ul class="cast-phones">${phones.map(p => `<li><span>📱 ${esc(p.name || "?")}</span>
      <button class="btn btn-ghost btn-sm" data-un="${esc(p.id)}">${esc(t("tvUnpair"))}</button></li>`).join("")}</ul>`
      : `<p class="muted">${esc(t("tvNone"))}</p>`}
    <div class="row bk-modal-acts">${phones.length > 1 ? `<button class="btn btn-ghost" data-un="*">${esc(t("tvUnpairAll"))}</button>` : ""}
      <button class="btn btn-primary" data-m="no">${esc(t("close"))}</button></div>`);
  const close = () => { if (panel) { panel.remove(); panel = null; } };
  panel.onclick = e => {
    if (e.target === panel || e.target.closest('[data-m="no"]')) return close();
    const u = e.target.closest("[data-un]"); if (!u) return;
    try { b.unpairPhone(u.dataset.un); } catch { /* */ }
    tvPanel(); homeRefresh();
  };
  const first = panel.querySelector("[data-un], [data-m]"); if (first) first.focus();
}

/* ---------------- télé : écran d'accueil sans connexion ---------------- */
// La télé n'a pas besoin du compte : les livres arrivent du téléphone associé. Au lieu de l'écran de connexion,
// elle affiche cet écran d'attente ; « Se connecter sur la télé » reste possible pour les QCM.
export const isCastTv = () => tvSide();
let home = null;          // { el, onLogin }
export function renderTvHome(el, onLogin) {
  const b = bridge(); if (!b) return;
  home = { el, onLogin };
  let info = {}; try { info = JSON.parse(b.info() || "{}"); } catch { /* */ }
  const phones = (info.phones || []).map(p => p.name || "?");
  el.innerHTML = `<section class="panel cast-home">
    <p class="mono kicker">&gt; ${esc(t("homeK"))}</p>
    <h1>📺 ${esc(t("homeT"))}</h1>
    <p class="cast-home-name"><strong>${esc(info.name || "TV")}</strong> <span class="muted mono">${esc(info.ip || "")}${info.port ? ":" + info.port : ""}</span></p>
    <p>${esc(t("homeTxt"))}</p>
    <p class="muted">${esc(phones.length ? t("homeHow") : t("homeFirst") + " " + t("homeHow"))}</p>
    ${phones.length ? `<p class="mono cast-home-ph">📱 ${esc(t("homePaired", { p: phones.join(", ") }))}</p>` : ""}
    <div class="row cast-home-acts">
      ${phones.length ? `<button class="btn btn-ghost" id="cast-home-ph">${esc(t("homeManage"))}</button>` : ""}
      <button class="btn btn-ghost" id="cast-home-login">${esc(t("homeLogin"))}</button>
    </div></section>`;
  const m = el.querySelector("#cast-home-ph"); if (m) m.onclick = tvPanel;
  el.querySelector("#cast-home-login").onclick = () => { home = null; onLogin && onLogin(); };
  const first = el.querySelector(".cast-home button"); if (first) setTimeout(() => first.focus({ preventScroll: true }), 50);
}
const homeRefresh = () => { if (home && home.el.querySelector(".cast-home")) renderTvHome(home.el, home.onLogin); else home = null; };

/* ---------------- démarrage ---------------- */
export function initCast(deps) {
  D = { ...D, ...deps };
  if (canCast()) {
    // Téléphone : bouton 📺 dans la barre du haut, sur toutes les pages
    const right = document.querySelector(".topbar-right");
    if (right && !document.getElementById("btn-cast")) {
      topBtn = document.createElement("button");
      topBtn.id = "btn-cast"; topBtn.className = "icon-btn cast-top"; topBtn.type = "button";
      topBtn.innerHTML = "📺";
      topBtn.onclick = phoneMenu;
      right.insertBefore(topBtn, right.firstChild);
      paintTopBtn();
    }
    return;
  }
  if (!tvSide()) return;
  // Télé : bouton 📺 dans la barre du haut, code d'association, lecteur plein écran
  try { bridge().serve(); } catch { /* */ }
  const right = document.querySelector(".topbar-right");
  if (right && !document.getElementById("btn-cast-tv")) {
    const btn = document.createElement("button");
    btn.id = "btn-cast-tv"; btn.className = "icon-btn"; btn.type = "button";
    btn.title = btn.ariaLabel = t("tvT"); btn.textContent = "📺";
    btn.onclick = tvPanel;
    right.insertBefore(btn, right.firstChild);
  }
  on("code", d => d && tvShowCode(d.code, d.phone));
  on("codeEnd", d => { tvHideCode(); if (d && d.phone) D.toast(t("tvPaired", { p: d.phone }), "ok"); if (panel) tvPanel(); homeRefresh(); });
  on("phones", () => { if (panel) tvPanel(); homeRefresh(); });
  on("play", tvTake);
  on("chapter", tvTakeChapters);
  on("cmd", d => d && tvCmd(d.c, d.v));
  window.__castBack = () => { if (codeEl) return tvHideCode(); tvStop(); };
  window.__castWake = () => {
    let info = {}; try { info = JSON.parse(bridge().info() || "{}"); } catch { /* */ }
    if (info.code && !codeEl) tvShowCode(info.code, info.phone);
    tvTake();
  };
  // Télécommande de la télé : touches média, Retour / Échap ferme le lecteur
  addEventListener("keydown", e => {
    if (!tvp) return;
    const k = { MediaPlayPause: "toggle", MediaPlay: "play", MediaPause: "pause", MediaStop: "pause", MediaTrackNext: "nextch",
      MediaTrackPrevious: "prevch", MediaFastForward: "next", MediaRewind: "prev", Escape: "stop" }[e.key];
    if (!k) return;
    e.preventDefault(); e.stopImmediatePropagation();
    tvCmd(k);
  }, true);
  window.__castWake();
}

