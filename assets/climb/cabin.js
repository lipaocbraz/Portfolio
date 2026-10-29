/* Interior da cabana do cume (montado só com primitivas do three.js): sala de troncos, janela com a noite de neve,
   mesa com um computador e uma luminária. A tela do computador mostra os projetos (textura de canvas no mesmo estilo
   do site). A câmera parte de uma vista da sala, por cima do ombro do pinguim, e aproxima até a tela ocupar a janela;
   nesse ponto o HTML dos projetos (#tela) assume no lugar da imagem.

   buildCabin(THREE, projects) => { scene, camera, spot, update(k, aspect) }
     k       0..1: 0 = vista da sala, 1 = tela do computador enchendo a vista
     spot    onde o pinguim fica, de costas para a câmera, olhando o computador */

export function buildCabin(THREE, projects) {
  var scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0a0c);
  var camera = new THREE.PerspectiveCamera(40, 1, 0.05, 60);
  function std(c, r, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r == null ? 0.85 : r, metalness: 0 }, extra || {})); }
  function box(w, h, d, m, x, y, z, parent) { var o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; (parent || scene).add(o); return o; }
  function tex(w, h, draw) { var c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

  /* ---- sala: paredes de troncos, piso de tábuas, teto ---- */
  var logs = tex(256, 256, function (g, w, h) {
    for (var y = 0; y < h; y += 32) {
      var gr = g.createLinearGradient(0, y, 0, y + 32); gr.addColorStop(0, "#5a3a22"); gr.addColorStop(0.5, "#8a5a35"); gr.addColorStop(1, "#4a2f1b");
      g.fillStyle = gr; g.fillRect(0, y, w, 32); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(0, y + 30, w, 2);
    }
  }); logs.wrapS = logs.wrapT = THREE.RepeatWrapping; logs.repeat.set(3, 2);
  var planks = tex(256, 256, function (g, w, h) {
    for (var x = 0; x < w; x += 32) { g.fillStyle = x % 64 ? "#6b4a2f" : "#5d3f27"; g.fillRect(x, 0, 32, h); g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(x + 31, 0, 1, h); }
  }); planks.wrapS = planks.wrapT = THREE.RepeatWrapping; planks.repeat.set(3, 3);
  var W = 8, H = 4, D = 8;
  var room = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [std(0xffffff, 0.9, { map: logs }), std(0xffffff, 0.9, { map: logs }), std(0x3b2a1c, 0.9), std(0xffffff, 0.85, { map: planks }), std(0xffffff, 0.9, { map: logs }), std(0xffffff, 0.9, { map: logs })].map(function (m) { m.side = THREE.BackSide; return m; }));
  room.position.y = H / 2; room.receiveShadow = true; scene.add(room);
  [-2.4, 0, 2.4].forEach(function (x) { box(0.22, 0.22, D, std(0x4a2f1b, 0.9), x, H - 0.15, 0); });            // vigas do teto

  /* ---- janela na parede do fundo: noite de neve ---- */
  var night = tex(256, 160, function (g, w, h) {
    var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#0a1430"); gr.addColorStop(1, "#3b4d7a"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = "#dfe8f5"; g.beginPath(); g.moveTo(0, h); g.lineTo(60, 96); g.lineTo(120, 130); g.lineTo(190, 80); g.lineTo(w, 120); g.lineTo(w, h); g.fill();
    g.fillStyle = "#fff"; for (var i = 0; i < 60; i++) { g.globalAlpha = Math.random() * 0.8; g.fillRect(Math.random() * w, Math.random() * h * 0.7, 1.5, 1.5); }
  });
  var win = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshBasicMaterial({ map: night })); win.position.set(-2.2, 2.25, -D / 2 + 0.02); scene.add(win);
  var frameM = std(0x3a2414, 0.8);
  box(1.95, 0.08, 0.08, frameM, -2.2, 2.82, -D / 2 + 0.05); box(1.95, 0.08, 0.08, frameM, -2.2, 1.68, -D / 2 + 0.05);
  box(0.08, 1.2, 0.08, frameM, -3.15, 2.25, -D / 2 + 0.05); box(0.08, 1.2, 0.08, frameM, -1.25, 2.25, -D / 2 + 0.05); box(0.05, 1.1, 0.05, frameM, -2.2, 2.25, -D / 2 + 0.06);

  /* ---- mesa, computador, teclado, caneca, luminária ---- */
  var wood = std(0x7a5232, 0.7), dark = std(0x1b1d22, 0.5), metal = std(0x9aa1ab, 0.35, { metalness: 0.6 });
  var DZ = -2.6;                                                     // centro da mesa (encostada na parede do fundo)
  box(2.6, 0.09, 1.1, wood, 0, 1.0, DZ);
  [[-1.2, -0.45], [1.2, -0.45], [-1.2, 0.45], [1.2, 0.45]].forEach(function (l) { box(0.08, 1.0, 0.08, wood, l[0], 0.5, DZ + l[1]); });
  // monitor
  var SCR = { w: 1.28, h: 0.8, y: 1.62, z: DZ - 0.2 };
  box(0.34, 0.03, 0.22, dark, 0, 1.06, SCR.z + 0.02);                                       // base
  box(0.06, 0.32, 0.05, dark, 0, 1.22, SCR.z - 0.02);                                       // haste
  box(SCR.w + 0.06, SCR.h + 0.06, 0.05, dark, 0, SCR.y, SCR.z);                             // moldura
  var screenTex = tex(1024, 640, function (g, w, h) {
    g.fillStyle = "#05070d"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#0e131c"; g.fillRect(0, 0, w, 44);
    ["#ff5f57", "#febc2e", "#28c840"].forEach(function (c, i) { g.fillStyle = c; g.beginPath(); g.arc(28 + i * 24, 22, 7, 0, 6.2832); g.fill(); });
    g.font = "20px Menlo, monospace"; g.fillStyle = "#98a2b3"; g.fillText("~/felipe/projetos", 120, 29);
    g.font = "26px Menlo, monospace"; g.fillStyle = "#5CCFE6"; g.fillText("$ ls projetos/", 48, 110);
    (projects || []).forEach(function (p, i) {
      var y = 180 + i * 120;
      g.fillStyle = "rgba(92,207,230,.08)"; g.fillRect(48, y - 40, w - 96, 96);
      g.fillStyle = "#5CCFE6"; g.fillRect(48, y - 40, 3, 96);
      g.font = "bold 34px -apple-system, Helvetica, sans-serif"; g.fillStyle = "#f5f5f7"; g.fillText(p.name, 76, y + 4);
      g.font = "20px Menlo, monospace"; g.fillStyle = "#febc2e"; g.fillText("● " + (p.label || p.status || ""), 76, y + 38);
    });
    g.font = "26px Menlo, monospace"; g.fillStyle = "#5CCFE6"; g.fillText("$ _", 48, h - 40);
  });
  var screen = new THREE.Mesh(new THREE.PlaneGeometry(SCR.w, SCR.h), new THREE.MeshBasicMaterial({ map: screenTex })); screen.position.set(0, SCR.y, SCR.z + 0.03); scene.add(screen);
  box(0.9, 0.03, 0.3, dark, 0, 1.06, DZ + 0.2);                                              // teclado
  var mug = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.15, 20), std(0xf08a2b, 0.5)); mug.position.set(0.85, 1.12, DZ + 0.15); scene.add(mug);
  box(0.04, 0.5, 0.04, metal, -1.0, 1.3, DZ - 0.25); var shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.18, 20, 1, true), std(0x2b2f36, 0.5, { side: THREE.DoubleSide })); shade.position.set(-0.92, 1.58, DZ - 0.18); shade.rotation.z = 0.5; scene.add(shade);
  // estante e lareira simples para a sala não ficar vazia
  box(1.2, 1.8, 0.35, wood, 3.1, 0.9, -1.0); [0.5, 1.0, 1.5].forEach(function (y) { box(1.1, 0.04, 0.32, std(0x5d3f27), 3.1, y, -1.0); });
  [[2.75, 0.62, 0xc0392b], [2.9, 0.62, 0x2a4a86], [3.05, 0.62, 0xe8b04a], [2.8, 1.12, 0x2e7d5b], [3.0, 1.12, 0xd8d2c4]].forEach(function (b) { box(0.1, 0.22, 0.24, std(b[2], 0.8), b[0], b[1] + 0.03, -1.0); });
  box(1.4, 1.2, 0.5, std(0x6e6a66, 0.95), -3.6, 0.6, 1.2).rotation.y = Math.PI / 2;
  var fire = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffa040 })); fire.position.set(-3.45, 0.35, 1.2); scene.add(fire);
  var rug = new THREE.Mesh(new THREE.CircleGeometry(1.4, 40), std(0x8a2f2a, 0.95)); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.005, -0.6); rug.receiveShadow = true; scene.add(rug);

  /* ---- luz: luminária quente, brilho ciano da tela, fogo e ambiente frio da janela ---- */
  scene.add(new THREE.HemisphereLight(0x9fb4d8, 0x2a1a10, 0.35));
  var lamp = new THREE.PointLight(0xffb36b, 3.2, 8, 1.6); lamp.position.set(-0.85, 1.5, DZ - 0.05); lamp.castShadow = true; scene.add(lamp);
  var glow = new THREE.PointLight(0x5ccfe6, 1.4, 4, 2); glow.position.set(0, SCR.y, SCR.z + 0.6); scene.add(glow);
  var fireL = new THREE.PointLight(0xff8a3a, 2.2, 7, 1.8); fireL.position.set(-3.2, 0.6, 1.2); scene.add(fireL);
  var moon = new THREE.DirectionalLight(0xaec4ff, 0.5); moon.position.set(-2, 4, -6); scene.add(moon);

  var spot = new THREE.Vector3(0, 0, DZ + 1.25);                    // pinguim em pé, de frente para a mesa
  var A = new THREE.Vector3(2.4, 2.35, 2.2), AL = new THREE.Vector3(0, 1.35, DZ), B = new THREE.Vector3(0, SCR.y, SCR.z + 0.95), BL = new THREE.Vector3(0, SCR.y, SCR.z);
  var mid = new THREE.Vector3(0.9, 2.1, 0.2), look = new THREE.Vector3(), t0 = 0;
  function bez(a, b, c, t, out) { var u = 1 - t; return out.set(u * u * a.x + 2 * u * t * b.x + t * t * c.x, u * u * a.y + 2 * u * t * b.y + t * t * c.y, u * u * a.z + 2 * u * t * b.z + t * t * c.z); }
  function update(k, aspect) {
    var e = k * k * (3 - 2 * k);                                    // suave no começo e no fim
    bez(A, mid, B, e, camera.position); look.lerpVectors(AL, BL, Math.pow(e, 0.7)); camera.lookAt(look);
    // ajusta a distância final para a tela encher a vista em qualquer proporção de janela
    var fit = Math.max(SCR.h / 2 / Math.tan(camera.fov * Math.PI / 360), SCR.w / 2 / (Math.tan(camera.fov * Math.PI / 360) * aspect)) * 0.98;
    B.z = SCR.z + 0.03 + fit;
    camera.aspect = aspect; camera.updateProjectionMatrix();
    t0 += 0.016; fireL.intensity = 2.0 + Math.sin(t0 * 9) * 0.25 + Math.sin(t0 * 23) * 0.15;
  }
  return { scene: scene, camera: camera, spot: spot, update: update };
}
