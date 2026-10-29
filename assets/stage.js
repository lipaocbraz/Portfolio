/* Um setor por vez: hero, agora, notas, log e o resumo dos projetos (no cume) ficam fixos na tela e só o atual aparece.
   A rolagem tem duas fases:
     1) subida (#scroll-space): o scroll escolhe o setor e leva o pinguim pela rota até o cume;
     2) cabana: o pinguim entra na casa do cume, a câmera vai até o computador e a tela (#tela) mostra os projetos.
   Expõe window.Stage = { p(): progresso 0..1 da subida, inside(): 0..1 da fase da cabana } para o mountain.js.
   Sem JS, as seções continuam no fluxo normal da página (a classe js-stages só entra aqui). */
(function () {
  "use strict";
  var doc = document.documentElement, main = document.querySelector("main");
  var stages = [].slice.call(document.querySelectorAll("main [data-mini]"));
  if (!main || !stages.length) return;
  var N = stages.length, cur = -1, Q = new URLSearchParams(location.search), CABIN = 2.6;   // CABIN: alturas de tela da fase da cabana
  doc.classList.add("js-stages");
  stages.forEach(function (s) { s.classList.add("stage"); });
  var space = document.createElement("div"); space.id = "scroll-space"; space.setAttribute("aria-hidden", "true"); space.style.height = (N * 90 + CABIN * 100) + "vh";
  main.insertBefore(space, document.getElementById("tela"));
  var tela = document.getElementById("tela");

  function climb() { return Math.max(1, N * 0.9 * innerHeight - innerHeight); }           // trecho de rolagem da subida
  function p() { return Math.min(1, Math.max(0, scrollY / climb())); }
  function inside() { return Q.get("inside") !== null ? +Q.get("inside") : Math.min(1, Math.max(0, (scrollY - climb()) / (CABIN * innerHeight))); }
  var forced = Q.get("stage");                                       // depuração: ?stage=2 fixa o setor
  function index() { if (forced !== null) return Math.min(N - 1, Math.max(0, +forced)); return Math.min(N - 1, Math.floor(p() * N)); }
  function sstep(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function apply() {
    var i = index(), it = inside();
    if (i !== cur) {
      cur = i;
      stages.forEach(function (s, k) { var on = k === i; s.classList.toggle("on", on); s.setAttribute("aria-hidden", on ? "false" : "true"); s.inert = !on; });
      doc.setAttribute("data-sector", stages[i].id || "hero");
    }
    stages[N - 1].style.opacity = it > 0 ? Math.max(0, 1 - it * 7).toFixed(3) : "";      // o resumo sai quando ele começa a entrar
    var sc = sstep(0.86, 0.97, it); tela.style.opacity = sc.toFixed(3); tela.classList.toggle("on", sc > 0.5); tela.inert = sc <= 0.5;
  }
  addEventListener("scroll", apply, { passive: true }); addEventListener("resize", apply); apply();
  window.Stage = { p: p, inside: inside, fade: inside, climbEnd: climb, insideAt: function (t) { return climb() + t * CABIN * innerHeight; } };   // insideAt(t): posição de rolagem de um ponto da fase da cabana

  // links de âncora (menu e rótulos 3D): setor -> centro da faixa dele; projetos e sobre -> fim (dentro da cabana)
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
    var id = a.getAttribute("href").slice(1), k = id === "top" ? 0 : stages.findIndex(function (s) { return s.id === id; }), top;
    if (id === "projetos" || id === "sobre") top = doc.scrollHeight - innerHeight;
    else if (k < 0) return;
    else top = k >= N - 1 ? climb() : (k + 0.5) / N * climb();
    e.preventDefault(); scrollTo({ top: top, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
})();
