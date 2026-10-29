/* A tela do computador do pinguim vira a nossa tela: no fim da subida o #tela ocupa a janela inteira, com a moldura do
   monitor, e funciona como um mini sistema.
   - O cursor (e o teclado: setas, Enter, Esc) escolhe um projeto; clicar abre o "README" dele dentro da própria tela.
   - A rolagem passa a rolar o conteúdo do computador (.screen-body), não a página. No topo do conteúdo, rolar para
     cima devolve a rolagem à página e o pinguim sai da tela.
   Sem JS, os projetos continuam como cards comuns na página. */
(function () {
  "use strict";
  var C = window.CONTENT || {}, tela = document.getElementById("tela");
  if (!tela) return;
  var body = tela.querySelector(".screen-body"), path = tela.querySelector(".screen-bar span"), list = document.getElementById("projetos-list");
  var cards = [].slice.call(list.querySelectorAll(".project")), app = null, sel = 0;
  function slug(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  // cada card vira um item selecionável (cursor e teclado)
  cards.forEach(function (c, i) {
    c.tabIndex = 0; c.setAttribute("role", "button"); c.setAttribute("aria-label", "Abrir " + ((C.projetos || [])[i] || {}).name);
    c.addEventListener("click", function (e) { if (e.target.closest("a")) return; open(i); });
    c.addEventListener("mouseenter", function () { mark(i); });
    c.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i); } });
  });
  function mark(i) { sel = (i + cards.length) % cards.length; cards.forEach(function (c, k) { c.classList.toggle("sel", k === sel); }); }

  // "README" do projeto, aberto dentro da tela do computador
  function open(i) {
    var p = (C.projetos || [])[i]; if (!p) return; close(true);
    app = el("article", "tela-app"); app.setAttribute("aria-label", p.name);
    var back = el("button", "tela-back", "← voltar"); back.type = "button"; back.addEventListener("click", function () { close(); });
    var cmd = el("p", "tela-cmd", "$ cat projetos/" + slug(p.name) + "/README.md");
    var st = el("p", "status " + p.status); st.append(el("span", "dot"), document.createTextNode(p.label || p.status));
    app.append(back, cmd, el("h2", "", p.name), st, el("p", "tela-text", p.text));
    if (p.link) { var a = el("a", "tela-link", "abrir ↗"); a.href = p.link; a.rel = "noopener"; a.target = "_blank"; app.append(a); }
    body.classList.add("reading"); body.append(app); body.scrollTop = 0; path.textContent = "~/felipe/projetos/" + slug(p.name); back.focus({ preventScroll: true });
  }
  function close(silent) {
    if (!app) return; app.remove(); app = null; body.classList.remove("reading"); path.textContent = "~/felipe/projetos";
    if (!silent && cards[sel]) cards[sel].focus({ preventScroll: true });
  }

  // teclado: só quando a tela está ativa
  addEventListener("keydown", function (e) {
    if (!tela.classList.contains("on")) return;
    if (e.key === "Escape" && app) { e.preventDefault(); close(); return; }
    if (app) return;
    var cols = getComputedStyle(list).gridTemplateColumns.split(" ").length || 1, d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    if (d) { e.preventDefault(); mark(sel + d); cards[sel].focus({ preventScroll: true }); }
  });

  // rolagem: a roda rola a tela do computador; no topo dela, rolar para cima volta para a página (sai do computador)
  tela.addEventListener("wheel", function (e) {
    var atTop = body.scrollTop <= 0, atEnd = body.scrollTop + body.clientHeight >= body.scrollHeight - 1;
    if (e.deltaY < 0 && atTop) return;                               // deixa a página rolar para cima
    e.preventDefault(); if (!(e.deltaY > 0 && atEnd)) body.scrollTop += e.deltaY;
  }, { passive: false });
  // prompt no fim da tela, como no terminal do computador dele
  var prompt = el("p", "tela-prompt"); prompt.setAttribute("aria-hidden", "true"); prompt.innerHTML = '$ <b>_</b>'; body.append(prompt);

  // botão vermelho da janela: sai do computador e volta para a sala da cabana, com o pinguim diante do computador
  var exit = tela.querySelector(".win-close");
  if (exit) exit.addEventListener("click", function () {
    close(true);
    var top = window.Stage && window.Stage.insideAt ? window.Stage.insideAt(0.4) : 0;
    scrollTo({ top: top, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
  mark(0);
})();
