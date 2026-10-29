/* Agente flutuante com o mascote do Felipe, inspirado no Labi do LaborHub.
   Nasce no instante da explosão do pinguim (evento "penguin:explode") e passa a flutuar.
   - Mascote vetorial animado (assets/mascot/): respira, pisca e acena.
   - Clique: voa atrás do cursor. Clique de novo: fica pairando onde está. Enter/Espaço também alternam.
   - "×" fecha até a próxima explosão.
   Ponto de entrada para o futuro chat: window.PenguinAgent.onActivate (hoje só alterna o voo). */
(function () {
  "use strict";

  var SIZE = { desktop: 230, mobile: 170 }, MARGIN = 24;   // altura do mascote em px
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var el, bubble, pupils = [], mascot = null, size = SIZE.desktop;
  var x = 0, y = 0, tx = 0, ty = 0, vx = 0, follow = false, raf = 0, last = 0, bubbleT = 0;
  var mx = window.innerWidth / 2, my = window.innerHeight / 2;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function build() {
    if (el) return;
    el = document.createElement("aside");
    el.className = "pagent"; el.hidden = true;
    el.setAttribute("aria-label", "Mascote do portfólio");
    el.innerHTML =
      '<div class="pagent-bubble" role="status">Oi! Eu sou o agente do Felipe. Ainda sou um protótipo.</div>' +
      '<div class="pagent-stage"><div class="pagent-mascot"></div></div>' +
      '<button class="pagent-hit" type="button" aria-pressed="false" ' +
      'title="Clique: o pinguim voa até o cursor. Clique de novo: ele fica pairando."></button>' +
      '<button class="pagent-close" type="button" aria-label="Fechar o agente">×</button>';
    document.body.appendChild(el);
    // mascote vetorial animado (assets/mascot/mascot.js): idle contínuo; o clique é tratado pelo botão .pagent-hit
    if (window.Mascot) mascot = window.Mascot.init(el.querySelector(".pagent-mascot"), { autoplay: "idle", clickToWave: false });
    bubble = el.querySelector(".pagent-bubble");
    el.querySelector(".pagent-hit").addEventListener("click", toggle);
    el.querySelector(".pagent-close").addEventListener("click", hide);
    window.addEventListener("pointermove", function (e) { mx = e.clientX; my = e.clientY; look(); if (el && !el.hidden) wake(); }, { passive: true });
    window.addEventListener("keydown", function (e) { if (e.key === "Escape" && follow) toggle(); });
    window.addEventListener("resize", function () { if (el && !el.hidden && !follow) { size = pick(); layoutSize(); var h = home(); tx = h.x; ty = h.y; wake(); } });
  }

  function pick() { return window.innerWidth <= 700 ? SIZE.mobile : SIZE.desktop; }
  function layoutSize() { el.style.setProperty("--s", size + "px"); }
  function home() { return { x: window.innerWidth - size - MARGIN, y: window.innerHeight - size - MARGIN }; }
  function place() { el.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)"; }

  // pupilas apontam para o cursor, no máximo 3 unidades do SVG
  function look() {
    if (!pupils.length) return;
    var dx = mx - (x + size / 2), dy = my - (y + size * 0.33), d = Math.sqrt(dx * dx + dy * dy) || 1;
    var k = Math.min(3, d / 40);
    pupils.forEach(function (p) { p.style.transform = "translate(" + (dx / d * k).toFixed(2) + "px," + (dy / d * k).toFixed(2) + "px)"; });
  }

  function loop(now) {
    var dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (follow) { tx = mx - size / 2; ty = my - size * 0.6; }
    tx = clamp(tx, 0, window.innerWidth - size); ty = clamp(ty, 0, window.innerHeight - size);
    var k = 1 - Math.exp(-dt * (follow ? 6 : 3.2)), nx = x + (tx - x) * k;
    vx = dt ? (nx - x) / dt : 0; x = nx; y += (ty - y) * k;
    el.style.setProperty("--tilt", clamp(vx * 0.02, -14, 14).toFixed(1) + "deg");
    place(); look();
    if (!follow && Math.abs(tx - x) < 0.5 && Math.abs(ty - y) < 0.5) { raf = 0; el.style.setProperty("--tilt", "0deg"); return; }
    raf = requestAnimationFrame(loop);
  }
  function wake() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }

  function toggle() {
    follow = !follow;
    el.classList.toggle("flying", follow);
    el.querySelector(".pagent-hit").setAttribute("aria-pressed", String(follow));
    if (!follow) { tx = x; ty = y; }                                      // solta: fica pairando onde está
    wake();
    if (mascot && !reduced) mascot.play("wave");
    if (window.PenguinAgent && typeof window.PenguinAgent.onActivate === "function") window.PenguinAgent.onActivate(follow);
  }

  function hide() { follow = false; el.hidden = true; el.classList.remove("flying"); cancelAnimationFrame(raf); raf = 0; }

  function say() {
    bubble.classList.add("on"); clearTimeout(bubbleT);
    bubbleT = setTimeout(function () { bubble.classList.remove("on"); }, 6000);
  }

  // Nasce no centro do pinguim que explodiu e desliza até o canto inferior direito.
  function spawn(d) {
    build();
    size = pick(); layoutSize();
    follow = false; el.classList.remove("flying", "pop"); el.hidden = false;
    var h = home();
    x = clamp(d.x - size / 2, 0, window.innerWidth - size); y = clamp(d.y - size / 2, 0, window.innerHeight - size);
    tx = h.x; ty = h.y;
    if (reduced) { x = tx; y = ty; }
    place(); look();
    void el.offsetWidth; el.classList.add("pop");                         // reinicia a animação de entrada
    say(); wake();
    if (mascot && !reduced) setTimeout(function () { mascot.play("wave"); }, 500);   // cumprimenta ao nascer
  }

  window.PenguinAgent = { spawn: spawn, hide: function () { if (el) hide(); }, onActivate: null };
  window.addEventListener("penguin:explode", function (e) { spawn(e.detail || { x: window.innerWidth / 2, y: window.innerHeight / 2 }); });
})();
