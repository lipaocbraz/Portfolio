/* Neve fina caindo pela página inteira enquanto o cenário de neve está à mostra (subida e cume).
   Some ao entrar na cabana e não aparece na tela do computador. Canvas 2D leve, atrás do texto.
   prefers-reduced-motion: sem neve. */
(function () {
  "use strict";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var CONFIG = { density: 1 / 7000, size: [0.35, 1.1], speed: [12, 34], drift: 10, alpha: [0.25, 0.7] };   // flocos por px², raio, px/s
  var cv = document.createElement("canvas"); cv.id = "snow"; cv.setAttribute("aria-hidden", "true");
  cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1";
  document.body.insertBefore(cv, document.body.firstChild);
  var g = cv.getContext("2d"), dark = matchMedia("(prefers-color-scheme: dark)"), W = 0, H = 0, dpr = 1, flakes = [], raf = 0, last = 0, t = 0;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function flake(y) { var z = Math.random(); return { x: Math.random() * W, y: y == null ? Math.random() * H : y, z: z, r: CONFIG.size[0] + (CONFIG.size[1] - CONFIG.size[0]) * z * z, v: rnd(CONFIG.speed[0], CONFIG.speed[1]) * (0.5 + z * 0.7), a: CONFIG.alpha[0] + (CONFIG.alpha[1] - CONFIG.alpha[0]) * z, ph: Math.random() * 6.28 }; }
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var want = Math.round(W * H * CONFIG.density); while (flakes.length < want) flakes.push(flake()); flakes.length = want;
  }
  function vis() {                                                   // visível na subida e no cume; some ao entrar na cabana
    var it = window.Stage && window.Stage.inside ? window.Stage.inside() : 0;
    return 1 - Math.min(1, Math.max(0, (it - 0.18) / 0.08));
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt;
    var o = vis(); cv.style.opacity = o.toFixed(3); g.clearRect(0, 0, W, H); if (o <= 0.001) return;
    g.fillStyle = dark.matches ? "#ffffff" : "#8aa0bf";
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i]; f.y += f.v * dt; f.x += Math.sin(t * 0.7 + f.ph) * CONFIG.drift * f.z * dt;
      if (f.y > H + 4) { flakes[i] = flake(-4); continue; } if (f.x < -4) f.x += W + 8; else if (f.x > W + 4) f.x -= W + 8;
      g.globalAlpha = f.a; g.beginPath(); g.arc(f.x, f.y, f.r, 0, 6.2832); g.fill();
    }
    g.globalAlpha = 1;
  }
  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  addEventListener("resize", resize); document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });
  resize(); start();
})();
