/* Progressive enhancement only. The document is fully readable with JS off:
   highlighting is done at build time, and every link is a plain anchor. */
(function () {
  "use strict";

  /* ---------------------------------------------------- theme (persisted) */
  var root = document.documentElement;
  var stored = null;
  try { stored = localStorage.getItem("mojo-libs-theme"); } catch (e) {}
  if (stored) root.setAttribute("data-theme", stored);
  else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
    root.setAttribute("data-theme", "light");
  }

  var themeBtn = document.getElementById("themeToggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("mojo-libs-theme", next); } catch (e) {}
    });
  }

  /* ---------------------------------------------------- copy buttons */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error("copy blocked"));
    });
  }

  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest ? ev.target.closest(".cb__copy") : null;
    if (!btn) return;
    var fig = btn.closest(".cb");
    if (!fig) return;
    var code = fig.querySelector("code");
    if (!code) return;
    // textContent preserves the raw source, stripping the highlight spans.
    // Strip zero-width spaces and widen tabs so pasted code matches the listing.
    var clean = code.textContent.split("\u200b").join("").replace(/\t/g, "    ");
    copyText(clean).then(
      function () {
        btn.textContent = "Copied";
        btn.classList.add("copied");
        setTimeout(function () {
          btn.textContent = "Copy";
          btn.classList.remove("copied");
        }, 1400);
      },
      function () {
        btn.textContent = "Press ⌘/Ctrl+C";
        setTimeout(function () { btn.textContent = "Copy"; }, 1800);
      }
    );
  });

  /* ---------------------------------------------------- reading progress */
  var bar = document.getElementById("progress");
  var ticking = false;
  function updateProgress() {
    if (!bar) return;
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
    ticking = false;
  }
  if (bar) {
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(updateProgress); }
    }, { passive: true });
    updateProgress();
  }

  /* ---------------------------------------------------- collapsible rails */
  var rail = document.getElementById("rail") || document.querySelector(".interactive-rail");
  var railBtn = document.getElementById("railToggle");

  function setRailCollapsed(collapsed) {
    document.body.classList.toggle("rail-collapsed", collapsed);
    if (railBtn) {
      railBtn.setAttribute("aria-expanded", String(!collapsed));
      railBtn.setAttribute("aria-label", collapsed ? "Expand contents" : "Collapse contents");
    }
    if (rail && window.innerWidth <= 1080) {
      rail.classList.toggle("open", !collapsed);
    }
  }

  if (railBtn) {
    railBtn.addEventListener("click", function () {
      var collapsed = !document.body.classList.contains("rail-collapsed");
      setRailCollapsed(collapsed);
    });
  }

  if (rail) {
    rail.addEventListener("click", function (ev) {
      if (ev.target.tagName === "A") {
        if (window.innerWidth <= 1080) {
          setRailCollapsed(true);
        }
      }
    });
  }

  var compactLayout = window.innerWidth <= 1080;
  setRailCollapsed(compactLayout);
  window.addEventListener("resize", function () {
    var nextCompactLayout = window.innerWidth <= 1080;
    if (nextCompactLayout !== compactLayout) {
      compactLayout = nextCompactLayout;
      setRailCollapsed(compactLayout);
    }
  });

  /* ---------------------------------------------------- scroll-spy TOC */
  var links = Array.prototype.slice.call(document.querySelectorAll(".rail a[href^='#']"));
  if (!links.length) return;

  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });

  var targets = Object.keys(byId)
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);

  var active = null;

  function setActive(el) {
    if (!el || el === active) return;
    if (active) active.classList.remove("active");
    active = el;
    if (el) {
      el.classList.add("active");
      var railBox = document.getElementById("rail");
      if (railBox && railBox.scrollHeight > railBox.clientHeight) {
        var top = el.offsetTop - railBox.clientHeight / 2;
        railBox.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    }
  }

  function spy() {
    var line = window.innerHeight * 0.28;
    var best = null;
    for (var i = 0; i < targets.length; i++) {
      if (targets[i].getBoundingClientRect().top <= line) best = targets[i];
      else break;
    }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      best = targets[targets.length - 1];
    }
    setActive(best ? byId[best.id] : null);
  }

  var queued = false;
  window.addEventListener("scroll", function () {
    if (!queued) { queued = true; window.requestAnimationFrame(function () { spy(); queued = false; }); }
  }, { passive: true });
  window.addEventListener("resize", spy);
  spy();
})();