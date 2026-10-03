/* app.js — Finance Mojo
 *
 * The app shell: sidebar build, scrollspy, reading progress, persistence, copy
 * buttons, quizzes, and the live labs. No framework, no build step, no fetch.
 * Forked from the Data Science Mojo reference app; independent from here on.
 *
 * Labs are declared in LAB below, keyed by the lab's data-lab attribute. The shell
 * finds every [data-lab] element, reads its declared inputs, runs the lab's compute
 * function, and paints whatever readouts and plots the lab returns.
 */
(function () {
  "use strict";

  var STORE = "tutmemo-fin-mojo-v1";

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

  function updateProgress() {
    if (!progressBar) return;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
    progressBar.style.width = (p * 100).toFixed(2) + "%";
  }

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
    if (xl) g.fillText(xl, pad.l + (w - pad.l - pad.r) / 2, h - 6);
    g.save();
    g.translate(11, pad.t + (h - pad.t - pad.b) / 2);
    g.rotate(-Math.PI / 2);
    if (yl) g.fillText(yl, 0, 0);
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

  /* Module 01 — precision. Compare Float64 against a lower-precision sum so the
     rounding error is visible rather than asserted. */
  LAB.precision = {
    note: "Both bars sum the same n copies of the same value. The Float32 bar rounds every partial sum to 24 bits, so the terms get absorbed once the running total outgrows them. The exact column is n times the Float32 value, which is representable to full precision.",
    controls: [
      { key: "n", label: "Terms", type: "range", min: 1000, max: 2000000, step: 1000, value: 1000000 },
      { key: "t", label: "Each term", type: "range", min: 0.01, max: 1, step: 0.01, value: 0.1 }
    ],
    compute: function (v) {
      /* Snap the term to Float32 first, so the exact reference is
         n * fl32(t) — exactly representable in Float64 at these magnitudes. */
      var inc = Math.fround(v.t);
      var exact = v.n * inc;

      var naive = 0;
      for (var i = 0; i < v.n; i++) naive = Math.fround(naive + inc);

      /* Kahan compensation over the same Float32 terms, in Float64. */
      var ksum = 0, c = 0;
      for (var j = 0; j < v.n; j++) {
        var y = inc - c;
        var t = ksum + y;
        c = (t - ksum) - y;
        ksum = t;
      }
      return { n: v.n, inc: inc, exact: exact, naive: naive, kahan: ksum, eNaive: Math.abs(naive - exact), eKahan: Math.abs(ksum - exact) };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 46, r: 12, t: 14, b: 26 };
      var mx = Math.max(r.eNaive, r.eKahan) * 1.25 || 1;
      var s = scaler(w, h, pad, 0, 1, 0, mx);
      axes(g, w, h, pad, "", "abs error");
      bar(g, w * 0.2, s.y(r.eNaive), w * 0.2, h - pad.b - s.y(r.eNaive), "rgba(239,68,68,0.65)");
      bar(g, w * 0.5, s.y(r.eKahan), w * 0.2, h - pad.b - s.y(r.eKahan), "rgba(34,197,94,0.65)");
      label(g, w * 0.2, s.y(r.eNaive) - 5, r.eNaive.toExponential(2), C.a4);
      label(g, w * 0.5, s.y(r.eKahan) - 5, r.eKahan.toExponential(2), C.a3);
    },
    readouts: function (r) {
      return [
        ["terms", r.n.toLocaleString()],
        ["each term (f32)", r.inc.toExponential(4)],
        ["exact", r.exact.toExponential(10)],
        ["naive f32 sum", r.naive.toExponential(10)],
        ["naive error", r.eNaive.toExponential(3), "bad"],
        ["Kahan error", r.eKahan.toExponential(3), "good"]
      ];
    }
  };

  /* Module 02 — time value of money. Solve the unknown rate numerically. */
  LAB.tvm = {
    note: "The blue curve is the present value of the payment stream against the discount rate. The orange marker is where it equals the principal - the rate that makes the loan balance to zero.",
    controls: [
      { key: "P", label: "Principal", type: "range", min: 100, max: 20000, step: 100, value: 5000 },
      { key: "n", label: "Periods", type: "range", min: 1, max: 40, step: 1, value: 12 },
      { key: "pmt", label: "Payment", type: "range", min: 10, max: 3000, step: 10, value: 500 }
    ],
    compute: function (v) {
      /* Balance a loan: PV = PMT * (1 - (1+r)^-n) / r, solved for r by bisection. */
      var lo = 1e-9, hi = 1.0;
      var f = function (r) {
        var f = r < 1e-12 ? v.n : (1 - Math.pow(1 + r, -v.n)) / r;
        return f * v.pmt - v.P;
      };
      for (var i = 0; i < 200; i++) {
        var mid = (lo + hi) / 2;
        if (f(mid) > 0) lo = mid; else hi = mid;
      }
      var rate = (lo + hi) / 2;
      var total = v.pmt * v.n;
      return { P: v.P, n: v.n, pmt: v.pmt, rate: rate, total: total, interest: total - v.P };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 46, r: 12, t: 14, b: 26 };
      var ymax = r.P * 3;
      var s = scaler(w, h, pad, 0, 0.5, 0, ymax);
      axes(g, w, h, pad, "discount rate", "PV of stream");
      var pts = [];
      for (var i = 0; i <= 60; i++) {
        var rate = (i / 60) * 0.5;
        var ann = rate < 1e-9 ? r.n : (1 - Math.pow(1 + rate, -r.n)) / rate;
        pts.push([s.x(rate), s.y(ann * r.pmt)]);
      }
      line(g, pts, C.a1, 2);
      var yr = Math.min(0.5, r.rate);
      g.strokeStyle = C.a2; g.setLineDash([4, 4]); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(s.x(yr), pad.t); g.lineTo(s.x(yr), h - pad.b); g.stroke();
      g.setLineDash([]);
      dot(g, s.x(yr), s.y(r.P), C.a2, 4);
      label(g, pad.l + 4, pad.t + 10, "IRR " + (r.rate * 100).toFixed(3) + "%", C.a2);
    },
    readouts: function (r) {
      return [
        ["principal", r.P.toFixed(2)],
        ["payment", r.pmt.toFixed(2)],
        ["periods", String(r.n)],
        ["implied rate", (r.rate * 100).toFixed(4) + "%"],
        ["total interest", r.interest.toFixed(2)]
      ];
    }
  };

  /* Module 03 — NPV and IRR. The profile is the classic multiple-IRR shape. */
  LAB.npv = {
    note: "The NPV profile crosses zero once for a conventional cash flow and more than once when the signs alternate — the NPV rule and the IRR rule disagree there.",
    controls: [
      { key: "r", label: "Discount rate", type: "range", min: -20, max: 60, step: 0.5, value: 10 },
      { key: "c2", label: "C2 (year 2)", type: "range", min: -2600, max: 3500, step: 25, value: -2100 }
    ],
    compute: function (v) {
      var cf = [-1000, 2600, v.c2, 500];
      var npv = function (r) {
        var s = 0;
        for (var t = 0; t < cf.length; t++) s += cf[t] / Math.pow(1 + r, t);
        return s;
      };
      /* Bracket every sign change, then bisect each one. A single Newton or
         closed-form solve would converge to whichever root it started nearest
         and report it as "the" IRR. */
      var irr = [];
      var step = 0.002, r = -0.98, prev = npv(r);
      while (r < 3) {
        var cur = npv(r + step);
        if ((prev < 0) !== (cur < 0)) {
          var lo = r, hi = r + step;
          for (var i = 0; i < 90; i++) {
            var mid = (lo + hi) / 2;
            if ((npv(lo) < 0) !== (npv(mid) < 0)) hi = mid; else lo = mid;
          }
          var x = (lo + hi) / 2;
          if (!irr.some(function (e) { return Math.abs(e - x) < 1e-4; })) irr.push(x);
        }
        prev = cur;
        r += step;
      }
      return { cf: cf, rate: v.r / 100, npv: npv(v.r / 100), irrs: irr };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 46, r: 12, t: 14, b: 26 };
      var s = scaler(w, h, pad, -0.2, 1.0, -1200, 1600);
      axes(g, w, h, pad, "rate", "NPV");
      var pts = [];
      for (var i = 0; i <= 120; i++) {
        var rate = -0.2 + (i / 120) * 1.2;
        var v = 0;
        for (var t = 0; t < r.cf.length; t++) v += r.cf[t] / Math.pow(1 + rate, t);
        pts.push([s.x(rate), s.y(v)]);
      }
      line(g, pts, C.a1, 2);
      g.strokeStyle = C.a3; g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(pad.l, s.y(0)); g.lineTo(w - pad.r, s.y(0)); g.stroke();
      g.setLineDash([]);
      r.irrs.forEach(function (x) { if (x > -0.2 && x < 1) dot(g, s.x(x), s.y(0), C.a2, 4); });
      dot(g, s.x(Math.max(-0.2, Math.min(1, r.rate))), s.y(r.npv), C.a4, 4);
      label(g, pad.l + 4, pad.t + 10, "IRR roots: " + r.irrs.length, C.a2);
      if (r.irrs.length > 1) {
        label(g, pad.l + 4, pad.t + 22, r.irrs.filter(function (x) { return x > -0.2 && x < 1; })
          .map(function (x) { return (x * 100).toFixed(1) + "%"; }).join("  "), C.a2);
      }
    },
    readouts: function (r) {
      var inRange = r.irrs.filter(function (x) { return x > -0.2 && x < 1; });
      return [
        ["cash flows", r.cf.join(", ")],
        ["rate", (r.rate * 100).toFixed(2) + "%"],
        ["NPV", r.npv.toFixed(2), r.npv > 0 ? "good" : "bad"],
        ["IRR roots", inRange.length > 1 ? inRange.length + "  (" + inRange.map(function (x) { return (x * 100).toFixed(1) + "%"; }).join(", ") + ")" : String(inRange.length), inRange.length > 1 ? "bad" : "hi"]
      ];
    }
  };

  /* Module 04 — amortisation. The split between interest and principal is the
     part people get wrong, so the chart shows it cumulatively. */
  LAB.amort = {
    note: "Interest is charged on the outstanding balance, so the interest portion shrinks every period while the principal portion grows by the same constant amount.",
    controls: [
      { key: "P", label: "Principal", type: "range", min: 10000, max: 900000, step: 10000, value: 200000 },
      { key: "rate", label: "Rate (%/yr)", type: "range", min: 0.5, max: 15, step: 0.1, value: 6 },
      { key: "n", label: "Years", type: "range", min: 3, max: 40, step: 1, value: 20 }
    ],
    compute: function (v) {
      var r = v.rate / 100, n = v.n, pmt = v.P * r / (1 - Math.pow(1 + r, -n));
      var bal = v.P, ti = 0, tp = 0, rows = [];
      /* A level-payment schedule is exactly zero at maturity, so whatever is
         left at the end is accumulated rounding. Snap it once it is down at the
         ulp level, otherwise the final row reports a negative principal. */
      var snap = v.P * 2.3e-16;
      for (var t = 1; t <= n; t++) {
        var i = bal * r, p = pmt - i;
        bal -= p; ti += i; tp += p;
        if (Math.abs(bal) < snap) bal = 0;
        rows.push({ t: t, interest: i, principal: p, bal: Math.max(0, bal) });
      }
      return { pmt: pmt, rows: rows, ti: ti, tp: tp, n: n };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 46, r: 12, t: 14, b: 26 };
      var s = scaler(w, h, pad, 1, r.n, 0, r.pmt * 1.1);
      axes(g, w, h, pad, "period", "payment part");
      var ipts = [], ppts = [];
      r.rows.forEach(function (row) {
        ipts.push([s.x(row.t), s.y(row.interest)]);
        ppts.push([s.x(row.t), s.y(row.principal)]);
      });
      line(g, ipts, C.a4, 2);
      line(g, ppts, C.a3, 2);
      label(g, pad.l + 4, pad.t + 10, "interest", C.a4);
      label(g, pad.l + 4, pad.t + 22, "principal", C.a3);
    },
    readouts: function (r) {
      return [
        ["payment", r.pmt.toFixed(2)],
        ["total paid", (r.ti + r.tp).toFixed(2)],
        ["total interest", r.ti.toFixed(2), "bad"],
        ["period 1 interest", r.rows[0].interest.toFixed(2)],
        ["period 1 principal", r.rows[0].principal.toFixed(2)]
      ];
    }
  };

  /* Module 05 — bonds. Price-yield is convex, and the slope is the duration. */
  LAB.bond = {
    note: "The price-yield curve is convex; a straight line between two points understates the price gain when yields fall, which is exactly what positive convexity is worth.",
    controls: [
      { key: "c", label: "Coupon (%)", type: "range", min: 0, max: 15, step: 0.25, value: 5 },
      { key: "T", label: "Years", type: "range", min: 1, max: 30, step: 1, value: 10 },
      { key: "y", label: "Yield (%)", type: "range", min: 0.5, max: 15, step: 0.1, value: 5 }
    ],
    compute: function (v) {
      var c = v.c / 100, y = v.y / 100, T = v.T, F = 100;
      /* Discrete annual compounding: CF / (1+y)^t. Using exp(-y*t) here would
         price a par bond at 99.02 instead of exactly 100. */
      var price = function (yy) {
        var p = 0;
        for (var t = 1; t <= T; t++) p += (c * F + (t === T ? F : 0)) / Math.pow(1 + yy, t);
        return p;
      };
      var p0 = price(y);
      var dy = 1e-4;
      var macaulay = 0;
      for (var t2 = 1; t2 <= T; t2++) {
        macaulay += t2 * (c * F / Math.pow(1 + y, t2) + (t2 === T ? F / Math.pow(1 + y, t2) : 0));
      }
      macaulay /= p0;
      var modified = macaulay / (1 + y);
      var convex = 0;
      for (var t3 = 1; t3 <= T; t3++) {
        var cf3 = c * F + (t3 === T ? F : 0);
        convex += (cf3 / Math.pow(1 + y, t3)) * (t3 * (t3 + 1));
      }
      convex /= (p0 * (1 + y) * (1 + y));
      return { price: p0, macaulay: macaulay, modified: modified, convex: convex, c: c, y: y, T: T, F: F, priceFn: price };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 46, r: 12, t: 14, b: 26 };
      var s = scaler(w, h, pad, 0.5, 15, 60, 140);
      axes(g, w, h, pad, "yield (%)", "price");
      var pts = [];
      for (var i = 0; i <= 100; i++) {
        var yy = 0.5 + (i / 100) * 14.5;
        pts.push([s.x(yy), s.y(r.priceFn(yy / 100))]);
      }
      line(g, pts, C.a1, 2);
      dot(g, s.x(r.y * 100), s.y(r.price), C.a2, 4);
      label(g, pad.l + 4, pad.t + 10, "price " + r.price.toFixed(2), C.a2);
      label(g, pad.l + 4, pad.t + 22, "mod dur " + r.modified.toFixed(3), C.a3);
    },
    readouts: function (r) {
      return [
        ["price", r.price.toFixed(4)],
        ["par?", Math.abs(r.price - 100) < 0.01 ? "yes" : "no", Math.abs(r.price - 100) < 0.01 ? "good" : "hi"],
        ["Macaulay dur", r.macaulay.toFixed(4)],
        ["modified dur", r.modified.toFixed(4)],
        ["convexity", r.convex.toExponential(3)]
      ];
    }
  };

  /* Module 06 — portfolio. Two assets, weights editor, efficient frontier. */
  LAB.portfolio = {
    note: "The frontier is traced by re-optimising at each target return; the orange cross is the chosen portfolio, and the line to the right is the capital allocation line.",
    controls: [
      { key: "w", label: "Weight in A", type: "range", min: 0, max: 100, step: 1, value: 60 },
      { key: "s1", label: "Vol A (%)", type: "range", min: 2, max: 40, step: 1, value: 18 },
      { key: "s2", label: "Vol B (%)", type: "range", min: 0, max: 40, step: 1, value: 8 }
    ],
    compute: function (v) {
      var wA = v.w / 100, wB = 1 - wA;
      var muA = 0.09, muB = 0.045;
      var sA = v.s1 / 100, sB = v.s2 / 100;
      var rho = 0.35;
      var cov = rho * sA * sB;
      var port = function (w) {
        var mu = w * muA + (1 - w) * muB;
        var var_ = w * w * sA * sA + (1 - w) * (1 - w) * sB * sB + 2 * w * (1 - w) * cov;
        var sd = Math.sqrt(Math.max(0, var_));
        return { w: w, mu: mu, sd: sd, sharpe: sd > 1e-9 ? (mu - 0.02) / sd : 0 };
      };
      var p = port(wA);
      /* Frontier: the max-Sharpe tangency portfolio, plus a few points around it. */
      var best = null;
      for (var i = 0; i <= 200; i++) {
        var w = i / 200, q = port(w);
        if (!best || q.sharpe > best.sharpe) best = q;
      }
      var line_ = [];
      for (var k = 0; k <= 20; k++) {
        var sh = best.sd * (k / 10);
        line_.push({ sd: sh, mu: 0.02 + best.sharpe * sh });
      }
      var var95 = p.mu - 1.645 * p.sd;
      return { p: p, best: best, cal: line_, var95: var95, rho: rho, muA: muA, muB: muB, sA: sA, sB: sB };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 46, r: 12, t: 14, b: 26 };
      var s = scaler(w, h, pad, 0, 0.34, 0, 0.12);
      axes(g, w, h, pad, "sigma", "expected return");
      var cl = [];
      for (var i = 0; i <= 40; i++) {
        var ww = i / 40;
        var mu = ww * r.muA + (1 - ww) * r.muB;
        var vr = ww * ww * r.sA * r.sA + (1 - ww) * (1 - ww) * r.sB * r.sB + 2 * ww * (1 - ww) * r.rho * r.sA * r.sB;
        cl.push([s.x(Math.sqrt(Math.max(0, vr))), s.y(mu)]);
      }
      line(g, cl, "rgba(255,255,255,0.28)", 1.5);
      line(g, r.cal.map(function (q) { return [s.x(q.sd), s.y(q.mu)]; }), C.a3, 2);
      dot(g, s.x(r.p.sd), s.y(r.p.mu), C.a2, 4);
      dot(g, s.x(r.best.sd), s.y(r.best.mu), C.a1, 4);
      label(g, pad.l + 4, pad.t + 10, "chosen Sharpe " + r.p.sharpe.toFixed(3), C.a2);
      label(g, pad.l + 4, pad.t + 22, "tangency " + r.best.sharpe.toFixed(3), C.a1);
    },
    readouts: function (r) {
      return [
        ["E[R]", (r.p.mu * 100).toFixed(2) + "%"],
        ["sigma", (r.p.sd * 100).toFixed(2) + "%"],
        ["Sharpe", r.p.sharpe.toFixed(3), r.p.sharpe > r.best.sharpe * 0.98 ? "good" : "hi"],
        ["VaR 95", (r.var95 * 100).toFixed(2) + "%"]
      ];
    }
  };

  /* Module 07 — options. Payoff at maturity plus the price ladder. */
  LAB.option = {
    note: "The blue curve is what the holder receives at expiry; the orange is what the holder pays today. The gap is the premium.",
    controls: [
      { key: "S", label: "Spot", type: "range", min: 40, max: 160, step: 1, value: 100 },
      { key: "K", label: "Strike", type: "range", min: 40, max: 160, step: 1, value: 100 },
      { key: "T", label: "Years", type: "range", min: 0.1, max: 3, step: 0.1, value: 1 },
      { key: "v", label: "Vol (%)", type: "range", min: 5, max: 90, step: 1, value: 25 }
    ],
    compute: function (v) {
      /* Black-Scholes-Merton, European, no dividend. */
      var S = v.S, K = v.K, T = v.T, sig = v.v / 100, r = 0.05;
      var d1 = (Math.log(S / K) + (r + sig * sig / 2) * T) / (sig * Math.sqrt(T));
      var d2 = d1 - sig * Math.sqrt(T);
      var N = function (x) { return 0.5 * (1 + erf(x / Math.SQRT2)); };
      var call = S * N(d1) - K * Math.exp(-r * T) * N(d2);
      var put = K * Math.exp(-r * T) * N(-d2) - S * N(-d1);
      var delta = N(d1);
      var payoff = function (s) { return Math.max(0, s - K); };
      return { S: S, K: K, T: T, sig: sig, call: call, put: put, delta: delta, d1: d1, d2: d2, payoff: payoff, r: r };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 46, r: 12, t: 14, b: 26 };
      var s = scaler(w, h, pad, 0, 2 * r.K, 0, Math.max(r.K, 2 * r.K * 0.5));
      axes(g, w, h, pad, "spot at expiry", "value");
      var pts = [];
      for (var i = 0; i <= 80; i++) {
        var sp = (i / 80) * 2 * r.K;
        pts.push([s.x(sp), s.y(r.payoff(sp))]);
      }
      line(g, pts, C.a1, 2);
      g.strokeStyle = C.a2; g.setLineDash([4, 4]); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(pad.l, s.y(r.call)); g.lineTo(w - pad.r, s.y(r.call)); g.stroke();
      g.setLineDash([]);
      g.strokeStyle = C.a5;
      g.beginPath(); g.moveTo(s.x(r.K), pad.t); g.lineTo(s.x(r.K), h - pad.b); g.stroke();
      label(g, pad.l + 4, pad.t + 10, "call premium " + r.call.toFixed(3), C.a2);
    },
    readouts: function (r) {
      return [
        ["call", r.call.toFixed(4)],
        ["put", r.put.toFixed(4)],
        ["put-call parity gap", (r.call - r.put - (r.S - r.K * Math.exp(-r.r * r.T))).toExponential(2), "good"],
        ["delta", r.delta.toFixed(4)],
        ["d1", r.d1.toFixed(4)]
      ];
    }
  };

  /* Module 08 — Monte Carlo. Seeded paths, antithetic pairs, percentiles. */
  LAB.mc = {
    note: "The orange line is the theoretical normal density for the same S, mu, sigma. The histogram should track it, and the readout shows the sampled percentile against the exact one.",
    controls: [
      { key: "n", label: "Paths", type: "range", min: 200, max: 20000, step: 200, value: 6000 },
      { key: "T", label: "Horizon", type: "range", min: 0.25, max: 5, step: 0.25, value: 1 },
      { key: "anti", label: "Antithetic", type: "range", min: 0, max: 1, step: 1, value: 1 }
    ],
    compute: function (v) {
      var S0 = 100, mu = 0.08, sig = 0.2, T = v.T;
      var s = seeded(20240115);
      var n = v.n, out = [];
      var drift = (mu - sig * sig / 2) * T, vol = sig * Math.sqrt(T);
      for (var i = 0; i < n; i++) {
        var z = gauss(s);
        out.push(S0 * Math.exp(drift + vol * z));
        /* Antithetic partner: the same z reflected through the origin. The two
           paths are maximally dependent, so the sample mean converges faster
           even though the path count doubles. */
        if (v.anti) out.push(S0 * Math.exp(drift - vol * z));
      }
      out.sort(function (a, b) { return a - b; });
      var q = function (p) { return out[Math.min(out.length - 1, Math.max(0, Math.floor(p * out.length)))]; };
      var mean_ = out.reduce(function (a, b) { return a + b; }, 0) / out.length;
      var m = Math.log(S0) + (mu - sig * sig / 2) * T;
      var exactP95 = S0 * Math.exp(m + 1.645 * sig * Math.sqrt(T));
      return { n: out.length, mean: mean_, p5: q(0.05), p50: q(0.5), p95: q(0.95), exactP95: exactP95, out: out, S0: S0, mu: mu, sig: sig, T: T, m: m };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 46, r: 12, t: 14, b: 26 };
      var lo = r.out[0], hi = r.out[r.out.length - 1];
      var bins = 40, span = (hi - lo) / bins || 1, counts = new Array(bins).fill(0);
      r.out.forEach(function (x) { counts[Math.min(bins - 1, Math.floor((x - lo) / span))]++; });
      var maxc = Math.max.apply(null, counts) || 1;
      var s = scaler(w, h, pad, lo, hi, 0, maxc * 1.05);
      axes(g, w, h, pad, "terminal price", "paths");
      var bw = (w - pad.l - pad.r) / bins;
      for (var i = 0; i < bins; i++) bar(g, pad.l + i * bw, s.y(counts[i]), Math.max(1, bw - 1), h - pad.b - s.y(counts[i]), "rgba(91,212,255,0.5)");
      /* Theoretical lognormal density, scaled to the same histogram. */
      var pts = [];
      var pdf = function (x) {
        return Math.exp(-(Math.log(x) - r.m) * (Math.log(x) - r.m) / (2 * r.sig * r.sig * r.T)) / (x * r.sig * Math.sqrt(2 * Math.PI * r.T));
      };
      for (var j = 0; j <= 60; j++) {
        var x = lo + (j / 60) * (hi - lo);
        pts.push([s.x(x), s.y(pdf(x) * r.out.length * span)]);
      }
      line(g, pts, C.a2, 2);
      g.strokeStyle = C.a3; g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(s.x(r.exactP95), pad.t); g.lineTo(s.x(r.exactP95), h - pad.b); g.stroke();
      g.setLineDash([]);
      label(g, pad.l + 4, pad.t + 10, "exact P95 " + r.exactP95.toFixed(1), C.a3);
    },
    readouts: function (r) {
      return [
        ["paths", r.n.toLocaleString()],
        ["mean", r.mean.toFixed(2)],
        ["P5", r.p5.toFixed(2)],
        ["P50", r.p50.toFixed(2)],
        ["P95 sampled", r.p95.toFixed(2)],
        ["P95 exact", r.exactP95.toFixed(2), Math.abs(r.p95 - r.exactP95) / r.exactP95 < 0.03 ? "good" : "hi"]
      ];
    }
  };

  /* Module 09 — numerical care. The cancellation demo, made visible. */
  LAB.cancellation = {
    note: "Sample n values that are all near 1e8 but differ in the third digit. The two-pass form is the truth; the one-pass form subtracts two numbers near 1e16 whose difference is around 1, so the rounding error swamps the answer.",
    controls: [
      { key: "n", label: "Sample size", type: "range", min: 1000, max: 200000, step: 1000, value: 100000 },
      { key: "e", label: "Offset (1e)", type: "range", min: 2, max: 9, step: 1, value: 8 }
    ],
    compute: function (v) {
      /* A deterministic spread of unit-scale deviations around a huge offset. */
      var n = v.n, base = Math.pow(10, v.e);
      var s = seeded(20240115);
      var xs = new Float64Array(n);
      var mean = 0;
      for (var i = 0; i < n; i++) {
        xs[i] = base + (s() - 0.5) * 2;
        mean += xs[i];
      }
      mean /= n;

      /* Two-pass: deviations from the already-known mean. Accurate. */
      var twoPass = 0;
      for (var j = 0; j < n; j++) { var d = xs[j] - mean; twoPass += d * d; }
      twoPass /= n - 1;

      /* One-pass: E[x^2] - E[x]^2. Each term is ~1e16, the difference is ~1. */
      var sq = 0;
      for (var k = 0; k < n; k++) sq += xs[k] * xs[k];
      var onePass = sq / n - mean * mean;

      return { n: n, base: base, mean: mean, twoPass: twoPass, onePass: onePass, rel: Math.abs(onePass - twoPass) / twoPass };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 46, r: 12, t: 14, b: 26 };
      var lg = Math.log10(Math.max(r.rel, 1e-18));
      var s = scaler(w, h, pad, 0, 1, 0, 20);
      axes(g, w, h, pad, "", "log10(relative error)");
      bar(g, w * 0.3, s.y(Math.max(0, lg)), w * 0.4, h - pad.b - s.y(Math.max(0, lg)), "rgba(255,140,0,0.6)");
      label(g, pad.l + 4, pad.t + 10, "rel err 1e" + lg.toFixed(1), C.a2);
      label(g, pad.l + 4, pad.t + 22, "offset 1e" + Math.round(Math.log10(r.base)), C.text);
    },
    readouts: function (r) {
      return [
        ["n", r.n.toLocaleString()],
        ["offset", r.base.toExponential(0)],
        ["mean", r.mean.toExponential(10)],
        ["two-pass var", r.twoPass.toFixed(6), "good"],
        ["one-pass var", r.onePass.toFixed(6), r.onePass > 0 ? "bad" : "bad"],
        ["relative error", r.rel.toExponential(3), r.rel < 1e-3 ? "good" : "bad"]
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

  /* ── Small numerical helpers ───────────────────────────────────────────── */

  /* Deterministic xorshift32, so every lab is reproducible from its inputs. */
  function seeded(seed) {
    var x = (seed >>> 0) || 1;
    return function () {
      x ^= x << 13; x >>>= 0;
      x ^= x >> 17;
      x ^= x << 5; x >>>= 0;
      return x / 4294967296;
    };
  }

  function gauss(s) {
    var u = Math.max(1e-12, s()), v = s();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* Abramowitz & Stegun 7.1.26 — |error| < 1.5e-7, plenty for a CDF. */
  function erf(x) {
    var sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return sign * y;
  }
})();
