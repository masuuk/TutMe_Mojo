/* lib/tok.js - Mojo source -> highlighted <pre> markup.
 *
 * The corpus has five different span vocabularies (see MAPS below), and each page
 * only colours the one it uses, via a page-local <style>. Emitting the wrong
 * vocabulary produces a block whose tokens all compute to the base text colour,
 * which hl_audit.js reports as "flat". So the vocabulary is a required input here,
 * never guessed.
 *
 * The tokenizer itself is the pure half of public/mojo-hl.js (its hiCode), lifted
 * out so it can run at build time. Keep the two in sync: if the palette or keyword
 * set changes there, change it here.
 */

export const MAPS = {
  /* ds_advanced_* : .kw .fn .com .str .num .type .op */
  com: { kw: "kw", fn: "fn", str: "str", num: "num", cmt: "com", op: "op", type: "type", var: null },
  /* ds_ml_textbook_*, mojo_09 : same but comments are .cmt and .var exists */
  cmt: { kw: "kw", fn: "fn", str: "str", num: "num", cmt: "cmt", op: "op", type: "type", var: "var" },
  /* ds_textbook_* : the tok-* set */
  tok: { kw: "tok-kw", fn: "tok-fn", str: "tok-str", num: "tok-num", cmt: "tok-com", op: null, type: "tok-ty", var: null },
  /* linear_regression_detailed : long-form class names */
  long: { kw: "keyword", fn: "func", str: "string", num: "number", cmt: "comment", op: null, type: "func", var: null },
  /* decision_aware_ml, fine_tuning_llms, perceptrons_and_activation */
  shorttok: { kw: "tok-k", fn: "tok-f", str: "tok-s", num: "tok-num", cmt: "tok-c", op: null, type: null, var: null },
};

export function resolveMap(name) {
  const m = MAPS[name];
  if (!m) throw new Error(`unknown vocabulary "${name}" (have: ${Object.keys(MAPS).join(", ")})`);
  return m;
}

const KW = {
  def: 1, fn: 1, struct: 1, trait: 1, var: 1, mut: 1, out: 1, self: 1, Self: 1,
  return: 1, raise: 1, raises: 1, if: 1, elif: 1, else: 1, while: 1, for: 1,
  in: 1, import: 1, from: 1, comptr: 1, comptime: 1, break: 1, continue: 1,
  pass: 1, and: 1, or: 1, not: 1, is: 1, None: 1, True: 1, False: 1, class: 1,
  try: 1, with: 1, as: 1, lambda: 1, yield: 1, alias: 1, match: 1, case: 1,
  global: 1, assert: 1, del: 1,
};
const FN_HEAD = { def: 1, fn: 1 };
const TYPE_HEAD = { struct: 1, class: 1, trait: 1 };
const VAR_HEAD = { var: 1 };
const FN = {
  print: 1, range: 1, len: 1, sum: 1, zip: 1, min: 1, max: 1, abs: 1, round: 1,
  pow: 1, sqrt: 1, exp: 1, sin: 1, cos: 1, tan: 1, log: 1, enumerate: 1,
  reversed: 1, sorted: 1, next: 1, repr: 1, isinstance: 1, format: 1,
  reshape: 1, transpose: 1, zeros: 1, ones: 1, arange: 1, linspace: 1,
  array: 1, mean: 1, median: 1, cov: 1, eigenvalue: 1,
};
/* Identifiers the hand-authored markup leaves uncoloured, even though the
 * capitalised-identifier rule would otherwise paint them as types. */
const PLAIN = { Python: 1 };
const SINGLE_OP = { "+": 1, "-": 1, "*": 1, "/": 1, "%": 1, "<": 1, ">": 1, "=": 1, "~": 1, "&": 1, "|": 1, "^": 1, "@": 1 };
const TWO_OP = ["->", "=>", "**", "//", "==", "!=", "<=", ">=", "&&", "||", "+=", "-=", "*=", "/=", "<<", ">>"];

const isIdStart = (c) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_" || c === "$";
const isId = (c) => isIdStart(c) || (c >= "0" && c <= "9");
const isDigit = (c) => c >= "0" && c <= "9";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function span(cls, text) {
  return cls ? `<span class="${cls}">${esc(text)}</span>` : esc(text);
}

/* Tokenize Mojo source into span-wrapped HTML using the page's vocabulary. */
export function hiCode(t, map) {
  let out = "", i = 0;
  const n = t.length;
  let prev = "";
  while (i < n) {
    const c = t.charAt(i), c2 = t.charAt(i + 1), c3 = t.charAt(i + 2);

    if ((c === '"' && c2 === '"' && c3 === '"') || (c === "'" && c2 === "'" && c3 === "'")) {
      const q = c;
      let j = i + 3, end = -1;
      while (j < n - 2) {
        if (t.charAt(j) === q && t.charAt(j + 1) === q && t.charAt(j + 2) === q) { end = j + 3; break; }
        if (t.charAt(j) === "\\") { j += 2; continue; }
        j++;
      }
      if (end < 0) end = n;
      out += span(map.str, t.slice(i, end));
      prev = ""; i = end; continue;
    }

    if (c === '"' || c === "'") {
      let j = i + 1, end = -1;
      while (j < n) {
        const ch = t.charAt(j);
        if (ch === "\\") { j += 2; continue; }
        if (ch === c) { end = j + 1; break; }
        if (ch === "\n" || ch === "\r") break;
        j++;
      }
      if (end < 0) end = j;
      out += span(map.str, t.slice(i, end));
      prev = ""; i = end; continue;
    }

    if (c === "#") {
      let j = i;
      while (j < n && t.charAt(j) !== "\n" && t.charAt(j) !== "\r") j++;
      out += span(map.cmt, t.slice(i, j));
      prev = ""; i = j; continue;
    }
    if (c === "/" && (c2 === "/" || c2 === "*")) {
      let j = i;
      if (c2 === "*") {
        const e = t.indexOf("*/", j + 2);
        j = e === -1 ? n : e + 2;
      } else {
        while (j < n && t.charAt(j) !== "\n" && t.charAt(j) !== "\r") j++;
      }
      out += span(map.cmt, t.slice(i, j));
      prev = ""; i = j; continue;
    }

    if (c === "@" && isIdStart(c2)) {
      let j = i + 1;
      while (j < n && isId(t.charAt(j))) j++;
      out += span(map.fn, t.slice(i, j));
      prev = ""; i = j; continue;
    }

    if (isIdStart(c)) {
      let j = i;
      while (j < n && isId(t.charAt(j))) j++;
      const w = t.slice(i, j);
      let cls = null;
      if (FN_HEAD[prev]) cls = map.fn;
      else if (TYPE_HEAD[prev]) cls = map.type;
      else if (VAR_HEAD[prev]) cls = map.var;
      else if (KW[w]) cls = map.kw;
      else if (FN[w]) cls = map.fn;
      else if (!PLAIN[w] && /^[A-Z]/.test(w)) cls = map.type;
      out += cls ? span(cls, w) : esc(w);
      prev = w;
      i = j; continue;
    }

    if (isDigit(c) || (c === "." && isDigit(c2))) {
      let j = i, k = i;
      if (c === "0" && (c2 === "x" || c2 === "X")) {
        j = i + 2;
        while (j < n && /^[0-9a-fA-F]$/.test(t.charAt(j))) j++;
      } else {
        while (j < n && (isDigit(t.charAt(j)) || t.charAt(j) === "_")) j++;
        if (j < n && t.charAt(j) === ".") {
          j++;
          while (j < n && (isDigit(t.charAt(j)) || t.charAt(j) === "_")) j++;
        }
        if (j < n && (t.charAt(j) === "e" || t.charAt(j) === "E")) {
          k = j + 1;
          if (t.charAt(k) === "+" || t.charAt(k) === "-") k++;
          if (isDigit(t.charAt(k))) {
            k++;
            while (k < n && (isDigit(t.charAt(k)) || t.charAt(k) === "_")) k++;
            j = k;
          }
        }
      }
      out += span(map.num, t.slice(i, j));
      prev = ""; i = j; continue;
    }

    const two = t.slice(i, i + 2);
    if (TWO_OP.indexOf(two) !== -1) {
      out += span(map.op, two);
      prev = ""; i += 2; continue;
    }
    if (SINGLE_OP[c]) {
      out += span(map.op, c);
      prev = ""; i += 1; continue;
    }

    if (c !== " " && c !== "\t" && c !== "\n" && c !== "\r") prev = "";
    out += esc(c);
    i += 1;
  }
  return out;
}

/* Build a complete <pre> for insertion. attrs/className must match the page's markup. */
export function buildPre(code, mapName, { id, cls, lang } = {}) {
  const map = typeof mapName === "string" ? resolveMap(mapName) : mapName;
  const at = [];
  if (cls) at.push(`class="${cls}"`);
  if (id) at.push(`id="${id}"`);
  if (lang) at.push(`data-lang="${lang}"`);
  const head = at.length ? `<pre ${at.join(" ")}>` : "<pre>";
  return `${head}<code>${hiCode(code.replace(/\r\n/g, "\n").replace(/\n$/, ""), map)}</code></pre>`;
}
