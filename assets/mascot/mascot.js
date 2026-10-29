/*!
 * Mascot — animação procedural do pinguim (JS puro, sem bibliotecas).
 *
 * Como funciona: o SVG vetorial (mascot-art.svg) é carregado e injetado inline;
 * a cada frame (requestAnimationFrame) calculamos a pose de cada parte e
 * escrevemos o atributo `transform` dos grupos (#body, #head, #beak, #eyes,
 * #arm-left/right, #lid-left/right, #shadow, #foot-*).
 *
 * Princípios de animação usados:
 *  - Molas amortecidas (Spring) em quase tudo => follow-through e overlap:
 *    a cabeça atrasa em relação ao corpo, bico e olhos atrasam em relação à cabeça,
 *    o braço passa do ponto e assenta.
 *  - Antecipação no aceno (braço recua um pouco antes de subir).
 *  - Curvas de easing (nada linear); intervalos de piscar aleatórios.
 *
 * API: window.Mascot = { init, play, onClick, destroy, CONFIG }
 *   <div data-mascot></div> é inicializado automaticamente.
 */
(function () {
  'use strict';

  /* ======================================================================
   * CONFIG — ajuste aqui. Ângulos em graus, tempos em segundos, distâncias
   * em unidades do viewBox do SVG (1324 x 2493).
   * ====================================================================== */
  var CONFIG = {
    src: null,               // URL do SVG; null => "mascot-art.svg" ao lado deste script
    width: null,             // largura do mascote: número (px), string CSS ('40vw') ou null = 100% do contêiner
    height: null,            // idem para altura (null = automática, proporcional)
    speed: 1,                // multiplicador global de velocidade (0.5 = metade, 2 = dobro)
    autoplay: 'idle',        // modo inicial
    clickToWave: true,       // clicar no mascote dispara o aceno
    respectReducedMotion: true, // prefers-reduced-motion => pose estática
    pauseOffscreen: true,    // pausa o loop quando fora da tela / aba oculta

    breathe: {
      period: 4.2,           // duração de um ciclo de respiração
      amp: 0.015,            // scaleY do corpo: 1 -> 1+amp
      volume: 0.3,           // quanto o corpo "afina" (scaleX) ao esticar (0..1)
      headLag: 3.2,          // Hz da mola da cabeça seguindo o corpo (menor = mais atraso)
      armLag: 4.5            // idem para ombros/braços
    },

    sway: {                  // balanço de cabeça no idle
      angle: 1.1,            // graus
      period: 6.4,           // s
      angle2: 0.5,           // segunda onda (incomensurável => orgânico)
      period2: 3.7,
      eyeShift: 3            // deslocamento lateral dos olhos junto ao balanço (unid.)
    },

    blink: {
      min: 2.0, max: 5.0,    // intervalo entre piscadas
      doubleChance: 0.2,     // chance de piscada dupla
      close: 0.075,          // tempo fechando
      hold: 0.03,            // tempo fechado
      open: 0.12,            // tempo abrindo
      doubleGap: 0.2,        // atraso da segunda piscada da dupla
      lidTravel: 120         // distância que a pálpebra percorre (igual ao SVG)
    },

    wave: {
      arm: 'left',           // 'left' = braço à esquerda de quem vê, 'right' = à direita
      anticipation: 0.22,    // s: braço recua antes de subir
      anticipationAngle: 4,  // graus (para dentro)
      raise: 0.42,           // s: subida
      raiseAngle: 40,        // graus: braço levantado (testado limpo até ~55; acima disso confira o ombro)
      swings: 4,             // número de oscilações
      swingFreq: 3.3,        // Hz
      swingAmp: 10,          // graus (primeira oscilação)
      swingDecay: 1.0,       // amortecimento exponencial (1/s)
      ret: 0.65,             // s: volta ao repouso
      settle: 0.5,           // s extras para assentar antes de encerrar
      headTilt: 3.2,         // graus de inclinação da cabeça (para o lado do braço)
      armSpring: [6.5, 0.62] // [Hz, razão de amortecimento] da mola do braço
    },

    speak: {
      syllable: [0.09, 0.19],// duração de cada "sílaba" (s)
      pauseChance: 0.18,     // chance de pausa entre palavras
      pause: [0.2, 0.55],
      openRange: [0.4, 1],   // abertura por sílaba
      beakScaleY: 0.11,      // quanto o bico "abre" (scaleY)
      beakShift: 8,          // e desce (unid.)
      beakPivotY: 494,       // pivô vertical do scaleY do bico
      nod: 4,                // cabeça desce na sílaba (unid.)
      headAngle: 1.8,        // graus de movimentos aleatórios de cabeça
      headEvery: [0.6, 1.3]  // intervalo entre novos alvos de cabeça
    },

    feet: { shift: 0.6 }     // graus de transferência de peso nos tornozelos durante o aceno
  };

  /* ---------------- pivôs (iguais aos data-pivot do SVG) ---------------- */
  var P = {
    body: [662, 1694], head: [664, 754], armL: [259, 944], armR: [1049, 944],
    footL: [364, 2234], footR: [964, 2234], shadow: [662, 2369]
  };

  /* ---------------- utilidades ---------------- */
  var TAU = Math.PI * 2;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(r) { return rand(r[0], r[1]); }
  function f(n) { return n.toFixed(3); }
  var ease = {
    inQuad: function (t) { return t * t; },
    outQuad: function (t) { return 1 - (1 - t) * (1 - t); },
    inOutCubic: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    inOutSine: function (t) { return .5 - .5 * Math.cos(Math.PI * t); }
  };
  function merge(base, over) {
    var o = {}, k;
    for (k in base) o[k] = base[k];
    for (k in (over || {})) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k]) o[k] = merge(base[k], over[k]);
      else o[k] = over[k];
    }
    return o;
  }

  /** Mola amortecida (integração semi-implícita com sub-passos). */
  function Spring(freq, zeta, x0) {
    this.set(freq, zeta);
    this.x = x0 || 0; this.v = 0; this.target = this.x;
  }
  Spring.prototype.set = function (freq, zeta) { this.w = TAU * freq; this.z = zeta; };
  Spring.prototype.step = function (dt) {
    var n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n, w2 = this.w * this.w, c = 2 * this.z * this.w;
    for (var i = 0; i < n; i++) {
      this.v += (-w2 * (this.x - this.target) - c * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  };

  /* ======================================================================
   * Instância
   * ====================================================================== */
  function Instance(container, opts) {
    var C = this.C = merge(CONFIG, opts);
    this.container = container;
    this.mode = 'idle';          // 'idle' | 'speaking'
    this.clickCbs = [];
    this.destroyed = false;
    this.running = false;
    this.visible = true;
    this.t = 0;
    this.last = 0;
    this.pending = C.autoplay;
    this.reduced = C.respectReducedMotion && window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.els = {};
    var self = this;
    this.ready = this._load().then(function () { self._setup(); return self; });
  }

  Instance.prototype._load = function () {
    var self = this, src = this.C.src || defaultSrc();
    return fetch(src).then(function (r) {
      if (!r.ok) throw new Error('Mascot: não consegui carregar ' + src + ' (' + r.status + ')');
      return r.text();
    }).then(function (txt) {
      var doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
      var svg = document.importNode(doc.documentElement, true);
      svg.removeAttribute('width'); svg.removeAttribute('height');
      var C = self.C;
      svg.style.display = 'block';
      svg.style.overflow = 'visible';
      svg.style.width = C.width == null ? '100%' : (typeof C.width === 'number' ? C.width + 'px' : C.width);
      svg.style.height = C.height == null ? 'auto' : (typeof C.height === 'number' ? C.height + 'px' : C.height);
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Mascote pinguim');
      self.container.appendChild(svg);
      self.svg = svg;
    });
  };

  Instance.prototype._setup = function () {
    if (this.destroyed) return;
    var q = this.svg, ids = ['shadow', 'foot-left', 'foot-right', 'body', 'arm-left', 'arm-right',
      'head', 'beak', 'eyes', 'lid-left', 'lid-right'];
    for (var i = 0; i < ids.length; i++) this.els[ids[i]] = q.querySelector('#' + ids[i]);
    var self = this, C = this.C;

    // molas (estado de movimento)
    this.sBreath = new Spring(C.breathe.headLag, 0.7, 0);   // respiração atrasada p/ cabeça
    this.sBreathArm = new Spring(C.breathe.armLag, 0.7, 0);
    this.sBreathEye = new Spring(C.breathe.headLag * 0.85, 0.7, 0);
    this.sExtra = new Spring(5, 0.5, 0);                    // "pulinho" do corpo no aceno
    this.sHead = new Spring(3.0, 0.5, 0);                   // rotação da cabeça
    this.sEyesRot = new Spring(4.6, 0.6, 0);
    this.sBeakRot = new Spring(4.0, 0.6, 0);
    this.sEyeX = new Spring(3.5, 0.8, 0);
    this.sNod = new Spring(7, 0.55, 0);
    this.sArmW = new Spring(C.wave.armSpring[0], C.wave.armSpring[1], 0); // braço que acena
    this.sArmIdle = new Spring(2.5, 0.5, 0);
    this.sMouth = new Spring(14, 0.55, 0);
    this.sSpeak = new Spring(3, 1, 0);                      // 0..1: quanto está "falando"
    this.sFoot = new Spring(3, 0.6, 0);
    this.sTot = 0; this.waveWin = 0;

    // estado de eventos
    this.blinks = [];
    this.nextBlink = 1.2 + rand(C.blink.min, C.blink.max) * 0.5;
    this.wave = null;               // {t0}
    this.syl = { end: 0, open: 0 };
    this.headTarget = { v: 0, next: 0 };

    this.svg.style.cursor = C.clickToWave ? 'pointer' : '';
    this._onClick = function (e) {
      if (e.target === self.svg) return;          // clique no "vazio" não conta
      if (self.C.clickToWave) self.play('wave');
      for (var i = 0; i < self.clickCbs.length; i++) try { self.clickCbs[i](e); } catch (err) { console.error(err); }
    };
    this.svg.addEventListener('click', this._onClick);

    // reduced motion (reage a mudanças)
    if (C.respectReducedMotion && window.matchMedia) {
      this._mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this._onMq = function () { self.reduced = self._mq.matches; self.reduced ? self._pose(true) : self._start(); };
      if (this._mq.addEventListener) this._mq.addEventListener('change', this._onMq);
    }

    // pausa fora da tela
    if (C.pauseOffscreen) {
      if ('IntersectionObserver' in window) {
        this._io = new IntersectionObserver(function (en) {
          self.visible = en[0].isIntersecting;
          self.visible ? self._start() : (self.running = false);
        });
        this._io.observe(this.svg);
      }
    }

    this._frame = function (now) { self._tick(now); };
    this._pose(true);
    if (this.pending) { var p = this.pending; this.pending = null; this.play(p); }
    this._start();
  };

  Instance.prototype._start = function () {
    if (this.destroyed || this.reduced || this.running || !this.visible || !this.svg) return;
    this.running = true; this.last = 0;
    requestAnimationFrame(this._frame);
  };

  Instance.prototype.play = function (name) {
    if (!this.svg) { this.pending = name; return this; }
    if (this.reduced) return this;
    if (name === 'wave') {
      if (!this.wave) this.wave = { t0: this.t };
    } else if (name === 'speaking' || name === 'idle') {
      this.mode = name;
    }
    this._start();
    return this;
  };

  Instance.prototype.onClick = function (cb) { if (typeof cb === 'function') this.clickCbs.push(cb); return this; };

  Instance.prototype.destroy = function () {
    this.destroyed = true; this.running = false;
    if (this._io) this._io.disconnect();
    if (this._mq && this._mq.removeEventListener) this._mq.removeEventListener('change', this._onMq);
    if (this.svg) { this.svg.removeEventListener('click', this._onClick); this.svg.remove(); }
    this.clickCbs = []; this.svg = null;
  };

  /* ---------------- loop ---------------- */
  Instance.prototype._tick = function (now) {
    if (this.destroyed || !this.running) return;
    var dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    dt *= this.C.speed;
    this.t += dt;
    this._update(dt);
    this._pose(false);
    requestAnimationFrame(this._frame);
  };

  /** Evolui alvos e molas. */
  Instance.prototype._update = function (dt) {
    var C = this.C, t = this.t, B = C.breathe, S = C.sway;

    /* respiração: inspira mais devagar que expira (fase deformada) */
    var ph = (t / B.period) % 1;
    ph += 0.07 * Math.sin(TAU * ph);
    var breath = .5 - .5 * Math.cos(TAU * ph);            // 0..1

    /* aceno */
    var w = this._waveTargets(t);
    this.waveWin = w.win;
    var extra = w.body;

    var sTot = B.amp * breath + extra;                    // excesso de escala em Y
    this.sTot = sTot;
    this.sBreath.target = sTot; this.sBreath.step(dt);
    this.sBreathArm.target = sTot; this.sBreathArm.step(dt);
    this.sBreathEye.target = sTot; this.sBreathEye.step(dt);
    this.sExtra.target = extra; this.sExtra.step(dt);

    /* fala */
    this.sSpeak.target = this.mode === 'speaking' ? 1 : 0; this.sSpeak.step(dt);
    var sp = this.sSpeak.x, SP = C.speak;
    if (this.mode === 'speaking') {
      if (t >= this.syl.end) {
        if (Math.random() < SP.pauseChance) { this.syl.open = 0; this.syl.end = t + pick(SP.pause); }
        else { this.syl.open = pick(SP.openRange); this.syl.end = t + pick(SP.syllable); }
      }
      if (t >= this.headTarget.next) {
        this.headTarget.v = rand(-SP.headAngle, SP.headAngle);
        this.headTarget.next = t + pick(SP.headEvery);
      }
    } else { this.syl.open = 0; this.headTarget.v = 0; }
    this.sMouth.target = this.syl.open; this.sMouth.step(dt);
    this.sNod.target = this.syl.open * SP.nod; this.sNod.step(dt);

    /* cabeça: balanço idle + tilt do aceno + alvos da fala */
    var sway = S.angle * Math.sin(TAU * t / S.period) + S.angle2 * Math.sin(TAU * t / S.period2 + 1.3);
    this.sHead.target = sway + w.tilt + this.headTarget.v * sp; this.sHead.step(dt);
    // olhos e bico seguem a cabeça com mais atraso (overlap)
    this.sEyesRot.target = this.sHead.x; this.sEyesRot.step(dt);
    this.sBeakRot.target = this.sHead.x; this.sBeakRot.step(dt);
    this.sEyeX.target = (sway / (S.angle + S.angle2)) * S.eyeShift + this.headTarget.v * 0.8 * sp;
    this.sEyeX.step(dt);

    /* braços */
    this.sArmW.target = w.arm; this.sArmW.step(dt);
    this.sArmIdle.target = breath * 0.45 + 0.2 * Math.sin(TAU * t / 5.1); this.sArmIdle.step(dt);
    this.sFoot.target = w.win * C.feet.shift; this.sFoot.step(dt);

    /* piscar */
    if (t >= this.nextBlink) {
      var Bk = C.blink;
      this.blinks.push(t);
      if (Math.random() < Bk.doubleChance) this.blinks.push(t + Bk.doubleGap);
      this.nextBlink = t + Bk.doubleGap + rand(Bk.min, Bk.max);
    }
  };

  /** Alvos do aceno em função do tempo: braço, tilt de cabeça, "pulinho" do corpo. */
  Instance.prototype._waveTargets = function (t) {
    var W = this.C.wave, out = { arm: 0, tilt: 0, body: 0, win: 0 };
    if (!this.wave) return out;
    var s = W.arm === 'right' ? -1 : 1;           // sinal: + = braço esquerdo para fora
    var tau = t - this.wave.t0;
    var tA = W.anticipation, tR = tA + W.raise, tS = tR + W.swings / W.swingFreq, tE = tS + W.ret;
    var a, osc = 0;
    if (tau < tA) {
      a = -W.anticipationAngle * ease.outQuad(tau / tA);
      out.body = -0.006 * ease.outQuad(tau / tA);                   // agacha de leve
    } else if (tau < tR) {
      var u = (tau - tA) / W.raise;
      a = lerp(-W.anticipationAngle, W.raiseAngle, ease.inOutCubic(u));
      out.body = lerp(-0.006, 0.004, ease.inOutCubic(u));          // estica ao subir
    } else if (tau < tS) {
      var q = tau - tR;
      osc = W.swingAmp * Math.exp(-W.swingDecay * q) * Math.sin(TAU * W.swingFreq * q);
      a = W.raiseAngle + osc;
      out.body = 0.004 * Math.exp(-3 * q);
    } else if (tau < tE) {
      var r = (tau - tS) / W.ret;
      a = W.raiseAngle * (1 - ease.inOutCubic(r));
    } else {
      a = 0;
      if (tau > tE + W.settle) this.wave = null;
    }
    out.arm = s * a;
    // janela 0..1 do tilt: sobe depois da antecipação, desce na volta
    var win = ease.inOutSine(clamp((tau - 0.1) / 0.5, 0, 1)) * (1 - ease.inOutSine(clamp((tau - tS) / W.ret, 0, 1)));
    out.win = win;
    out.tilt = -s * W.headTilt * win + (-s) * 0.12 * osc;     // inclina para o lado do braço
    return out;
  };

  /** Nível de pálpebra fechada (0 aberta .. 1 fechada) em função das piscadas ativas. */
  Instance.prototype._lid = function () {
    var Bk = this.C.blink, t = this.t, best = 0, keep = [];
    for (var i = 0; i < this.blinks.length; i++) {
      var d = t - this.blinks[i], c = 0;
      if (d < 0) { keep.push(this.blinks[i]); continue; }
      if (d < Bk.close) c = ease.inQuad(d / Bk.close);
      else if (d < Bk.close + Bk.hold) c = 1;
      else if (d < Bk.close + Bk.hold + Bk.open) c = 1 - ease.outQuad((d - Bk.close - Bk.hold) / Bk.open);
      else continue;
      keep.push(this.blinks[i]);
      if (c > best) best = c;
    }
    this.blinks = keep;
    return best;
  };

  /** Escreve os transforms no SVG. `still` = pose estática (reduced motion / início). */
  Instance.prototype._pose = function (still) {
    var E = this.els, C = this.C, B = C.breathe, SP = C.speak;
    function set(el, v) { if (el) { v ? el.setAttribute('transform', v) : el.removeAttribute('transform'); } }
    if (still && (this.reduced || !this.sBreath)) {
      for (var k in E) if (E[k] && k.indexOf('lid') !== 0) E[k].removeAttribute('transform');
      return;
    }
    // dy de um ponto à altura y quando o corpo escala em Y por (1+e) em torno de 1694
    function dyAt(e, y) { return e * (y - P.body[1]); }

    var eBody = this.sTot, vol = 1 - eBody * B.volume;
    set(E.body, 'translate(' + P.body[0] + ' ' + P.body[1] + ') scale(' + f(vol) + ' ' + f(1 + eBody) + ') translate(' + -P.body[0] + ' ' + -P.body[1] + ')');

    // cabeça
    var hy = dyAt(this.sBreath.x, P.head[1]) + this.sNod.x;
    set(E.head, 'translate(0 ' + f(hy) + ') rotate(' + f(this.sHead.x) + ' ' + P.head[0] + ' ' + P.head[1] + ')');
    // bico (abre-fecha por scaleY em torno do topo + desce)
    var m = this.sMouth.x, by = hy + dyAt(this.sBreathEye.x - this.sBreath.x, P.head[1]);
    set(E.beak, 'translate(0 ' + f(by + m * SP.beakShift) + ') rotate(' + f(this.sBeakRot.x) + ' ' + P.head[0] + ' ' + P.head[1] + ') ' +
      'translate(' + P.head[0] + ' ' + SP.beakPivotY + ') scale(' + f(1 - m * 0.015) + ' ' + f(1 + m * SP.beakScaleY) +
      ') translate(' + -P.head[0] + ' ' + -SP.beakPivotY + ')');
    // olhos
    set(E.eyes, 'translate(' + f(this.sEyeX.x) + ' ' + f(by) + ') rotate(' + f(this.sEyesRot.x) + ' ' + P.head[0] + ' ' + P.head[1] + ')');

    // pálpebras
    var lid = still ? 0 : this._lid(), ty = -C.blink.lidTravel * (1 - lid);
    var lt = 'translate(0 ' + f(ty) + ')';
    if (E['lid-left']) E['lid-left'].setAttribute('transform', lt);
    if (E['lid-right']) E['lid-right'].setAttribute('transform', lt);

    // braços: o que acena + o outro com sway sutil de follow-through
    var armDy = dyAt(this.sBreathArm.x, P.armL[1]);
    var wv = C.wave.arm === 'right' ? 'right' : 'left';
    var idle = this.sArmIdle.x;
    var aL = (wv === 'left' ? this.sArmW.x : 0) + idle;
    var aR = (wv === 'right' ? this.sArmW.x : 0) - idle;
    set(E['arm-left'], 'translate(0 ' + f(armDy) + ') rotate(' + f(aL) + ' ' + P.armL[0] + ' ' + P.armL[1] + ')');
    set(E['arm-right'], 'translate(0 ' + f(armDy) + ') rotate(' + f(aR) + ' ' + P.armR[0] + ' ' + P.armR[1] + ')');

    // pés (transferência de peso) e sombra
    var fa = this.sFoot.x, sgn = wv === 'left' ? 1 : -1;
    set(E['foot-left'], 'rotate(' + f(fa * sgn) + ' ' + P.footL[0] + ' ' + P.footL[1] + ')');
    set(E['foot-right'], 'rotate(' + f(-fa * sgn) + ' ' + P.footR[0] + ' ' + P.footR[1] + ')');
    var ss = 1 + eBody * 0.8;
    set(E.shadow, 'translate(' + P.shadow[0] + ' ' + P.shadow[1] + ') scale(' + f(ss) + ' ' + f(1 - eBody * 0.4) + ') translate(' + -P.shadow[0] + ' ' + -P.shadow[1] + ')');
  };

  /* ======================================================================
   * API global
   * ====================================================================== */
  var scriptSrc = document.currentScript && document.currentScript.src;
  function defaultSrc() { return scriptSrc ? new URL('mascot-art.svg', scriptSrc).href : 'mascot-art.svg'; }

  var main = null;
  var Mascot = {
    CONFIG: CONFIG,
    /** Cria um mascote dentro de `el` (elemento ou seletor). Retorna a instância (com .ready). */
    init: function (el, opts) {
      if (typeof el === 'string') el = document.querySelector(el);
      if (!el) throw new Error('Mascot.init: contêiner não encontrado');
      var inst = new Instance(el, opts);
      if (!main) main = inst;
      return inst;
    },
    play: function (name) { if (main) main.play(name); return Mascot; },
    onClick: function (cb) { if (main) main.onClick(cb); return Mascot; },
    destroy: function () { if (main) { main.destroy(); main = null; } }
  };
  window.Mascot = Mascot;

  function auto() {
    var el = document.querySelector('[data-mascot]');
    if (el && !main) Mascot.init(el);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})();
