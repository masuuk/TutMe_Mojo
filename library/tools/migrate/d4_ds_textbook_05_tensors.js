/* Migrate ds_textbook_05_tensors.html : drop the 3 Python tabs and the 3 Python panes they
 * control (ndarray_create.py / ndarray_ops.py / matmul_numpy.py).
 *
 * Same third shape as ds_textbook_02 / 03 / 04 / 14 (p10): no data-target, no ids -
 *   <div class="tab" data-lang="python" data-group="create"><span class="sw"></span>ndarray_create.py</div>
 *   <div class="pane" data-lang="python"><pre>...</pre></div>
 * This page's markup is unindented (the tab/pane divs start at column 0), which the
 * `[ \t]*`-prefixed regexes still match. The Mojo tab and pane already hold `active` in all
 * three groups, so nothing has to move, and each tab bar keeps its single `*.mojo` tab.
 *
 * This page's <style> is minified onto two long lines, so the dead-CSS removals below are
 * bare substrings of those lines rather than whole lines.
 *
 * Vocabulary: .tok-kw .tok-str .tok-com .tok-fn .tok-num .tok-ty  ->  MAPS.com
 * (every surviving <pre> is hand-authored spans, so no build-time highlighting is emitted
 * here and the token classes are untouched.)
 *
 * NOT changed here, flagged instead: the surviving `create` pane still opens with
 * `from tensor import Tensor` (compliance report B3 - the `tensor` module is gone from the
 * stdlib). The report counts ~191 bare `Tensor[...]` uses across the site, so changing one
 * import in one pane would be a half-measure, and `max.tensor`'s real surface cannot be
 * confirmed without the toolchain the audit says is not installed. Leaving the page
 * self-consistent and reporting the item.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_textbook_05_tensors.html";
const page = loadPage(P);
let h = page.text;

/* data-group value -> the file name shown on the .py tab that goes away. */
const GROUPS = [
  ["create", "ndarray_create.py"],
  ["ops", "ndarray_ops.py"],
  ["matmul", "matmul_numpy.py"],
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
/* 1. create - the removed pane was the only place the dtype= argument, .astype() and
 *    np.bfloat16 appeared. */
h = replaceOnce(
  h,
  `<p class="cap">Mojo Tensor is similar to NumPy's ndarray API but with compile-time type safety and no Python overhead.</p>`,
  `<p class="cap">Mojo Tensor is similar to NumPy's ndarray API but with compile-time type safety and no Python overhead. Two of the NumPy call shapes disappear: there is no <code class="inline">dtype=</code> argument to thread through every constructor, because the dtype is already part of the type, and <code class="inline">np.random.rand(3, 3).astype(np.float32)</code> collapses into <code class="inline">Tensor[DType.float32](random=True, 3, 3)</code>. Likewise <code class="inline">np.bfloat16</code> is a built-in type rather than something you import, and <code class="inline">data.size</code> is spelled <code class="inline">data.num_elements()</code>.</p>`
);
/* 2. ops - the removed pane was a line-for-line NumPy mirror, so the interesting delta is
 *    that the np. prefix and the free-function reductions disappear. */
h = replaceOnce(
  h,
  `<p class="cap">The API is nearly identical to NumPy — the mental model transfers directly. The difference is all under the hood: Mojo compiles these to SIMD kernels.</p>`,
  `<p class="cap">The API is nearly identical to NumPy — the mental model transfers directly. The difference is all under the hood: Mojo compiles these to SIMD kernels. It shows in the names too: <code class="inline">np.sqrt(a)</code>, <code class="inline">np.exp(a)</code> and <code class="inline">np.sum(a)</code> become the bare <code class="inline">sqrt(a)</code>, <code class="inline">exp(a)</code> and <code class="inline">a.reduce_add()</code>, because the dtype already selects the overload and a reduction is a method on the tensor rather than a free function you have to import.</p>`
);
/* 3. matmul - the removed pane was the only @ / np.matmul / np.einsum / BLAS comparison. */
h = replaceOnce(
  h,
  `<p class="cap">Mojo gives you three levels of control: high-level matmul, manual tiling for cache efficiency, and raw SIMD for maximum performance.</p>`,
  `<p class="cap">Mojo gives you three levels of control: high-level matmul, manual tiling for cache efficiency, and raw SIMD for maximum performance. In NumPy the same product is <code class="inline">A @ B</code>, <code class="inline">np.matmul(A, B)</code> or — for the awkward shapes — <code class="inline">np.einsum('ij,jk-&gt;ik', A, B)</code>, and all three delegate to BLAS (OpenBLAS, MKL). <code class="inline">matmul(A, B)</code> is the same call in Mojo, except it is one you can drop down into, which is what <code class="inline">simd_dot</code> above starts doing.</p>`
);

/* ---- dead CSS: the only consumer of --py-blue / --py-yellow was the .py tab swatch ---- */
h = replaceOnce(h, `--py-blue:#4b8bbe;--py-yellow:#ffd43b;`, ``);
h = replaceOnce(h, `.tab[data-lang="python"] .sw{background:var(--py-blue)}`, ``);

/* no Python control may survive */
if (/data-lang="python"/.test(h)) throw new Error("data-lang=python survived");
if (/--py-/.test(h)) throw new Error("dead --py-* CSS survived");
if (countOf(h, '<div class="pane active" data-lang="mojo">') !== 3) throw new Error("lost a mojo pane");
/* the removed panes were the page's only numpy / BLAS code */
if (countOf(h, `numpy <span class="tok-kw">as</span> np`) !== 0) throw new Error("bare numpy import survived");
if (countOf(h, `einsum`) !== 1) throw new Error("einsum lesson lost from prose");
/* 1 in the new cap + 1 already in the "Why this matters for ML" callout */
if (countOf(h, `np.matmul`) !== 2) throw new Error("np.matmul lesson lost from prose");

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
