/* Fundo animado: partículas que, conforme o scroll, formam um pinguim.
   JS puro, sem bibliotecas. Canvas fixo em #bg, atrás de todo o conteúdo.

   API pública (para o futuro chat de agente):
     window.onPenguinClick = function () {}        // chamado ao clicar no pinguim formado
     window.addEventListener("penguin:click", fn)  // mesmo evento, via DOM
     Penguin.setSpeaking(true|false)               // estado "falando": corpo treme/brilha
     Penguin.isReady()                             // true quando o pinguim está formado */
(function () {
  "use strict";

  /* ============================ PARÂMETROS ============================ */
  var CFG = {
    count: { desktop: 2800, mobile: 1300 },
    mobileMax: 900,            // largura (px) até a qual vale o layout de celular
    dprMax: 2,
    sizeLoose: [1.2, 2.6],       // tamanho (px) solto: longe -> perto
    sizeFormed: [1.8, 2.6],
    alphaLoose: [0.18, 0.5],    // opacidade solta: longe -> perto
    drift: 22,                 // amplitude da deriva (px)
    driftSpeed: 0.35,          // velocidade da deriva
    scrollSmooth: 3.5,         // maior = acompanha o scroll mais rápido
    mouseRadius: 90, mouseForce: 2.2, spring: 0.06, damping: 0.86,
    // linha de referência no viewport usada para medir o progresso por seção
    refLine: 0.75,
    // [seção, progresso ao chegar nela]. Hero = topo da página.
    stops: [[null, 0], ["agora", 0], ["projetos", 0.3], ["notas", 0.6], ["sobre", 1]],
    // frações de partículas por região (o resto é corpo)
    share: { wing: 0.1, belly: 0.3, feet: 0.03, beak: 0.025, eye: 0.03 },
    alphaFormed: { body: 0.75, wing: 0.6, belly: 0.7, feet: 0.75, beak: 0.95, eye: 0.9 },
    colors: {
      light: { body: "#1D1D1F", belly: "#AEAEB2", feet: "#1D1D1F", eyeSleep: "#C7C7CC", cyan: "#22B8E6" },
      dark:  { body: "#8E8E93", belly: "#F5F5F7", feet: "#8E8E93", eyeSleep: "#F5F5F7", cyan: "#64D2FF" }
    }
  };

  var canvas = document.getElementById("bg");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var dark = window.matchMedia("(prefers-color-scheme: dark)");

  /* ===================== FORMA DO PINGUIM (offscreen) ===================== */
  // Ids das regiões: 1 corpo, 2 asa, 3 barriga, 4 pés, 5 bico, 6 olho
  var R = { body: 1, wing: 2, belly: 3, feet: 4, beak: 5, eye: 6 };
  var REG_NAME = { 1: "body", 2: "wing", 3: "belly", 4: "feet", 5: "beak", 6: "eye" };
  var SW = 240, SH = 320;          // espaço da forma; centro em (120, 160)
  var shape = null;                // { region: [[x,y],...] } em coordenadas da forma

  function buildShape() {
    var c = document.createElement("canvas"); c.width = SW; c.height = SH;
    var g = c.getContext("2d");
    function ell(id, x, y, rx, ry, rot) {
      g.fillStyle = "rgb(" + id * 40 + ",0,0)";
      g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); g.fill();
    }
    ell(R.body, 120, 92, 56, 56);                 // cabeça
    ell(R.body, 120, 190, 80, 104);               // corpo (gota: cabeça fundida)
    ell(R.wing, 48, 188, 17, 62, 0.16);           // asas coladas ao corpo
    ell(R.wing, 192, 188, 17, 62, -0.16);
    ell(R.belly, 120, 200, 48, 78);               // barriga
    ell(R.feet, 92, 298, 23, 10); ell(R.feet, 148, 298, 23, 10);
    ell(R.beak, 120, 106, 15, 9);                 // bico
    ell(R.eye, 98, 80, 7, 7); ell(R.eye, 142, 80, 7, 7);

    var d = g.getImageData(0, 0, SW, SH).data, out = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (var y = 0; y < SH; y += 2) for (var x = 0; x < SW; x += 2) {
      var i = (y * SW + x) * 4;
      if (d[i + 3] < 250) continue;               // fora da forma ou borda suavizada
      var id = Math.round(d[i] / 40);
      if (id < 1 || id > 6 || Math.abs(d[i] - id * 40) > 3) continue; // pixel de mistura
      out[id].push([x, y]);
    }
    return out;
  }

  /* ============================== PARTÍCULAS ============================== */
  var W, H, dpr, mobile, Hs, sc, cx, cy;
  var parts = [], eyes = [[0, 0], [0, 0]];
  var Ps = 0, Pt = 0, ghost = 1;                  // progresso suavizado / alvo / fantasma do hero
  var time = 0, awake = 0, awakeOn = false, wakeT = 0, speak = 0, speaking = false;
  var mx = -9999, my = -9999, raf = 0, last = 0, hoverPeng = false;
  var col = CFG.colors.light;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function gauss() { return Math.random() + Math.random() + Math.random() - 1.5; }

  function build() {
    var n = mobile ? CFG.count.mobile : CFG.count.desktop, sh = CFG.share, list = [];
    var blobs = [];                               // centros das "manchas" (fração do tamanho do pinguim)
    for (var b = 0; b < 7; b++) blobs.push([rnd(-0.9, 0.9), rnd(-0.7, 0.7)]);
    var plan = [[R.eye, sh.eye], [R.beak, sh.beak], [R.feet, sh.feet], [R.wing, sh.wing], [R.belly, sh.belly]];
    var used = 0;
    plan.forEach(function (p) { p.n = Math.round(n * p[1]); used += p.n; });
    plan.push([R.body, 0]); plan[plan.length - 1].n = n - used;
    plan.forEach(function (p) {
      for (var k = 0; k < p.n; k++) {
        var px = shape[p[0]][(Math.random() * shape[p[0]].length) | 0];
        var bl = blobs[(Math.random() * blobs.length) | 0], z = Math.random();
        list.push({
          reg: p[0], z: z, af: CFG.alphaFormed[REG_NAME[p[0]]], o: Math.random(),
          fx: Math.random(), fy: Math.random(),                         // posição solta (fração da tela)
          ph: [rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)],
          sp: [rnd(0.6, 1.4), rnd(0.6, 1.4), rnd(0.3, 0.8), rnd(0.3, 0.8)],
          sx: px[0] - 120 + rnd(-1, 1), sy: px[1] - 160 + rnd(-1, 1),   // alvo na forma
          bx: bl[0] + gauss() * 0.28, by: bl[1] + gauss() * 0.28,       // mancha (fração de Hs)
          tx: 0, ty: 0, ox: 0, oy: 0, vx: 0, vy: 0
        });
      }
    });
    parts = list;                                 // já ordenado por região (poucas trocas de cor)
  }

  function layout() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, CFG.dprMax);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var wasMobile = mobile; mobile = W <= CFG.mobileMax;
    if (!parts.length || wasMobile !== mobile) build();
    Hs = mobile ? Math.min(H * 0.4, 300) : Math.min(H * 0.5, 420);
    sc = Hs / SH;
    cx = mobile ? W / 2 : W - 32 - Hs * 0.3;        // desktop: à direita do texto
    cy = mobile ? H * 0.5 : H * 0.55;
    parts.forEach(function (p) { p.tx = cx + p.sx * sc; p.ty = cy + p.sy * sc; });
    eyes[0] = [cx + (98 - 120) * sc, cy + (80 - 160) * sc];
    eyes[1] = [cx + (142 - 120) * sc, cy + (80 - 160) * sc];
  }

  /* ============================ PROGRESSO ============================ */
  // Progresso por seção: interpola entre as paradas conforme a linha de referência
  // (scrollY + 75% da altura) passa pelo topo de cada seção.
  function targetProgress() {
    var y = window.scrollY || 0;
    if (y + H >= document.documentElement.scrollHeight - 4) return 1;
    var pos = y + H * CFG.refLine, prev = null, i, s = CFG.stops;
    for (i = 0; i < s.length; i++) {
      var el = s[i][0] && document.getElementById(s[i][0]);
      if (s[i][0] && !el) continue;
      var top = el ? el.getBoundingClientRect().top + y : 0;
      if (pos < top) return prev ? prev[1] + (s[i][1] - prev[1]) * (pos - prev[0]) / Math.max(1, top - prev[0]) : 0;
      prev = [top, s[i][1]];
    }
    return 1;
  }

  /* ============================== DESENHO ============================== */
  function colorFor(reg) {
    return reg === R.body || reg === R.wing ? col.body : reg === R.belly ? col.belly
      : reg === R.feet ? col.feet : reg === R.beak ? col.cyan : col.eyeSleep;
  }

  function render(dt) {
    var wake = awakeOn ? 1 + 1.4 * Math.exp(-(time - wakeT) / 0.7) : 1;
    var spring = CFG.spring, damp = Math.pow(CFG.damping, dt * 60), f60 = dt * 60;
    var R2 = CFG.mouseRadius * CFG.mouseRadius, t = time * CFG.driftSpeed;
    ctx.clearRect(0, 0, W, H);
    var cur = "";

    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], z = p.z;
      // deriva solta, orgânica; as mais próximas (z alto) se movem mais
      var amp = CFG.drift * (0.4 + z);
      var lx = p.fx * W + Math.sin(t * p.sp[0] + p.ph[0]) * amp + Math.sin(t * p.sp[2] + p.ph[2]) * amp * 0.5;
      var ly = p.fy * H + Math.cos(t * p.sp[1] + p.ph[1]) * amp + Math.cos(t * p.sp[3] + p.ph[3]) * amp * 0.5;
      // solto -> mancha -> pinguim, com escalonamento por partícula (p.o)
      var sBlob = smooth((Ps - p.o * 0.15) / 0.4);
      var sShape = smooth((Ps - 0.35 - p.o * 0.3) / 0.35);
      if (p.o < 0.2) sShape = Math.max(sShape, ghost * 0.85);            // silhueta fraca no hero
      var x = lx + (cx + p.bx * Hs - lx) * sBlob, y = ly + (cy + p.by * Hs - ly) * sBlob;
      x += (p.tx - x) * sShape; y += (p.ty - y) * sShape;

      var body = p.reg !== R.eye && p.reg !== R.beak && p.reg !== R.feet;
      if (speak > 0.01 && body) {                                         // "falando": treme de leve
        x += Math.sin(time * 38 + p.ph[0]) * 1.3 * speak * sShape;
        y += Math.cos(time * 33 + p.ph[1]) * 1.3 * speak * sShape;
      }

      // mouse: repele e volta como mola, mesmo com o pinguim formado
      var dx = x + p.ox - mx, dy = y + p.oy - my, d2 = dx * dx + dy * dy;
      if (d2 < R2 && d2 > 0.01) {
        var d = Math.sqrt(d2), f = (1 - d / CFG.mouseRadius) * CFG.mouseForce * f60;
        p.vx += dx / d * f; p.vy += dy / d * f;
      }
      p.vx = (p.vx - p.ox * spring * f60) * damp; p.vy = (p.vy - p.oy * spring * f60) * damp;
      p.ox += p.vx * f60; p.oy += p.vy * f60;
      x += p.ox; y += p.oy;

      var aL = CFG.alphaLoose[0] + (CFG.alphaLoose[1] - CFG.alphaLoose[0]) * z;
      var aF = p.af;
      var a = aL + (aF - aL) * sShape;
      if (speak > 0.01 && body) a *= 1 + 0.35 * Math.sin(time * 8 + p.ph[2]) * speak;
      var sL = CFG.sizeLoose[0] + (CFG.sizeLoose[1] - CFG.sizeLoose[0]) * z;
      var sF = CFG.sizeFormed[0] + (CFG.sizeFormed[1] - CFG.sizeFormed[0]) * z;
      var r = (sL + (sF - sL) * sShape) * 0.5;

      if (p.reg === R.eye && awake > 0.01) {                              // olho acordado: ciano com brilho
        dot(col.eyeSleep, x, y, r, a * (1 - awake));
        dot(col.cyan, x, y, r * (1 + 0.25 * (wake - 1)), Math.min(1, a * awake * wake));
      } else {
        var c = colorFor(p.reg);
        if (c !== cur) { ctx.fillStyle = c; cur = c; }
        ctx.globalAlpha = clamp(a, 0, 1);
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
      }
      if (p.reg === R.eye) cur = "";                                      // dot() mexeu no fillStyle
    }

    if (awake > 0.01) {                                                   // halo suave nos olhos
      eyes.forEach(function (e) {
        var rad = Hs * 0.09 * wake, gr = ctx.createRadialGradient(e[0], e[1], 0, e[0], e[1], rad);
        gr.addColorStop(0, col.cyan); gr.addColorStop(1, rgba(col.cyan, 0));
        ctx.globalAlpha = 0.28 * awake * Math.min(wake, 2) * sShapeFull(); ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(e[0], e[1], rad, 0, 6.2832); ctx.fill();
      });
    }
    ctx.globalAlpha = 1;
  }

  function dot(c, x, y, r, a) {
    if (a <= 0.003) return;
    ctx.fillStyle = c; ctx.globalAlpha = clamp(a, 0, 1);
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }
  function sShapeFull() { return smooth((Ps - 0.85) / 0.15); }

  /* ============================== LOOP ============================== */
  function step(dt) {
    time += dt;
    Pt = targetProgress();
    Ps += (Pt - Ps) * (1 - Math.exp(-CFG.scrollSmooth * dt));
    ghost = 1 - smooth((window.scrollY || 0) / (H * 0.4));
    if (Ps > 0.97 && !awakeOn) { awakeOn = true; wakeT = time; }
    else if (Ps < 0.9) awakeOn = false;
    awake += ((awakeOn ? 1 : 0) - awake) * (1 - Math.exp(-2.5 * dt));
    speak += ((speaking ? 1 : 0) - speak) * (1 - Math.exp(-6 * dt));
    render(dt);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min((now - last) / 1000, 0.05); last = now;
    step(dt);
  }
  function start() { if (!raf && !reduced) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  function drawStatic() {                         // reduced-motion: pinguim formado e parado
    Ps = Pt = 1; awake = 1; awakeOn = true; wakeT = -99; ghost = 0; time = 0;
    render(0);
  }

  function setTheme() { col = dark.matches ? CFG.colors.dark : CFG.colors.light; if (reduced) drawStatic(); }

  /* ============================ INTERAÇÃO ============================ */
  function overPenguin(x, y) {
    var a = (x - cx) / (Hs * 0.27), b = (y - cy) / (Hs * 0.5);
    return Ps > 0.9 && a * a + b * b <= 1;
  }

  window.Penguin = {
    setSpeaking: function (v) { speaking = !!v; },
    isReady: function () { return Ps > 0.9; }
  };

  /* ================================ INIT ================================ */
  shape = buildShape();
  setTheme();
  if (dark.addEventListener) dark.addEventListener("change", setTheme);
  layout();

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { layout(); if (reduced) drawStatic(); }, 150);
  });

  if (reduced) { drawStatic(); return; }

  window.addEventListener("pointermove", function (e) {
    mx = e.clientX; my = e.clientY;
    var h = overPenguin(mx, my);
    if (h !== hoverPeng) { hoverPeng = h; document.body.style.cursor = h ? "pointer" : ""; }
  }, { passive: true });
  document.addEventListener("pointerleave", function () { mx = my = -9999; });
  window.addEventListener("click", function (e) {
    if (!overPenguin(e.clientX, e.clientY) || (e.target.closest && e.target.closest("a,button"))) return;
    if (typeof window.onPenguinClick === "function") window.onPenguinClick(e);
    window.dispatchEvent(new CustomEvent("penguin:click"));
  });
  document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });
  Ps = targetProgress();                          // começa já no ponto certo (ex.: recarregar no meio da página)
  start();
})();
