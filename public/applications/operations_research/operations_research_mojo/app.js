/* app.js - Operations Research Mojo
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

  var STORE = "tutmemo-or-mojo-v1";

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

  /* ── Operations-research primitives shared by the labs ─────────────────── */

  function orRound(v) { return Math.round(v * 1e6) / 1e6; }

  /* Vertices of the feasible polygon for the running LP:
       6x + 4y <= b1,  x + 2y <= b2,  x >= 0,  y >= 0. */
  function orLines(b1, b2) {
    return [[6, 4, b1], [1, 2, b2], [1, 0, 0], [0, 1, 0]];
  }

  function orFeasible(x, y, b1, b2) {
    return x >= -1e-9 && y >= -1e-9 && 6 * x + 4 * y <= b1 + 1e-9 && x + 2 * y <= b2 + 1e-9;
  }

  function orVerts(b1, b2) {
    var L = orLines(b1, b2), out = [];
    for (var i = 0; i < L.length; i++) {
      for (var j = i + 1; j < L.length; j++) {
        var det = L[i][0] * L[j][1] - L[j][0] * L[i][1];
        if (Math.abs(det) < 1e-12) continue;
        var x = (L[i][2] * L[j][1] - L[j][2] * L[i][1]) / det;
        var y = (L[i][0] * L[j][2] - L[j][0] * L[i][2]) / det;
        if (!orFeasible(x, y, b1, b2)) continue;
        var dup = out.some(function (p) { return Math.hypot(p.x - x, p.y - y) < 1e-7; });
        if (!dup) out.push({ x: x, y: y });
      }
    }
    return out;
  }

  function orBest(b1, b2, c1, c2) {
    var vs = orVerts(b1, b2), best = null;
    vs.forEach(function (p) {
      var z = c1 * p.x + c2 * p.y;
      if (!best || z > best.z) best = { x: p.x, y: p.y, z: z };
    });
    return best;
  }

  /* Generic simplex for the 2x2 running LP; returns a snapshot per iteration.
     Column order: x, y, s1, s2, rhs. */
  function orSimplex(b1, b2, c1, c2, maxSteps) {
    var T = [[6, 4, 1, 0, b1], [1, 2, 0, 1, b2], [-c1, -c2, 0, 0, 0]];
    var basis = [2, 3], snaps = [];
    function snap() {
      var x = 0, y = 0, z = 0;
      for (var i = 0; i < 2; i++) {
        if (basis[i] === 0) x = T[i][4];
        if (basis[i] === 1) y = T[i][4];
      }
      z = c1 * x + c2 * y;
      return { T: T.map(function (r) { return r.slice(); }), basis: basis.slice(), x: x, y: y, z: z };
    }
    snaps.push(snap());
    for (var step = 0; step < maxSteps; step++) {
      var e = -1, most = -1e-9;
      for (var j = 0; j < 4; j++) if (T[2][j] < most) { most = T[2][j]; e = j; }
      if (e === -1) break;
      var l = -1, bestRatio = Infinity;
      for (var i = 0; i < 2; i++) if (T[i][e] > 1e-9) {
        var r = T[i][4] / T[i][e];
        if (r < bestRatio) { bestRatio = r; l = i; }
      }
      if (l === -1) break;
      var p = T[l][e];
      for (var k = 0; k < 5; k++) T[l][k] /= p;
      for (var m = 0; m < 3; m++) if (m !== l) {
        var f = T[m][e];
        if (Math.abs(f) > 1e-12) for (var kk = 0; kk < 5; kk++) T[m][kk] -= f * T[l][kk];
      }
      basis[l] = e;
      snaps.push(snap());
    }
    return snaps;
  }

  var OR_EDGES = [[0, 1, 7], [0, 2, 9], [0, 5, 14], [1, 2, 10], [1, 3, 15], [2, 3, 11], [2, 5, 2], [3, 4, 6], [4, 5, 9]];

  function orDijkstra(src) {
    var N = 6, dist = [], done = [], parent = [], adj = [];
    for (var i = 0; i < N; i++) { dist.push(i === src ? 0 : Infinity); done.push(false); parent.push(-1); adj.push([]); }
    OR_EDGES.forEach(function (e) { adj[e[0]].push([e[1], e[2]]); adj[e[1]].push([e[0], e[2]]); });
    for (var k = 0; k < N; k++) {
      var u = -1, best = Infinity;
      for (var i = 0; i < N; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u === -1) break;
      done[u] = true;
      adj[u].forEach(function (pr) {
        if (dist[u] + pr[1] < dist[pr[0]]) { dist[pr[0]] = dist[u] + pr[1]; parent[pr[0]] = u; }
      });
    }
    return { dist: dist, parent: parent };
  }

  function orFactorial(n) { var f = 1; for (var i = 2; i <= n; i++) f *= i; return f; }

  function orMMc(lam, mu, c) {
    var a = lam / mu, rho = a / c;
    if (rho >= 1) return { rho: rho, unstable: true };
    var sum = 0, term = 1;
    for (var k = 0; k < c; k++) { if (k > 0) term *= a / k; sum += term; }
    var pc = term * a / c / (1 - rho);
    var P0 = 1 / (sum + pc);
    var Lq = P0 * Math.pow(a, c) / (orFactorial(c) * Math.pow(1 - rho, 2)) * rho;
    var Wq = Lq / lam, W = Wq + 1 / mu, L = lam * W;
    return { rho: rho, P0: P0, Lq: Lq, Wq: Wq, W: W, L: L };
  }

  function orPolygon(g, s, verts, fill) {
    if (!verts.length) return;
    var cx = 0, cy = 0;
    verts.forEach(function (p) { cx += p.x; cy += p.y; });
    cx /= verts.length; cy /= verts.length;
    var ordered = verts.slice().sort(function (p, q) {
      return Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx);
    });
    g.beginPath();
    ordered.forEach(function (p, i) { i ? g.lineTo(s.x(p.x), s.y(p.y)) : g.moveTo(s.x(p.x), s.y(p.y)); });
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    g.strokeStyle = C.a1;
    g.lineWidth = 1.5;
    g.stroke();
  }

  /* ── Module 01 — objective and resource usage ──────────────────────────── */

  LAB.objective = {
    note: "A plan of x units of the first product and y of the second. Each bar is a resource against its capacity; a full bar is a binding constraint.",
    controls: [
      { key: "x", label: "Product 1 (x)", type: "range", min: 0, max: 6, step: 1, value: 3 },
      { key: "y", label: "Product 2 (y)", type: "range", min: 0, max: 6, step: 1, value: 1 }
    ],
    compute: function (v) {
      var caps = [24, 6, 6, 6];
      var use = [6 * v.x + 4 * v.y, v.x + 2 * v.y, v.x, v.y];
      return { x: v.x, y: v.y, z: 5 * v.x + 4 * v.y, use: use, caps: caps };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 44, r: 12, t: 14, b: 26 };
      axes(g, w, h, pad, "resource", "used / capacity");
      var names = ["labor", "steel", "wood", "paint"];
      var bw = (w - pad.l - pad.r) / r.use.length;
      for (var i = 0; i < r.use.length; i++) {
        var ratio = Math.max(0, Math.min(1.2, r.use[i] / r.caps[i]));
        var bh = ratio * (h - pad.t - pad.b);
        var col = r.use[i] > r.caps[i] + 1e-9 ? C.a4 : C.a3;
        bar(g, pad.l + i * bw + 6, h - pad.b - bh, bw - 12, bh, col);
        label(g, pad.l + i * bw + 6, h - pad.b - bh - 4, r.use[i].toFixed(0), col);
        label(g, pad.l + i * bw + 6, h - 8, names[i], C.text);
      }
    },
    readouts: function (r) {
      var rows = [["x", r.x.toFixed(0)], ["y", r.y.toFixed(0)], ["profit z", r.z.toFixed(1)]];
      var names = ["labor", "steel", "wood", "paint"];
      for (var i = 0; i < 4; i++) rows.push([names[i], r.use[i].toFixed(0) + " / " + r.caps[i], r.use[i] > r.caps[i] + 1e-9 ? "hi" : ""]);
      return rows;
    }
  };

  /* ── Module 02 — LP geometry ───────────────────────────────────────────── */

  LAB.lp = {
    note: "The shaded polygon is the feasible set. The objective line is swept until it last touches a vertex - that vertex is optimal.",
    controls: [
      { key: "c1", label: "objective coefficient x", type: "range", min: 1, max: 10, step: 0.5, value: 5 },
      { key: "c2", label: "objective coefficient y", type: "range", min: 1, max: 10, step: 0.5, value: 4 },
      { key: "b1", label: "resource 1 limit", type: "range", min: 12, max: 48, step: 1, value: 24 },
      { key: "b2", label: "resource 2 limit", type: "range", min: 3, max: 12, step: 0.5, value: 6 }
    ],
    compute: function (v) {
      var verts = orVerts(v.b1, v.b2);
      var best = orBest(v.b1, v.b2, v.c1, v.c2);
      return { verts: verts, best: best, c1: v.c1, c2: v.c2, b1: v.b1, b2: v.b2 };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 40, r: 14, t: 14, b: 26 };
      var xmax = Math.max(r.b1 / 6, r.b2) * 1.05;
      var ymax = Math.max(r.b1 / 4, r.b2 / 2) * 1.05;
      var s = scaler(w, h, pad, 0, xmax, 0, ymax);
      axes(g, w, h, pad, "x", "y");
      orPolygon(g, s, r.verts, "rgba(91,212,255,0.12)");
      if (r.best) {
        var cx = r.best.x, cy = r.best.y;
        var d = Math.max(xmax, ymax);
        var dx = r.c2, dy = -r.c1;
        var len = Math.hypot(dx, dy) || 1;
        dx = (dx / len) * d; dy = (dy / len) * d;
        line(g, [[s.x(cx - dx), s.y(cy - dy)], [s.x(cx + dx), s.y(cy + dy)]], C.a4, 1.5);
        dot(g, s.x(cx), s.y(cy), C.a2, 4.5);
        label(g, pad.l + 4, pad.t + 12, "z = " + r.best.z.toFixed(2) + " at (" + r.best.x.toFixed(2) + ", " + r.best.y.toFixed(2) + ")", C.a2);
      }
    },
    readouts: function (r) {
      return [
        ["vertices", String(r.verts.length)],
        ["optimal x", r.best ? r.best.x.toFixed(3) : "-"],
        ["optimal y", r.best ? r.best.y.toFixed(3) : "-"],
        ["optimal z", r.best ? r.best.z.toFixed(3) : "-", "good"]
      ];
    }
  };

  /* ── Module 03 — simplex stepper ───────────────────────────────────────── */

  LAB.simplex = {
    note: "Step 0 is the slack basis at the origin. Each step pivots the most negative reduced cost into the basis; the objective rises until no improving column remains.",
    controls: [
      { key: "step", label: "iteration", type: "range", min: 0, max: 2, step: 1, value: 2 }
    ],
    compute: function (v) {
      var snaps = orSimplex(24, 6, 5, 4, v.step);
      var cur = snaps[Math.min(v.step, snaps.length - 1)];
      return { snaps: snaps, cur: cur, step: v.step };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 40, r: 14, t: 14, b: 26 };
      var s = scaler(w, h, pad, 0, 8, 0, 8);
      axes(g, w, h, pad, "x", "y");
      orPolygon(g, s, orVerts(24, 6), "rgba(91,212,255,0.10)");
      dot(g, s.x(r.cur.x), s.y(r.cur.y), C.a2, 5);
      label(g, pad.l + 4, pad.t + 12, "z = " + r.cur.z.toFixed(3) + " at (" + r.cur.x.toFixed(2) + ", " + r.cur.y.toFixed(2) + ")", C.a2);
    },
    readouts: function (r) {
      var names = ["x", "y", "s1", "s2"];
      var rows = [["iteration", String(r.step)], ["basis", r.cur.basis.map(function (b) { return names[b]; }).join(", ")]];
      rows.push(["x", r.cur.x.toFixed(3)]);
      rows.push(["y", r.cur.y.toFixed(3)]);
      rows.push(["z", r.cur.z.toFixed(3), "good"]);
      rows.push(["reduced cost", r.cur.T[2].slice(0, 4).map(function (v) { return v.toFixed(3); }).join("  ")]);
      return rows;
    }
  };

  /* ── Module 04 — duality and sensitivity ───────────────────────────────── */

  LAB.dual = {
    note: "Perturb the first resource limit. While the same pair of constraints binds, the profit moves on a line of slope equal to the shadow price 0.75.",
    controls: [
      { key: "b1", label: "resource 1 limit", type: "range", min: 12, max: 48, step: 1, value: 24 }
    ],
    compute: function (v) {
      var best = orBest(v.b1, 6, 5, 4);
      return { b1: v.b1, base: 21, best: best, dz: best ? best.z - 21 : 0, inRange: v.b1 >= 12 - 1e-9 && v.b1 <= 36 + 1e-9 };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 44, r: 14, t: 14, b: 26 };
      var s = scaler(w, h, pad, 12, 48, 12, 36);
      axes(g, w, h, pad, "resource 1 limit", "optimal profit z");
      var pts = [];
      for (var b = 12; b <= 48; b += 0.5) {
        var best = orBest(b, 6, 5, 4);
        if (best) pts.push([s.x(b), s.y(best.z)]);
      }
      line(g, pts, C.a1, 2);
      dot(g, s.x(r.b1), s.y(r.best ? r.best.z : 0), C.a2, 4.5);
      label(g, pad.l + 4, pad.t + 12, "slope y1 = 0.75 while basis is fixed", C.a3);
    },
    readouts: function (r) {
      return [
        ["resource 1 limit", r.b1.toFixed(1)],
        ["optimal x", r.best ? r.best.x.toFixed(3) : "-"],
        ["optimal y", r.best ? r.best.y.toFixed(3) : "-"],
        ["optimal z", r.best ? r.best.z.toFixed(3) : "-"],
        ["change in z", (r.dz >= 0 ? "+" : "") + r.dz.toFixed(3)],
        ["within allowable range", r.inRange ? "yes" : "no", r.inRange ? "good" : "hi"]
      ];
    }
  };

  /* ── Module 05 — knapsack ──────────────────────────────────────────────── */

  LAB.knapsack = {
    note: "The step curve is the exact integer DP value; the smooth line is the fractional relaxation. Their difference at the chosen capacity is the integrality gap.",
    controls: [
      { key: "cap", label: "capacity", type: "range", min: 1, max: 10, step: 1, value: 6 }
    ],
    compute: function (v) {
      var w = [2, 3, 4, 5], val = [3, 4, 5, 6], cap = v.cap;
      var dp = []; for (var c = 0; c <= cap; c++) dp.push(0);
      for (var i = 0; i < w.length; i++) for (var cc = cap; cc >= w[i]; cc--) dp[cc] = Math.max(dp[cc], dp[cc - w[i]] + val[i]);
      var order = [0, 1, 2, 3].sort(function (a, b) { return val[b] / w[b] - val[a] / w[a]; });
      var rem = cap, lp = 0;
      for (var k = 0; k < order.length; k++) {
        var idx = order[k];
        if (w[idx] <= rem) { rem -= w[idx]; lp += val[idx]; }
        else { lp += val[idx] * rem / w[idx]; rem = 0; break; }
      }
      var intCurve = [];
      for (var t = 0; t <= cap; t++) {
        var dt = []; for (var q = 0; q <= t; q++) dt.push(0);
        for (var p = 0; p < w.length; p++) for (var c2 = t; c2 >= w[p]; c2--) dt[c2] = Math.max(dt[c2], dt[c2 - w[p]] + val[p]);
        intCurve.push(dt[t]);
      }
      return { cap: cap, best: dp[cap], lp: lp, gap: lp - dp[cap], curve: intCurve };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 40, r: 14, t: 14, b: 26 };
      var s = scaler(w, h, pad, 0, r.cap, 0, Math.max(r.lp, r.best) * 1.15 + 1);
      axes(g, w, h, pad, "capacity", "value");
      var pts = r.curve.map(function (v, c) { return [s.x(c), s.y(v)]; });
      line(g, pts, C.a1, 2);
      for (var c = 0; c < r.curve.length; c++) dot(g, s.x(c), s.y(r.curve[c]), C.a1, 2.5);
      var lpPts = [];
      for (var c2 = 0; c2 <= r.cap; c2++) lpPts.push([s.x(c2), s.y(r.lp * c2 / r.cap)]);
      line(g, lpPts, C.a4, 1.5);
      label(g, pad.l + 4, pad.t + 12, "gap " + r.gap.toFixed(2) + " at capacity " + r.cap, C.a2);
    },
    readouts: function (r) {
      return [
        ["capacity", String(r.cap)],
        ["integer best", String(r.best), "good"],
        ["fractional bound", r.lp.toFixed(3)],
        ["integrality gap", r.gap.toFixed(3)]
      ];
    }
  };

  /* ── Module 06 — shortest paths ────────────────────────────────────────── */

  LAB.graph = {
    note: "Dijkstra settles the nearest unsettled node, then relaxes its edges. Green edges form the shortest-path tree from the source.",
    controls: [
      { key: "src", label: "source node", type: "select", options: ["0", "1", "2", "3", "4", "5"], value: "0" }
    ],
    compute: function (v) {
      var src = parseInt(v.src, 10);
      var res = orDijkstra(src);
      return { src: src, dist: res.dist, parent: res.parent };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 24, r: 24, t: 20, b: 20 };
      var N = 6, pos = [];
      var cx = (w) / 2, cy = (h) / 2, R = Math.min(w - pad.l - pad.r, h - pad.t - pad.b) / 2 - 6;
      for (var i = 0; i < N; i++) {
        var ang = -Math.PI / 2 + i * 2 * Math.PI / N;
        pos.push([cx + R * Math.cos(ang), cy + R * Math.sin(ang)]);
      }
      OR_EDGES.forEach(function (e) {
        var isTree = r.parent[e[0]] === e[1] || r.parent[e[1]] === e[0];
        line(g, [pos[e[0]], pos[e[1]]], isTree ? C.a3 : "rgba(255,255,255,0.16)", isTree ? 2.5 : 1);
        var mx = (pos[e[0]][0] + pos[e[1]][0]) / 2, my = (pos[e[0]][1] + pos[e[1]][1]) / 2;
        label(g, mx, my, String(e[2]), C.text);
      });
      for (var k = 0; k < N; k++) {
        dot(g, pos[k][0], pos[k][1], k === r.src ? C.a2 : C.a1, k === r.src ? 6 : 4.5);
        var d = r.dist[k];
        label(g, pos[k][0] - 6, pos[k][1] - 8, (isFinite(d) ? d : "-") + "", C.a1);
      }
    },
    readouts: function (r) {
      var rows = [["source", String(r.src)]];
      for (var i = 0; i < 6; i++) rows.push(["node " + i, isFinite(r.dist[i]) ? r.dist[i].toFixed(1) : "unreachable"]);
      return rows;
    }
  };

  /* ── Module 07 — queues ────────────────────────────────────────────────── */

  LAB.queue = {
    note: "M/M/c metrics. The curve is Lq as the arrival rate grows at the chosen service rate and server count; it diverges as utilisation approaches one.",
    controls: [
      { key: "lam", label: "arrival rate lambda", type: "range", min: 0.5, max: 7.5, step: 0.5, value: 6 },
      { key: "mu", label: "service rate mu", type: "range", min: 1, max: 8, step: 0.5, value: 4 },
      { key: "c", label: "servers c", type: "range", min: 1, max: 5, step: 1, value: 2 }
    ],
    compute: function (v) {
      return { lam: v.lam, mu: v.mu, c: v.c, m: orMMc(v.lam, v.mu, v.c) };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 44, r: 14, t: 14, b: 26 };
      var lmax = r.c * r.mu * 0.98;
      var pts = [], ymax = 0.001;
      for (var lam = 0.05; lam <= lmax; lam += lmax / 120) {
        var m = orMMc(lam, r.mu, r.c);
        if (m.unstable) continue;
        ymax = Math.max(ymax, m.Lq);
        pts.push([lam, m.Lq]);
      }
      var s = scaler(w, h, pad, 0, lmax, 0, ymax * 1.1);
      axes(g, w, h, pad, "arrival rate lambda", "average queue Lq");
      line(g, pts.map(function (p) { return [s.x(p[0]), s.y(p[1])]; }), C.a1, 2);
      if (!r.m.unstable) dot(g, s.x(r.lam), s.y(r.m.Lq), C.a2, 4.5);
      label(g, pad.l + 4, pad.t + 12, r.m.unstable ? "unstable: rho >= 1" : "rho = " + r.m.rho.toFixed(3), r.m.unstable ? C.a4 : C.a3);
    },
    readouts: function (r) {
      if (r.m.unstable) return [["arrival rate", r.lam.toFixed(1)], ["servers", String(r.c)], ["rho", r.m.rho.toFixed(3)], ["status", "unstable (rho >= 1)", "hi"]];
      return [
        ["arrival rate", r.lam.toFixed(1)],
        ["service rate", r.mu.toFixed(1)],
        ["servers", String(r.c)],
        ["rho", r.m.rho.toFixed(3), r.m.rho < 0.9 ? "good" : "hi"],
        ["P0", r.m.P0.toFixed(6)],
        ["Lq", r.m.Lq.toFixed(6)],
        ["Wq", r.m.Wq.toFixed(6)],
        ["W", r.m.W.toFixed(6)],
        ["L", r.m.L.toFixed(6)]
      ];
    }
  };

  /* ── Module 08 — gradient descent ──────────────────────────────────────── */

  LAB.descent = {
    note: "The path of gradient iterates on the objective's plane. The minimum is the dot at (2, 2); the colours mark the start and the final step.",
    controls: [
      { key: "lr", label: "step size alpha", type: "range", min: 0.01, max: 0.6, step: 0.01, value: 0.1 },
      { key: "iters", label: "iterations", type: "range", min: 1, max: 60, step: 1, value: 40 }
    ],
    compute: function (v) {
      var x = 0, y = 0, path = [[0, 0]];
      for (var i = 0; i < v.iters; i++) {
        var gx = 2 * x + y - 6, gy = x + 2 * y - 6;
        x -= v.lr * gx; y -= v.lr * gy;
        path.push([x, y]);
      }
      return { path: path, x: x, y: y, f: x * x + y * y + x * y - 6 * x - 6 * y, lr: v.lr, iters: v.iters };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 40, r: 14, t: 14, b: 26 };
      var xs = r.path.map(function (p) { return p[0]; }), ys = r.path.map(function (p) { return p[1]; });
      var lo = Math.min.apply(null, xs.concat(ys, [0])), hi = Math.max.apply(null, xs.concat(ys, [2]));
      if (hi - lo < 1) hi = lo + 1;
      var s = scaler(w, h, pad, lo, hi, lo, hi);
      axes(g, w, h, pad, "x", "y");
      line(g, r.path.map(function (p) { return [s.x(p[0]), s.y(p[1])]; }), C.a1, 1.5);
      r.path.forEach(function (p, i) {
        if (i === 0 || i === r.path.length - 1 || i % 5 === 0) dot(g, s.x(p[0]), s.y(p[1]), i === 0 ? C.a3 : C.a1, 2.5);
      });
      dot(g, s.x(2), s.y(2), C.a4, 4);
      label(g, pad.l + 4, pad.t + 12, "f = " + r.f.toFixed(6) + "  alpha = " + r.lr.toFixed(2), C.a2);
    },
    readouts: function (r) {
      return [
        ["x", r.x.toFixed(9)],
        ["y", r.y.toFixed(9)],
        ["f(x, y)", r.f.toFixed(9)],
        ["iterations", String(r.iters)],
        ["step size", r.lr.toFixed(2)]
      ];
    }
  };

  /* ── Module 09 — Amdahl's law ──────────────────────────────────────────── */

  LAB.amdahl = {
    note: "Speedup against core count for the chosen parallel fraction. The ceiling 1/(1-p) is the horizontal asymptote the curve can never pass.",
    controls: [
      { key: "p", label: "parallel fraction p", type: "range", min: 0.5, max: 0.999, step: 0.001, value: 0.95 },
      { key: "cores", label: "cores n", type: "range", min: 1, max: 64, step: 1, value: 8 }
    ],
    compute: function (v) {
      var speedup = 1 / ((1 - v.p) + v.p / v.cores);
      return { p: v.p, cores: v.cores, speedup: speedup, ceiling: 1 / (1 - v.p) };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 44, r: 14, t: 14, b: 26 };
      var s = scaler(w, h, pad, 1, 64, 1, Math.min(r.ceiling, 40) * 1.05);
      axes(g, w, h, pad, "cores n", "speedup S(n)");
      var pts = [];
      for (var n = 1; n <= 64; n += 1) pts.push([s.x(n), s.y(1 / ((1 - r.p) + r.p / n))]);
      line(g, pts, C.a1, 2);
      g.strokeStyle = C.a4; g.setLineDash([5, 4]); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(pad.l, s.y(r.ceiling)); g.lineTo(w - pad.r, s.y(r.ceiling)); g.stroke();
      g.setLineDash([]);
      dot(g, s.x(r.cores), s.y(r.speedup), C.a2, 4.5);
      label(g, pad.l + 4, pad.t + 12, "S = " + r.speedup.toFixed(3) + " at n = " + r.cores, C.a2);
      label(g, pad.l + 4, s.y(r.ceiling) - 4, "ceiling " + r.ceiling.toFixed(2), C.a4);
    },
    readouts: function (r) {
      return [
        ["parallel fraction", r.p.toFixed(3)],
        ["cores", String(r.cores)],
        ["speedup S(n)", r.speedup.toFixed(6), "good"],
        ["ceiling 1/(1-p)", r.ceiling.toFixed(6)]
      ];
    }
  };

  /* ── Module 09 — capstone production plan ──────────────────────────────── */

  LAB.capstone = {
    note: "The polygon is the continuous feasible set; the dots are feasible whole-unit plans, shaded by profit. The best integer plan need not be the rounded LP vertex.",
    controls: [
      { key: "b1", label: "resource 1 limit", type: "range", min: 12, max: 48, step: 1, value: 24 },
      { key: "b2", label: "resource 2 limit", type: "range", min: 3, max: 12, step: 0.5, value: 6 }
    ],
    compute: function (v) {
      var lp = orBest(v.b1, v.b2, 5, 4);
      var best = null, pts = [];
      var nx = Math.ceil(v.b1 / 6) + 1, ny = Math.ceil(v.b2 / 2) + 1;
      for (var xi = 0; xi <= nx; xi++) {
        for (var yi = 0; yi <= ny; yi++) {
          if (6 * xi + 4 * yi <= v.b1 + 1e-9 && xi + 2 * yi <= v.b2 + 1e-9) {
            var z = 5 * xi + 4 * yi;
            pts.push({ x: xi, y: yi, z: z });
            if (!best || z > best.z) best = { x: xi, y: yi, z: z };
          }
        }
      }
      var rounded = lp ? { x: Math.floor(lp.x), y: Math.floor(lp.y) } : null;
      var rz = rounded ? 5 * rounded.x + 4 * rounded.y : 0;
      return { lp: lp, best: best, pts: pts, rounded: rounded, rz: rz, b1: v.b1, b2: v.b2 };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 40, r: 14, t: 14, b: 26 };
      var xmax = Math.max(r.b1 / 6, r.b2) * 1.05;
      var ymax = Math.max(r.b1 / 4, r.b2 / 2) * 1.05;
      var s = scaler(w, h, pad, 0, xmax, 0, ymax);
      axes(g, w, h, pad, "x", "y");
      var zmax = r.best ? r.best.z : 1;
      r.pts.forEach(function (p) {
        var t = zmax > 0 ? p.z / zmax : 0;
        g.fillStyle = "rgba(34,197,94," + (0.15 + 0.75 * t) + ")";
        g.beginPath(); g.arc(s.x(p.x), s.y(p.y), 4, 0, Math.PI * 2); g.fill();
      });
      orPolygon(g, s, orVerts(r.b1, r.b2), null);
      if (r.lp) dot(g, s.x(r.lp.x), s.y(r.lp.y), C.a4, 4.5);
      if (r.best) dot(g, s.x(r.best.x), s.y(r.best.y), C.a2, 6);
      label(g, pad.l + 4, pad.t + 12, "LP z = " + (r.lp ? r.lp.z.toFixed(2) : "-") + "  best integer z = " + (r.best ? r.best.z : "-"), C.a2);
    },
    readouts: function (r) {
      return [
        ["LP optimum x", r.lp ? r.lp.x.toFixed(3) : "-"],
        ["LP optimum y", r.lp ? r.lp.y.toFixed(3) : "-"],
        ["LP profit", r.lp ? r.lp.z.toFixed(3) : "-"],
        ["rounded plan", r.rounded ? "(" + r.rounded.x + ", " + r.rounded.y + ") profit " + r.rz : "-"],
        ["best integer plan", r.best ? "(" + r.best.x + ", " + r.best.y + ")" : "-"],
        ["integer profit", r.best ? String(r.best.z) : "-", "good"],
        ["integrality gap", r.best && r.lp ? (r.lp.z - r.best.z).toFixed(3) : "-"]
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
      if (spec.value !== undefined) el.value = spec.value;
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
