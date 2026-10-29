/* Cena 3D: o pinguim sobe a montanha do cenário (scene-lowpoly.glb) por uma rota que existe no próprio mapa:
   estrada da base -> estrada do segundo nível -> túnel de pedra (entra pelo arco e sai numa caverna mais acima)
   -> anel de estrada -> rampa de madeira -> anel interno -> cume, onde fica acenando.

   - A rota (route.json) foi extraída do próprio modelo: mapa de alturas + busca de caminho pelas partes planas.
     Segmentos: "walk" (estrada), "tunnel" (o pinguim some dentro da montanha) e "ramp" (rampa de madeira).
   - O scroll define o ponto-alvo ao longo da rota; o pinguim anda até lá com velocidade limitada e suavizada
     (acelera, desacelera, vira seguindo a curva). Subindo ele olha para onde anda; parado, vira de frente para a câmera.
   - O cenário foi escalado (SCALE) para o pinguim ficar na proporção de um morador da montanha.

   API: window.Climb = { setSpeaking(bool), onPenguinClick(fn), setProgress(p|null), destroy() } */
import * as THREE from "./vendor/three.module.min.js";
import { GLTFLoader } from "./vendor/loaders/GLTFLoader.js";
import { buildPenguin } from "./penguin.js";
import { loadPenguinModel } from "./penguin3d.js";
import { buildCabin } from "./cabin.js";

/* ============================ PARÂMETROS ============================ */
var CONFIG = {
  dprMax: 2,
  scale: 40,                       // escala do cenário (modelo tem ~1 unidade de largura)
  penguinHeight: 1.45,             // altura do pinguim em unidades de cena (≈ 0,036 do modelo: tamanho de um morador)
  stride: 0.42,                    // comprimento de um passo
  maxSpeed: 20,                   // velocidade máxima (unidades/s): ele nunca "voa" para onde o scroll foi
  accel: 9,                        // quão rápido acelera/desacelera
  scroll: { smooth: 9 },
  camera: { fov: 36, dist: 7.5, height: 2.9, look: 0.8, shiftX: 2.4, follow: 2.4 },   // shiftX > 0 = pinguim à direita da tela
  sky: { top: "#7fb2d9", mid: "#cfe6f5", dawn: "#f6d9c4" },
  mini: { on: true, w: 0.42, maxW: 720, aspect: 0.96, top: 8, right: 2, fov: 27, elevation: 34, azimuth: 28, sweep: 240, closeAt: 0.8, closeDist: 40, closeElev: 38, closeLook: [1.2, 6.5, -2.8], cabin: [-0.3, -5.04], door: [0.6, -2.74], closeShift: 0, dist: 84, centerY: -3 },   // miniatura no canto: w = fração da largura da tela; top/right em vw/vh; elevation/azimuth em graus; sweep = quanto a câmera gira ao longo da rota
  mobileMaxWidth: 760,
  routeUrl: "route.json", sceneUrl: "scene-lowpoly.glb", modelUrl: "penguin-lowpoly.glb"
};

var canvas = document.getElementById("scene");
var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
var darkMq = matchMedia("(prefers-color-scheme: dark)");
var Q = new URLSearchParams(location.search), qn = function (k, d) { return Q.get(k) === null ? d : +Q.get(k); };
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function wrapAngle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
var base = new URL(".", import.meta.url).href;

/* ============================== CENA ============================== */
var MINI = CONFIG.mini.on && Q.get("mode") !== "full";   // ?mode=full volta à câmera de perto, em tela cheia
var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: MINI, powerPreference: "high-performance" });
if (MINI) renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 600);
var hemi = new THREE.HemisphereLight(0xdcecff, 0x8a9db3, 0.9); scene.add(hemi);
var sun = new THREE.DirectionalLight(0xfff1de, 1.6); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
var sc = sun.shadow.camera; sc.left = -7; sc.right = 7; sc.top = 7; sc.bottom = -7; sc.near = 1; sc.far = 60;
scene.add(sun); scene.add(sun.target);
if (!MINI) scene.fog = new THREE.Fog(0xcfe6f5, 60, 260);

var skyCv = document.createElement("canvas"); skyCv.width = 4; skyCv.height = 256;
var skyTex = new THREE.CanvasTexture(skyCv); skyTex.colorSpace = THREE.SRGBColorSpace; if (!MINI) scene.background = skyTex;
function paintSky(h) {                                                 // h: 0 (base) .. 1 (cume): o céu clareia para o amanhecer
  if (MINI) { var dk = darkMq.matches; hemi.intensity = dk ? 0.8 : 1.0; sun.intensity = dk ? 1.3 : 1.8; sun.color.set(dk ? 0xc4d4ff : 0xfff1de); return; }
  var g = skyCv.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256), dark = darkMq.matches;
  var top = dark ? "#0b1530" : CONFIG.sky.top, mid = dark ? "#2a3b66" : CONFIG.sky.mid, low = dark ? "#8a6f86" : CONFIG.sky.dawn;
  gr.addColorStop(0, top); gr.addColorStop(0.62 - 0.1 * h, mid); gr.addColorStop(1, low);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256); skyTex.needsUpdate = true;
  scene.fog.color.set(dark ? "#2a3b66" : CONFIG.sky.mid);
  hemi.intensity = dark ? 0.7 : 0.9; sun.intensity = dark ? 1.1 : 1.6; sun.color.set(dark ? 0xc4d4ff : 0xfff1de);
}
var snowGeo = new THREE.BufferGeometry(), NS = 500, sPos = new Float32Array(NS * 3), sSeed = new Float32Array(NS);
for (var si = 0; si < NS; si++) { sPos[si * 3] = (Math.random() - 0.5) * 30; sPos[si * 3 + 1] = Math.random() * 14 - 3; sPos[si * 3 + 2] = (Math.random() - 0.5) * 30; sSeed[si] = Math.random() * 6.28; }
snowGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
var snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.8, depthWrite: false })); snow.frustumCulled = false; snow.visible = !MINI; scene.add(snow);

/* ============================ CENÁRIO ============================ */
var world = new THREE.Group(); world.scale.setScalar(CONFIG.scale); scene.add(world);
var mountainReady = false;
new GLTFLoader().load(base + CONFIG.sceneUrl, function (g) {
  g.scene.traverse(function (o) {
    if (!o.isMesh) return;
    o.geometry.computeVertexNormals();                           // o arquivo veio sem normais
    var m = o.material; m.flatShading = false; m.metalness = 0; m.roughness = 0.95; m.metalnessMap = null; m.roughnessMap = null; m.needsUpdate = true;
    o.receiveShadow = true; o.castShadow = false;
  });
  world.add(g.scene); mountainReady = true; document.documentElement.setAttribute("data-scene", "ok"); kick();
}, undefined, function (e) { document.documentElement.setAttribute("data-scene", "err " + (e && e.message || e)); });

/* ============================== ROTA ============================== */
var route = null;                  // { pts: [Vector3...], cum: [..], len, segs: [{type, a, b}] }
function buildRoute(json) {
  var S = CONFIG.scale, pts = [], segs = [], cum = [0], types = [];
  json.segments.forEach(function (sg) {
    var a = pts.length;
    sg.pts.forEach(function (p) { pts.push(new THREE.Vector3(p[0] * S, p[2] * S + 0.03, p[1] * S)); types.push(sg.type); });   // (x, y=altura, z) do modelo
    segs.push({ type: sg.type, a: a, b: pts.length - 1 });
  });
  for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  return { pts: pts, cum: cum, len: cum[cum.length - 1], segs: segs, types: types };
}
var _tan = new THREE.Vector3();
function sampleRoute(s) {          // posição, tangente (olhando para o fim da rota) e tipo do trecho na distância s
  var R = route, lo = 0, hi = R.pts.length - 1;
  s = clamp(s, 0, R.len);
  while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (R.cum[mid] <= s) lo = mid; else hi = mid; }
  var t = (s - R.cum[lo]) / Math.max(1e-6, R.cum[hi] - R.cum[lo]), p = new THREE.Vector3().lerpVectors(R.pts[lo], R.pts[hi], t);
  var i0 = Math.max(0, lo - 4), i1 = Math.min(R.pts.length - 1, hi + 4);
  _tan.subVectors(R.pts[i1], R.pts[i0]).setY(0).normalize();
  var seg = null; for (var k = 0; k < R.segs.length; k++) if (lo >= R.segs[k].a && lo < R.segs[k].b) seg = R.segs[k];
  var st = 0; if (seg) st = (s - R.cum[seg.a]) / Math.max(1e-6, R.cum[seg.b] - R.cum[seg.a]);
  return { pos: p, tan: _tan.clone(), type: seg ? seg.type : "walk", segT: st };
}
/* ====== texto dentro do cenário: rótulos ancorados em pontos 3D da rota (projetados pela câmera) + HUD de altitude ====== */
var STAGES = [{ at: 0.16, id: "agora", n: "01", t: "agora", lift: 0.9 }, { at: 0.42, id: "notas", n: "02", t: "notas", lift: 1.8 }, { at: 0.68, id: "log", n: "03", t: "log", lift: 1.8 }, { at: 1, id: "projetos", n: "04", t: "projetos", lift: 4.2 }];   // lift: altura do rótulo (separa os que cairiam um sobre o outro)
var labels = [], hud = null, hudLast = "", _v = new THREE.Vector3();
function buildLabels() {
  var box = document.createElement("div"); box.id = "scene-labels"; box.setAttribute("aria-hidden", "true"); document.body.appendChild(box);
  STAGES.forEach(function (st) {
    var a = document.createElement("a"); a.className = "slabel"; a.href = "#" + st.id; a.tabIndex = -1;
    a.innerHTML = '<i></i><b>' + st.n + '</b> ' + st.t; box.appendChild(a);
    var S = sampleRoute(Math.min(st.at, 0.995) * route.len); labels.push({ el: a, pos: S.pos.clone().add(new THREE.Vector3(0, st.lift, 0)), at: st.at });
  });
  hud = document.createElement("div"); hud.id = "hud"; hud.setAttribute("aria-hidden", "true"); hud.innerHTML = '<span id="hud-alt"></span><span id="hud-bar"><u></u></span><span id="hud-st"></span>'; document.body.appendChild(hud);
}
function updateHud(pos, z) {
  if (!hud) return;
  var alt = Math.max(0, Math.round((pos.y / CONFIG.scale + 0.23) / 0.4 * 2400)), p = route ? clamp(state.s / route.len, 0, 1) : 0, cur = STAGES[0];
  var sec = document.documentElement.getAttribute("data-sector"), map = { agora: 0, notas: 1, log: 2, resumo: 3 };
  if (sec in map) cur = STAGES[map[sec]]; else for (var i = 0; i < STAGES.length; i++) if (p >= STAGES[i].at - 0.12) cur = STAGES[i];
  var key = alt + "|" + Math.round(p * 100) + "|" + cur.id; if (key === hudLast) return; hudLast = key;
  document.getElementById("hud-alt").textContent = "ALT " + String(alt).padStart(4, "0") + " m";
  document.getElementById("hud-bar").firstChild.style.width = Math.round(p * 100) + "%";
  document.getElementById("hud-st").textContent = (sec === "hero" ? "// base" : p > 0.985 ? "// cume" : "// " + cur.n + " " + cur.t);
  document.documentElement.setAttribute("data-stage", cur.id);
}
function projectLabels(rx, ry, rw, rh, z) {
  var p = route ? clamp(state.s / route.len, 0, 1) : 0;
  labels.forEach(function (L) {
    _v.copy(L.pos).project(camera);
    var vis = z < 0.25 && (!window.Stage || window.Stage.fade() < 0.02) && _v.z < 1 && Math.abs(_v.x) < 1 && Math.abs(_v.y) < 1;   // somem no cume e na fase dos cards
    L.el.style.opacity = vis ? (p >= L.at - 0.2 ? 1 : 0.55) : 0; L.el.style.pointerEvents = vis ? "auto" : "none";
    if (vis) L.el.style.transform = "translate(" + (rx + (_v.x * 0.5 + 0.5) * rw).toFixed(1) + "px," + (ry + (-_v.y * 0.5 + 0.5) * rh).toFixed(1) + "px)";
    L.el.classList.toggle("on", p >= L.at - 0.06);
  });
}
fetch(base + CONFIG.routeUrl).then(function (r) { return r.json(); }).then(function (j) { route = buildRoute(j); buildLabels(); kick(); });

/* ============================= PINGUIM ============================= */
var P = buildPenguin(THREE), penguin = new THREE.Group(), pscale = 1;
function setPenguin(m, h) {
  if (P && P.root.parent === penguin) penguin.remove(P.root);
  P = m; pscale = CONFIG.penguinHeight / h; P.root.scale.setScalar(pscale); penguin.add(P.root);
}
setPenguin(P, 2.9);                // reserva procedural (até o modelo real carregar)
scene.add(penguin); penguin.visible = false;
loadPenguinModel(THREE, base + CONFIG.modelUrl).then(function (m) { setPenguin(m, 2.9); document.documentElement.setAttribute("data-model", "ok"); kick(); })
  .catch(function (e) { document.documentElement.setAttribute("data-model", "err " + (e && e.message || e)); });

/* ============================== ESTADO ============================== */
/* ====== depois do cume: o pinguim entra na cabana; dentro dela a câmera vai até o computador com os projetos ======
   it = Stage.inside() (0..1, fase de rolagem depois do cume):
     0.00–0.24  ele caminha até a porta e entra (câmera vai para trás dele, olhando a porta)
     0.24–0.36  passagem: tela escurece e volta já dentro da cabana
     0.36–0.88  dentro: a câmera sai da sala, passa por cima do ombro dele e aproxima da tela do computador
     0.88–1.00  a imagem da tela dá lugar ao HTML dos projetos (#tela) */
var cabin = buildCabin(THREE, (window.CONTENT && window.CONTENT.projetos) || []);
var fadeBox = null, door = null, doorFrom = null;
if (MINI) { fadeBox = document.createElement("div"); fadeBox.id = "scene-fade"; fadeBox.setAttribute("aria-hidden", "true"); fadeBox.style.cssText = "position:fixed;inset:0;z-index:7;pointer-events:none;background:#000;opacity:0"; document.body.appendChild(fadeBox); }
function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function insideT() { return window.Stage && window.Stage.inside ? window.Stage.inside() : 0; }
var _down = new THREE.Raycaster(), _o = new THREE.Vector3(), _dn = new THREE.Vector3(0, -1, 0);
function groundY(x, z, fallback) {                                  // altura do chão do cenário em (x, z): o pinguim sobe o domo até a cabana
  if (!mountainReady) return fallback; _o.set(x, 200, z); _down.set(_o, _dn);
  var hit = _down.intersectObject(world, true)[0]; return hit ? hit.point.y : fallback;
}
function doorPoints() {
  if (door || !route) return;
  doorFrom = route.pts[route.pts.length - 1].clone();
  var c = new THREE.Vector3(CONFIG.mini.cabin[0], doorFrom.y, CONFIG.mini.cabin[1]);
  door = new THREE.Vector3(CONFIG.mini.door[0], doorFrom.y, CONFIG.mini.door[1]); door.out = door.clone().sub(c).setY(0).normalize(); door.y = groundY(door.x, door.z, doorFrom.y);   // porta = frente da cabana (lado +z do modelo)
}
var inRoom = false;
function setRoom(on) {
  if (on === inRoom) return; inRoom = on;
  (on ? scene : cabin.scene).remove(penguin); (on ? cabin.scene : scene).add(penguin);
}
// posição/pose do pinguim durante a entrada; devolve true quando a fase "dentro" está ativa
function walkIn(it, dt) {
  doorPoints(); if (!door) return false;
  if (it >= 0.3) {
    setRoom(true); penguin.visible = true; penguin.position.copy(cabin.spot); penguin.rotation.y = Math.PI;
    P.update({ t: state.t, dt: dt, walk: state.walk, speed: 0, wave: 0, speak: 0, gaze: 0, happy: 0 });
    return true;
  }
  setRoom(false);
  var w = sstep(0, 0.24, it), prev = state.inPrev == null ? w : state.inPrev; state.inPrev = w;
  penguin.position.lerpVectors(doorFrom, door, w); penguin.position.y = groundY(penguin.position.x, penguin.position.z, penguin.position.y); penguin.visible = it < 0.235;
  penguin.rotation.y = Math.atan2(door.x - doorFrom.x, door.z - doorFrom.z);
  state.walk += Math.abs(w - prev) * doorFrom.distanceTo(door) * Math.PI / CONFIG.stride;
  P.update({ t: state.t, dt: dt, walk: state.walk, speed: w > 0.001 && w < 0.999 ? 0.8 : 0, wave: 0, speak: 0, gaze: 0, happy: 0 });
  return false;
}
function doorCamera(it) {                                          // a câmera não aproxima (o modelo perde qualidade de perto): só mostra ele entrando
  return;
  if (!door || it <= 0) return;
  var k = sstep(0, 0.2, it), cp = door.clone().addScaledVector(door.out, 11).add(new THREE.Vector3(2.5, 7.5, 0)), lk = door.clone().add(new THREE.Vector3(0, 0.6, 0));   // alto e afastado: passa por cima da mesa de fora
  camera.position.lerp(cp, k); camLook.lerp(lk, k); camera.lookAt(camLook); camera.updateMatrixWorld();
}
var state = { s: 0, v: 0, p: 0, forced: null, yaw: 0, walk: 0, speed: 0, wave: 0, happy: 0, speak: 0, speaking: false, t: 0, last: 0, raf: 0, still: 1, dir: 1, first: true, clickWave: 0, hov: false };
var clickCb = null, camPos = new THREE.Vector3(), camLook = new THREE.Vector3();

function scrollProgress() { if (window.Stage) return window.Stage.p(); var max = document.documentElement.scrollHeight - innerHeight; return max > 0 ? clamp((window.scrollY || 0) / max, 0, 1) : 0; }

var marker = null, skyDiv = null;
if (MINI) {                                          // céu da página: aparece quando o pinguim chega ao cume (a landing page "vira" o cenário)
  skyDiv = document.createElement("div"); skyDiv.id = "scene-sky"; skyDiv.setAttribute("aria-hidden", "true");
  skyDiv.style.cssText = "position:fixed;inset:0;z-index:-2;pointer-events:none;opacity:0";
  document.body.insertBefore(skyDiv, canvas);
}
function paintPageSky() {
  if (!skyDiv) return; var dk = darkMq.matches;
  skyDiv.style.background = dk   // sem céu claro: mantém o fundo da página e só acrescenta um halo discreto atrás do cenário
    ? "radial-gradient(40% 46% at 50% 53%,rgba(120,150,210,.10),rgba(120,150,210,0) 70%)"
    : "radial-gradient(40% 46% at 50% 53%,rgba(20,40,80,.06),rgba(20,40,80,0) 70%)";
}
paintPageSky();
// desenha a cena no retângulo atual: miniatura no canto -> tela cheia quando ele chega ao cume (suave, com borda esfumada)
var miniEls = null;
function miniSideTarget() {
  if (Q.get("side") !== null) return Q.get("side") === "left" ? 1 : 0;      // depuração: ?side=left|right
  if (document.documentElement.classList.contains("js-stages")) { var on = document.querySelector("[data-mini].on"); return on && on.getAttribute("data-mini") === "left" ? 1 : 0; }   // um setor por vez: lado do setor ativo          // 0 = miniatura à direita, 1 = à esquerda, conforme o lado do texto da seção que está no meio da tela
  if (!miniEls) miniEls = [].slice.call(document.querySelectorAll("[data-mini]"));
  var mid = innerHeight * 0.5, best = null, bd = 1e9;
  miniEls.forEach(function (e) { var r = e.getBoundingClientRect(), d = mid < r.top ? r.top - mid : mid > r.bottom ? mid - r.bottom : 0; if (d < bd) { bd = d; best = e; } });
  return best && best.getAttribute("data-mini") === "left" ? 1 : 0;
}
function drawScene() {
  if (!MINI) { renderer.render(scene, camera); return; }
  var mc = CONFIG.mini, w = innerWidth, h = innerHeight, mob = w <= CONFIG.mobileMaxWidth;
  var cw = Math.round(Math.min(mob ? w * 0.52 : w * mc.w, mc.maxW)), ch = Math.round(cw * mc.aspect);
  var sgT = miniSideTarget(); state.side = (state.side === undefined || state.snap) ? sgT : state.side + (sgT - state.side) * (1 - Math.exp(-1.8 * (state.dtv || 0.016)));
  var sg = state.side * state.side * (3 - 2 * state.side), rightX = w - w * mc.right / 100 - cw, leftX = w * mc.right / 100 + 12;
  var mx = mob ? w - cw - 6 : lerp(rightX, leftX, sg), my = mob ? h - ch - 54 : h * mc.top / 100, z = state.zoom * state.zoom * (3 - 2 * state.zoom);
  var rx = lerp(mx, 0, z), ry = lerp(my, 0, z), rw = lerp(cw, w, z), rh = lerp(ch, h, z);
  camera.aspect = rw / rh; camera.fov = lerp(mc.fov, CONFIG.camera.fov * (w / h < 0.8 ? 1.35 : 1), z); camera.updateProjectionMatrix();
  renderer.autoClear = false; renderer.setScissorTest(false); renderer.clear();
  var it = insideT();
  if (fadeBox) fadeBox.style.opacity = (sstep(0.2, 0.29, it) * (1 - sstep(0.31, 0.4, it))).toFixed(3);   // passagem pela porta
  if (it >= 0.3) {                                                   // dentro da cabana: tela cheia
    renderer.setViewport(0, 0, w, h); cabin.update(sstep(0.36, 0.88, it), w / h); renderer.render(cabin.scene, cabin.camera);
    canvas.style.maskImage = canvas.style.webkitMaskImage = "none";
    var sv = 1 - sstep(0.88, 0.97, it); canvas.style.opacity = sv.toFixed(3); canvas.style.visibility = sv <= 0.001 ? "hidden" : "visible";
    skyDiv.style.opacity = "0"; document.documentElement.style.setProperty("--scene", "0"); if (hud) hud.style.opacity = "0";
    projectLabels(0, 0, w, h, 1); return;
  }
  renderer.setViewport(rx, h - ry - rh, rw, rh); renderer.setScissor(rx, h - ry - rh, rw, rh); renderer.setScissorTest(true);
  renderer.render(scene, camera);
  // borda esfumada (sem corte reto) enquanto for miniatura; some ao virar tela cheia
  // sombra circular: na miniatura acompanha o retângulo; em tela cheia vira um círculo no centro (mesmo desenho)
  var R = Math.min(w, h) * 0.56, ex = lerp(rw * 0.5, R, z), ey = lerp(rh * 0.5, R, z), fx = lerp(rx + rw / 2, w / 2, z), fy = lerp(ry + rh / 2, h * 0.53, z);
  var m = "radial-gradient(ellipse " + ex.toFixed(0) + "px " + ey.toFixed(0) + "px at " + fx.toFixed(0) + "px " + fy.toFixed(0) + "px, #000 58%, rgba(0,0,0,0) 99%)";
  // em tela cheia, a base do mapa (chão quadrado) se dissolve no céu como na miniatura: degradê vertical somado à elipse
  canvas.style.maskImage = m; canvas.style.webkitMaskImage = m;
  var fd = 0, vis = 1;
  canvas.style.opacity = vis.toFixed(3); canvas.style.visibility = fd >= 0.999 ? "hidden" : "visible";
  skyDiv.style.opacity = (z * vis).toFixed(3); document.documentElement.style.setProperty("--scene", (z * vis).toFixed(3));
  if (hud) hud.style.opacity = (1 - sstep(0, 0.15, it)).toFixed(3);
  snow.visible = z > 0.4;
  projectLabels(rx, ry, rw, rh, z); updateHud(penguin.position, z);
  if (hud) hud.classList.toggle("full", z > 0.5);
}
state.zoom = 0;
function aimMini(pos, frac, dt, snap) {
  var mc = CONFIG.mini, azf = snap && state.forced != null ? state.forced : state.p;          // a câmera gira junto com o scroll
  var az = (mc.azimuth + mc.sweep * azf) * Math.PI / 180, el = mc.elevation * Math.PI / 180;
  var zt = frac > mc.closeAt ? 1 : 0; state.zoom = snap ? zt : state.zoom + (zt - state.zoom) * (1 - Math.exp(-1.6 * dt));   // no cume, aproxima do pinguim
  var z = state.zoom * state.zoom * (3 - 2 * state.zoom);
  var ov = new THREE.Vector3(Math.sin(az) * Math.cos(el) * mc.dist, Math.sin(el) * mc.dist + mc.centerY, Math.cos(az) * Math.cos(el) * mc.dist), ovLook = new THREE.Vector3(0, mc.centerY, 0);
  // no cume: tela cheia mostrando o cenário inteiro (câmera afastada, olhando o centro da montanha, deslocada para o lado do texto)
  var ce = mc.closeElev * Math.PI / 180, clLook = new THREE.Vector3(mc.closeLook[0], mc.closeLook[1], mc.closeLook[2]);
  var cl = new THREE.Vector3(clLook.x + Math.sin(az) * Math.cos(ce) * mc.closeDist, clLook.y + Math.sin(ce) * mc.closeDist, clLook.z + Math.cos(az) * Math.cos(ce) * mc.closeDist), fwd = new THREE.Vector3(-cl.x, 0, -cl.z).normalize(), rgt = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
  var tShift = clLook.clone().addScaledVector(rgt, innerWidth > CONFIG.mobileMaxWidth ? -mc.closeShift : 0);
  camera.position.lerpVectors(ov, cl, z); camLook.lerpVectors(ovLook, tShift, z); camera.lookAt(camLook); camera.updateMatrixWorld();
  if (marker) { var k = 1 + 0.18 * Math.sin(state.t * 4); marker.position.set(pos.x, pos.y + 0.12, pos.z); marker.scale.setScalar(k); marker.visible = z < 0.35; }
}
function aimCamera(pos, dt, snap) {
  if (MINI && Q.get("far") !== "1") { aimMini(pos, route ? clamp(state.s / route.len, 0, 1) : 0, dt, snap); return; }
  var cm = CONFIG.camera, mobile = innerWidth <= CONFIG.mobileMaxWidth;
  var o = new THREE.Vector3(pos.x, 0, pos.z); if (o.lengthSq() < 1e-4) o.set(0, 0, 1); o.normalize();      // para fora da montanha
  var D = mobile ? cm.dist * 1.25 : cm.dist, tgt = new THREE.Vector3(pos.x + o.x * D, pos.y + cm.height, pos.z + o.z * D);
  if (snap) camPos.copy(tgt); else camPos.lerp(tgt, 1 - Math.exp(-cm.follow * dt));
  var fwd = new THREE.Vector3(pos.x - camPos.x, 0, pos.z - camPos.z).normalize(), right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
  var shift = mobile ? 0 : cm.shiftX, look = new THREE.Vector3(pos.x, pos.y + cm.look, pos.z).addScaledVector(right, -shift);
  if (snap) camLook.copy(look); else camLook.lerp(look, 1 - Math.exp(-cm.follow * 1.4 * dt));
  camera.position.copy(camPos); camera.lookAt(camLook);
  if (Q.get("far") === "1") { camera.position.set(34, 26, 40); camera.lookAt(0, 6, 0); }
  if (Q.get("close") === "1") { camera.position.set(pos.x + o.x * 3.4, pos.y + 1.5, pos.z + o.z * 3.4); camera.lookAt(pos.x, pos.y + 0.8, pos.z); }
  camera.updateMatrixWorld();
}

function placeLights(pos) {
  if (MINI) { sun.position.set(pos.x + 14, pos.y + 26, pos.z + 10); sun.target.position.copy(pos); sun.target.updateMatrixWorld(); return; }
  sun.position.set(pos.x + 9, pos.y + 16, pos.z + 7); sun.target.position.copy(pos); sun.target.updateMatrixWorld();
  snow.position.set(pos.x, pos.y, pos.z);
}

function resize() {
  var w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, CONFIG.dprMax);
  if (MINI) {                                          // canvas em tela cheia e transparente; a miniatura é só um retângulo de viewport (animado)
    var st = canvas.style; st.position = "fixed"; st.inset = "0"; st.width = "100%"; st.height = "100%";
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.updateProjectionMatrix();
  } else {
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = CONFIG.camera.fov * (w / h < 0.8 ? 1.35 : 1); camera.updateProjectionMatrix();
  }
  if (reduced) stepStatic();
}

var lastSkyH = -1;
function frame(now) {
  state.raf = requestAnimationFrame(frame);
  var dt = Math.min((now - state.last) / 1000, 0.05); state.last = now; state.t += dt; state.dtv = dt;
  if (!route) return;
  var tgtP = state.forced != null ? state.forced : scrollProgress();
  state.p += (tgtP - state.p) * (1 - Math.exp(-CONFIG.scroll.smooth * dt));
  var target = state.p * route.len;
  if (state.first) { state.s = target; state.first = false; }
  // velocidade desejada: proporcional à distância, limitada; suavizada (aceleração) => passos contínuos e sem trancos
  var vt = clamp((target - state.s) * 4.5, -CONFIG.maxSpeed, CONFIG.maxSpeed);
  if (Math.abs(target - state.s) < 0.02) vt = 0;
  state.v += (vt - state.v) * (1 - Math.exp(-CONFIG.accel * dt));
  var ds = state.v * dt; state.s = clamp(state.s + ds, 0, route.len);
  var moving = Math.abs(state.v) > 0.25;
  state.walk += Math.abs(ds) * Math.PI / CONFIG.stride;                       // um passo = meio ciclo
  state.speed += (clamp(Math.abs(state.v) / 3.5, 0, 1) - state.speed) * (1 - Math.exp(-6 * dt));
  if (moving) { state.still = 0; state.dir = state.v > 0 ? 1 : -1; } else state.still = Math.min(1, state.still + dt / 0.5);
  var idle = state.still >= 1, S = sampleRoute(state.s), pos = S.pos;
  // direção: segue a tangente da rota (para frente ao subir, para trás ao descer); parado, olha para a câmera
  var yawT;
  if (idle) yawT = Math.atan2(camera.position.x - pos.x, camera.position.z - pos.z);
  else { var dx = S.tan.x * state.dir, dz = S.tan.z * state.dir, mix = 0.22; var ax = dx, az = dz; var cx = camera.position.x - pos.x, cz = camera.position.z - pos.z, cl = Math.hypot(cx, cz) || 1; ax = dx * (1 - mix) + cx / cl * mix; az = dz * (1 - mix) + cz / cl * mix; yawT = Math.atan2(ax, az); }
  state.yaw += wrapAngle(yawT - state.yaw) * (1 - Math.exp(-(idle ? 5 : 9) * dt));
  var atTop = state.s > route.len - 0.35 && idle ? 1 : 0;
  state.wave += (atTop - state.wave) * (1 - Math.exp(-3 * dt));
  state.happy += ((idle ? 1 : 0) - state.happy) * (1 - Math.exp(-3 * dt));
  state.speak += ((state.speaking ? 1 : 0) - state.speak) * (1 - Math.exp(-5 * dt));
  // túnel: o pinguim some dentro da montanha
  var hidden = S.type === "tunnel" && S.segT > 0.12 && S.segT < 0.88;
  var it = insideT();
  if (it > 0 && state.s > route.len - 0.5) walkIn(it, dt);
  else { setRoom(false); state.inPrev = null; penguin.visible = !hidden; penguin.position.copy(pos); penguin.rotation.y = state.yaw;
    P.update({ t: state.t, dt: dt, walk: state.walk, speed: state.speed, wave: Math.max(state.wave, state.clickWave), speak: state.speak, gaze: 0, happy: state.happy }); }
  if (state.clickWave) state.clickWave = Math.max(0, state.clickWave - dt * 0.5);
  aimCamera(pos, dt, false); doorCamera(it); placeLights(pos);
  var h = clamp((pos.y / CONFIG.scale + 0.23) / 0.4, 0, 1); if (Math.abs(h - lastSkyH) > 0.03) { lastSkyH = h; paintSky(h); }
  var a = snowGeo.attributes.position.array;
  for (var i = 0; i < NS; i++) { a[i * 3 + 1] -= 0.8 * dt; a[i * 3] += Math.sin(state.t * 0.6 + sSeed[i]) * 0.25 * dt; if (a[i * 3 + 1] < -3) a[i * 3 + 1] = 11; }
  snowGeo.attributes.position.needsUpdate = true;
  drawScene();
}

/* ============ modos estáticos: reduced-motion e capturas (?p=0.5&y=..&w=..&s=..&h=..) ============ */
function stepStatic() {
  if (!route || !mountainReady) return;
  state.snap = true;
  var p = state.forced != null ? state.forced : scrollProgress(), S = sampleRoute(p * route.len), pos = S.pos; state.s = p * route.len; state.p = p;
  var idle = qn("s", 0) < 0.05, yaw = Q.get("y") !== null ? qn("y", 0) : null;
  penguin.visible = !(S.type === "tunnel" && S.segT > 0.12 && S.segT < 0.88); penguin.position.copy(pos);
  aimCamera(pos, 1, true); placeLights(pos);                         // primeiro a câmera; o pinguim olha para ela
  penguin.rotation.y = yaw !== null ? yaw : Math.atan2(camera.position.x - pos.x, camera.position.z - pos.z);
  P.update({ t: 0.5, dt: 1, walk: qn("w", 0), speed: qn("s", 0), wave: p > 0.985 && insideT() === 0 ? 1 : 0, speak: 0, gaze: 0, happy: idle ? 1 : 0 });
  if (insideT() > 0) { walkIn(insideT(), 1); doorCamera(insideT()); }
  paintSky(clamp((pos.y / CONFIG.scale + 0.23) / 0.4, 0, 1)); drawScene();
}
function kick() { if (Q.get("p") !== null || reduced) stepStatic(); }

/* ============================= INTERAÇÃO ============================= */
var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function hit(e) { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return penguin.visible && ray.intersectObjects(P.meshes, false).length > 0; }
function onMove(e) { var h = hit(e); if (h !== state.hov) { state.hov = h; document.body.style.cursor = h ? "pointer" : ""; } }
function onClick(e) { if (e.target.closest && e.target.closest("a,button")) return; if (!hit(e)) return; state.clickWave = 1; if (clickCb) clickCb(e); dispatchEvent(new CustomEvent("penguin:click")); }
function onVis() { if (document.hidden) { cancelAnimationFrame(state.raf); state.raf = 0; } else start(); }
function start() { if (!state.raf && !reduced && Q.get("p") === null) { state.last = performance.now(); state.raf = requestAnimationFrame(frame); } }
var rt; function onResize() { clearTimeout(rt); rt = setTimeout(resize, 120); }
addEventListener("resize", onResize); document.addEventListener("visibilitychange", onVis);
addEventListener("pointermove", onMove, { passive: true }); addEventListener("click", onClick);
darkMq.addEventListener && darkMq.addEventListener("change", function () { lastSkyH = -1; });
if (Q.get("p") !== null) state.forced = qn("p", 0);
if (reduced) addEventListener("scroll", stepStatic, { passive: true });
resize(); start();

window.Climb = {
  setSpeaking: function (v) { state.speaking = !!v; },
  onPenguinClick: function (fn) { clickCb = fn; },
  setProgress: function (p) { state.forced = p; },
  destroy: function () { cancelAnimationFrame(state.raf); state.raf = 0; removeEventListener("resize", onResize); document.removeEventListener("visibilitychange", onVis); removeEventListener("pointermove", onMove); removeEventListener("click", onClick); renderer.dispose(); document.body.style.cursor = ""; },
  _state: state
};
