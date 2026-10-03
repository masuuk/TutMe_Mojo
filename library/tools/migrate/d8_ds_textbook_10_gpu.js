/* Migrate ds_textbook_10_gpu.html : drop the 2 Python tabs and the 2 Python panes they
 * control (kernel.py / matmul.py).
 *
 * Same third shape as ds_textbook_02..05 / 07 / 08 / 09 / 14 (p10): no data-target, no ids -
 *   <div class="tab" data-lang="python" data-group="k1"><span class="sw"></span>kernel.py</div>
 *   <div class="pane" data-lang="python"><pre>...</pre></div>
 * The Mojo tab and pane already hold `active` in both groups, so nothing has to move, and
 * each tab bar keeps its single `*.mojo` tab.
 *
 * This page has no `class="tok-cast"` spans, so nothing outside the panes needs tidying.
 *
 * Vocabulary: .tok-kw .tok-str .tok-com .tok-fn .tok-num .tok-ty  ->  MAPS.com
 * (every surviving <pre> is hand-authored spans, so no build-time highlighting is emitted
 * here and the token classes are untouched.)
 *
 * NOT changed here, flagged instead:
 *   - C2  legacy SIMD dtype names in *prose*, i.e. two inline-code spots rather than code:
 *          "just load a SIMD[float32, 8] instead of individual floats"   (activation section)
 *          "processes 8 floats at a time using SIMD[float32, 8] loads"  (exercise)
 *        Both want `SIMD[DType.float32, 8]`. Deliberately left alone: this batch is the
 *        Python-removal pass agreed for pages 02-13, and a partial C2 sweep that skips the
 *        code-block sites on page 09 while editing the prose sites here would be reported as
 *        "C2 fixed" when most of it is still open. C2 gets one sweep, compiler-verified.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_textbook_10_gpu.html";
const page = loadPage(P);
let h = page.text;

/* data-group value -> the file name shown on the .py tab that goes away. */
const GROUPS = [
  ["k1", "kernel.py"],
  ["mm", "matmul.py"],
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
/* 1. k1 - the removed pane was the CuPy equivalent: `c = a + b` for free, or a RawModule
 *    for the custom kernel. The paragraph below the demo makes the PTX/type-check point. */
h = replaceOnce(
  h,
  `\n\n    <p>The Mojo kernel compiles to the same PTX`,
  `\n\n    <p class="cap">In CuPy the elementwise case is <code class="inline">c = a + b</code> with no launch code at all, and the custom-kernel route means wrapping the same C source in <code class="inline">cp.RawModule(code=...).get_function('vec_add')</code> before passing <code class="inline">(n//256,), (256,)</code> as the grid and block. Here the kernel is an ordinary Mojo function and its launch sits in the same file.</p>\n\n    <p>The Mojo kernel compiles to the same PTX`
);
/* 2. mm - the removed pane was the CuPy/PyTorch `A @ B` route. The table below already has
 *    a cuBLAS row, so the cap just has to name what dispatches to it. */
h = replaceOnce(
  h,
  `\n\n    <h3>Why tiled matmul is faster</h3>`,
  `\n\n    <p class="cap">From Python the same multiply is <code class="inline">C = A @ B</code> on CuPy device arrays, or <code class="inline">torch.randn(M, K, device='cuda')</code> followed by the same <code class="inline">@</code> — either way it dispatches to a vendor GEMM, which is the <code class="inline">cuBLAS</code> row in the table below. Reaching that last row's level of control in Python means Triton or a hand-written CUDA extension; in Mojo it is the kernel above.</p>\n\n    <h3>Why tiled matmul is faster</h3>`
);

/* ---- dead CSS: the only consumer of --py-blue / --py-yellow was the .py tab swatch ---- */
h = replaceOnce(h, `  --py-blue:#4b8bbe; --py-yellow:#ffd43b;\n`, ``);
h = replaceOnce(h, `.tab[data-lang="python"] .sw{background:var(--py-blue);}\n`, ``);

/* no Python control may survive */
if (/data-lang="python"/.test(h)) throw new Error("data-lang=python survived");
if (/--py-/.test(h)) throw new Error("dead --py-* CSS survived");
if (countOf(h, '<div class="pane active" data-lang="mojo">') !== 2) throw new Error("lost a mojo pane");
/* the removed panes were the page's only cupy / torch / Triton code */
if (countOf(h, `<span class="tok-kw">import</span> cupy`) !== 0) throw new Error("bare cupy import survived");
if (countOf(h, `<span class="tok-kw">import</span> torch`) !== 0) throw new Error("bare torch import survived");
if (countOf(h, `cp.RawModule(code=`) !== 1) throw new Error("RawModule lesson lost from prose");
if (countOf(h, `Triton`) !== 1) throw new Error("Triton lesson lost from prose");
/* the page must not now promise a Python listing it no longer has */
if (/no custom kernel needed/.test(h)) throw new Error("dangling 'no custom kernel needed' promise");

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
