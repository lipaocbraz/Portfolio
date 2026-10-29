/* Pinguim 3D a partir do modelo real (penguin-lowpoly.glb, gerado da imagem do mascote e reduzido de 2 milhões
   para ~80 mil triângulos, com texturas de 2048 px em WebP). As proporções do modelo são mantidas estritamente:
   só há escala UNIFORME (nunca esticamos um eixo) e o respiro é de apenas ±0,5%.

   O modelo é uma malha única, sem esqueleto: a animação é do corpo inteiro, ancorada nos pés (balanço de
   pinguim ao andar, subida e descida, inclinação, pulinho de comemoração). Não há aceno com a nadadeira,
   nem piscar, nem pés alternando.

   loadPenguinModel(THREE, url) => Promise<{ root, update(st), meshes }>  (mesma interface do penguin.js)
     st = { t, dt, walk, speed, wave, speak, gaze, happy } */
import { GLTFLoader } from "./vendor/loaders/GLTFLoader.js";

var HEIGHT = 2.9;                       // altura final em unidades da cena (escala uniforme)

export function loadPenguinModel(THREE, url) {
  return new Promise(function (resolve, reject) {
    new GLTFLoader().load(url, function (gltf) {
      var model = gltf.scene, meshes = [];
      model.traverse(function (o) {
        if (!o.isMesh) return;
        o.geometry.computeVertexNormals();                         // o arquivo veio sem normais
        var m = o.material; m.flatShading = false; m.metalness = 0; m.roughness = Math.max(m.roughness, 0.75);
        if (m.metalnessMap) m.metalnessMap = null;                  // a textura de metal/rugosidade deixava o tecido brilhante
        if (m.roughnessMap) m.roughnessMap = null;
        m.needsUpdate = true; o.castShadow = true; o.receiveShadow = false; meshes.push(o);
      });
      var box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), k = HEIGHT / size.y;
      model.scale.setScalar(k);                                     // escala uniforme: dimensões originais preservadas
      box.setFromObject(model);
      model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2 + 0.1);   // pés em y=0, centrado
      var pivot = new THREE.Group(), root = new THREE.Group(); pivot.add(model); root.add(pivot);

      // aceno: a malha não tem esqueleto, então "dobramos" o braço do lado +x (à direita de quem vê o pinguim de frente)
      // em volta do ombro, com pesos suaves por vértice (esqueleto improvisado). Só roda enquanto ele acena.
      var armMesh = meshes[0], armPos = armMesh.geometry.attributes.position, armNor = armMesh.geometry.attributes.normal, armBase = new Float32Array(armPos.count * 3), armBaseN = new Float32Array(armPos.count * 3), armIdx = [], armW = [];
      var SH = { x: 0.215, y: 0.13 };                                  // ombro, em coordenadas do modelo
      function ss(a0, a1, x) { var t = Math.min(1, Math.max(0, (x - a0) / (a1 - a0))); return t * t * (3 - 2 * t); }
      for (var vi = 0; vi < armPos.count; vi++) {
        var vx = armPos.getX(vi), vy = armPos.getY(vi), vz = armPos.getZ(vi);
        armBase[vi * 3] = vx; armBase[vi * 3 + 1] = vy; armBase[vi * 3 + 2] = vz; armBaseN[vi * 3] = armNor.getX(vi); armBaseN[vi * 3 + 1] = armNor.getY(vi); armBaseN[vi * 3 + 2] = armNor.getZ(vi);
        var w = ss(0.2, 0.24, vx) * ss(0.17, 0.08, vy) * ss(0.2, 0.1, Math.abs(vz));      // sem limite inferior: a mão (ponta preta) gira junto
        if (w > 0.002) { armIdx.push(vi); armW.push(w); }
      }
      armMesh.frustumCulled = false; var armOn = false;
      function applyArm(theta) {
        for (var k = 0; k < armIdx.length; k++) {
          var i = armIdx[k], a = theta * armW[k], c = Math.cos(a), sn = Math.sin(a), dx = armBase[i * 3] - SH.x, dy = armBase[i * 3 + 1] - SH.y;
          armPos.setXYZ(i, SH.x + dx * c - dy * sn, SH.y + dx * sn + dy * c, armBase[i * 3 + 2]);
          var nx = armBaseN[i * 3], ny = armBaseN[i * 3 + 1]; armNor.setXYZ(i, nx * c - ny * sn, nx * sn + ny * c, armBaseN[i * 3 + 2]);   // a normal gira junto
        }
        armPos.needsUpdate = true; armNor.needsUpdate = true;
      }
      var sm = {};
      function D(key, target, lam, dt) { sm[key] = sm[key] === undefined ? target : sm[key] + (target - sm[key]) * (1 - Math.exp(-lam * dt)); return sm[key]; }
      function update(st) {
        var t = st.t, sp = st.speed, ph = st.walk, dt = Math.min(0.05, Math.max(0.001, st.dt || 0.016)), hp = st.happy || 0;
        var breathe = 1 + 0.005 * Math.sin(t * 1.5);                // respiro: ±0,5% em Y
        var hop = 0;
        if (st.wave > 0.02) hop = st.wave * Math.max(0, Math.sin(t * 3)) * 0.015;   // só um balanço leve: o aceno agora é com o braço                         // comemoração no cume: pulinhos
        // andar de pinguim: balanço lateral (waddle), sobe e desce a cada passo e leve inclinação para a frente
        pivot.position.y = D("y", 0.045 * Math.abs(Math.cos(ph)) * sp + hop, 14, dt);
        pivot.position.x = D("x", -Math.sin(ph) * 0.06 * sp, 10, dt);
        pivot.rotation.z = D("rz", Math.sin(ph) * 0.13 * sp + hp * Math.sin(t * 0.9) * 0.02, 10, dt);
        pivot.rotation.y = D("ry", Math.cos(ph) * 0.09 * sp, 8, dt);
        pivot.rotation.x = D("rx", 0.06 * sp, 5, dt);
        pivot.scale.set(1, breathe + st.speak * Math.sin(t * 14) * 0.004, 1);
        var wv = D("wave", st.wave || 0, 6, dt);
        if (wv > 0.01) { applyArm(wv * (1.85 + Math.sin(t * 8) * 0.25)); armOn = true; }
        else if (armOn) { applyArm(0); armOn = false; }
      }
      resolve({ root: root, update: update, meshes: meshes });
    }, undefined, reject);
  });
}
