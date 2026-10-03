/* Migrate ds_textbook_09_autodiff.html : drop the 2 Python tabs and the 2 Python panes they
 * control (autodiff.py / comptime.py).
 *
 * Same third shape as ds_textbook_02..05 / 07 / 08 / 14 (p10): no data-target, no ids -
 *   <div class="tab" data-lang="python" data-group="auto"><span class="sw"></span>autodiff.py</div>
 *   <div class="pane" data-lang="python"><pre>...</pre></div>
 * The Mojo tab and pane already hold `active` in both groups, so nothing has to move, and
 * each tab bar keeps its single `*.mojo` tab.
 *
 * Side effect worth knowing: the five `class="tok-cast"` spans on this page all sit inside
 * the two Python panes, and `tok-cast` is not defined in this page's stylesheet, so they go
 * away with the removal. No undefined token class is left behind.
 *
 * Vocabulary: .tok-kw .tok-str .tok-com .tok-fn .tok-num .tok-ty  ->  MAPS.com
 * (every surviving <pre> is hand-authored spans, so no build-time highlighting is emitted
 * here and the token classes are untouched.)
 *
 * NOT changed here, flagged instead. This page carries four report items and two of them
 * live in the *same* code block, so fixing one alone would leave the block just as
 * uncompilable while making the diff look like the block was dealt with:
 *   - A2  f-strings: `f"dW = {dw}, db = {db}"` (B2) and `f"Float32({val})"` / `f"Int32({val})"`
 *        / `f"Unknown({val})"` (B5). A2's prescribed alternatives (t-strings, `print(a, b)`)
 *        and these call sites need a decision the static audit cannot make.
 *   - C2  `SIMD[float32, N]` / `SIMD[float64, N]` in B3 and B5 -> `SIMD[DType.float32, N]`.
 *        The correct spelling is already used two functions later in B5 itself.
 *   - C5  `@differentiable` standard-scope availability - the report itself marks it "verify".
 *   - B1  `from math import exp, log` / `from math import exp` missing the `std.` prefix.
 * The report's recommended next step is to install the toolchain and compile block by block;
 * that is the right place to close all four at once.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_textbook_09_autodiff.html";
const page = loadPage(P);
let h = page.text;

/* data-group value -> the file name shown on the .py tab that goes away. */
const GROUPS = [
  ["auto", "autodiff.py"],
  ["cptime", "comptime.py"],
];

const before = counts(h);
/* 4 controls (2 tabs + 2 panes) plus the one `.tab[data-lang="python"] .sw` CSS rule. */
if (countOf(h, 'data-lang="python"') !== GROUPS.length * 2 + 1) throw new Error("unexpected data-lang=python count");

function removePyTab(hh, group, file) {
  const re = new RegExp(`[ \\t]*<div class="tab" data-lang="python" data-group="${group}"><span class="sw"></span>${file.replace(/\./g, "\\.")}</div>\\r?\\n?`);
  if (!re.test(hh)) throw new Error(`removePyTab: no python tab for ${group}`);
  return hh.replace(re, "");
}
function removePyPane(hh, group) {
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

/* ---- editorial: every removed pane's lesson becomes prose ---- */
/* 1. auto - the removed pane was the jax.grad comparison; the "How Mojo's autodiff works"
 *    list below already makes the tracing argument, so the cap only has to name the API. */
h = replaceOnce(
  h,
  `\n\n    <h3>How Mojo's autodiff works</h3>`,
  `\n\n    <p class="cap">JAX spells the same two functions <code class="inline">jax.grad(quadratic)</code> and <code class="inline">jax.grad(loss_fn, argnums=(0, 1))</code> — the delta is not the API, it is <i>when</i> the derivative is worked out.</p>\n\n    <h3>How Mojo's autodiff works</h3>`
);
/* 2. cptime - the removed pane was the np.dot / runtime-string-dispatch comparison. */
h = replaceOnce(
  h,
  `\n\n    <h3>Parameterized types and compile-time loops</h3>`,
  `\n\n    <p class="cap">Python's nearest neighbours are <code class="inline">np.dot(a, b)</code> and a runtime <code class="inline">if dtype == "float32"</code> chain that compares dtype <i>strings</i>. Both re-run on every call, and neither unrolls a loop or emits a specialised version of anything.</p>\n\n    <h3>Parameterized types and compile-time loops</h3>`
);

/* ---- dead CSS: the only consumer of --py-blue / --py-yellow was the .py tab swatch ---- */
h = replaceOnce(h, `  --py-blue:#4b8bbe; --py-yellow:#ffd43b;\n`, ``);
h = replaceOnce(h, `.tab[data-lang="python"] .sw{background:var(--py-blue);}\n`, ``);

/* no Python control may survive */
if (/data-lang="python"/.test(h)) throw new Error("data-lang=python survived");
if (/--py-/.test(h)) throw new Error("dead --py-* CSS survived");
if (countOf(h, '<div class="pane active" data-lang="mojo">') !== 2) throw new Error("lost a mojo pane");
if (countOf(h, "tok-cast") !== 0) throw new Error("undefined .tok-cast span survived");
/* the removed panes were the page's only jax / numpy code */
if (countOf(h, `<span class="tok-kw">import</span> jax`) !== 0) throw new Error("bare jax import survived");
if (countOf(h, `np.dot`) !== 1) throw new Error("np.dot lesson lost from prose");
/* 2 = the two jax.grad spellings the new cap names (quadratic + loss_fn/argnums) */
if (countOf(h, `jax.grad`) !== 2) throw new Error("jax.grad lesson lost from prose");
/* the page must not now promise a Python listing it no longer has */
if (/no comptime equivalent/.test(h)) throw new Error("dangling 'no comptime equivalent' promise");

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
