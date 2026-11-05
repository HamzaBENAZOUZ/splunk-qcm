// Fond "matrix" discret. Désactivé si l'utilisateur préfère moins d'animations.
(function () {
  const c = document.getElementById("matrix");
  if (!c) return;
  const ctx = c.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const chars = "01アイウエオカキクケコABCDEF0123456789#$%&*<>/{}[]";
  const size = 16;
  let cols = 0, drops = [];

  function resize() {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    cols = Math.ceil(c.width / size);
    drops = Array.from({ length: cols }, () => Math.random() * -50);
  }
  function frame() {
    ctx.fillStyle = "rgba(5, 8, 13, 0.12)";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.font = size + "px JetBrains Mono, monospace";
    for (let i = 0; i < cols; i++) {
      const ch = chars[(Math.random() * chars.length) | 0];
      const y = drops[i] * size;
      ctx.fillStyle = Math.random() > 0.975 ? "#ffd0a0" : "#ff8a1f";
      ctx.fillText(ch, i * size, y);
      if (y > c.height && Math.random() > 0.975) drops[i] = 0;
      drops[i] += 0.5;
    }
  }
  resize();
  window.addEventListener("resize", resize);
  if (reduce) { frame(); return; }
  let last = 0;
  (function loop(t) {
    if (t - last > 55) { frame(); last = t; }
    requestAnimationFrame(loop);
  })(0);
})();
