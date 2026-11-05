// Fond animé « flux de données » : vagues en dégradé magenta → orange et chevrons qui défilent,
// dans l'esprit des animations Splunk. Animation figée si l'utilisateur préfère moins de mouvement.
(function () {
  const c = document.getElementById("matrix");
  if (!c) return;
  const ctx = c.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0, h = 0, t = 0, chevrons = [];
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    w = window.innerWidth; h = window.innerHeight;
    c.width = w * dpr; c.height = h * dpr; c.style.width = w + "px"; c.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    chevrons = Array.from({ length: Math.round(w / 90) }, () => ({ x: Math.random() * w, y: h * (0.55 + Math.random() * 0.4), s: 0.3 + Math.random() * 0.8, a: 0.15 + Math.random() * 0.35 }));
  }
  function grad() {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "#ed0080"); g.addColorStop(0.55, "#f4513f"); g.addColorStop(1, "#f99d1c");
    return g;
  }
  function frame() {
    ctx.clearRect(0, 0, w, h);
    const g = grad();
    // vagues de données
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      const base = h * (0.62 + k * 0.05), amp = 22 + k * 9, freq = 0.0035 + k * 0.0006, ph = t * (0.6 + k * 0.12) + k;
      for (let x = 0; x <= w; x += 8) {
        const y = base + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 2.3 - ph * 0.7) * amp * 0.35;
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = g; ctx.globalAlpha = 0.10 + k * 0.035; ctx.lineWidth = 1.2; ctx.stroke();
    }
    // chevrons « > » qui avancent comme un flux d'événements
    ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const p of chevrons) {
      p.x += p.s * (reduce ? 0 : 1); if (p.x > w + 20) p.x = -20;
      const yy = p.y + Math.sin(p.x * 0.01 + t) * 8;
      ctx.globalAlpha = p.a; ctx.strokeStyle = g;
      ctx.beginPath(); ctx.moveTo(p.x - 5, yy - 6); ctx.lineTo(p.x + 3, yy); ctx.lineTo(p.x - 5, yy + 6); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    t += 0.012;
  }
  resize();
  window.addEventListener("resize", resize);
  if (reduce) { frame(); return; }
  (function loop() { if (!document.hidden) frame(); requestAnimationFrame(loop); })();
})();
