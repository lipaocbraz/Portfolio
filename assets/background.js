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
    count: { desktop: 8000, mobile: 3600 },        // partículas do pinguim
    chargeTime: 7,                                 // s entre o pinguim formado e a explosão
    // curva da explosão (prototipada no EffectCraft): d(t) = D·(1 − e^(−k·t)), com curvatura e rastro curto
    debrisLife: 4.5, debrisK: 1.25,                // vida (s) e constante de freada (1/s)
    debrisReach: [0.85, 1.3],                      // alcance D, em múltiplos da meia-diagonal da tela
    debrisSwirl: [0.54, 1.26],                     // curvatura total (rad)
    debrisFront: 0.22,                             // atraso da frente de onda (por raio do pinguim)
    dustDensity: 3.4, dustMax: 24000,              // poeira: partículas por 1000 px² de tela (tamanho fixo)
    dustSize: [0.4, 1.1], dustAlpha: [0.12, 0.45], dustDrift: 40,
    mobileMax: 900,            // largura (px) até a qual vale o layout de celular
    dprMax: 2,
    sizeLoose: [0.4, 1.1],       // tamanho (px) solto: longe -> perto
    sizeFormed: [0.9, 1.7],
    alphaLoose: [0.12, 0.45],    // opacidade solta: longe -> perto
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
    alphaFormed: { body: 0.8, wing: 0.65, belly: 0.8, feet: 0.8, beak: 0.9, eye: 0.85 },
    colors: {
      light: { dust: "#1D1D1F", body: "#1D1D1F", belly: "#AEAEB2", feet: "#1D1D1F", eyeSleep: "#C7C7CC", cyan: "#22B8E6" },
      dark:  { dust: "#F5F5F7", body: "#8E8E93", belly: "#F5F5F7", feet: "#8E8E93", eyeSleep: "#F5F5F7", cyan: "#64D2FF" }
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
  var SW = 240, SH = 320;          // espaço da forma (SW varia com a forma); centro em (SW/2, SH/2)
  var shape = null;                // { w, eyes, 1..6: [[x,y,r,g,b],...] } em coordenadas da forma
  var SCRIPT_SRC = document.currentScript && document.currentScript.src;
  var MASCOT_SVG = SCRIPT_SRC ? new URL("mascot/mascot-art.svg", SCRIPT_SRC).href : "assets/mascot/mascot-art.svg";

  function buildShapeFallback() {
    var c = document.createElement("canvas"); c.width = SW; c.height = SH;
    var g = c.getContext("2d", { willReadFrequently: true });
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

    var sh = sampleShape(g); sh.w = SW; sh.eyes = [[92, 90], [148, 90]]; sh.mascot = false;
    return sh;
  }

  // Forma do mascote (assets/mascot/mascot-art.svg): cada pixel carrega a cor real do personagem.
  // Regiões por cor/posição: olho = íris azul na cabeça; bico = laranja no alto; pés = laranja embaixo;
  // o resto (cabelo, rosto, jaqueta, calça, cordão) é "corpo".
  function sampleMascot(img) {
    var RS = 2, MW = 1324, MH = 2493;
    SW = Math.round(SH * MW / MH);                                   // proporção do mascote (≈170)
    var w = SW * RS, h = SH * RS;
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    var g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    var d = g.getImageData(0, 0, w, h).data, out = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    var ex = [0, 0, 0, 0, 0, 0];                                     // soma x,y,n de cada olho (esq., dir.)
    for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) {
      var i = (y * w + x) * 4;
      if (d[i + 3] < 250) continue;                                  // fora do mascote, borda ou sombra
      var r = d[i], gg = d[i + 1], b = d[i + 2], fy = y / h, reg = R.body;
      if (r > 180 && gg > 70 && gg < 170 && b < 100 && r - b > 110) reg = fy < 0.285 ? R.beak : fy > 0.8 ? R.feet : R.body;
      else if (fy < 0.23 && b > r + 35 && b > gg) {
        reg = R.eye; var k = x < w / 2 ? 0 : 3; ex[k] += x / RS; ex[k + 1] += y / RS; ex[k + 2]++;
      }
      out[reg].push([x / RS, y / RS, r, gg, b]);
    }
    out.w = SW; out.mascot = true;
    out.eyes = [[ex[0] / Math.max(1, ex[2]), ex[1] / Math.max(1, ex[2])], [ex[3] / Math.max(1, ex[5]), ex[4] / Math.max(1, ex[5])]];
    return out;
  }

  // Lê as regiões (pela cor) de um canvas e devolve os pixels de cada uma, em coordenadas da forma.
  function sampleShape(g) {
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

  // Forma principal: SVG desenhado no VectorCraft (viewBox 240x320, uma cor por região).
  var SHAPE_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"240\" height=\"320\" viewBox=\"0 0 240 320\"><path d=\"M225 190 C225 255.17 177.99 308 120 308 C62.01 308 15 255.17 15 190 C15 124.83 62.01 72 120 72 C177.99 72 225 124.83 225 190 Z\" fill=\"#280000\"/><path d=\"M217 92 C217 140.049 173.572 179 120 179 C66.428 179 23 140.049 23 92 C23 43.951 66.428 5 120 5 C173.572 5 217 43.951 217 92 Z\" fill=\"#280000\"/><path d=\"M30 150 C2 196 8 244 40 272 C56 244 60 196 54 156 Z\" fill=\"#500000\"/><path d=\"M210 150 C238 196 232 244 200 272 C184 244 180 196 186 156 Z\" fill=\"#500000\"/><path d=\"M186 208 C186 255.496 156.451 294 120 294 C83.549 294 54 255.496 54 208 C54 160.504 83.549 122 120 122 C156.451 122 186 160.504 186 208 Z\" fill=\"#780000\"/><path d=\"M114 306 C114 310.418 104.15 314 92 314 C79.85 314 70 310.418 70 306 C70 301.582 79.85 298 92 298 C104.15 298 114 301.582 114 306 Z\" fill=\"#a00000\"/><path d=\"M170 306 C170 310.418 160.15 314 148 314 C135.85 314 126 310.418 126 306 C126 301.582 135.85 298 148 298 C160.15 298 170 301.582 170 306 Z\" fill=\"#a00000\"/><path d=\"M107 111 C115.667 105 124.333 105 133 111 C133 123 128.667 130.667 120 134 C111.333 130.667 107 123 107 111 Z\" fill=\"#c80000\"/><path d=\"M99.5 90 C99.5 94.142 96.142 97.5 92 97.5 C87.858 97.5 84.5 94.142 84.5 90 C84.5 85.858 87.858 82.5 92 82.5 C96.142 82.5 99.5 85.858 99.5 90 Z\" fill=\"#f00000\"/><path d=\"M155.5 90 C155.5 94.142 152.142 97.5 148 97.5 C143.858 97.5 140.5 94.142 140.5 90 C140.5 85.858 143.858 82.5 148 82.5 C152.142 82.5 155.5 85.858 155.5 90 Z\" fill=\"#f00000\"/></svg>";
  function buildShape(done) {
    // 1) mascote (precisa de http/https: em file:// o canvas bloqueia a leitura); 2) pinguim geométrico antigo
    var m = new Image();
    m.onload = function () {
      try { var sh = sampleMascot(m); if (sh[1].length > 500) { done(sh); return; } } catch (e) {}
      SW = 240; buildGeometric(done);
    };
    m.onerror = function () { buildGeometric(done); };
    m.src = MASCOT_SVG;
  }
  function buildGeometric(done) {
    var img = new Image();
    img.onload = function () {
      var c = document.createElement("canvas"); c.width = SW; c.height = SH;
      var g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0, SW, SH);
      var sh = sampleShape(g); sh.w = SW; sh.eyes = [[92, 90], [148, 90]]; sh.mascot = false;
      done(sh);
    };
    img.onerror = function () { done(buildShapeFallback()); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(SHAPE_SVG);
  }

  /* ============================== PARTÍCULAS ============================== */
  var W, H, dpr, mobile, Hs, sc, cx, cy;
  var parts = [], dust = [], eyes = [[0, 0], [0, 0]];
  var debrisEnd = 0, wakeWall = 0, charge = 0, exploded = false, pv = 1, debris = [];   // carga azul / explosão
  var Ps = 0, Pt = 0;                             // progresso suavizado / alvo
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
    var plan = shape.mascot
      ? [[R.eye, sh.eye], [R.beak, sh.beak], [R.feet, sh.feet * 1.4]]                 // mascote: o resto é corpo
      : [[R.eye, sh.eye], [R.beak, sh.beak], [R.feet, sh.feet], [R.wing, sh.wing], [R.belly, sh.belly]];
    var used = 0;
    plan.forEach(function (p) { p.n = Math.round(n * p[1]); used += p.n; });
    plan.push([R.body, 0]); plan[plan.length - 1].n = n - used;
    plan.forEach(function (p) {
      for (var k = 0; k < p.n; k++) {
        var px = shape[p[0]][(Math.random() * shape[p[0]].length) | 0];
        var rgb = px.length > 2 ? [px[2] + rnd(-9, 9), px[3] + rnd(-9, 9), px[4] + rnd(-9, 9)] : null;
        var bl = blobs[(Math.random() * blobs.length) | 0], z = Math.random();
        list.push({
          reg: p[0], z: z, rgb: rgb, c: null, af: CFG.alphaFormed[REG_NAME[p[0]]], o: Math.random(),
          fx: Math.random(), fy: Math.random(),                         // posição solta (fração da tela)
          ph: [rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)],
          sp: [rnd(0.6, 1.4), rnd(0.6, 1.4), rnd(0.3, 0.8), rnd(0.3, 0.8)],
          sx: px[0] - shape.w / 2 + rnd(-1, 1), sy: px[1] - SH / 2 + rnd(-1, 1),   // alvo na forma
          bx: bl[0] + gauss() * 0.28, by: bl[1] + gauss() * 0.28,       // mancha (fração de Hs)
          tx: 0, ty: 0, ox: 0, oy: 0, vx: 0, vy: 0
        });
      }
    });
    parts = list;
    recolor();
  }

  // Cor de cada partícula do mascote, ajustada ao tema: no claro, os brancos escurecem um pouco
  // (senão somem no fundo); no escuro, os tons muito escuros clareiam (senão somem no preto).
  function tone(c) {
    var r = c[0], g = c[1], b = c[2], lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, t, m;
    if (dark.matches) {                                  // sobe o brilho mantendo o matiz (azul continua azul)
      var k = Math.max(1, 0.5 / Math.max(lum, 0.04));
      return "rgb(" + Math.round(clamp(r * k, 0, 255)) + "," + Math.round(clamp(g * k, 0, 255)) + "," + Math.round(clamp(b * k, 0, 255)) + ")";
    }
    t = clamp((lum - 0.5) * 2, 0, 0.7); m = [132, 144, 170];
    return "rgb(" + Math.round(clamp(r + (m[0] - r) * t, 0, 255)) + "," + Math.round(clamp(g + (m[1] - g) * t, 0, 255)) + "," + Math.round(clamp(b + (m[2] - b) * t, 0, 255)) + ")";
  }
  function recolor() { for (var i = 0; i < parts.length; i++) if (parts[i].rgb) parts[i].c = tone(parts[i].rgb); }

  // Poeira proporcional à área da tela: tamanho fixo, só a quantidade muda.
  // Ao redimensionar, adiciona ou remove partículas sem reposicionar as existentes.
  function syncDust() {
    var want = Math.min(CFG.dustMax, Math.round(W * H / 1000 * CFG.dustDensity));
    if (dust.length > want) dust.length = want;
    while (dust.length < want) {
      dust.push({
        z: Math.random(), fx: Math.random(), fy: Math.random(),
        ph: [rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)],
        sp: [rnd(0.5, 1.3), rnd(0.5, 1.3), rnd(0.2, 0.7), rnd(0.2, 0.7)],
        ox: 0, oy: 0, vx: 0, vy: 0
      });
    }
  }

  function layout() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, CFG.dprMax);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var wasMobile = mobile; mobile = W <= CFG.mobileMax;
    if (!parts.length || wasMobile !== mobile) build();
    syncDust();
    Hs = mobile ? Math.min(H * 0.55, W * 1.15, 480) : Math.min(H * 0.8, 680);
    sc = Hs / SH;
    cx = W / 2;                                                          // centralizado na tela
    cy = H * 0.5;
    parts.forEach(function (p) { p.tx = cx + p.sx * sc; p.ty = cy + p.sy * sc; });
    eyes[0] = [cx + (shape.eyes[0][0] - shape.w / 2) * sc, cy + (shape.eyes[0][1] - SH / 2) * sc];
    eyes[1] = [cx + (shape.eyes[1][0] - shape.w / 2) * sc, cy + (shape.eyes[1][1] - SH / 2) * sc];
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

    // poeira: camada fina e permanente, deriva por toda a tela
    ctx.fillStyle = col.dust;
    for (var j = 0; j < dust.length; j++) {
      var q = dust[j], zq = q.z, am = CFG.dustDrift * (0.4 + zq);
      var qx = q.fx * W + Math.sin(t * q.sp[0] + q.ph[0]) * am + Math.sin(t * q.sp[2] + q.ph[2]) * am * 0.5;
      var qy = q.fy * H + Math.cos(t * q.sp[1] + q.ph[1]) * am + Math.cos(t * q.sp[3] + q.ph[3]) * am * 0.5;
      var ex = qx + q.ox - mx, ey = qy + q.oy - my, e2 = ex * ex + ey * ey;
      if (e2 < R2 && e2 > 0.01) {
        var ed = Math.sqrt(e2), ef = (1 - ed / CFG.mouseRadius) * CFG.mouseForce * f60;
        q.vx += ex / ed * ef; q.vy += ey / ed * ef;
      }
      q.vx = (q.vx - q.ox * spring * f60) * damp; q.vy = (q.vy - q.oy * spring * f60) * damp;
      q.ox += q.vx * f60; q.oy += q.vy * f60;
      ctx.globalAlpha = CFG.dustAlpha[0] + (CFG.dustAlpha[1] - CFG.dustAlpha[0]) * zq;
      var qs = CFG.dustSize[0] + (CFG.dustSize[1] - CFG.dustSize[0]) * zq;
      ctx.beginPath(); ctx.arc(qx + q.ox, qy + q.oy, qs * 0.5 + 0.2, 0, 6.2832); ctx.fill();
    }

    var ch = smooth(charge), shk = Math.max(speak, ch * ch);

    // detritos da explosão: ciano brilhante, em curvas suaves com rastro, que esfria até virar poeira comum
    for (var k = debris.length - 1; k >= 0; k--) {
      var b = debris[k], age = time - b.t0;
      var ad = CFG.dustAlpha[0] + (CFG.dustAlpha[1] - CFG.dustAlpha[0]) * b.z;
      var sd = (CFG.dustSize[0] + (CFG.dustSize[1] - CFG.dustSize[0]) * b.z) * 0.5 + 0.2;
      if (age < 0) { dot(col.cyan, b.x, b.y, sd * 1.6, 0.9); cur = ""; continue; }   // espera a frente de onda
      var kk = clamp(age / CFG.debrisLife, 0, 1), pr = 1 - Math.exp(-CFG.debrisK * age), an = b.a0 + b.S * pr;
      var nx = b.x0 + b.D * pr * Math.cos(an), ny = b.y0 + b.D * pr * Math.sin(an);
      b.x = nx; b.y = ny;
      var fa = age < 1 ? 1 - 0.1 * age : age < 2.5 ? 0.9 - (age - 1) * 0.3 : Math.max(0, 0.45 - (age - 2.5) * 0.3);
      if (fa > 0.01) {                                                    // azul brilhando (cintila), mesmo tamanho da poeira
        var tw = 0.7 + 0.3 * Math.sin(time * 7 + b.z * 40);
        dot(col.cyan, b.x, b.y, sd * 2.4, 0.1 * fa * tw);                 // halo discreto
        dot(col.cyan, b.x, b.y, sd, Math.min(1, fa * tw));
      }
      dot(col.dust, b.x, b.y, sd, ad * kk);
      cur = "";
    }
    if (debris.length && time > debrisEnd) mergeDebris(t);
    for (var i = 0; i < parts.length; i++) {
      if (pv < 0.003) break;                                              // pinguim explodiu: nada a desenhar
      var p = parts[i], z = p.z;
      // deriva solta, orgânica; as mais próximas (z alto) se movem mais
      var amp = CFG.drift * (0.4 + z);
      var lx = p.fx * W + Math.sin(t * p.sp[0] + p.ph[0]) * amp + Math.sin(t * p.sp[2] + p.ph[2]) * amp * 0.5;
      var ly = p.fy * H + Math.cos(t * p.sp[1] + p.ph[1]) * amp + Math.cos(t * p.sp[3] + p.ph[3]) * amp * 0.5;
      // solto -> mancha -> pinguim, com escalonamento por partícula (p.o)
      var sBlob = smooth((Ps - p.o * 0.15) / 0.4);
      var sShape = smooth((Ps - 0.35 - p.o * 0.3) / 0.35);
      var x = lx + (cx + p.bx * Hs - lx) * sBlob, y = ly + (cy + p.by * Hs - ly) * sBlob;
      x += (p.tx - x) * sShape; y += (p.ty - y) * sShape;

      var body = p.reg !== R.eye && p.reg !== R.beak && p.reg !== R.feet;
      if (shk > 0.01 && body) {                                           // "falando"/carregando: treme
        x += Math.sin(time * 38 + p.ph[0]) * (1.3 + ch * 1.6) * shk * sShape;
        y += Math.cos(time * 33 + p.ph[1]) * (1.3 + ch * 1.6) * shk * sShape;
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
      if (shk > 0.01 && body) a *= 1 + 0.35 * Math.sin(time * 8 + p.ph[2]) * shk;
      a *= pv; p.px = x; p.py = y;
      var sL = CFG.sizeLoose[0] + (CFG.sizeLoose[1] - CFG.sizeLoose[0]) * z;
      var sF = CFG.sizeFormed[0] + (CFG.sizeFormed[1] - CFG.sizeFormed[0]) * z;
      var r = (sL + (sF - sL) * sShape) * 0.5;

      if (p.reg === R.eye && awake > 0.01) {                              // olho acordado: ciano com brilho
        dot(p.c || col.eyeSleep, x, y, r, a * (1 - awake));
        dot(col.cyan, x, y, r * (1 + 0.25 * (wake - 1)), Math.min(1, a * awake * wake));
      } else {
        var c = p.c || colorFor(p.reg);
        if (c !== cur) { ctx.fillStyle = c; cur = c; }
        ctx.globalAlpha = clamp(a, 0, 1);
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
        if (ch > 0.01 && p.reg !== R.beak) {                              // pinguim vai ficando azul brilhante
          dot(col.cyan, x, y, r * (1 + 0.6 * ch), Math.min(1, a * ch * 1.3 + ch * 0.15 * pv));
          cur = "";
        }
      }
      if (p.reg === R.eye) cur = "";                                      // dot() mexeu no fillStyle
    }

    if (awake > 0.01) {                                                   // halo suave nos olhos
      eyes.forEach(function (e) {
        var rad = Hs * 0.06 * wake, gr = ctx.createRadialGradient(e[0], e[1], 0, e[0], e[1], rad);
        gr.addColorStop(0, col.cyan); gr.addColorStop(1, rgba(col.cyan, 0));
        ctx.globalAlpha = 0.16 * awake * Math.min(wake, 2) * sShapeFull(); ctx.fillStyle = gr;
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

  /* ============================ EXPLOSÃO ============================ */
  function explode() {
    exploded = true; awakeOn = false; charge = 0; pv = 0; speak = 0;
    var rmax = Math.hypot(W, H) * 0.5, maxDelay = 0;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], dx = p.px - cx, dy = p.py - cy, dist = Math.sqrt(dx * dx + dy * dy);
      var dl = dist / Hs * CFG.debrisFront + rnd(0, 0.08);
      maxDelay = Math.max(maxDelay, dl);
      debris.push({ x0: p.px, y0: p.py, x: p.px, y: p.py, a0: Math.atan2(dy, dx) + rnd(-0.4, 0.4),
                    D: rmax * rnd(CFG.debrisReach[0], CFG.debrisReach[1]),
                    S: rnd(CFG.debrisSwirl[0], CFG.debrisSwirl[1]), z: Math.random(), t0: time + dl });
      p.ox = p.oy = p.vx = p.vy = 0;
    }
    debrisEnd = time + maxDelay + CFG.debrisLife;
    var detail = { x: cx, y: cy, size: Hs };
    if (typeof window.onPenguinExplode === "function") window.onPenguinExplode(detail);
    window.dispatchEvent(new CustomEvent("penguin:explode", { detail: detail }));
  }

  // Detritos viram poeira comum: substituem partículas aleatórias do cenário (densidade constante),
  // com fases escolhidas para o deslocamento ser zero no instante da fusão (sem salto visual).
  function mergeDebris(t) {
    var n = Math.min(debris.length, Math.floor(dust.length * 0.8));
    for (var i = 0; i < n; i++) {
      var b = debris[i], sp = [rnd(0.5, 1.3), rnd(0.5, 1.3), rnd(0.2, 0.7), rnd(0.2, 0.7)];
      dust[(Math.random() * dust.length) | 0] = {
        z: b.z, fx: (((b.x / W) % 1) + 1) % 1, fy: (((b.y / H) % 1) + 1) % 1, sp: sp,
        ph: [-t * sp[0], 1.5708 - t * sp[1], -t * sp[2], 1.5708 - t * sp[3]],
        ox: 0, oy: 0, vx: 0, vy: 0
      };
    }
    debris = [];
  }

  /* ============================== LOOP ============================== */
  function step(dt) {
    time += dt;
    Pt = targetProgress();
    Ps += (Pt - Ps) * (1 - Math.exp(-CFG.scrollSmooth * dt));
    if (Ps > 0.97 && !awakeOn && !exploded) { awakeOn = true; wakeT = time; wakeWall = performance.now(); }
    else if (Ps < 0.9) awakeOn = false;
    if (awakeOn && !exploded) {                                           // timer: formado -> azul -> explosão
      charge = clamp((performance.now() - wakeWall) / 1000 / CFG.chargeTime, 0, 1);   // relógio real
      if (charge >= 1) explode();
    } else charge = Math.max(0, charge - dt * 0.5);
    if (exploded && Ps < 0.6) exploded = false;                           // rolou de volta: pode formar de novo
    if (!exploded) pv = Math.min(1, pv + dt * 1.2);
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
    Ps = Pt = 1; awake = 1; awakeOn = true; wakeT = -99; time = 0;
    render(0);
  }

  function setTheme() { col = dark.matches ? CFG.colors.dark : CFG.colors.light; recolor(); if (reduced) drawStatic(); }

  /* ============================ INTERAÇÃO ============================ */
  function overPenguin(x, y) {
    var a = (x - cx) / (Hs * (shape && shape.mascot ? 0.27 : 0.34)), b = (y - cy) / (Hs * 0.5);
    return Ps > 0.9 && a * a + b * b <= 1;
  }

  window.Penguin = {
    setSpeaking: function (v) { speaking = !!v; },
    isReady: function () { return Ps > 0.9; }
  };

  /* ================================ INIT ================================ */
  function init() {
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
  }
  buildShape(function (sh) { shape = sh; init(); });
})();
