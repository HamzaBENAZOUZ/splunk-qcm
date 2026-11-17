// Fichier d'origine (PDF / EPUB) d'un livre importé, gardé sur l'appareil pour pouvoir le redécouper plus tard.
//
//  - Application Android : au moment du choix, le fichier est recopié dans un dossier privé de l'appli
//    (files/imports/), puis relu à l'adresse virtuelle __files/<nom> servie par l'appli.
//  - Navigateur Chrome / Edge sur PC : un navigateur ne donne jamais le chemin d'un fichier à une page web.
//    On garde à la place un « lien » vers le fichier du disque (FileSystemFileHandle) : il se rouvre tant que
//    le fichier n'est ni déplacé ni renommé, avec l'accord de l'utilisateur.
//  - Autres navigateurs : une copie du fichier est gardée dans le navigateur (IndexedDB).
// Le texte découpé, lui, est dans Supabase : il est disponible sur tous les appareils.
const DB = "splunk-book-sources", OS = "src";
let dbp = null;
const db = () => (dbp ||= new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(OS);
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
const tx = (mode, fn) => db().then(d => new Promise((res, rej) => {
  const t = d.transaction(OS, mode), r = fn(t.objectStore(OS));
  t.oncomplete = () => res(r && r.result);
  t.onerror = t.onabort = () => rej(t.error);
}));

const app = () => window.AndroidFiles || null;
export const ACCEPT = ".pdf,.epub,application/pdf,application/epub+zip";
const canHandle = () => !app() && typeof window.showOpenFilePicker === "function";

/** Fait choisir un fichier. Rend { file, keep } où keep(uid, bookId) garde le fichier d'origine pour ce livre. */
export async function pickFile(input) {
  if (canHandle()) {
    let h;
    try {
      [h] = await window.showOpenFilePicker({
        multiple: false, excludeAcceptAllOption: false,
        types: [{ description: "PDF / EPUB", accept: { "application/pdf": [".pdf"], "application/epub+zip": [".epub"] } }],
      });
    } catch (e) { if (e && e.name === "AbortError") return null; throw e; }
    const file = await h.getFile();
    return { file, keep: (uid, id) => put(uid, id, { kind: "handle", name: file.name, size: file.size, handle: h }) };
  }
  const file = await new Promise(ok => {
    input.value = "";
    input.onchange = () => ok(input.files && input.files[0] || null);
    input.oncancel = () => ok(null);
    input.click();
  });
  if (!file) return null;
  if (app()) {
    let saved = "";
    try { saved = app().lastImport() || ""; } catch { /* */ }
    return { file, keep: (uid, id) => put(uid, id, { kind: "app", name: file.name, size: file.size, file: saved }) };
  }
  return { file, keep: (uid, id) => put(uid, id, { kind: "copy", name: file.name, size: file.size, blob: file }) };
}

const k = (uid, id) => (uid || "local") + "|" + id;
const put = (uid, id, rec) => tx("readwrite", s => s.put({ ...rec, at: Date.now() }, k(uid, id))).catch(e => console.warn("source", e));
export const info = (uid, id) => tx("readonly", s => s.get(k(uid, id))).catch(() => undefined);

/** Rouvre le fichier d'origine. Erreur (code "gone") s'il n'est plus disponible sur cet appareil. */
export async function open(uid, id) {
  const r = await info(uid, id);
  const gone = () => Object.assign(new Error("gone"), { code: "gone" });
  if (!r) throw gone();
  if (r.kind === "copy") return new File([r.blob], r.name, { type: r.blob.type });
  if (r.kind === "handle") {
    try {
      if ((await r.handle.queryPermission({ mode: "read" })) !== "granted" && (await r.handle.requestPermission({ mode: "read" })) !== "granted") throw gone();
      return await r.handle.getFile();
    } catch (e) { throw e.code === "gone" ? e : gone(); }
  }
  if (r.kind === "app" && r.file) {
    const res = await fetch(new URL("__files/" + encodeURIComponent(r.file), document.baseURI), { cache: "no-store" });
    if (!res.ok) throw gone();
    return new File([await res.blob()], r.name);
  }
  throw gone();
}

export async function remove(uid, id) {
  const r = await info(uid, id);
  if (r && r.kind === "app" && r.file && app()) { try { app().remove(r.file); } catch { /* */ } }
  await tx("readwrite", s => s.delete(k(uid, id))).catch(() => {});
}
