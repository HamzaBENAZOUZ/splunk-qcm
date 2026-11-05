// Mode hors ligne : petit stockage IndexedDB (clé -> valeur) + enregistrement du service worker.
// Les questions téléchargées restent sur l'appareil de l'utilisateur connecté et sont effacées à la déconnexion.

const DB = "splunk-offline", OS = "kv";
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(OS);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
function tx(mode, fn) {
  return db().then(d => new Promise((res, rej) => {
    const t = d.transaction(OS, mode), st = t.objectStore(OS);
    const r = fn(st);
    t.oncomplete = () => res(r && r.result);
    t.onerror = t.onabort = () => rej(t.error);
  }));
}
export const idbGet = k => tx("readonly", s => s.get(k)).catch(() => undefined);
export const idbSet = (k, v) => tx("readwrite", s => s.put(v, k));
export const idbDel = k => tx("readwrite", s => s.delete(k)).catch(() => {});
export const idbClear = () => tx("readwrite", s => s.clear()).catch(() => {});

// Drapeau « contenu téléchargé sur cet appareil »
const FLAG = "splunk-offline";
export const offlineEnabled = () => { try { return localStorage.getItem(FLAG) === "1"; } catch { return false; } };
export const setOfflineEnabled = on => { try { on ? localStorage.setItem(FLAG, "1") : localStorage.removeItem(FLAG); } catch { /* */ } };

/** Erreur réseau (pas de connexion, serveur injoignable) plutôt qu'erreur applicative. */
export const isNetErr = e => !navigator.onLine || e instanceof TypeError ||
  /failed to fetch|network|load failed|fetch failed|timeout|timed out|ERR_/i.test((e && (e.message || e.details)) || String(e));

/** Rejette si la promesse ne se termine pas à temps (utile hors ligne, où certaines requêtes attendent longtemps). */
export const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

// Mode autonome : l'application tourne uniquement sur la copie de l'appareil, sans Internet ni connexion.
const AUTO = "splunk-autonomous";
export const autonomous = () => { try { return localStorage.getItem(AUTO) === "1" && offlineEnabled(); } catch { return false; } };
export const setAutonomous = on => { try { on ? localStorage.setItem(AUTO, "1") : localStorage.removeItem(AUTO); } catch { /* */ } };

// ---- Service worker : met en cache les fichiers du site pour qu'il s'ouvre sans connexion.
export async function registerSW() {
  if (!("serviceWorker" in navigator)) return false;
  try { await navigator.serviceWorker.register("sw.js"); await navigator.serviceWorker.ready; return true; }
  catch (e) { console.warn("service worker", e); return false; }
}
export async function unregisterSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    if (window.caches) for (const k of await caches.keys()) if (k.startsWith("splunk-")) await caches.delete(k);
  } catch { /* */ }
}
