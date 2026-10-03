/* app.js - Geomatics Mojo
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

  var STORE = "tutmemo-geo-mojo-v1";

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

  /* ── Geodesy primitives (WGS84) ────────────────────────────────────────── */

  var D2R = Math.PI / 180;
  var R2D = 180 / Math.PI;
  var GA = 6378137.0;
  var GF = 1 / 298.257223563;
  var GE2 = GF * (2 - GF);
  var GN3 = GF / (2 - GF);
  var GCTAU = (2 * Math.sqrt(GN3)) / (1 + GN3);
  var GARC = (GA / (1 + GN3)) * (1 + (GN3 * GN3) / 4 + Math.pow(GN3, 4) / 64);

  function geoAlpha() {
    var n = GN3, n2 = n * n, n3 = n2 * n, n4 = n3 * n, n5 = n4 * n, n6 = n5 * n;
    return [
      n / 2 - 2 * n2 / 3 + 5 * n3 / 16 + 41 * n4 / 180 - 127 * n5 / 288 + 7891 * n6 / 37800,
      13 * n2 / 48 - 3 * n3 / 5 + 557 * n4 / 1440 + 281 * n5 / 630 - 1983433 * n6 / 1935360,
      61 * n3 / 240 - 103 * n4 / 140 + 15061 * n5 / 26880 + 167603 * n6 / 181440,
      49561 * n4 / 161280 - 179 * n5 / 168 + 6601661 * n6 / 7257600,
      34729 * n5 / 80640 - 3418889 * n6 / 1995840,
      212378941 * n6 / 319334400
    ];
  }

  function geoBeta() {
    var n = GN3, n2 = n * n, n3 = n2 * n, n4 = n3 * n, n5 = n4 * n, n6 = n5 * n;
    return [
      n / 2 - 2 * n2 / 3 + 37 * n3 / 96 - n4 / 360 - 81 * n5 / 512 + 96199 * n6 / 604800,
      n2 / 48 + n3 / 15 - 437 * n4 / 1440 + 46 * n5 / 105 - 1118711 * n6 / 3870720,
      17 * n3 / 480 - 37 * n4 / 840 - 209 * n5 / 4480 + 5569 * n6 / 90720,
      4397 * n4 / 161280 - 11 * n5 / 504 - 830251 * n6 / 7257600,
      4583 * n5 / 161280 - 108847 * n6 / 3991680,
      20648693 * n6 / 638668800
    ];
  }

  function meridianRadius(phi) {
    var s = Math.sin(phi);
    return (GA * (1 - GE2)) / Math.pow(1 - GE2 * s * s, 1.5);
  }

  function primeVertical(phi) {
    var s = Math.sin(phi);
    return GA / Math.sqrt(1 - GE2 * s * s);
  }

  var G_AL = geoAlpha();
  var G_BE = geoBeta();

  function tmForward(phi, dlam, k0, fe, fn) {
    var s = Math.sin(phi);
    var t = Math.atanh(s) - GCTAU * Math.atanh(GCTAU * s);
    var sh = Math.sinh(t);
    var xip = Math.atan2(sh, Math.cos(dlam));
    var etap = Math.atanh(Math.sin(dlam) / Math.sqrt(1 + sh * sh));
    var xi = xip, eta = etap;
    for (var j = 1; j <= 6; j++) {
      xi += G_AL[j - 1] * Math.sin(2 * j * xip) * Math.cosh(2 * j * etap);
      eta += G_AL[j - 1] * Math.cos(2 * j * xip) * Math.sinh(2 * j * etap);
    }
    return { E: (fe || 0) + k0 * GARC * eta, N: (fn || 0) + k0 * GARC * xi, xi: xi, eta: eta };
  }

  function tmInverse(E, N, k0, fe, fn) {
    var xi = (N - (fn || 0)) / (k0 * GARC);
    var eta = (E - (fe || 0)) / (k0 * GARC);
    var xip = xi, etap = eta;
    for (var j = 6; j >= 1; j--) {
      xip -= G_BE[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
      etap -= G_BE[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
    }
    var sn = Math.sin(xip), cs = Math.cos(xip);
    var p = Math.tanh(etap), p2 = p * p;
    var den = Math.sqrt(cs * cs + p2 * sn * sn);
    var shT = (sn * Math.sqrt(Math.max(0, 1 - p2))) / den;
    var sinLam = p * Math.sqrt(1 + shT * shT);
    var cosLam = Math.abs(sn) < 1e-14 ? Math.sqrt(Math.max(0, 1 - sinLam * sinLam)) : (shT * cs) / sn;
    var lam = Math.atan2(sinLam, cosLam);
    var tau = Math.asinh(shT);
    var w = Math.tanh(tau);
    for (var i = 0; i < 60; i++) {
      var wc = Math.max(-1 + 1e-15, Math.min(1 - 1e-15, w));
      var f = Math.atanh(wc) - GCTAU * Math.atanh(GCTAU * wc) - tau;
      var df = 1 / (1 - w * w) - (GCTAU * GCTAU) / (1 - GCTAU * GCTAU * w * w);
      if (Math.abs(f) < 1e-16) break;
      w -= f / df;
    }
    return { phi: Math.asin(Math.max(-1, Math.min(1, w))), lam: lam };
  }

  function scaleConv(phi, lam, k0) {
    var d = 1e-7;
    var a1 = tmForward(phi + d, lam, k0), a2 = tmForward(phi - d, lam, k0);
    var b1 = tmForward(phi, lam + d, k0), b2 = tmForward(phi, lam - d, k0);
    var dEdp = (a1.E - a2.E) / (2 * d), dNdp = (a1.N - a2.N) / (2 * d);
    var dEdl = (b1.E - b2.E) / (2 * d), dNdl = (b1.N - b2.N) / (2 * d);
    var M = meridianRadius(phi), Np = primeVertical(phi);
    return {
      kPhi: Math.hypot(dEdp, dNdp) / M,
      kLam: Math.hypot(dEdl, dNdl) / (Np * Math.cos(phi)),
      gamma: Math.atan2(dNdl, dEdl)
    };
  }

  function geodeticToEcef(lat, lon, h) {
    var s = Math.sin(lat), c = Math.cos(lat);
    var n = GA / Math.sqrt(1 - GE2 * s * s);
    return [(n + h) * c * Math.cos(lon), (n + h) * c * Math.sin(lon), (n * (1 - GE2) + h) * s];
  }

  function ecefToGeodetic(x, y, z) {
    var lon = Math.atan2(y, x);
    var p = Math.hypot(x, y);
    var phi = Math.atan2(z, p * (1 - GE2)), n = GA;
    for (var i = 0; i < 15; i++) {
      var s = Math.sin(phi);
      n = GA / Math.sqrt(1 - GE2 * s * s);
      var next = Math.atan2(z + GE2 * n * s, p);
      if (Math.abs(next - phi) < 1e-15) { phi = next; break; }
      phi = next;
    }
    var h = Math.abs(phi) < Math.PI / 2 - 1e-8 ? p / Math.cos(phi) - n : z / Math.sin(phi) - n * (1 - GE2);
    return { phi: phi, lam: lon, h: h };
  }

  /* ── Module 01 — radii of curvature ────────────────────────────────────── */

  LAB.earth = {
    note: "The meridian radius falls faster with latitude than the prime-vertical radius, so they are equal at the equator and the pole and furthest apart in between. The ratio N/M is the correction between the two curvatures.",
    controls: [
      { key: "lat", label: "Latitude (deg)", type: "range", min: 0, max: 90, step: 0.5, value: 51.5 }
    ],
    compute: function (v) {
      var phi = v.lat * D2R;
      var m = meridianRadius(phi), n = primeVertical(phi);
      return { phi: phi, lat: v.lat, m: m, n: n, mean: Math.sqrt(m * n), ratio: n / m };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 52, r: 12, t: 14, b: 26 };
      var s = scaler(w, h, pad, 0, 90, 6335000, 6400000);
      axes(g, w, h, pad, "latitude (deg)", "radius (m)");
      var mp = [], np = [];
      for (var i = 0; i <= 90; i++) { var p = i * D2R; mp.push([s.x(i), s.y(meridianRadius(p))]); np.push([s.x(i), s.y(primeVertical(p))]); }
      line(g, mp, C.a1, 2);
      line(g, np, C.a3, 2);
      g.strokeStyle = C.a2; g.setLineDash([4, 4]); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(s.x(r.lat), pad.t); g.lineTo(s.x(r.lat), h - pad.b); g.stroke();
      g.setLineDash([]);
      dot(g, s.x(r.lat), s.y(r.m), C.a2, 4);
      dot(g, s.x(r.lat), s.y(r.n), C.a2, 4);
      label(g, pad.l + 4, pad.t + 10, "meridian M", C.a1);
      label(g, pad.l + 4, pad.t + 22, "prime vertical N", C.a3);
    },
    readouts: function (r) {
      return [
        ["latitude", r.lat.toFixed(1) + " deg"],
        ["M (meridian)", r.m.toFixed(3)],
        ["N (prime vertical)", r.n.toFixed(3)],
        ["mean radius", r.mean.toFixed(3)],
        ["N/M ratio", r.ratio.toFixed(8)]
      ];
    }
  };

  /* ── Module 02 — coordinate frames ─────────────────────────────────────── */

  var REF = { lat: 51.4778, lon: -0.0015, h: 45.0 };

  LAB.frames = {
    note: "The forward map is closed and the inverse iterates. The map shows the point in longitude-latitude; the baseline is the straight-line chord to the fixed reference point at Greenwich.",
    controls: [
      { key: "lat", label: "Latitude (deg)", type: "range", min: -85, max: 85, step: 0.5, value: 51.5 },
      { key: "lon", label: "Longitude (deg)", type: "range", min: -180, max: 180, step: 1, value: 0 },
      { key: "h", label: "Height (m)", type: "range", min: -100, max: 3000, step: 10, value: 45 }
    ],
    compute: function (v) {
      var lat = v.lat * D2R, lon = v.lon * D2R;
      var e = geodeticToEcef(lat, lon, v.h);
      var back = ecefToGeodetic(e[0], e[1], e[2]);
      var ref = geodeticToEcef(REF.lat * D2R, REF.lon * D2R, REF.h);
      var chord = Math.hypot(e[0] - ref[0], e[1] - ref[1], e[2] - ref[2]);
      return { e: e, back: back, chord: chord, lat: v.lat, lon: v.lon, h: v.h };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 40, r: 12, t: 14, b: 26 };
      var s = scaler(w, h, pad, -180, 180, -90, 90);
      axes(g, w, h, pad, "longitude", "latitude");
      g.strokeStyle = "rgba(255,255,255,0.18)";
      g.beginPath(); g.moveTo(s.x(0), pad.t); g.lineTo(s.x(0), h - pad.b); g.moveTo(pad.l, s.y(0)); g.lineTo(w - pad.r, s.y(0)); g.stroke();
      dot(g, s.x(REF.lon), s.y(REF.lat), C.a3, 4);
      dot(g, s.x(r.lon), s.y(r.lat), C.a2, 4);
      line(g, [[s.x(REF.lon), s.y(REF.lat)], [s.x(r.lon), s.y(r.lat)]], C.a1, 1.5);
      label(g, pad.l + 4, pad.t + 10, "chord " + (r.chord / 1000).toFixed(1) + " km", C.a1);
    },
    readouts: function (r) {
      return [
        ["X", r.e[0].toFixed(3)],
        ["Y", r.e[1].toFixed(3)],
        ["Z", r.e[2].toFixed(3)],
        ["lat (recovered)", (r.back.phi * R2D).toFixed(12) + " deg"],
        ["lon (recovered)", (r.back.lam * R2D).toFixed(12) + " deg"],
        ["h (recovered)", r.back.h.toFixed(9)],
        ["chord to ref", (r.chord / 1000).toFixed(3) + " km"]
      ];
    }
  };

  /* ── Module 03 — traverse closure ──────────────────────────────────────── */

  function parseLegs(text) {
    var out = [];
    text.split("\n").forEach(function (ln) {
      var parts = ln.split(/[\s,;]+/).filter(function (x) { return x.length; });
      if (parts.length >= 2) {
        var az = parseFloat(parts[0]), d = parseFloat(parts[1]);
        if (isFinite(az) && isFinite(d)) out.push({ az: az * D2R, d: d });
      }
    });
    return out;
  }

  LAB.traverse = {
    note: "Each line is an azimuth in degrees and a distance in metres. The red dashed line is the misclosure vector from the last station back to the first.",
    controls: [
      { key: "legs", label: "Legs (azimuth, distance)", type: "textarea", wide: true, value: "45,100\n136,100\n224,100.5\n315,99.8" }
    ],
    compute: function (v) {
      var legs = parseLegs(v.legs || "");
      var pts = [{ e: 0, n: 0 }];
      var se = 0, sn = 0, per = 0;
      for (var i = 0; i < legs.length; i++) {
        var de = legs[i].d * Math.sin(legs[i].az), dn = legs[i].d * Math.cos(legs[i].az);
        se += de; sn += dn; per += legs[i].d;
        pts.push({ e: se, n: sn });
      }
      var mis = Math.hypot(se, sn);
      return { legs: legs, pts: pts, se: se, sn: sn, per: per, mis: mis, acc: per > 0 ? (mis / per) * 1000 : 0 };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 40, r: 12, t: 14, b: 26 };
      var es = r.pts.map(function (p) { return p.e; }), ns = r.pts.map(function (p) { return p.n; });
      var e0 = Math.min.apply(null, es), e1 = Math.max.apply(null, es);
      var n0 = Math.min.apply(null, ns), n1 = Math.max.apply(null, ns);
      if (e1 - e0 < 1) { e0 -= 1; e1 += 1; }
      if (n1 - n0 < 1) { n0 -= 1; n1 += 1; }
      var s = scaler(w, h, pad, e0, e1, n0, n1);
      axes(g, w, h, pad, "East", "North");
      var path = r.pts.map(function (p) { return [s.x(p.e), s.y(p.n)]; });
      line(g, path, C.a1, 2);
      var first = r.pts[0], last = r.pts[r.pts.length - 1];
      g.strokeStyle = C.a4; g.setLineDash([4, 4]); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(s.x(last.e), s.y(last.n)); g.lineTo(s.x(first.e), s.y(first.n)); g.stroke();
      g.setLineDash([]);
      dot(g, s.x(first.e), s.y(first.n), C.a3, 4);
      label(g, pad.l + 4, pad.t + 10, "misclose " + r.mis.toFixed(3) + " m", C.a4);
    },
    readouts: function (r) {
      return [
        ["legs", String(r.legs.length)],
        ["sum E", r.se.toFixed(6)],
        ["sum N", r.sn.toFixed(6)],
        ["perimeter", r.per.toFixed(3) + " m"],
        ["misclosure", r.mis.toFixed(4) + " m", r.mis < 0.05 * r.per / 100 ? "good" : "hi"],
        ["accuracy", r.acc.toFixed(4) + " per mille"]
      ];
    }
  };

  /* ── Module 04 — map projection ────────────────────────────────────────── */

  LAB.projection = {
    note: "The curve is the local scale factor against longitude offset from the central meridian. It passes through k0 on the CM and rises on both sides; the flat bottom is the region a national grid keeps within tolerance.",
    controls: [
      { key: "lat", label: "Latitude (deg)", type: "range", min: 40, max: 60, step: 0.1, value: 51.5 },
      { key: "dlon", label: "Longitude offset (deg)", type: "range", min: -3, max: 3, step: 0.1, value: 1.2 },
      { key: "k0", label: "Central scale k0", type: "range", min: 0.999, max: 1, step: 0.0001, value: 0.9996 }
    ],
    compute: function (v) {
      var phi = v.lat * D2R, lam = v.dlon * D2R;
      var fwd = tmForward(phi, lam, v.k0, 500000, 0);
      var inv = tmInverse(fwd.E, fwd.N, v.k0, 500000, 0);
      var rt = Math.hypot((inv.phi - phi), (inv.lam - lam)) * GA;
      var sc = scaleConv(phi, lam, v.k0);
      return { phi: phi, lam: lam, dlon: v.dlon, k0: v.k0, E: fwd.E, N: fwd.N, rt: rt, kPhi: sc.kPhi, kLam: sc.kLam, gamma: sc.gamma * R2D };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 52, r: 12, t: 14, b: 26 };
      var s = scaler(w, h, pad, -3, 3, 0.9990, 1.0012);
      axes(g, w, h, pad, "longitude offset (deg)", "scale factor k");
      var pts = [];
      for (var i = -30; i <= 30; i++) {
        var dl = i / 10;
        var sc = scaleConv(r.phi, dl * D2R, r.k0);
        pts.push([s.x(dl), s.y(sc.kLam)]);
      }
      line(g, pts, C.a1, 2);
      g.strokeStyle = C.a3; g.setLineDash([4, 4]); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(pad.l, s.y(1)); g.lineTo(w - pad.r, s.y(1)); g.stroke();
      g.setLineDash([]);
      dot(g, s.x(r.dlon), s.y(r.kLam), C.a2, 4);
      label(g, pad.l + 4, pad.t + 10, "k = " + r.kLam.toFixed(7), C.a2);
    },
    readouts: function (r) {
      return [
        ["Easting", r.E.toFixed(4)],
        ["Northing", r.N.toFixed(4)],
        ["round-trip", r.rt.toExponential(3) + " m", r.rt < 1e-3 ? "good" : "bad"],
        ["k from dN/dphi", r.kPhi.toFixed(9)],
        ["k from dE/dlam", r.kLam.toFixed(9)],
        ["convergence", r.gamma.toFixed(6) + " deg"]
      ];
    }
  };

  /* ── Module 05 — GNSS fix ──────────────────────────────────────────────── */

  var GNSS_TRUE = { x: 1200, y: -800 };

  LAB.gnss = {
    note: "Four satellites are placed around the receiver; the ranges are built from the true point plus a fixed error pattern scaled by the slider. The bars are the post-fit residuals - the range errors that the two-parameter fit could not absorb.",
    controls: [
      { key: "rot", label: "Constellation rotation (deg)", type: "range", min: 0, max: 360, step: 5, value: 0 },
      { key: "noise", label: "Range error scale", type: "range", min: 0, max: 5, step: 0.25, value: 1 }
    ],
    compute: function (v) {
      var base = [[-8000, 6000], [12000, 9000], [10000, -11000], [-7000, -9000]];
      var noise = [2.0, -3.0, 1.5, -2.5];
      var a = v.rot * D2R, ca = Math.cos(a), sa = Math.sin(a);
      var sats = base.map(function (p, i) {
        var x = p[0] * ca - p[1] * sa, y = p[0] * sa + p[1] * ca;
        var rho = Math.hypot(GNSS_TRUE.x - x, GNSS_TRUE.y - y) + noise[i] * v.noise;
        return { x: x, y: y, rho: rho };
      });
      var x = 0, y = 0, hdop = 0;
      for (var it = 0; it < 12; it++) {
        var a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
        for (var i = 0; i < sats.length; i++) {
          var dx = x - sats[i].x, dy = y - sats[i].y, rr = Math.hypot(dx, dy);
          var ux = dx / rr, uy = dy / rr, res = sats[i].rho - rr;
          a11 += ux * ux; a12 += ux * uy; a22 += uy * uy; b1 += ux * res; b2 += uy * res;
        }
        var det = a11 * a22 - a12 * a12;
        x += (a22 * b1 - a12 * b2) / det;
        y += (a11 * b2 - a12 * b1) / det;
        hdop = Math.sqrt((a11 + a22) / det);
      }
      var res = sats.map(function (s) { return s.rho - Math.hypot(x - s.x, y - s.y); });
      return { sats: sats, x: x, y: y, hdop: hdop, res: res, err: Math.hypot(x - GNSS_TRUE.x, y - GNSS_TRUE.y) };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 40, r: 12, t: 14, b: 46 };
      var xs = r.sats.map(function (s) { return s.x; }).concat([r.x]);
      var ys = r.sats.map(function (s) { return s.y; }).concat([r.y]);
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
      var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      var s = scaler(w, h, pad, x0 - 1000, x1 + 1000, y0 - 1000, y1 + 1000);
      axes(g, w, h, pad, "East (m)", "North (m)");
      r.sats.forEach(function (st) {
        line(g, [[s.x(st.x), s.y(st.y)], [s.x(r.x), s.y(r.y)]], "rgba(91,212,255,0.4)", 1);
        dot(g, s.x(st.x), s.y(st.y), C.a1, 4);
      });
      dot(g, s.x(r.x), s.y(r.y), C.a2, 5);
      var maxr = Math.max.apply(null, r.res.map(Math.abs)) || 1;
      var bw = (w - pad.l - pad.r) / r.res.length;
      r.res.forEach(function (rv, i) {
        var bh = (Math.abs(rv) / maxr) * 26;
        bar(g, pad.l + i * bw + bw * 0.25, h - pad.b + (rv >= 0 ? 0 : 0), bw * 0.5, bh, rv >= 0 ? "rgba(34,197,94,0.7)" : "rgba(239,68,68,0.7)");
      });
      label(g, pad.l + 4, pad.t + 10, "HDOP " + r.hdop.toFixed(2), C.a2);
    },
    readouts: function (r) {
      return [
        ["x", r.x.toFixed(3) + " m"],
        ["y", r.y.toFixed(3) + " m"],
        ["error to truth", r.err.toFixed(3) + " m", r.err < 20 ? "good" : "hi"],
        ["HDOP", r.hdop.toFixed(4)]
      ];
    }
  };

  /* ── Module 06 — weighted adjustment ───────────────────────────────────── */

  var ADJ_OBS = [[1, 2.1], [2, 3.9], [3, 6.2], [4, 7.8], [5, 10.1]];

  LAB.adjust = {
    note: "The last observation starts at a quarter weight. Lower it and the fitted line rotates toward the four full-weight points while the residual bars grow on the de-weighted point.",
    controls: [
      { key: "w5", label: "Weight of last point", type: "range", min: 0.05, max: 2, step: 0.05, value: 0.25 }
    ],
    compute: function (v) {
      var wts = [1, 1, 1, 1, v.w5];
      var sw = 0, swx = 0, swy = 0, swxx = 0, swxy = 0;
      for (var i = 0; i < ADJ_OBS.length; i++) {
        var x = ADJ_OBS[i][0], y = ADJ_OBS[i][1], w = wts[i];
        sw += w; swx += w * x; swy += w * y; swxx += w * x * x; swxy += w * x * y;
      }
      var det = sw * swxx - swx * swx;
      var a = (swxx * swy - swx * swxy) / det, b = (sw * swxy - swx * swy) / det;
      var res = ADJ_OBS.map(function (o, i) { return o[1] - (a + b * o[0]); });
      var ss = 0;
      for (var j = 0; j < res.length; j++) ss += wts[j] * res[j] * res[j];
      var dof = ADJ_OBS.length - 2;
      return { a: a, b: b, res: res, dof: dof, s0: Math.sqrt(ss / dof), obs: ADJ_OBS, wts: wts };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 40, r: 12, t: 14, b: 26 };
      var s = scaler(w, h, pad, 0, 6, 0, 11);
      axes(g, w, h, pad, "x", "y");
      line(g, [[s.x(0), s.y(r.a)], [s.x(6), s.y(r.a + 6 * r.b)]], C.a2, 2);
      g.strokeStyle = "rgba(255,255,255,0.3)";
      r.obs.forEach(function (o, i) {
        var yf = r.a + r.b * o[0];
        g.beginPath(); g.moveTo(s.x(o[0]), s.y(o[1])); g.lineTo(s.x(o[0]), s.y(yf)); g.stroke();
        dot(g, s.x(o[0]), s.y(o[1]), r.wts[i] > 0.5 ? C.a1 : C.a4, r.wts[i] > 0.5 ? 4 : 3);
      });
      label(g, pad.l + 4, pad.t + 10, "s0 = " + r.s0.toFixed(4), C.a2);
    },
    readouts: function (r) {
      return [
        ["intercept a", r.a.toFixed(6)],
        ["slope b", r.b.toFixed(6)],
        ["dof", String(r.dof)],
        ["s0", r.s0.toFixed(6)]
      ];
    }
  };

  /* ── Module 07 — areas and volumes ─────────────────────────────────────── */

  LAB.area = {
    note: "The profile is a smooth sine. The trapezoid rule joins samples with straight lines; Simpson fits a parabola through each pair of intervals, so it hugs the curve and its error falls far faster as samples are added.",
    controls: [
      { key: "seg", label: "Intervals", type: "range", min: 2, max: 40, step: 2, value: 8 },
      { key: "amp", label: "Amplitude", type: "range", min: 0.5, max: 4, step: 0.5, value: 2 }
    ],
    compute: function (v) {
      var n = v.seg, amp = v.amp, L = 4;
      var xs = [], ys = [];
      for (var i = 0; i <= n; i++) { var x = (i / n) * L; xs.push(x); ys.push(amp * Math.sin(Math.PI * x / L)); }
      var exact = (amp * 2 * L) / Math.PI;
      var trap = 0;
      for (var j = 0; j < n; j++) trap += (ys[j] + ys[j + 1]) * (xs[j + 1] - xs[j]) / 2;
      var h = L / n, s = ys[0] + ys[n];
      for (var k = 1; k < n; k++) s += (k % 2 === 0 ? 2 : 4) * ys[k];
      var simp = Math.abs(s * h / 3);
      return { xs: xs, ys: ys, exact: exact, trap: Math.abs(trap), simp: simp, n: n };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 40, r: 12, t: 14, b: 26 };
      var ymax = Math.max.apply(null, r.ys) * 1.15;
      var s = scaler(w, h, pad, 0, 4, 0, ymax);
      axes(g, w, h, pad, "x", "y");
      var pts = [];
      for (var i = 0; i <= 80; i++) { var x = (i / 80) * 4; pts.push([s.x(x), s.y(r.ys[0] ? (r.ys[0] / Math.sin(Math.PI * r.xs[1] / 4)) * Math.sin(Math.PI * x / 4) : 0)]); }
      line(g, pts, C.a1, 2);
      r.xs.forEach(function (xx, idx) { dot(g, s.x(xx), s.y(r.ys[idx]), C.a2, 3); });
      label(g, pad.l + 4, pad.t + 10, "Simpson " + r.simp.toFixed(5), C.a2);
    },
    readouts: function (r) {
      return [
        ["intervals", String(r.n)],
        ["exact", r.exact.toFixed(6)],
        ["trapezoid", r.trap.toFixed(6)],
        ["Simpson", r.simp.toFixed(6)],
        ["trap error", Math.abs(r.trap - r.exact).toExponential(3), Math.abs(r.trap - r.exact) < 1e-3 ? "good" : "hi"],
        ["Simpson error", Math.abs(r.simp - r.exact).toExponential(3), Math.abs(r.simp - r.exact) < 1e-3 ? "good" : "hi"]
      ];
    }
  };

  /* ── Module 08 — grid bench ────────────────────────────────────────────── */

  LAB.grid = {
    note: "The scalar and unrolled sums are compared block by block. They differ only by the reassociation of the additions, so the relative difference sits near machine epsilon scaled by the cell count - not a bug, just a change of summation order.",
    controls: [
      { key: "n", label: "Grid side", type: "range", min: 128, max: 2048, step: 128, value: 1024 },
      { key: "width", label: "Unroll width", type: "range", min: 2, max: 8, step: 1, value: 4 }
    ],
    compute: function (v) {
      var n = v.n, total = n * n, wdt = v.width;
      var scalar = 0;
      for (var i = 0; i < total; i++) { var s0 = Math.sin(i); scalar += s0 * s0; }
      var unrolled = 0, groups = Math.floor(total / wdt);
      for (var gpt = 0; gpt < groups; gpt++) {
        for (var c = 0; c < wdt; c++) { var sc = Math.sin(gpt * wdt + c); unrolled += sc * sc; }
      }
      for (var tail = groups * wdt; tail < total; tail++) { var st = Math.sin(tail); unrolled += st * st; }
      var rel = Math.abs(scalar - unrolled) / scalar;
      return { n: n, total: total, scalar: scalar, unrolled: unrolled, rel: rel, width: wdt };
    },
    plot: function (g, w, h, r) {
      var pad = { l: 52, r: 12, t: 14, b: 26 };
      var lg = Math.log10(Math.max(r.rel, 1e-18));
      var s = scaler(w, h, pad, 0, 1, 0, 18);
      axes(g, w, h, pad, "", "log10 relative difference");
      bar(g, w * 0.3, s.y(Math.max(0, lg)), w * 0.4, h - pad.b - s.y(Math.max(0, lg)), "rgba(255,140,0,0.6)");
      label(g, pad.l + 4, pad.t + 10, "rel diff 1e" + lg.toFixed(1), C.a2);
      label(g, pad.l + 4, pad.t + 22, "cells " + r.total.toLocaleString(), C.text);
    },
    readouts: function (r) {
      return [
        ["cells", r.total.toLocaleString()],
        ["unroll width", String(r.width)],
        ["scalar sum", r.scalar.toFixed(9)],
        ["unrolled sum", r.unrolled.toFixed(9)],
        ["rel difference", r.rel.toExponential(3), r.rel < 1e-12 ? "good" : "hi"]
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
