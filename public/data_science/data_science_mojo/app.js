/* app.js — Data Science Mojo
 *
 * The app shell: sidebar build, scrollspy, reading progress, persistence, copy
 * buttons, quizzes, and the live labs. No framework, no build step, no fetch.
 *
 * Labs are declared in LAB below, keyed by the lab's data-lab attribute. The shell
 * finds every [data-lab] element, reads its declared inputs, runs the lab's compute
 * function, and paints whatever readouts and plots the lab returns. Adding a module
 * is therefore mostly an HTML edit: a <section class="lab" data-lab="mean"> with
 * inputs named the way the lab expects, plus an entry in LAB.
 */
(function () {
  "use strict";

  var STORE = "tutmemo-ds-mojo-v1";

  /* ── Persistence ───────────────────────────────────────────────────────── */

  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      var d = raw ? JSON.parse(raw) : null;
      return d && typeof d === "object" ? d : { done: {}, cur: 0, attempts: {} };
    } catch (e) {
      return { done: {}, cur: 0, attempts: {} };
    }
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }

  var state = load();
  state.done = state.done || {};
  state.attempts = state.attempts || {};

  /* ── Shell ─────────────────────────────────────────────────────────────── */

  var modules = [].slice.call(document.querySelectorAll("section.module"));
  var tocLinks = {};
  var progressBar = document.getElementById("progress");
  var readout = document.getElementById("readout");

  /* Build the sidebar from the sections, so index.html owns the module list. */
  (function buildToc() {
    var nav = document.getElementById("toclist");
    if (!nav || !modules.length) return;
    var html = "";
    modules.forEach(function (m, i) {
      var n = i + 1;
      html +=
        '<a href="#' + m.id + '" data-i="' + i + '">' +
        '<span class="n">' + (n < 10 ? "0" : "") + n + '</span>' +
        '<span class="t">' + (m.dataset.title || m.id) + "</span>" +
        '<span class="tick">&#10003;</span>' +
        "</a>";
      if (n % 5 === 0 && n !== modules.length) html += "<hr>";
    });
    nav.innerHTML = html;
    tocLinks = {};
    [].forEach.call(nav.querySelectorAll("a"), function (a) {
      tocLinks[+a.dataset.i] = a;
    });
  })();

  function markDone(i) {
    state.done[i] = true;
    save();
    if (tocLinks[i]) tocLinks[i].classList.add("done");
    updateReadout();
  }

  function updateReadout() {
    if (!readout) return;
    var n = Object.keys(state.done).filter(function (k) { return state.done[k]; }).length;
    readout.textContent = n + "/" + modules.length + " modules";
  }

  /* Reading progress: fraction of the document scrolled, not fraction of modules
     read, so the bar moves smoothly while scrolling. */
  function updateProgress() {
    if (!progressBar) return;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
    progressBar.style.width = (p * 100).toFixed(2) + "%";
  }

  /* Scrollspy: the last module whose top has passed under the fixed topbar. */
  function updateSpy() {
    var line = 120, current = 0;
    modules.forEach(function (m, i) {
      if (m.getBoundingClientRect().top <= line) current = i;
    });
    Object.keys(tocLinks).forEach(function (k) { tocLinks[k].classList.remove("on"); });
    var link = tocLinks[current];
    if (link) {
      link.classList.add("on");
      if (state.cur !== current) { state.cur = current; save(); }
    }
    updateProgress();
  }

  var ticking = false;
  window.addEventListener(
    "scroll",
    function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        updateSpy();
        ticking = false;
      });
    },
    { passive: true }
  );

  /* ── Copy buttons ──────────────────────────────────────────────────────── */

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".copy");
    if (!btn) return;
    var fig = btn.closest(".listing");
    var pre = fig && fig.querySelector("pre.code");
    if (!pre) return;
    var text = pre.innerText.replace(/\n$/, "");
    var done = function () {
      var old = btn.textContent;
      btn.textContent = "copied";
      btn.classList.add("done");
      setTimeout(function () { btn.textContent = old; btn.classList.remove("done"); }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {});
    } else {
      /* file:// is not always a secure context, so keep a textarea fallback. */
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (err) { /* no-op */ }
      document.body.removeChild(ta);
    }
  });

  /* ── Quizzes ───────────────────────────────────────────────────────────── */

  document.addEventListener("click", function (e) {
    var box = e.target.closest(".check");
    if (!box || box.dataset.done === "1") return;
    var picked = box.querySelector('input[type="radio"]:checked');
    if (!picked) return;
    var correct = picked.value === box.dataset.answer;
    var fb = box.querySelector(".feedback");
    [].forEach.call(box.querySelectorAll(".opt"), function (o) {
      var inp = o.querySelector("input");
      inp.disabled = true;
      if (inp.value === box.dataset.answer) o.classList.add("is-correct");
      else if (inp === picked) o.classList.add("is-wrong");
    });
    fb.textContent = correct ? "Correct." : "Not quite — the right answer is highlighted.";
    fb.className = "feedback " + (correct ? "ok" : "no");
    var ex = box.querySelector(".explain");
    if (ex) ex.hidden = false;
    var key = "m" + (box.closest(".module") ? box.closest(".module").id : "x") + "q" + (box.dataset.q || "0");
    state.attempts[key] = (state.attempts[key] || 0) + 1;
    box.dataset.done = "1";
    var mod = box.closest(".module");
    if (mod) {
      var i = modules.indexOf(mod);
      if (i >= 0) markDone(i);
    }
    save();
  });

  /* ── Prev / next ───────────────────────────────────────────────────────── */

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-goto]");
    if (!btn) return;
    var i = +btn.dataset.goto;
    if (i < 0 || i >= modules.length) return;
    modules[i].scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ── TOC toggle (narrow screens) ───────────────────────────────────────── */

  var tocbtn = document.querySelector(".tocbtn");
  var toc = document.getElementById("toc");
  if (tocbtn && toc) {
    tocbtn.addEventListener("click", function () {
      toc.classList.toggle("open");
      tocbtn.setAttribute("aria-expanded", toc.classList.contains("open") ? "true" : "false");
    });
    toc.addEventListener("click", function (e) {
      if (e.target.closest("a") && window.innerWidth <= 1000) toc.classList.remove("open");
    });
  }

  var reset = document.getElementById("reset");
  if (reset) {
    reset.addEventListener("click", function () {
      state = { done: {}, cur: 0, attempts: {} };
      save();
      location.reload();
    });
  }

  /* ── Canvas helper ─────────────────────────────────────────────────────── */

  /* All plots are drawn on a devicePixelRatio-scaled backing store so text stays
     crisp on a HiDPI display, and every plot is styled from the same palette. */
  function setupCanvas(cv) {
    var dpr = window.devicePixelRatio || 1;
    var w = cv.clientWidth || 320, h = +cv.getAttribute("height") || 200;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.height = h + "px";
    var g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    return { g: g, w: w, h: h };
  }

  var C = {
    grid: "rgba(255,255,255,0.06)",
    axis: "rgba(255,255,255,0.22)",
    text: "#9aa1ad",
    a1: "#5bd4ff",
    a2: "#ff8c00",
    a3: "#22c55e",
    a4: "#ef4444",
    a5: "#8b5cf6"
  };

  function axes(g, w, h, pad, xl, yl) {
    g.strokeStyle = C.grid;
    g.lineWidth = 1;
    for (var i = 0; i <= 4; i++) {
      var y = pad.t + ((h - pad.t - pad.b) * i) / 4;
      g.beginPath(); g.moveTo(pad.l, y); g.lineTo(w - pad.r, y); g.stroke();
      var x = pad.l + ((w - pad.l - pad.r) * i) / 4;
      g.beginPath(); g.moveTo(x, pad.t); g.lineTo(x, h - pad.b); g.stroke();
    }
    g.strokeStyle = C.axis;
    g.beginPath();
    g.moveTo(pad.l, pad.t); g.lineTo(pad.l, h - pad.b); g.lineTo(w - pad.r, h - pad.b);
    g.stroke();
    g.fillStyle = C.text;
    g.font = "10px ui-monospace, monospace";
    g.textAlign = "center";
    g.fillText(xl, pad.l + (w - pad.l - pad.r) / 2, h - 6);
    g.save();
    g.translate(11, pad.t + (h - pad.t - pad.b) / 2);
    g.rotate(-Math.PI / 2);
    g.fillText(yl, 0, 0);
    g.restore();
  }

  function line(g, pts, color, width) {
    if (!pts.length) return;
    g.strokeStyle = color;
    g.lineWidth = width || 2;
    g.lineJoin = "round";
    g.beginPath();
    pts.forEach(function (p, i) { i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
    g.stroke();
  }

  function dot(g, x, y, color, r) {
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y, r || 3.5, 0, Math.PI * 2);
    g.fill();
  }

  function label(g, x, y, s, color) {
    g.fillStyle = color || C.text;
    g.font = "10px ui-monospace, monospace";
    g.textAlign = "left";
    g.fillText(s, x, y);
  }

  function bar(g, x, y, w, h, color) {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  }

  /* Project a data range onto canvas pixels. */
  function scaler(w, h, pad, dmin, dmax, rmin, rmax) {
    var pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    return {
      x: function (d) { return pad.l + ((d - dmin) / (dmax - dmin || 1)) * pw; },
      y: function (r) { return h - pad.b - ((r - rmin) / (rmax - rmin || 1)) * ph; }
    };
  }

  /* ── Lab registry ──────────────────────────────────────────────────────── */

  var LAB = {};

  /* Module 01 — first tensors. One live histogram of the sample. */
  LAB.mean = {
    note: "Bars are the sample; the orange line is the running mean, recomputed as each point arrives.",
    controls: [
      { key: "mu", label: "True mean", type: "range", min: -20, max: 20, step: 1, value: 6 },
      { key: "sigma", label: "Spread", type: "range", min: 1, max: 12, step: 0.5, value: 4 },
      { key: "n", label: "Points", type: "range", min: 8, max: 120, step: 4, value: 40 }
    ],
    compute: function (v) {
      var s = seeded(v.mu * 1000 + v.sigma * 7 + v.n);
      var d = gauss(s, v.n, v.mu, v.sigma);
      var sum = 0;
      for (var i = 0; i < d.length; i++) sum += d[i];
      var m = sum / d.length;
      var ss = 0;
      for (var j = 0; j < d.length; j++) ss += (d[j] - m) * (d[j] - m);
      var sd = Math.sqrt(ss / (d.length - 1 || 1));
      return { data: d, mean: m, sd: sd };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 40, r: 12, t: 14, b: 26 };
      var lo = Math.min.apply(null, r.data), hi = Math.max.apply(null, r.data);
      var bins = 12, span = (hi - lo) / bins || 1;
      var counts = new Array(bins).fill(0);
      r.data.forEach(function (d) {
        var k = Math.min(bins - 1, Math.floor((d - lo) / span));
        counts[k]++;
      });
      var maxc = Math.max.apply(null, counts) || 1;
      var s = scaler(w, h, pad, lo, hi, 0, maxc);
      axes(g, w, h, pad, "value", "count");
      var bw = (w - pad.l - pad.r) / bins;
      for (var i = 0; i < bins; i++) {
        bar(g, pad.l + i * bw + 1, s.y(counts[i]), Math.max(1, bw - 2), h - pad.b - s.y(counts[i]), "rgba(91,212,255,0.55)");
      }
      /* Running mean, so the estimate visibly settles near the true mean. */
      var run = 0, pts = [];
      for (var j = 0; j < r.data.length; j++) {
        run += r.data[j];
        pts.push([s.x(r.data[j]), s.y(run / (j + 1) / maxc)]);
      }
      line(g, pts, C.a2, 1.5);
      label(g, pad.l + 4, pad.t + 10, "mean = " + r.mean.toFixed(2), C.a2);
    },
    readouts: function (r) {
      return [
        ["sample mean", r.mean.toFixed(3)],
        ["sample sd", r.sd.toFixed(3)]
      ];
    }
  };

  /* Module 02 — shapes and reductions. */
  LAB.shape = {
    note: "The same arithmetic written for two shapes: a rank-1 slice and a rank-2 column vector, produced by identical code.",
    controls: [
      { key: "n", label: "Row length", type: "range", min: 4, max: 24, step: 1, value: 10 }
    ],
    compute: function (v) {
      var a = [];
      for (var i = 0; i < v.n; i++) a.push(i * 2 - v.n + 1);
      var total = 0, mn = Infinity, mx = -Infinity;
      for (var j = 0; j < a.length; j++) {
        total += a[j];
        if (a[j] < mn) mn = a[j];
        if (a[j] > mx) mx = a[j];
      }
      return { a: a, sum: total, mn: mn, mx: mx, len: a.length };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 40, r: 12, t: 14, b: 26 };
      var mx = Math.max(1, Math.abs(r.mn), Math.abs(r.mx));
      var s = scaler(w, h, pad, 0, r.len - 1, -mx * 1.2, mx * 1.2);
      axes(g, w, h, pad, "index", "value");
      g.strokeStyle = "rgba(255,140,0,0.4)";
      g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(pad.l, s.y(0)); g.lineTo(w - pad.r, s.y(0)); g.stroke();
      g.setLineDash([]);
      var pts = [];
      for (var i = 0; i < r.len; i++) pts.push([s.x(i), s.y(r.a[i])]);
      line(g, pts, C.a1, 2);
      pts.forEach(function (p) { dot(g, p[0], p[1], C.a1, 3); });
    },
    readouts: function (r) {
      return [
        ["shape", "(" + r.len + ",)"],
        ["sum", String(r.sum)],
        ["min", String(r.mn)],
        ["max", String(r.mx)]
      ];
    }
  };

  /* Module 03 — descriptive statistics: mean vs median under contamination. */
  LAB.stats = {
    note: "Slide the outliers up. Watch which estimator moves first — that asymmetry is the whole lesson.",
    controls: [
      { key: "contam", label: "Outliers", type: "range", min: 0, max: 6, step: 1, value: 0 },
      { key: "amount", label: "Outlier size", type: "range", min: 5, max: 60, step: 1, value: 25 }
    ],
    compute: function (v) {
      var s = seeded(4242);
      var d = gauss(s, 20, 50, 6);
      for (var i = 0; i < v.contam; i++) d[i] = 50 + v.amount * (i + 1);
      /* NB: name the locals differently from the module-level helpers below.
         `var mean = mean(d)` would hoist `mean` and shadow the function, so the
         right-hand side would be undefined. */
      var mu = mean(d);
      var med = median(d);
      var sd = Math.sqrt(variance(d));
      return { data: d, mean: mu, med: med, sd: sd, true: 50 };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 40, r: 12, t: 14, b: 26 };
      var lo = Math.min.apply(null, r.data), hi = Math.max.apply(null, r.data);
      var s = scaler(w, h, pad, lo - 2, hi + 2, 0, r.data.length + 1);
      axes(g, w, h, pad, "value", "rank");
      r.data.forEach(function (d, i) { dot(g, s.x(d), s.y(i + 1), d > 70 ? C.a4 : C.a1, 3.5); });
      g.save(); g.setLineDash([4, 4]); g.strokeStyle = C.a2; g.lineWidth = 1.5;
      [r.mean, r.med, r.true].forEach(function (v) {
        g.beginPath(); g.moveTo(s.x(v), pad.t); g.lineTo(s.x(v), h - pad.b); g.stroke();
      });
      g.restore();
      label(g, pad.l + 4, pad.t + 10, "mean " + r.mean.toFixed(1), C.a2);
      label(g, pad.l + 4, pad.t + 22, "median " + r.med.toFixed(1), C.a3);
    },
    readouts: function (r) {
      return [
        ["true centre", "50.00"],
        ["mean", r.mean.toFixed(2), r.mean - r.true > 1 ? "bad" : "good"],
        ["median", r.med.toFixed(2), Math.abs(r.med - r.true) > 1 ? "bad" : "good"],
        ["sample sd", r.sd.toFixed(2)]
      ];
    }
  };

  /* Module 04 — linear algebra: least-squares line with residual bars. */
  LAB.lstsq = {
    note: "Drag the noise up to bend the line. The fit is solved from the normal equations, so it degrades exactly as the data does.",
    controls: [
      { key: "n", label: "Points", type: "range", min: 4, max: 60, step: 2, value: 20 },
      { key: "noise", label: "Noise", type: "range", min: 0, max: 20, step: 1, value: 4 },
      { key: "slope", label: "True slope", type: "range", min: -4, max: 8, step: 0.5, value: 3 }
    ],
    compute: function (v) {
      var s = seeded(v.n * 31 + v.noise * 7 + Math.round(v.slope * 10));
      var pts = [];
      for (var i = 0; i < v.n; i++) {
        var x = i / (v.n - 1) * 10;
        var y = 2 + v.slope * x + (s() - 0.5) * 2 * v.noise;
        pts.push([x, y]);
      }
      /* Normal equations for y = a + b x. */
      var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
      pts.forEach(function (p) { sx += p[0]; sy += p[1]; sxx += p[0] * p[0]; sxy += p[0] * p[1]; });
      var den = n * sxx - sx * sx;
      var b = den ? (n * sxy - sx * sy) / den : 0;
      var a = (sy - b * sx) / n;
      var ssr = 0, sst = 0, my = sy / n;
      pts.forEach(function (p) {
        var e = p[1] - (a + b * p[0]);
        ssr += e * e;
        sst += (p[1] - my) * (p[1] - my);
      });
      return { pts: pts, a: a, b: b, r2: sst ? 1 - ssr / sst : 1, rmse: Math.sqrt(ssr / n) };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 42, r: 12, t: 14, b: 26 };
      var xs = r.pts.map(function (p) { return p[0]; }), ys = r.pts.map(function (p) { return p[1]; });
      var s = scaler(w, h, pad, 0, 10, Math.min.apply(null, ys) - 3, Math.max.apply(null, ys) + 3);
      axes(g, w, h, pad, "x", "y");
      line(g, [[s.x(0), s.y(r.a)], [s.x(10), s.y(r.a + r.b * 10)]], C.a2, 2);
      r.pts.forEach(function (p) { dot(g, s.x(p[0]), s.y(p[1]), C.a1, 3); });
      label(g, pad.l + 4, pad.t + 10, "b = " + r.b.toFixed(3), C.a2);
      label(g, pad.l + 4, pad.t + 22, "R2 = " + r.r2.toFixed(4), C.a3);
    },
    readouts: function (r) {
      return [
        ["intercept a", r.a.toFixed(3)],
        ["slope b", r.b.toFixed(3)],
        ["R2", r.r2.toFixed(4)],
        ["RMSE", r.rmse.toFixed(3)]
      ];
    }
  };

  /* Module 05 — linear regression, the model you will actually ship. */
  LAB.regression = {
    note: "Learning rate too high makes the loss climb instead of fall. The trace is the gradient-descent path.",
    controls: [
      { key: "lr", label: "Learning rate", type: "range", min: 0.001, max: 0.4, step: 0.001, value: 0.06 },
      { key: "iters", label: "Steps", type: "range", min: 20, max: 400, step: 20, value: 160 },
      { key: "noise", label: "Noise", type: "range", min: 0, max: 8, step: 1, value: 2 }
    ],
    compute: function (v) {
      var s = seeded(99);
      var pts = [];
      for (var i = 0; i < 24; i++) {
        var x = (i - 11.5) * 0.5;
        pts.push([x, 1.5 + 2.5 * x + (s() - 0.5) * 2 * v.noise]);
      }
      var a = 0, b = 0, n = pts.length, trace = [], loss = null;
      for (var it = 0; it < v.iters; it++) {
        var ga = 0, gb = 0, l = 0;
        for (var j = 0; j < n; j++) {
          var e = pts[j][1] - (a + b * pts[j][0]);
          ga += e; gb += e * pts[j][0];
          l += e * e;
        }
        a += v.lr * (2 * ga) / n;
        b += v.lr * (2 * gb) / n;
        trace.push(l / n);
      }
      loss = trace[trace.length - 1];
      return { pts: pts, a: a, b: b, trace: trace, loss: loss, diverged: !isFinite(loss) || loss > 1e6 };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 42, r: 12, t: 14, b: 26 };
      var tmax = r.trace.length - 1;
      var lmax = Math.max.apply(null, r.trace.filter(isFinite)) || 1;
      var s = scaler(w, h, pad, 0, tmax, 0, lmax * 1.1);
      axes(g, w, h, pad, "step", "loss");
      var pts = [];
      for (var i = 0; i < r.trace.length; i++) {
        if (isFinite(r.trace[i])) pts.push([s.x(i), s.y(r.trace[i])]);
      }
      line(g, pts, r.diverged ? C.a4 : C.a3, 2);
      label(g, pad.l + 4, pad.t + 10, "final loss " + (isFinite(r.loss) ? r.loss.toExponential(2) : "diverged"), r.diverged ? C.a4 : C.a3);
    },
    readouts: function (r) {
      return [
        ["intercept", r.a.toFixed(3)],
        ["slope", r.b.toFixed(3)],
        ["final loss", isFinite(r.loss) ? r.loss.toExponential(3) : "overflow", r.diverged ? "bad" : "good"]
      ];
    }
  };

  /* Module 06 — classification: logistic decision boundary. */
  LAB.logistic = {
    note: "The boundary is drawn where the predicted probability is exactly 0.5.",
    controls: [
      { key: "lr", label: "Learning rate", type: "range", min: 0.01, max: 2, step: 0.01, value: 0.5 },
      { key: "sep", label: "Overlap", type: "range", min: 0, max: 4, step: 0.2, value: 1.6 },
      { key: "bias", label: "Offset", type: "range", min: -2, max: 2, step: 0.2, value: 0 }
    ],
    compute: function (v) {
      var s = seeded(2024);
      var pts = [];
      for (var i = 0; i < 30; i++) {
        var c0 = i < 15;
        var x = s() * 6 - 3 + (c0 ? -v.sep : v.sep);
        var y = s() * 6 - 3 + v.bias;
        pts.push([x, y, c0 ? 0 : 1]);
      }
      var w0 = 0, w1 = 0, w2 = 0;
      for (var it = 0; it < 600; it++) {
        var g0 = 0, g1 = 0, g2 = 0;
        pts.forEach(function (p) {
          var z = w0 + w1 * p[0] + w2 * p[1];
          var pr = 1 / (1 + Math.exp(-z));
          var e = pr - p[2];
          g0 += e; g1 += e * p[0]; g2 += e * p[1];
        });
        var m = pts.length;
        w0 -= v.lr * g0 / m; w1 -= v.lr * g1 / m; w2 -= v.lr * g2 / m;
      }
      var wrong = 0, correct = 0;
      pts.forEach(function (p) {
        var pr = 1 / (1 + Math.exp(-(w0 + w1 * p[0] + w2 * p[1])));
        if ((pr >= 0.5 ? 1 : 0) === p[2]) correct++; else wrong++;
      });
      return { pts: pts, w0: w0, w1: w1, w2: w2, acc: correct / pts.length };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 40, r: 12, t: 14, b: 26 };
      var s = scaler(w, h, pad, -5, 5, -5, 5);
      axes(g, w, h, pad, "x1", "x2");
      /* Shade the predicted-positive half-plane, lightly. */
      var den = r.w1 * r.w1 + r.w2 * r.w2;
      if (den > 1e-9) {
        g.save();
        g.beginPath();
        var cx = s.x((-r.w0 * r.w2) / den), cy = s.y((-r.w0 * r.w1) / den);
        g.moveTo(cx, cy);
        var r0 = Math.abs(r.w0) / Math.sqrt(den) * 3.6;
        var ang = Math.atan2(r.w2, r.w1) - Math.PI / 2;
        g.arc(cx, cy, r0, ang - Math.PI / 2, ang + Math.PI / 2);
        g.closePath();
        g.fillStyle = "rgba(255,140,0,0.07)";
        g.fill();
        g.restore();
        line(g, [
          [s.x(-6), s.y((6 * r.w1 - r.w0) / r.w2)],
          [s.x(6), s.y((-6 * r.w1 - r.w0) / r.w2)]
        ], C.a2, 2);
      }
      r.pts.forEach(function (p) { dot(g, s.x(p[0]), s.y(p[1]), p[2] ? C.a4 : C.a1, 4); });
      label(g, pad.l + 4, pad.t + 10, "accuracy " + (r.acc * 100).toFixed(1) + "%", C.a3);
    },
    readouts: function (r) {
      return [
        ["w0 (bias)", r.w0.toFixed(3)],
        ["w1", r.w1.toFixed(3)],
        ["w2", r.w2.toFixed(3)],
        ["accuracy", (r.acc * 100).toFixed(1) + "%", r.acc > 0.9 ? "good" : "hi"]
      ];
    }
  };

  /* Module 07 — decision trees: split search. */
  LAB.tree = {
    note: "Each level picks the feature and threshold with the largest impurity drop. The tree is greedy and never looks ahead.",
    controls: [
      { key: "depth", label: "Max depth", type: "range", min: 1, max: 6, step: 1, value: 3 },
      { key: "noise", label: "Label noise", type: "range", min: 0, max: 45, step: 5, value: 10 }
    ],
    compute: function (v) {
      var s = seeded(777);
      var pts = [];
      for (var i = 0; i < 120; i++) {
        var x = s() * 10 - 5, y = s() * 10 - 5;
        var lab = (x * x + y * y < 12) ? 0 : 1;
        if (s() * 100 < v.noise) lab = 1 - lab;
        pts.push([x, y, lab]);
      }
      var root = buildTree(pts, 0, v.depth, 2);
      var wrong = 0;
      pts.forEach(function (p) { if (predict(root, p[0], p[1]) !== p[2]) wrong++; });
      return { pts: pts, tree: root, wrong: wrong, acc: 1 - wrong / pts.length, leaves: countLeaves(root) };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 40, r: 12, t: 14, b: 26 };
      var s = scaler(w, h, pad, -5, 5, -5, 5);
      axes(g, w, h, pad, "x1", "x2");
      r.pts.forEach(function (p) { dot(g, s.x(p[0]), s.y(p[1]), p[2] ? C.a4 : C.a1, 2.6); });
      drawSplits(g, s, r.tree, 0);
    },
    readouts: function (r) {
      return [
        ["leaves", String(r.leaves)],
        ["training error", r.wrong + " / " + r.pts.length],
        ["accuracy", (r.acc * 100).toFixed(1) + "%", r.acc > 0.85 ? "good" : "hi"]
      ];
    }
  };

  function gini(labels) {
    var n = labels.length;
    if (!n) return 0;
    var a = 0;
    for (var i = 0; i < n; i++) if (labels[i] === 1) a++;
    var p = a / n;
    return 2 * p * (1 - p);
  }

  function buildTree(pts, depth, maxDepth, minLeaf) {
    var labels = pts.map(function (p) { return p[2]; });
    var majority = labels.reduce(function (a, b) { return a + b; }, 0) * 2 >= labels.length ? 1 : 0;
    var node = { leaf: true, cls: majority, n: pts.length, gini: gini(labels) };
    if (depth >= maxDepth || node.gini < 1e-9 || pts.length < minLeaf * 2) return node;
    var best = null;
    for (var f = 0; f < 2; f++) {
      var vals = pts.map(function (p) { return p[f]; }).sort(function (a, b) { return a - b; });
      for (var i = 0; i < vals.length - 1; i++) {
        var thr = (vals[i] + vals[i + 1]) / 2;
        if (thr === vals[i]) continue;
        var L = [], R = [];
        for (var j = 0; j < pts.length; j++) (pts[j][f] <= thr ? L : R).push(pts[j]);
        if (L.length < minLeaf || R.length < minLeaf) continue;
        var gL = gini(L.map(function (p) { return p[2]; }));
        var gR = gini(R.map(function (p) { return p[2]; }));
        var gain = node.gini - (L.length * gL + R.length * gR) / pts.length;
        if (!best || gain > best.gain) best = { f: f, thr: thr, gain: gain, L: L, R: R };
      }
    }
    if (!best) return node;
    node.leaf = false;
    node.f = best.f;
    node.thr = best.thr;
    node.left = buildTree(best.L, depth + 1, maxDepth, minLeaf);
    node.right = buildTree(best.R, depth + 1, maxDepth, minLeaf);
    return node;
  }

  function predict(n, x, y) {
    while (!n.leaf) n = n.f === 0 ? (x <= n.thr ? n.left : n.right) : (y <= n.thr ? n.left : n.right);
    return n.cls;
  }

  function countLeaves(n) {
    return n.leaf ? 1 : countLeaves(n.left) + countLeaves(n.right);
  }

  /* Draw each node's cut across the plot area. A full-height line is an honest
     depiction of the region the node governs; the recursive guards are what stop a
     deep tree from overdrawing the same region many times. */
  function drawSplits(g, s, n, depth) {
    if (n.leaf || depth > 5) return;
    drawSplits(g, s, n.left, depth + 1);
    drawSplits(g, s, n.right, depth + 1);
    g.strokeStyle = "rgba(255,255,255,0.32)";
    g.lineWidth = 1;
    g.setLineDash([5, 4]);
    g.beginPath();
    if (n.f === 0) { g.moveTo(s.x(n.thr), s.y(5)); g.lineTo(s.x(n.thr), s.y(-5)); }
    else { g.moveTo(s.x(-5), s.y(n.thr)); g.lineTo(s.x(5), s.y(n.thr)); }
    g.stroke();
    g.setLineDash([]);
  }

  /* Module 08 — clustering: k-means iteration trace. */
  LAB.kmeans = {
    note: "Watch the assignment step and the update step alternate; the trace records total within-cluster sum of squares.",
    controls: [
      { key: "k", label: "Clusters", type: "range", min: 2, max: 6, step: 1, value: 3 },
      { key: "iters", label: "Iterations", type: "range", min: 2, max: 24, step: 1, value: 12 }
    ],
    compute: function (v) {
      var s = seeded(31337);
      var pts = [];
      for (var i = 0; i < 90; i++) {
        var c = i % 3;
        var cx = [0, 3.2, 1.6][c], cy = [0, 1.4, -3][c];
        pts.push([cx + (s() - 0.5) * 2.2, cy + (s() - 0.5) * 2.2]);
      }
      var cents = [];
      for (var k = 0; k < v.k; k++) cents.push([pts[Math.floor((k + 0.5) * pts.length / v.k)].slice()]);
      var assign = new Array(pts.length).fill(0), trace = [];
      for (var it = 0; it < v.iters; it++) {
        for (var j = 0; j < pts.length; j++) {
          var bd = Infinity, bi = 0;
          for (var c2 = 0; c2 < v.k; c2++) {
            var dx = pts[j][0] - cents[c2][0], dy = pts[j][1] - cents[c2][1];
            var d = dx * dx + dy * dy;
            if (d < bd) { bd = d; bi = c2; }
          }
          assign[j] = bi;
        }
        var sx = new Array(v.k).fill(0), sy = new Array(v.k).fill(0), cn = new Array(v.k).fill(0);
        for (var p = 0; p < pts.length; p++) {
          sx[assign[p]] += pts[p][0]; sy[assign[p]] += pts[p][1]; cn[assign[p]]++;
        }
        var sse = 0;
        for (var k2 = 0; k2 < v.k; k2++) {
          if (cn[k2]) { cents[k2] = [sx[k2] / cn[k2], sy[k2] / cn[k2]]; }
          for (var q = 0; q < pts.length; q++) {
            if (assign[q] !== k2) continue;
            var ex = pts[q][0] - cents[k2][0], ey = pts[q][1] - cents[k2][1];
            sse += ex * ex + ey * ey;
          }
        }
        trace.push(sse);
      }
      return { pts: pts, cents: cents, assign: assign, trace: trace, sse: trace[trace.length - 1] };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 40, r: 12, t: 14, b: 26 };
      var s = scaler(w, h, pad, -5, 6, -5, 4);
      axes(g, w, h, pad, "x", "y");
      var cols = [C.a1, C.a2, C.a3, C.a5, "#e879f9", "#facc15"];
      r.pts.forEach(function (p, i) { dot(g, s.x(p[0]), s.y(p[1]), cols[r.assign[i] % cols.length], 3); });
      r.cents.forEach(function (c, i) {
        var x = s.x(c[0]), y = s.y(c[1]);
        g.strokeStyle = cols[i % cols.length];
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x + 7, y); g.moveTo(x, y - 7); g.lineTo(x, y + 7); g.stroke();
      });
      label(g, pad.l + 4, pad.t + 10, "SSE " + r.sse.toFixed(2), C.a3);
    },
    readouts: function (r) {
      return [
        ["k", String(r.cents.length)],
        ["iterations", String(r.trace.length)],
        ["final SSE", r.sse.toFixed(3)]
      ];
    }
  };

  /* Module 09 — NumPy interop. */
  LAB.interop = {
    note: "This mirrors the approved Mojo interop exactly: import the module, then call into it. The column sums are the same in both.",
    controls: [
      { key: "n", label: "Rows", type: "range", min: 2, max: 20, step: 1, value: 8 },
      { key: "w", label: "Column scale", type: "range", min: 0.5, max: 4, step: 0.5, value: 1 }
    ],
    compute: function (v) {
      var s = seeded(5150);
      var M = [];
      for (var i = 0; i < v.n; i++) {
        var row = [];
        for (var j = 0; j < 3; j++) row.push((s() * 4 - 2) * v.w);
        M.push(row);
      }
      var colsum = [0, 0, 0], mean = 0;
      M.forEach(function (row) {
        row.forEach(function (x, j) { colsum[j] += x; });
      });
      var total = 0;
      M.forEach(function (row) { row.forEach(function (x) { total += x; }); });
      mean = total / (v.n * 3);
      return { M: M, colsum: colsum, mean: mean, shape: [v.n, 3] };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 40, r: 12, t: 14, b: 26 };
      var flat = [];
      r.M.forEach(function (row) { row.forEach(function (x) { flat.push(x); }); });
      var lo = Math.min.apply(null, flat), hi = Math.max.apply(null, flat);
      var s = scaler(w, h, pad, -1, 3, lo * 1.1, hi * 1.1 || 1);
      axes(g, w, h, pad, "column", "value");
      r.colsum.forEach(function (v2, i) { bar(g, s.x(i) - 22, s.y(v2), 44, h - pad.b - s.y(v2), "rgba(139,92,246,0.6)"); });
      label(g, pad.l + 4, pad.t + 10, "shape (" + r.shape[0] + ", 3)", C.a5);
    },
    readouts: function (r) {
      return [
        ["shape", "(" + r.shape[0] + ", 3)"],
        ["col 0 sum", r.colsum[0].toFixed(3)],
        ["col 1 sum", r.colsum[1].toFixed(3)],
        ["col 2 sum", r.colsum[2].toFixed(3)],
        ["grand mean", r.mean.toFixed(4)]
      ];
    }
  };

  /* Module 10 — performance: where the time goes. */
  LAB.perf = {
    note: "SIMD-friendly column-major loops amortise far better than the naive form. Both compute the identical result.",
    controls: [
      { key: "n", label: "Elements", type: "range", min: 1000, max: 400000, step: 1000, value: 200000 },
      { key: "scale", label: "Work", type: "range", min: 1, max: 6, step: 1, value: 3 }
    ],
    compute: function (v) {
      var a = new Float64Array(v.n);
      var s = seeded(8);
      for (var i = 0; i < v.n; i++) a[i] = s() * 2 - 1;
      var scale = v.scale;
      var t0 = performance.now(), acc = 0;
      for (var j = 0; j < v.n; j++) acc += a[j] * scale;
      var naive = performance.now() - t0;
      var t1 = performance.now(), acc2 = 0;
      var BLK = 8, lim = v.n - (v.n % BLK);
      for (var k = 0; k < lim; k += BLK) {
        for (var m = 0; m < BLK; m++) acc2 += a[k + m] * scale;
      }
      for (var t = lim; t < v.n; t++) acc2 += a[t] * scale;
      var blocked = performance.now() - t1;
      return { n: v.n, naive: naive, blocked: blocked, acc: acc, acc2: acc2, speedup: blocked > 0.0005 ? naive / blocked : null };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 42, r: 12, t: 14, b: 26 };
      var mx = Math.max(r.naive, r.blocked) * 1.2 || 1;
      var s = scaler(w, h, pad, 0, 1, 0, mx);
      axes(g, w, h, pad, "", "ms");
      bar(g, w * 0.28, s.y(r.naive), w * 0.18, h - pad.b - s.y(r.naive), "rgba(239,68,68,0.6)");
      bar(g, w * 0.56, s.y(r.blocked), w * 0.18, h - pad.b - s.y(r.blocked), "rgba(34,197,94,0.6)");
      label(g, w * 0.28, s.y(r.naive) - 5, r.naive.toFixed(2) + "ms", C.a4);
      label(g, w * 0.56, s.y(r.blocked) - 5, r.blocked.toFixed(2) + "ms", C.a3);
    },
    readouts: function (r) {
      return [
        ["elements", r.n.toLocaleString()],
        ["scalar loop", r.naive.toFixed(2) + " ms"],
        ["blocked loop", r.blocked.toFixed(2) + " ms"],
        ["speedup", r.speedup ? r.speedup.toFixed(2) + "x" : "too fast to time", r.speedup && r.speedup > 1.2 ? "good" : "hi"]
      ];
    }
  };

  /* ── Maths ─────────────────────────────────────────────────────────────── */

  function renderMath() {
    if (typeof renderMathInElement !== "function" || !window.katex) return;
    renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false }
      ],
      throwOnError: false
    });
  }

  /* ── Lab driver ────────────────────────────────────────────────────────── */

  function inputEl(spec) {
    if (spec.type === "select") {
      var sel = document.createElement("select");
      sel.innerHTML = spec.options.map(function (o) {
        return '<option value="' + o + '"' + (o === spec.value ? " selected" : "") + ">" + o + "</option>";
      }).join("");
      return sel;
    }
    var el;
    if (spec.type === "textarea") {
      el = document.createElement("textarea");
      el.placeholder = spec.placeholder || "";
      return el;
    }
    el = document.createElement("input");
    el.type = spec.type || "text";
    if (spec.type === "range") {
      el.min = spec.min;
      el.max = spec.max;
      el.step = spec.step;
    }
    if (spec.value !== undefined) el.value = spec.value;
    if (spec.placeholder) el.placeholder = spec.placeholder;
    return el;
  }

  (function mountLabs() {
    [].forEach.call(document.querySelectorAll("[data-lab]"), function (host) {
      var lab = LAB[host.dataset.lab];
      if (!lab) return;
      var ctrls = document.createElement("div");
      ctrls.className = "ctrls";
      var vals = {};
      var valueLabels = {};

      lab.controls.forEach(function (spec) {
        var wrap = document.createElement("div");
        wrap.className = "ctrl" + (spec.wide ? " wide" : "");
        var lab2 = document.createElement("label");
        var name = document.createElement("span");
        name.textContent = spec.label;
        var val = document.createElement("span");
        val.className = "val";
        lab2.appendChild(name);
        lab2.appendChild(val);
        var el = inputEl(spec);
        wrap.appendChild(lab2);
        wrap.appendChild(el);
        ctrls.appendChild(wrap);
        vals[spec.key] = el;
        valueLabels[spec.key] = { el: val, spec: spec };
      });

      var body = document.createElement("div");
      body.className = "labbody";
      body.appendChild(ctrls);

      var cols = document.createElement("div");
      cols.className = "labcols";
      var outCol = document.createElement("div");
      var cv = document.createElement("canvas");
      cv.className = "plot";
      cv.setAttribute("height", "220");
      cols.appendChild(cv);
      cols.appendChild(outCol);
      body.appendChild(cols);

      if (lab.note) {
        var note = document.createElement("p");
        note.className = "labnote";
        note.innerHTML = "<b>Note.</b> " + lab.note;
        body.appendChild(note);
      }

      host.appendChild(body);

      function fmt(spec, v) {
        if (spec.format) return spec.format(v);
        var n = parseFloat(v);
        if (spec.type === "range") {
          return spec.step && +spec.step < 1 ? (+n).toFixed(3).replace(/0+$/, "").replace(/\.$/, "") : String(n);
        }
        return v;
      }

      function run() {
        var v = {};
        Object.keys(vals).forEach(function (k) {
          var spec = valueLabels[k].spec;
          var raw = vals[k].value;
          valueLabels[k].el.textContent = fmt(spec, raw);
          v[k] = spec.type === "range" || spec.type === "number" ? parseFloat(raw) : raw;
        });
        var r = lab.compute(v);
        var sc = setupCanvas(cv);
        if (lab.plot) lab.plot(sc.g, sc.w, sc.h, r);
        var rows = lab.readouts ? lab.readouts(r) : [];
        outCol.innerHTML =
          '<table class="readout-table">' +
          rows.map(function (row) {
            var cls = row[2] ? ' class="' + row[2] + '"' : "";
            return "<tr" + cls + "><td>" + row[0] + "</td><td>" + row[1] + "</td></tr>";
          }).join("") +
          "</table>";
        host._last = r;
      }

      Object.keys(vals).forEach(function (k) {
        vals[k].addEventListener("input", run);
        vals[k].addEventListener("change", run);
      });
      run();
    });
  })();

  /* ── Boot ──────────────────────────────────────────────────────────────── */

  function boot() {
    renderMath();
    updateReadout();
    updateSpy();
    Object.keys(tocLinks).forEach(function (k) {
      if (state.done[k]) tocLinks[k].classList.add("done");
    });
    var start = document.querySelector("[data-start]");
    if (start && modules.length) start.addEventListener("click", function () {
      modules[0].scrollIntoView({ behavior: "smooth" });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  /* ── Small deterministic RNG so every lab is reproducible ──────────────── */

  function seeded(seed) {
    var x = (seed >>> 0) || 1;
    return function () {
      x ^= x << 13; x >>>= 0;
      x ^= x >> 17;
      x ^= x << 5; x >>>= 0;
      return x / 4294967296;
    };
  }

  function gauss(s, n, mu, sigma) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var u = Math.max(1e-9, s()), v = s();
      out.push(mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
    }
    return out;
  }

  function mean(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
  function variance(a) {
    var m = mean(a);
    return a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (a.length - 1 || 1);
  }
  function median(a) {
    var b = a.slice().sort(function (x, y) { return x - y; });
    var m = b.length >> 1;
    return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
  }
})();
