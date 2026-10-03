/* ==========================================================================
   Mojo v1 manual — behaviour.
   No dependencies, no build step, no network beyond this book's own folder.
   ========================================================================== */

(function () {
  "use strict";

  var STORE_THEME = "mojo-manual-theme";
  var STORE_SEEN = "mojo-manual-seen";

  /* ------------------------------------------------------------- theme -- */

  function systemTheme() {
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#fbf7f0" : "#0c0906");
    var btn = document.querySelector("[data-theme-toggle]");
    if (btn) {
      btn.textContent = theme === "light" ? "☾" : "☀";
      btn.setAttribute(
        "aria-label",
        theme === "light" ? "Switch to dark theme" : "Switch to light theme"
      );
    }
  }

  function initTheme() {
    var saved = null;
    try {
      saved = window.localStorage.getItem(STORE_THEME);
    } catch (err) {
      saved = null;
    }
    applyTheme(saved || systemTheme());

    document.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-theme-toggle]");
      if (!btn) return;
      var next =
        document.documentElement.getAttribute("data-theme") === "light"
          ? "dark"
          : "light";
      applyTheme(next);
      try {
        window.localStorage.setItem(STORE_THEME, next);
      } catch (err) {
        /* private mode: the toggle still works for this page */
      }
    });
  }

  /* ------------------------------------------------------- reading bar -- */

  function initProgress() {
    var bar = document.querySelector(".progress");
    if (!bar) return;
    var ticking = false;

    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var pct = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      bar.style.width = (pct * 100).toFixed(2) + "%";
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    update();
  }

  /* --------------------------------------------------------- copy code -- */

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy") ? resolve() : reject(new Error("copy failed"));
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  function initCopy() {
    document.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-copy]");
      if (!btn) return;
      var block = btn.closest(".cb");
      var code = block && block.querySelector(".cb__code");
      if (!code) return;

      var lines = code.querySelectorAll(".cl");
      var text;
      if (lines.length) {
        text = Array.prototype.map
          .call(lines, function (line) {
            return line.textContent;
          })
          .join("\n");
      } else {
        text = code.textContent;
      }

      copyText(text).then(
        function () {
          var original = btn.textContent;
          btn.textContent = "Copied";
          btn.setAttribute("data-done", "true");
          window.setTimeout(function () {
            btn.textContent = original;
            btn.removeAttribute("data-done");
          }, 1400);
        },
        function () {
          btn.textContent = "Failed";
          window.setTimeout(function () {
            btn.textContent = "Copy";
          }, 1400);
        }
      );
    });
  }

  /* ------------------------------------------------------------ scrollspy */

  function initScrollspy() {
    var links = Array.prototype.slice.call(
      document.querySelectorAll(".rail a[href^='#']")
    );
    if (!links.length) return;

    var targets = links
      .map(function (link) {
        var id = decodeURIComponent(link.getAttribute("href").slice(1));
        var el = id ? document.getElementById(id) : null;
        return el ? { link: link, el: el } : null;
      })
      .filter(Boolean);
    if (!targets.length) return;

    var ticking = false;

    function update() {
      var line = window.scrollY + window.innerHeight * 0.28;
      var current = targets[0];
      for (var i = 0; i < targets.length; i++) {
        if (targets[i].el.offsetTop <= line) current = targets[i];
      }
      targets.forEach(function (t) {
        t.link.setAttribute("aria-current", t === current ? "true" : "false");
      });
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    update();
  }

  /* -------------------------------------------------------------- search */

  function initSearch() {
    var input = document.querySelector("[data-search]");
    var panel = document.querySelector("[data-search-results]");
    if (!input || !panel) return;

    var index = null;
    var loading = null;

    function isChapter() {
      return document.body.classList.contains("page");
    }

    function indexUrl() {
      var holder = input.closest("[data-search-index]");
      if (holder) {
        var declared = holder.getAttribute("data-search-index");
        if (declared) return declared;
      }
      // chapter pages live one directory down from the cover
      return isChapter()
        ? "../assets/search-index.json"
        : "assets/search-index.json";
    }

    // index records store book-root-relative URLs; resolve them for this page
    function pageUrl(url) {
      if (/^(https?:)?\/\//.test(url) || url.charAt(0) === "/") return url;
      return isChapter() ? "../" + url : url;
    }

    function load() {
      if (index) return Promise.resolve(index);
      if (!loading) {
        loading = fetch(indexUrl())
          .then(function (res) {
            if (!res.ok) throw new Error("no index");
            return res.json();
          })
          .then(function (data) {
            index = data;
            return index;
          })
          .catch(function () {
            return [];
          });
      }
      return loading;
    }

    function escapeHtml(value) {
      return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    function excerpt(haystack, needle) {
      var at = haystack.toLowerCase().indexOf(needle.toLowerCase());
      if (at < 0) return escapeHtml(haystack.slice(0, 150)) + "…";
      var start = Math.max(0, at - 60);
      var end = Math.min(haystack.length, at + 110);
      var lead = start > 0 ? "…" : "";
      var tail = end < haystack.length ? "…" : "";
      return (
        lead +
        escapeHtml(haystack.slice(start, end)).replace(
          new RegExp("(" + escapeRegExp(needle) + ")", "ig"),
          "<mark>$1</mark>"
        ) +
        tail
      );
    }

    function escapeRegExp(value) {
      return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function render(query) {
      if (!query || query.length < 2) {
        panel.removeAttribute("data-open");
        panel.innerHTML = "";
        return;
      }
      load().then(function (docs) {
        var needle = query.toLowerCase();
        var hits = [];
        docs.forEach(function (doc) {
          if (hits.length >= 12) return;
          var inTitle = doc.title.toLowerCase().indexOf(needle) >= 0;
          var inHeadings = (doc.headings || []).some(function (h) {
            return h.toLowerCase().indexOf(needle) >= 0;
          });
          var at = doc.text.toLowerCase().indexOf(needle);
          if (!inTitle && !inHeadings && at < 0) return;
          hits.push({ doc: doc, at: at, strong: inTitle || inHeadings });
        });

        if (!hits.length) {
          panel.innerHTML =
            '<p class="search__empty">Nothing in the manual matches “' +
            escapeHtml(query) +
            "”.</p>";
          panel.setAttribute("data-open", "true");
          return;
        }

        panel.innerHTML = hits
          .map(function (hit) {
            return (
              '<a class="search__hit" href="' +
              escapeHtml(pageUrl(hit.doc.url)) +
              '"><span class="t">' +
              escapeHtml(hit.doc.title) +
              "</span><span class=\"m\">" +
              escapeHtml(hit.doc.part) +
              (hit.strong ? "" : " · " + excerpt(hit.doc.text, query)) +
              "</span></a>"
            );
          })
          .join("");
        panel.setAttribute("data-open", "true");
      });
    }

    input.addEventListener("input", function () {
      render(input.value.trim());
    });
    input.addEventListener("focus", function () {
      if (input.value.trim().length >= 2) render(input.value.trim());
    });

    document.addEventListener("click", function (event) {
      if (!panel.contains(event.target) && event.target !== input) {
        panel.removeAttribute("data-open");
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        panel.removeAttribute("data-open");
        input.blur();
      }
    });

    input.dataset.ready = "true";
  }

  /* ----------------------------------------------------- keyboard paging */

  function initKeys() {
    document.addEventListener("keydown", function (event) {
      var tag = (event.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || event.target.isContentEditable) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "/") {
        var search = document.querySelector("[data-search]");
        if (search) {
          event.preventDefault();
          search.focus();
          search.select();
        }
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        var selector =
          event.key === "ArrowLeft" ? ".pager__link--prev" : ".pager__link--next";
        var link = document.querySelector(selector);
        if (link) window.location.href = link.href;
      }
    });
  }

  /* -------------------------------------------------------------- boot -- */

  function boot() {
    initTheme();
    initProgress();
    initCopy();
    initScrollspy();
    initSearch();
    initKeys();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();