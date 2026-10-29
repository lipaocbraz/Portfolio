(function () {
  var C = window.CONTENT || {};
  var $ = function (id) { return document.getElementById(id); };
  var fmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
  var fmtFull = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" });
  function d(s) { return new Date(s + "T12:00:00"); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  if (C.updated) { var t = $("updated"); t.textContent = fmtFull.format(d(C.updated)).replace(".", ""); t.dateTime = C.updated; }
  $("year").textContent = new Date().getFullYear();

  (C.agora || []).forEach(function (a) {
    var c = el("article", "card");
    c.append(el("p", "tag", a.tag), el("h3", "", a.title), el("p", "muted", a.text));
    $("agora-list").append(c);
  });

  (C.projetos || []).forEach(function (p, i) {
    var c = el("article", "card project" + (i === 0 ? " wide" : ""));
    c.append(el("div", "preview"));
    var s = el("p", "status " + p.status); s.append(el("span", "dot"), document.createTextNode(p.label || p.status));
    var h = el("h3"); if (p.link) { var a = el("a", "", p.name); a.href = p.link; a.rel = "noopener"; h.append(a); } else { h.textContent = p.name; }
    c.append(s, h, el("p", "muted", p.text));
    $("projetos-list").append(c);
  });

  (C.projetos || []).forEach(function (p) { $("resumo-list").append(el("li", "", p.name)); });

  var notas = $("notas-list");
  if (!(C.notas || []).length) {
    notas.append(el("li", "empty", "Os primeiros textos estão a caminho."));
  } else {
    C.notas.forEach(function (n) {
      var li = el("li", "row");
      var title = n.link ? (function () { var a = el("a", "", n.title); a.href = n.link; return a; })() : el("span", "", n.title);
      var meta = el("span", "meta"); meta.append(el("span", "tag", n.tag || ""), el("time", "", n.date ? fmt.format(d(n.date)).replace(".", "") : ""));
      li.append(title, meta); notas.append(li);
    });
  }

  (C.log || []).forEach(function (l) {
    var li = el("li", "log-row");
    var tm = el("time", "", fmt.format(d(l.date)).replace(".", "")); tm.dateTime = l.date;
    li.append(tm, el("span", "", l.text)); $("log-list").append(li);
  });
})();
