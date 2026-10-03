/* hl_probe.js — injected into a page copy to report per-<pre> highlight state.
 * Appends a JSON <script> to the body for the audit to read back. The id is
 * assembled at runtime so the marker never appears literally in this file,
 * which would otherwise confuse the audit's extractor.
 */
(function () {
  var TOKENISH = /^(h?(kw|fn|str|num|cmt|op|ty|type|tp|var|dec|ctl|cls|blt)|tok-)/;
  var HAS_TOK = "span[class*='kw'],span[class*='tok-'],span[class*='hfn'],span[class*='str']";
  var rows = [];
  var pres = document.querySelectorAll("pre");
  for (var i = 0; i < pres.length; i++) {
    var pre = pres[i];
    var chain = [], n = pre;
    while (n && n !== document.body) {
      if (n.className) chain.push(String(n.className));
      n = n.parentElement;
    }
    var spans = pre.querySelectorAll("span[class]");
    var colors = {}, order = [];
    for (var j = 0; j < spans.length; j++) {
      var cl = spans[j].className;
      if (!TOKENISH.test(cl)) continue;
      var c = "";
      try { c = getComputedStyle(spans[j]).color; } catch (e) {}
      if (!(cl in colors)) { colors[cl] = c; order.push(cl); }
    }

    /* Sibling signal: climb to the nearest ancestor holding more than one <pre>
     * (a code-tabs / code-playground widget). If some sibling carries token
     * markup and this one does not, this one is an output panel. */
    var host = pre.parentElement, sibHi = 0, sibTot = 0, hops = 0;
    while (host && host !== document.body && hops < 6) {
      var ps = host.querySelectorAll("pre");
      if (ps.length > 1) {
        for (var k = 0; k < ps.length; k++) {
          sibTot++;
          if (ps[k].querySelector(HAS_TOK)) sibHi++;
        }
        break;
      }
      host = host.parentElement;
      hops++;
    }

    /* Language markers: explicit class tokens, data-lang attributes, and the
     * label of the tab button that controls this tab panel.
     *
     * The marker usually sits on an *inner* <code> element
     * (<pre><code class="lang-py">), not on the <pre> or its ancestors, so the
     * upward walk alone misses the site's most explicit signal. Walk down into
     * the <pre> as well: a <pre> holds one block, so a descendant marker
     * belongs to it. */
    var langs = {};
    var markerAttrs = ["data-lang", "data-language", "data-code-lang"];
    var isMark = function (t2) {
      return /^(py|python|python2|python3|ipython|mojo|mj|mojo1x|mojo-1|lang[-_].*|language[-_].*)$/.test(t2);
    };
    var harvest = function (el) {
      var cn = String((el && el.className) || "");
      for (var t2 of cn.split(/\s+/)) {
        var lt = t2.toLowerCase();
        if (lt && isMark(lt)) langs[lt] = 1;
      }
      for (var an of markerAttrs) {
        var v = el.getAttribute && el.getAttribute(an);
        if (v) langs[String(v).toLowerCase()] = 1;
      }
    };
    var m2 = pre;
    while (m2 && m2 !== document.body) { harvest(m2); m2 = m2.parentElement; }
    if (pre.querySelectorAll) {
      var kids = pre.querySelectorAll("[class],[data-lang],[data-language],[data-code-lang]");
      for (var ki = 0; ki < kids.length; ki++) harvest(kids[ki]);
    }
    /* code-tabs widget: <button data-tab="ID">Label</button> + <div id="ID"> */
    var label = "";
    var tc = pre.closest && pre.closest(".tab-content,[data-tab-panel],.code-panel");
    if (tc && tc.id) {
      var btn = document.querySelector('[data-tab="' + tc.id + '"]');
      if (btn) label = (btn.textContent || "").trim().toLowerCase();
    }

    rows.push({
      chain: chain.join("|"),
      langs: Object.keys(langs),
      label: label,
      cls: order,
      colors: order.map(function (k) { return colors[k]; }),
      base: (function () { try { return getComputedStyle(pre).color; } catch (e) { return ""; } })(),
      sibHi: sibHi,
      sibTot: sibTot,
      len: pre.textContent.length,
      text: pre.textContent.slice(0, 260),
    });
  }
  var s = document.createElement("script");
  s.type = "application/json";
  /* Built from parts so this literal never appears in the probe's own source,
   * which would otherwise make the audit's extractor match the script tag. */
  s.id = "__hl" + "probe";
  s.textContent = JSON.stringify(rows);
  document.body.appendChild(s);
})();
