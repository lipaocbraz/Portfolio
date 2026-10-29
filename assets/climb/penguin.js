/* Pinguim 3D do mascote, estilo animação: o corpo inteiro (barriga, pescoço, cabeça e cabelo) é UMA malha contínua
   em forma de gota, pintada por cor de vértice (jaqueta, gola, barra, peito, máscara branca do rosto, bigode, cabelo).
   Só os acessórios são peças à parte: olhos, bico, sobrancelhas, nadadeiras, pés e rabinho.
   De frente = +z, pés em y = 0, ~2,9 de altura.

   buildPenguin(THREE) => { root, update(st), meshes }
     st = { t, dt, walk, speed, wave, speak, gaze, happy }
       t, dt  tempo (s) e passo de tempo; walk = fase do passo (rad); speed 0..1 = intensidade do passo
       wave   0..1 acena com a nadadeira; speak 0..1 bico mexe
       gaze   rotação (rad) dos olhos em Y, para olhar a câmera; happy 0..1 sobrancelhas erguidas / sorriso */

export function buildPenguin(THREE) {
  var C = { jacket: 0x3a5790, jacketLo: 0x28437a, pants: 0x44444c, hair: 0x15151b, black: 0x1b1b21, white: 0xf7f6f2, orange: 0xf08a2b };

  /* ---- texturas procedurais ---- */
  function canvasTex(w, h, draw, srgb) { var c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); var t = new THREE.CanvasTexture(c); t.colorSpace = srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace; return t; }
  var irisTex = canvasTex(128, 128, function (g) {                  // íris: azul profundo, pupila, sombra da pálpebra em cima
    var gr = g.createRadialGradient(64, 66, 3, 64, 64, 62);
    gr.addColorStop(0, "#04060c"); gr.addColorStop(0.28, "#04060c"); gr.addColorStop(0.33, "#7cc4ee"); gr.addColorStop(0.6, "#3a86c4"); gr.addColorStop(0.9, "#1b4a7c"); gr.addColorStop(1, "#0d2240");
    g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 62, 0, 6.2832); g.fill();
    var sh = g.createLinearGradient(0, 0, 0, 128); sh.addColorStop(0, "rgba(0,0,0,.55)"); sh.addColorStop(0.45, "rgba(0,0,0,0)");
    g.save(); g.beginPath(); g.arc(64, 64, 62, 0, 6.2832); g.clip(); g.fillStyle = sh; g.fillRect(0, 0, 128, 128); g.restore();
  });
  var socketTex = canvasTex(64, 64, function (g) {                  // sombra suave ao redor do olho (afunda o olho no rosto)
    var gr = g.createRadialGradient(32, 32, 14, 32, 32, 32); gr.addColorStop(0, "rgba(10,12,24,0)"); gr.addColorStop(0.6, "rgba(10,12,24,.14)"); gr.addColorStop(1, "rgba(10,12,24,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  var knit = canvasTex(64, 64, function (g, w, h) {
    g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); g.strokeStyle = "#e0e0e0"; g.lineWidth = 3;
    for (var y = 0; y < h; y += 8) for (var x = 0; x < w; x += 8) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y + 7); g.lineTo(x + 8, y); g.stroke(); }
  }, false);
  knit.wrapS = knit.wrapT = THREE.RepeatWrapping; knit.repeat.set(20, 9);

  function std(color, rough, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: rough, metalness: 0 }, extra || {})); }
  var M = {
    body: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.82, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x8aa0d8), bumpMap: knit, bumpScale: 0.7 }),
    pants: std(C.pants, 0.88), black: std(C.black, 0.45, { emissive: 0x070810 }), zip: std(0xbfc2c8, 0.3, { metalness: 0.7 }), lace: std(C.orange, 0.7),
    beakUp: new THREE.MeshPhysicalMaterial({ color: 0xf59a22, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.25 }),
    beakLow: new THREE.MeshPhysicalMaterial({ color: 0xe07f16, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.3 }),
    mouth: std(0x5a1714, 0.5), orange: std(C.orange, 0.5, { emissive: 0x1a0a00 }),
    eye: new THREE.MeshPhysicalMaterial({ color: 0xf6f7f8, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04 }),
    iris: new THREE.MeshStandardMaterial({ map: irisTex, emissiveMap: irisTex, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.2 }),
    glint: new THREE.MeshBasicMaterial({ color: 0xffffff }), lid: std(0xe9e9e6, 0.85),
    socket: new THREE.MeshBasicMaterial({ map: socketTex, transparent: true, depthWrite: false }), flipper: new THREE.MeshPhysicalMaterial({ color: 0x1d1e26, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.35 })
  };
  var meshes = [];
  function ss(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function blob(x, y, cx, cy, rx, ry) { var u = (x - cx) / rx, v = (y - cy) / ry; return 1 - ss(0.86, 1.0, u * u + v * v); }
  function mk(parent, geo, material, x, y, z, sx, sy, sz) {
    var m = new THREE.Mesh(geo, material); m.position.set(x || 0, y || 0, z || 0); if (sx) m.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz);
    m.castShadow = true; parent.add(m); meshes.push(m); return m;
  }
  var SPH = new THREE.SphereGeometry(1, 40, 28);

  var root = new THREE.Group(), hips = new THREE.Group(); root.add(hips); hips.position.y = 0.55;

  /* ================= CORPO: uma única gota contínua ================= */
  var ZS = 0.8;                                                      // achatamento frente-trás
  var ctrl = [[0.0, -0.02], [0.46, 0.0], [0.6, 0.13], [0.68, 0.42], [0.68, 0.78], [0.6, 1.06], [0.52, 1.2], [0.545, 1.3], [0.48, 1.4], [0.5, 1.52],
    [0.58, 1.72], [0.62, 1.9], [0.57, 2.08], [0.44, 2.24], [0.22, 2.34], [0.0, 2.38]].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var spline = new THREE.SplineCurve(ctrl), prof = spline.getPoints(150);
  prof.forEach(function (p) { p.x = Math.max(p.x, 0); });
  function radiusAt(y) { var best = 0.5, bd = 9; for (var i = 0; i < prof.length; i++) { var d = Math.abs(prof[i].y - y); if (d < bd) { bd = d; best = prof[i].x; } } return best; }
  function front(x, y, off) { var r = radiusAt(y); return new THREE.Vector3(x, y, ZS * Math.sqrt(Math.max(r * r - x * x, 0.0009)) + (off || 0)); }

  var bg = new THREE.LatheGeometry(prof, 144), bp = bg.attributes.position, bcol = [];
  var cJ = new THREE.Color(C.jacket), cR = new THREE.Color(C.jacketLo), cK = new THREE.Color(C.black), cW = new THREE.Color(C.white), cM = new THREE.Color(0x3a3a42), cH = new THREE.Color(C.hair), cHL = new THREE.Color(0x4a4b58), tmp = new THREE.Color();
  var HEAD_Y = 1.85, HEAD_R = 0.56;
  for (var vi = 0; vi < bp.count; vi++) {
    var x = bp.getX(vi), y = bp.getY(vi), z = bp.getZ(vi);            // z em espaço da geometria (o mesh é achatado por ZS depois)
    var zn = z / 0.6, u = x / HEAD_R, v = (y - HEAD_Y) / 0.55, front01 = ss(0.0, 0.4, zn);
    var hairCut = zn > 0 ? 0.4 + 0.16 * Math.abs(u) : 0.4 + 0.95 * zn;                           // linha do cabelo: alta na testa, desce na nuca
    var hf = ss(hairCut - 0.05, hairCut + 0.05, v) * ss(1.45, 1.75, y);
    // volume do cabelo + topete + onda, deslocando a própria malha (continua com o crânio)
    var dq = Math.hypot(u - 0.22, v - 0.98, zn - 0.55), quiff = Math.exp(-dq * dq / 0.2), dq2 = Math.hypot(u + 0.55, v - 0.75, zn - 0.2), q2 = Math.exp(-dq2 * dq2 / 0.18);
    var wave = 0.025 * Math.sin(8 * u + 4 * v + 2 * zn) + 0.02 * Math.sin(13 * zn - 6 * u);
    var kr = 1 + hf * (0.11 + wave + 0.12 * q2), ky = hf * (0.34 * quiff + 0.07 + 0.1 * q2), kz = hf * 0.2 * quiff;
    bp.setXYZ(vi, x * kr, y + ky, z * kr + kz);
    // cor: jaqueta, barra, gola, peito, pescoço/cabeça pretos, máscara branca, bigode, cabelo
    var jacket = 1 - ss(1.3, 1.36, y);
    tmp.copy(cK).lerp(cJ, jacket);
    tmp.lerp(cR, Math.max(1 - ss(0.1, 0.2, y), ss(1.16, 1.22, y) * (1 - ss(1.34, 1.4, y))));      // barra e gola de tricô
    var white = Math.max(blob(u, v, -0.82, 0.04, 0.7, 0.9), blob(u, v, 0.82, 0.04, 0.7, 0.9), blob(u, v, 0, -0.78, 1.15, 0.66), blob(u, v, 0, -0.1, 0.55, 0.7) * 0.9) * front01 * ss(1.5, 1.7, y);
    var must = Math.max(blob(u, v, -0.5, -0.2, 0.36, 0.13), blob(u, v, 0.5, -0.2, 0.36, 0.13)) * front01 * 0.75 * ss(1.5, 1.7, y);
    tmp.lerp(cW, white * 1.0).lerp(cM, must * white);
    if (white > 0.5) { tmp.multiplyScalar(1 + 0.18 * white); }                                       // máscara clara mais luminosa
    var streak = Math.pow(Math.max(0, 0.5 + 0.5 * Math.sin(11 * u + 6 * v + 3 * zn)), 2) * 0.9 * ss(0.2, 0.9, v) + quiff * 0.45;
    tmp.lerp(cH, hf).lerp(cHL, hf * streak * 0.8);
    bcol.push(tmp.r, tmp.g, tmp.b);
  }
  bg.setAttribute("color", new THREE.Float32BufferAttribute(bcol, 3)); bg.computeVertexNormals();
  var body = new THREE.Mesh(bg, M.body); body.scale.z = ZS; body.castShadow = true; hips.add(body); meshes.push(body);

  function tube(pts, r, material) { var m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, r, 8, false), material); m.castShadow = true; hips.add(m); return m; }
  var zp = [], k; for (k = 0; k <= 9; k++) zp.push(front(0, 1.17 - k * 0.12, 0.012));
  tube(zp, 0.014, M.zip);                                            // zíper
  var lL = [], lR = []; for (k = 0; k <= 8; k++) { var q = k / 8; lL.push(front(-0.33 * (1 - q), 1.2 - q * 0.4, 0.022)); lR.push(front(0.33 * (1 - q), 1.2 - q * 0.4, 0.022)); }
  tube(lL, 0.02, M.lace); tube(lR, 0.02, M.lace);                    // cordão laranja em V

  /* ================= CABEÇA: acessórios ================= */
  var head = new THREE.Group(); head.position.set(0, HEAD_Y, 0); hips.add(head);            // pivô da cabeça (olhos, bico, sobrancelhas)
  var hz = function (x, y) { return front(x, HEAD_Y + y, 0).z; };

  var eyeBalls = [], lids = [], brows = [];
  [-1, 1].forEach(function (s) {
    var ex = s * 0.2, ey = 0.1, g = new THREE.Group(); g.position.set(ex, ey, hz(ex, ey) - 0.045); head.add(g);
    var sock = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), M.socket); sock.position.set(0, 0, 0.07); g.add(sock);   // sombra ao redor
    var ball = new THREE.Group(); g.add(ball); eyeBalls.push(ball);
    mk(ball, SPH, M.eye, 0, 0, 0, 0.145, 0.165, 0.12);                                      // olho (esclera clara)
    var iris = new THREE.Mesh(new THREE.CircleGeometry(1, 40), M.iris); iris.scale.set(0.098, 0.108, 1); iris.position.set(0, -0.004, 0.1215); ball.add(iris);
    var gl1 = new THREE.Mesh(new THREE.CircleGeometry(1, 20), M.glint); gl1.scale.set(0.03, 0.03, 1); gl1.position.set(-0.036, 0.045, 0.127); ball.add(gl1);   // brilhos
    var gl2 = new THREE.Mesh(new THREE.CircleGeometry(1, 16), M.glint); gl2.scale.set(0.014, 0.014, 1); gl2.position.set(0.04, -0.04, 0.127); ball.add(gl2);
    var lid = mk(g, SPH, M.lid, 0, 0.165, 0.015, 0.155, 0.001, 0.125); lid.castShadow = false; lids.push(lid);   // pálpebra (escala em Y para piscar)
    var bw = new THREE.Group(); bw.position.set(ex * 1.08, 0.34, hz(ex, 0.34) - 0.03); head.add(bw);        // sobrancelha: arco fino
    var arc = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.1 * s, -0.012, 0), new THREE.Vector3(0, 0.02, 0.01), new THREE.Vector3(0.1 * s, -0.01, 0)]), 16, 0.026, 8), M.black);
    arc.castShadow = true; bw.add(arc); bw.userData.s = s; brows.push(bw);
  });

  // bico de pinguim: alongado, afilado, levemente curvado para baixo; duas peças (cima e baixo) que se abrem ao falar
  function beakGeo(len, w, h, droop) {
    var g = new THREE.SphereGeometry(1, 36, 26), p = g.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var bx = p.getX(i), by = p.getY(i), bz = p.getZ(i), t = (bz + 1) / 2, tap = Math.pow(1 - t, 0.62);
      p.setXYZ(i, bx * w * tap, by * h * tap - droop * t * t, t * len);
    }
    g.computeVertexNormals(); return g;
  }
  var bz0 = hz(0, -0.08) - 0.06;
  mk(head, beakGeo(0.4, 0.17, 0.085, 0.07), M.beakUp, 0, -0.07, bz0);
  var jaw = new THREE.Group(); jaw.position.set(0, -0.135, bz0 + 0.01); head.add(jaw);
  mk(jaw, beakGeo(0.3, 0.13, 0.05, 0.04), M.beakLow, 0, 0, 0);
  mk(jaw, SPH, M.mouth, 0, 0.012, 0.1, 0.09, 0.012, 0.12);           // interior da boca

  /* ================= NADADEIRAS (no lugar de braços) ================= */
  function flipperGeo() {
    var g = new THREE.SphereGeometry(1, 32, 24), p = g.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var fx = p.getX(i), fy = p.getY(i), fz = p.getZ(i), s = (fy + 1) / 2;                              // s = 1 no ombro, 0 na ponta
      var w = 0.2 * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, 0.1 + 0.9 * s)));
      p.setXYZ(i, fx * 0.05 + (1 - s) * 0.1, fy * 0.42 - 0.42, fz * w);                                  // curva para fora na ponta
    }
    g.computeVertexNormals(); return g;
  }
  var FG = flipperGeo(), flippers = [];
  [-1, 1].forEach(function (s) {
    var a = new THREE.Group(); a.position.set(s * 0.66, 1.08, 0); hips.add(a);
    var f = mk(a, FG, M.flipper, 0, 0, 0); f.scale.x = s;
    a.userData.side = s; flippers.push(a);
  });

  /* ================= PERNAS, PÉS E RABINHO ================= */
  function footGeo() {                                               // pé espalmado com três dedos
    var g = new THREE.SphereGeometry(1, 32, 22), p = g.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var fx = p.getX(i), fy = p.getY(i), fz = p.getZ(i), toe = fz > 0.2 ? 0.14 * (0.5 + 0.5 * Math.cos(fx * 11)) * (fz - 0.2) : 0;
      p.setXYZ(i, fx * 0.24, Math.max(fy, -0.2) * 0.075, fz * 0.3 + toe + (fz > 0 ? 0.1 : 0));
    }
    g.computeVertexNormals(); return g;
  }
  var FT = footGeo(), legs = [];
  [-1, 1].forEach(function (s) {
    var l = new THREE.Group(); l.position.set(s * 0.26, 0.55, 0); root.add(l);
    mk(l, new THREE.CylinderGeometry(0.24, 0.2, 0.46, 32), M.pants, 0, -0.17, 0);
    var foot = new THREE.Group(); foot.position.set(0, -0.44, 0.06); l.add(foot); mk(foot, FT, M.orange, 0, 0.04, 0.05);
    l.userData.foot = foot; l.userData.side = s; legs.push(l);
  });
  mk(hips, SPH, M.black, 0, 0.12, -0.42, 0.17, 0.1, 0.24);           // rabinho

  /* ================= ANIMAÇÃO: tudo amortecido (sem trancos) ================= */
  var nextBlink = 1.2, blinkT = -1, lastT = 0, sm = {};
  function D(key, target, lam, dt) { sm[key] = sm[key] === undefined ? target : sm[key] + (target - sm[key]) * (1 - Math.exp(-lam * dt)); return sm[key]; }
  function update(st) {
    var t = st.t, sp = st.speed, ph = st.walk, dt = Math.min(0.05, Math.max(0.001, st.dt || (t - lastT))); lastT = t;
    var hp = st.happy || 0, br = Math.sin(t * 1.4) * 0.012;
    // andar de pinguim: passinhos curtos, corpo balançando de um lado para o outro (waddle), leve inclinação para a frente
    hips.position.y = 0.55 + br + D("by", 0.03 * Math.abs(Math.cos(ph)) * sp, 12, dt);
    hips.position.x = D("bx", -Math.sin(ph) * 0.05 * sp, 10, dt);
    hips.rotation.z = D("rz", Math.sin(ph) * 0.17 * sp, 10, dt);
    hips.rotation.y = D("ry", Math.cos(ph) * 0.1 * sp, 8, dt);
    hips.rotation.x = D("rx", 0.07 * sp, 5, dt);
    legs.forEach(function (l, i) {
      var s = l.userData.side, pp = ph + (s > 0 ? Math.PI : 0), a = Math.sin(pp), lift = Math.max(0, Math.cos(pp));
      l.rotation.x = D("l" + i, a * 0.42 * sp, 14, dt);
      l.userData.foot.rotation.x = D("f" + i, -a * 0.18 * sp - lift * 0.3 * sp, 12, dt);
      l.userData.foot.position.y = D("fy" + i, -0.44 + lift * 0.05 * sp, 14, dt);
    });
    flippers.forEach(function (a, i) {                                // nadadeiras: abertas para os lados, balançam no andar; a direita acena
      var s = a.userData.side, w = s > 0 ? (st.wave || 0) : 0;
      var flap = sp * (0.22 + 0.12 * Math.sin(ph * 2 + (s > 0 ? 0 : 0.6))) + (1 - sp) * 0.05 * Math.sin(t * 1.4 + (s > 0 ? 0 : 1)), rest = 0.28;
      a.rotation.z = D("az" + i, s * (rest + flap) + w * (2.55 + Math.sin(t * 8) * 0.28) * s, 7, dt);
      a.rotation.x = D("ax" + i, Math.sin(ph + (s > 0 ? 0 : Math.PI)) * 0.15 * sp * (1 - w), 9, dt);
    });
    head.rotation.z = D("hz", (-hips.rotation.z * 0.8 + Math.sin(t * 0.8) * 0.025 + hp * Math.sin(t * 0.7) * 0.05) * 0.4, 6, dt);
    head.rotation.y = D("hy", (-hips.rotation.y * 0.8 + Math.sin(t * 0.55) * 0.07 * (1 - sp * 0.5)) * 0.4, 5, dt);
    head.rotation.x = D("hx", (-0.03 - hp * 0.04 - hips.rotation.x * 0.8 + st.speak * Math.sin(t * 15) * 0.03) * 0.4, 8, dt);
    eyeBalls.forEach(function (b, i) { b.rotation.y = D("ey" + i, st.gaze || 0, 8, dt); b.rotation.x = D("ex" + i, 0.04 * hp, 5, dt); });
    var open = D("jw", st.speak * (0.5 + 0.5 * Math.sin(t * 16)) + hp * 0.1, 14, dt);
    jaw.rotation.x = open * 0.5;
    brows.forEach(function (b, i) { var lift = D("br" + i, hp, 4, dt); b.position.y = 0.34 + lift * 0.04; b.rotation.z = -b.userData.s * (0.1 + lift * 0.18); });
    if (blinkT < 0 && t > nextBlink) blinkT = 0;
    var kk = 0;
    if (blinkT >= 0) { blinkT += dt; kk = Math.sin(Math.min(1, blinkT / 0.2) * Math.PI); if (blinkT > 0.2) { blinkT = -1; nextBlink = t + 2 + Math.random() * 3; } }
    lids.forEach(function (l) { l.scale.y = 0.001 + kk * 0.165; l.position.y = 0.165 - kk * 0.165; });
  }

  return { root: root, update: update, meshes: meshes };
}
