// Mode télé (Android TV) : navigation à la télécommande (flèches + OK), focus bien visible, texte plus grand.
// Activé quand l'appli tourne sur une télé (l'APK ajoute « SplunkTV/1 » à son user-agent),
// ou sur le site avec ?tv=1 dans l'adresse (pour essayer au clavier sur un PC).
export const isTV = /SplunkTV\//.test(navigator.userAgent) || /[?&]tv=1\b/.test(location.search);

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

function shown(el) {
  if (el.closest("[hidden], [aria-hidden=true]")) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const s = getComputedStyle(el);
  return s.visibility !== "hidden" && s.display !== "none" && +s.opacity !== 0;
}

/** Élément le plus proche dans la direction demandée (null s'il n'y en a pas d'assez proche). */
function nearest(from, [dx, dy], scope) {
  const a = from.getBoundingClientRect(), H = innerHeight;
  let best = null, bestScore = Infinity;
  for (const el of scope.querySelectorAll(FOCUSABLE)) {
    if (el === from || !shown(el)) continue;
    const r = el.getBoundingClientRect();
    // distance dans l'axe du déplacement (bord à bord), et décalage sur l'autre axe
    let main, side;
    if (dy) {
      main = dy > 0 ? r.top - a.bottom : a.top - r.bottom;
      if (main < -Math.min(a.height, r.height) / 2) continue;
      side = Math.max(0, Math.max(a.left, r.left) - Math.min(a.right, r.right));
    } else {
      main = dx > 0 ? r.left - a.right : a.left - r.right;
      if (main < -Math.min(a.width, r.width) / 2) continue;
      const overlap = Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top);
      if (overlap < Math.min(a.height, r.height) * 0.3) continue;     // gauche / droite : même ligne seulement
      side = Math.abs((r.top + r.bottom) / 2 - (a.top + a.bottom) / 2);
    }
    if (dy && main > H * 0.8) continue;                                  // trop loin : on fait défiler la page à la place
    const score = Math.max(0, main) + side * 2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  return best;
}

function focusEl(el) {
  el.focus({ preventScroll: true });
  const r = el.getBoundingClientRect();
  if (r.top < 70 || r.bottom > innerHeight - 90) el.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function initTV() {
  if (!isTV) return;
  document.documentElement.classList.add("tv");
  addEventListener("keydown", e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const a = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    // OK de la télécommande : le bouton ou le lien sélectionné s'active normalement (pas de raccourci du quiz).
    if (e.key === "Enter") { if (a) e.stopImmediatePropagation(); return; }
    const dir = DIRS[e.key];
    if (!dir) return;
    if (a && dir[0] && a.matches('input[type=range], input[type=text], input[type=email], input[type=password], input:not([type]), textarea')) return;
    if (a && a.matches("select") && dir[1]) return;                  // liste déroulante ouverte : laisse faire
    e.preventDefault(); e.stopImmediatePropagation();
    const scope = document.querySelector(".bk-modal-ov") || document.querySelector(".cast-ov") || document;  // fenêtre ouverte (confirmation, lecteur télé) : on y reste
    if (!a || !shown(a) || !scope.contains(a)) {
      const first = [...scope.querySelectorAll(FOCUSABLE)].find(el => { if (!shown(el)) return false; const r = el.getBoundingClientRect(); return r.bottom > 60 && r.top < innerHeight; });
      if (first) return focusEl(first);
    } else {
      const next = nearest(a, dir, scope);
      if (next) return focusEl(next);
    }
    // Rien dans cette direction : on fait défiler le texte (lecture d'un long chapitre)
    if (dir[1]) scrollBy({ top: dir[1] * innerHeight * 0.6, behavior: "smooth" });
  }, true);
}
