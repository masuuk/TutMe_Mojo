/* mojo-hl.js — runtime Mojo/Python syntax highlighting for the TutMe tutorial corpus.
 *
 * Self-contained: injects the canonical mojo_v1 palette and tokenizes every <pre>
 * block that does not carry pre-baked <span> markup yet. Math equation panels
 * (.eq), printed output, and terminal sessions are left untouched. Re-runs are
 * no-ops (guarded by window.__mojoHlLoaded).
 */
(function () {
  'use strict';
  if (window.__mojoHlLoaded) return;
  window.__mojoHlLoaded = true;

  /* ---- palette (matches mojo_v1 `pre .kw{...}` house style) ---------------- */
  var PALETTE = [
    'pre .kw{color:#c084fc}',
    'pre .fn{color:#60a5fa}',
    'pre .str{color:#4ade80}',
    'pre .num{color:#fbbf24}',
    'pre .cmt{color:#a8b6d4;font-style:italic}',
    'pre .op{color:#f472b6}',
    'pre .type{color:#34d399}',
    'pre .var{color:#fcd34d}'
  ].join('\n');

  var KW = {
    def: 1, fn: 1, struct: 1, trait: 1, var: 1, mut: 1, out: 1, self: 1, Self: 1,
    return: 1, raise: 1, raises: 1, if: 1, elif: 1, else: 1, while: 1, for: 1,
    in: 1, import: 1, from: 1, comptr: 1, comptime: 1, break: 1, continue: 1,
    pass: 1, and: 1, or: 1, not: 1, is: 1, None: 1, True: 1, False: 1, class: 1,
    try: 1, with: 1, as: 1, lambda: 1, yield: 1, alias: 1, match: 1, case: 1,
    global: 1, assert: 1, del: 1
  };
  // Color the identifier that follows these as fn/type/var.
  var FN_HEAD = { def: 1, fn: 1 };
  var TYPE_HEAD = { struct: 1, class: 1, trait: 1 };
  var VAR_HEAD = { var: 1 };

  var FN = {
    print: 1, range: 1, len: 1, sum: 1, zip: 1, min: 1, max: 1, abs: 1, round: 1,
    pow: 1, sqrt: 1, exp: 1, sin: 1, cos: 1, tan: 1, log: 1, enumerate: 1,
    reversed: 1, sorted: 1, next: 1, repr: 1, isinstance: 1, format: 1,
    reshape: 1, transpose: 1, zeros: 1, ones: 1, arange: 1, linspace: 1,
    array: 1, mean: 1, median: 1, cov: 1, eigenvalue: 1
  };

  function isIdStart(c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$'; }
  function isId(c) { return isIdStart(c) || (c >= '0' && c <= '9'); }
  function isDigit(c) { return c >= '0' && c <= '9'; }

  var SINGLE_OP = { '+': 1, '-': 1, '*': 1, '/': 1, '%': 1, '<': 1, '>': 1, '=': 1, '~': 1, '&': 1, '|': 1, '^': 1, '@': 1 };
  var TWO_OP = ['->', '=>', '**', '//', '==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/=', '<<', '>>'];

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* Tokenize one code string into span-wrapped HTML. Pure function (no DOM). */
  function hiCode(t) {
    var out = '', i = 0, n = t.length, prev = '';
    while (i < n) {
      var c = t.charAt(i), c2 = t.charAt(i + 1), c3 = t.charAt(i + 2);

      {/* triple-quoted string */}
      if ((c === '"' && c2 === '"' && c3 === '"') || (c === "'" && c2 === "'" && c3 === "'")) {
        var q = c, j = i + 3, end = -1;
        while (j < n - 2) {
          if (t.charAt(j) === q && t.charAt(j + 1) === q && t.charAt(j + 2) === q) { end = j + 3; break; }
          if (t.charAt(j) === '\\') { j += 2; continue; }
          j++;
        }
        if (end < 0) end = n;
        out += '<span class="str">' + esc(t.slice(i, end)) + '</span>';
        prev = ''; i = end; continue;
      }
      {/* single-quoted string */}
      if (c === '"' || c === "'") {
        var j = i + 1, end2 = -1;
        while (j < n) {
          var ch = t.charAt(j);
          if (ch === '\\') { j += 2; continue; }
          if (ch === c) { end2 = j + 1; break; }
          if (ch === '\n' || ch === '\r') break;
          j++;
        }
        if (end2 < 0) end2 = j;
        out += '<span class="str">' + esc(t.slice(i, end2)) + '</span>';
        prev = ''; i = end2; continue;
      }
      {/* comment: # to EOL, // to EOL, /* ... * / */}
      if (c === '#') {
        var j = i; while (j < n && t.charAt(j) !== '\n') j++;
        out += '<span class="cmt">' + esc(t.slice(i, j)) + '</span>';
        prev = ''; i = j; continue;
      }
      if (c === '/' && (c2 === '/' || c2 === '*')) {
        var j = i, block = (c2 === '*');
        if (block) {
          var e = t.indexOf('*/', j + 2);
          j = (e === -1) ? n : e + 2;
        } else {
          while (j < n && t.charAt(j) !== '\n') j++;
        }
        out += '<span class="cmt">' + esc(t.slice(i, j)) + '</span>';
        prev = ''; i = j; continue;
      }
      {/* decorator @name */}
      if (c === '@' && isIdStart(c2)) {
        var j = i + 1; while (j < n && isId(t.charAt(j))) j++;
        out += '<span class="fn">' + esc(t.slice(i, j)) + '</span>';
        prev = ''; i = j; continue;
      }
      {/* identifier or keyword */}
      if (isIdStart(c)) {
        var j = i; while (j < n && isId(t.charAt(j))) j++;
        var w = t.slice(i, j);
        var cls = '';
        if (FN_HEAD[prev]) cls = 'fn';
        else if (TYPE_HEAD[prev]) cls = 'type';
        else if (VAR_HEAD[prev]) cls = 'var';
        else if (KW[w]) cls = 'kw';
        else if (FN[w]) cls = 'fn';
        else if (/^[A-Z]/.test(w)) cls = 'type';
        out += cls ? '<span class="' + cls + '">' + esc(w) + '</span>' : esc(w);
        prev = w;
        i = j; continue;
      }
      {/* number */}
      if (isDigit(c) || (c === '.' && isDigit(c2))) {
        var j = i, k = i;
        if (c === '0' && (c2 === 'x' || c2 === 'X')) {
          j = i + 2;
          while (j < n && /^[0-9a-fA-F]$/.test(t.charAt(j))) j++;
        } else {
          while (j < n && (isDigit(t.charAt(j)) || t.charAt(j) === '_')) j++;
          if (j < n && t.charAt(j) === '.') { j++; while (j < n && (isDigit(t.charAt(j)) || t.charAt(j) === '_')) j++; }
          if (j < n && (t.charAt(j) === 'e' || t.charAt(j) === 'E')) {
            k = j + 1;
            if (t.charAt(k) === '+' || t.charAt(k) === '-') k++;
            if (isDigit(t.charAt(k))) { k++; while (k < n && (isDigit(t.charAt(k)) || t.charAt(k) === '_')) k++; j = k; }
          }
        }
        out += '<span class="num">' + esc(t.slice(i, j)) + '</span>';
        prev = ''; i = j; continue;
      }
      {/* operator (two-char first) */}
      var two = t.slice(i, i + 2);
      if (TWO_OP.indexOf(two) !== -1) {
        out += '<span class="op">' + esc(two) + '</span>';
        prev = ''; i += 2; continue;
      }
      if (SINGLE_OP[c]) {
        out += '<span class="op">' + esc(c) + '</span>';
        prev = ''; i += 1; continue;
      }
      {/* any other char (parens, brackets, colon, comma, whitespace) */}
      if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') prev = '';
      out += esc(c);
      i += 1;
    }
    return out;
  }

  window.__hiCode = hiCode;

  /* ---- DOM pass ----------------------------------------------------------- */

  function isPanel(p) {
    var e = p;
    while (e && e !== document.body) {
      var c = typeof e.className === 'string' ? e.className : '';
      if (/(^|\s)(eq|equ|equation|out|output|result|terminal|ans|answer)(\s|$)/.test(c)) return true;
      e = e.parentElement;
    }
    return false;
  }

  var CODE_RX = /(?:^|[^A-Za-z0-9_])(def|fn|struct|trait|class|import|from|return|var|mut|if|elif|else|while|for|raise|raises|try|with|comptime|alias|match)(?:\s|\[|$)|(?:^|[^A-Za-z0-9_])(print|range|len|sum|zip|min|max|abs|round|sqrt|pow|mean)\s*\(/m;

  var style = document.createElement('style');
  style.textContent = PALETTE;
  (document.head || document.documentElement).appendChild(style);

  var blocks = document.querySelectorAll('pre');
  for (var k = 0; k < blocks.length; k++) {
    var p = blocks[k];
    if (p.querySelector('span')) continue;
    if (isPanel(p)) continue;
    var txt = p.textContent;
    if (!CODE_RX.test(txt)) continue;
    p.innerHTML = hiCode(txt);
  }
})();