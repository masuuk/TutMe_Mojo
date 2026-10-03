/* Migrate ds_textbook_02_syntax.html : drop the 3 Python tabs and the 3 Python panes
 * they control (functions.py / variables.py / classes.py).
 *
 * Markup shape is the same as ds_textbook_14 (p10) - no data-target, no ids:
 *   <div class="tab" data-lang="python" data-group="g"><span class="sw"></span>functions.py</div>
 *   <div class="pane" data-lang="python"><pre>...</pre></div>
 * so both controls are located by data-lang + data-group / document order. The Mojo tab
 * and pane already hold `active` in all three groups, so nothing has to move, and each
 * tab bar keeps its single `*.mojo` filename tab - it never claimed the plain word
 * "Mojo", so per the brief it is not renamed.
 *
 * Vocabulary: .tok-kw .tok-str .tok-com .tok-fn .tok-num .tok-ty  ->  MAPS.tok
 * (every surviving <pre> is hand-authored spans, so no build-time highlighting is emitted
 * here and the token classes are untouched.)
 *
 * One repair inside a *surviving* Mojo block, which the brief's "Mojo correctness"
 * section asks for: the structs pane's `distance_to` returned the *squared* distance while
 * its trailing comment claimed `# 5.0` (9 + 16 = 25, not 5). The removed classes.py pane
 * held the page's only correct distance (`math.sqrt(...)`), so deleting it would have left
 * a false output claim in a chapter about correctness. Fixed with the stdlib path the
 * compliance report prescribes (B1: `from math import ...` -> `from std.math import ...`),
 * not an invented API.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_textbook_02_syntax.html";
const page = loadPage(P);
let h = page.text;

/* data-group value -> the file name shown on the .py tab that goes away. */
const GROUPS = [
  ["fndef", "functions.py"],
  ["vars", "variables.py"],
  ["structs", "classes.py"],
];

const before = counts(h);
/* 6 controls (3 tabs + 3 panes) plus the one `.tab[data-lang="python"] .sw` CSS rule. */
if (countOf(h, 'data-lang="python"') !== GROUPS.length * 2 + 1) throw new Error("unexpected data-lang=python count");

function removePyTab(hh, group, file) {
  const re = new RegExp(`[ \\t]*<div class="tab" data-lang="python" data-group="${group}"><span class="sw"></span>${file.replace(/\./g, "\\.")}</div>\\r?\\n?`);
  if (!re.test(hh)) throw new Error(`removePyTab: no python tab for ${group}`);
  return hh.replace(re, "");
}
function removePyPane(hh, group) {
  /* No `active` in the open tag: that is the assertion that the Mojo pane is the selected
   * one, so no `active` has to be moved afterwards. Panes carry no id and no group, so they
   * are consumed strictly in document order; `expect` drops by one every call. */
  const body = `[ \\t]*<div class="pane" data-lang="python"><pre>[\\s\\S]*?</pre></div>\\r?\\n?`;
  const n = (hh.match(new RegExp(body, "g")) || []).length;
  if (n !== expect) throw new Error(`removePyPane: expected ${expect} python panes at ${group}, found ${n}`);
  expect -= 1;
  return hh.replace(new RegExp(body), ""); // non-global: consume exactly one
}
let expect = GROUPS.length;

for (const [group, file] of GROUPS) {
  if (!new RegExp(`<div class="tab active" data-lang="mojo" data-group="${group}">`).test(h)) {
    throw new Error(`mojo tab for ${group} is not the active one`);
  }
  h = removePyTab(h, group, file);
  h = removePyPane(h, group);
}

/* ---- surviving-Mojo repair: distance_to returned the squared distance ---- */
h = replaceOnce(
  h,
  `<span class="tok-com"># Mojo — struct with fieldwise init</span>\n<span class="tok-kw">@fieldwise_init</span>`,
  `<span class="tok-com"># Mojo — struct with fieldwise init</span>\n<span class="tok-kw">from</span> std.math <span class="tok-kw">import</span> sqrt\n\n<span class="tok-kw">@fieldwise_init</span>`
);
h = replaceOnce(
  h,
  `<span class="tok-kw">return</span> ((self.x - other.x)**<span class="tok-num">2</span> + (self.y - other.y)**<span class="tok-num">2</span>)`,
  `<span class="tok-kw">return</span> sqrt((self.x - other.x)**<span class="tok-num">2</span> + (self.y - other.y)**<span class="tok-num">2</span>)`
);

/* ---- editorial: every removed pane's lesson becomes prose, no dangling promise ---- */
/* 1. fndef - the removed pane was the only place `sum()` and `ValueError` were contrasted. */
h = replaceOnce(
  h,
  `<p class="cap">Notice how similar the API surface is — Mojo borrows Python's optional args, variadic args, and raise syntax directly.</p>`,
  `<p class="cap">Notice how similar the API surface is — Mojo borrows Python's optional args, variadic args, and raise syntax directly. Two habits change: there is no builtin <code class="inline">sum</code> over a variadic, so <code class="inline">sum_all</code> accumulates with a <code class="inline">var</code> loop, and a failure is <code class="inline">raise Error(...)</code> rather than a typed <code class="inline">ValueError</code> — the <code class="inline">raises</code> declaration above is what makes that legal.</p>`
);
/* 2. vars - the removed pane carried "no block scope" and "assigning makes an alias". */
h = replaceOnce(
  h,
  `\n\n    <p>The critical difference from Python: <b>Mojo variables are statically typed.</b>`,
  `\n\n    <p class="cap">The Python version of this file needs no annotations at all, has no block scope — a name first assigned inside an <code class="inline">if</code> is still live afterwards, which is why the <code class="inline">result</code> declaration above sits outside both branches — and binding a second name to a list makes an <b>alias</b>, not a copy. Mojo spells those last two operations <code class="inline">first.copy()</code> and <code class="inline">first^</code>.</p>\n\n    <p>The critical difference from Python: <b>Mojo variables are statically typed.</b>`
);
/* 3. structs - the removed pane was the only @dataclass comparison; keep it, add its one
 *    habit that does not carry over (the quoted forward reference). */
h = replaceOnce(
  h,
  `Without it, you'd write the constructor manually using <code class="inline">def __init__(out self, ...)</code>.</p>`,
  `Without it, you'd write the constructor manually using <code class="inline">def __init__(out self, ...)</code>. One Python habit does not carry over: a method taking another <code class="inline">Point</code> has to quote the type as <code class="inline">-> "Point"</code>, because the class body is not finished when the signature is read. Mojo names the type directly.</p>`
);
/* 4. the intro promised f-strings, which Mojo 1.1 does not have (compliance report A2). */
h = replaceOnce(
  h,
  `<code class="inline">for</code> loops, list comprehensions, f-strings`,
  `<code class="inline">for</code> loops, list comprehensions, t-strings`
);
/* 5. exercise 2 asked for `let`, which this same page says was removed in 1.0. */
h = replaceOnce(
  h,
  `using Mojo's type annotations and <code class="inline">var</code>/<code class="inline">let</code> declarations`,
  `using Mojo's type annotations and a mandatory <code class="inline">var</code> on every binding`
);

/* ---- dead CSS: the only consumer of --py-blue / --py-yellow was the .py tab swatch ---- */
h = replaceOnce(h, `  --py-blue:#4b8bbe; --py-yellow:#ffd43b;\n`, ``);
h = replaceOnce(h, `.tab[data-lang="python"] .sw{background:var(--py-blue);}\n`, ``);

/* no Python control may survive */
if (/data-lang="python"/.test(h)) throw new Error("data-lang=python survived");
if (/--py-/.test(h)) throw new Error("dead --py-* CSS survived");
if (/f-string/.test(h)) throw new Error("dangling f-string promise (A2)");
/* only the exercise's promise is forbidden; the vars section documents `let`'s removal */
if (countOf(h, `<code class="inline">var</code>/<code class="inline">let</code>`) !== 0) {
  throw new Error("removed `let` keyword still promised in the exercises");
}
if (countOf(h, '<div class="pane active" data-lang="mojo">') !== GROUPS.length) throw new Error("lost a mojo pane");
if (countOf(h, `from</span> std.math <span class="tok-kw">import</span> sqrt`) !== 1) throw new Error("sqrt import missing");
/* the removed classes.py pane was the only other consumer of bare `math` */
if (countOf(h, `<span class="tok-kw">import</span> math`) !== 0) throw new Error("bare `import math` survived");

const after = counts(h);
savePage(page, h, P);

const cy = (s) => (s.match(/\r\n/g) || []).length ? "CRLF" : "LF";
console.log(`py pre  ${GROUPS.length} -> 0`);
console.log(`pre    ${before.pre[0]} -> ${after.pre[0]}  ${after.pre[0] === after.pre[1] ? "balanced" : "UNBALANCED"}`);
console.log(`panes  ${before.panes} -> ${after.panes}`);
console.log(`tabBtn ${before.tabBtn} -> ${after.tabBtn}`);
console.log(`div    ${before.div} -> ${after.div}  ${after.div[0] === after.div[1] ? "balanced" : "UNBALANCED"}`);
console.log(`span   ${before.span} -> ${after.span}`);
console.log(`eol    ${JSON.stringify(page.eol)} (${cy(h)})  bom=${page.bom}`);
