/* Migrate ds_ml_textbook_03_data_structures.html : drop the 4 labelled Python (NumPy)
 * panes from the Mojo/Python tab bars. Same shape and same house style as
 * ds_ml_textbook_02 (see c1_ds_ml_textbook_02.js): <button class="tab-btn" data-tab>
 * over <div class="tab-content" id>, every Mojo pane already carries `active`, the
 * single remaining tab keeps its "Mojo" label, and each removed NumPy comparison is
 * folded into the section's existing info-box/prose rather than left as a promise.
 *
 * Vocabulary: .kw .fn .str .num .cmt .op .type .var  ->  MAPS.cmt
 * Every surviving <pre> is hand-authored spans, so nothing is re-highlighted here.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_ml_textbook_03_data_structures.html";
const page = loadPage(P);
let h = page.text;

/* [python pane id, mojo pane id that must already be the active one] */
const PANES = [
  ["ch3-arrays-py", "ch3-arrays-mojo"],           // 1. List / Array
  ["ch3-tensor-py", "ch3-tensor-mojo"],           // 2. Tensors
  ["ch3-vec-py", "ch3-vec-mojo"],                 // 3. vectorized ops
  ["ch3-broadcast-py", "ch3-broadcast-mojo"],     // 4. broadcasting + matmul
];

function removeTabBtn(hh, id) {
  const re = new RegExp(`[ \\t]*<button\\b[^>]*\\bdata-tab="${id}"[^>]*>[\\s\\S]*?</button>\\r?\\n?`);
  if (!re.test(hh)) throw new Error(`removeTabBtn: no button for ${id}`);
  return hh.replace(re, "");
}
function removePaneDiv(hh, id) {
  /* No `active` allowed in the open tag: that is the assertion that the Python pane
   * was never the selected one, so no `active` has to be moved afterwards. */
  const re = new RegExp(`[ \\t]*<div class="tab-content" id="${id}">\\r?\\n[ \\t]*<pre>[\\s\\S]*?</pre>\\r?\\n[ \\t]*</div>\\r?\\n?`);
  if (!re.test(hh)) throw new Error(`removePaneDiv: no (inactive) pane ${id}`);
  return hh.replace(re, "");
}

const before = counts(h);
for (const [py, mojo] of PANES) {
  if (countOf(h, `data-tab="${py}"`) !== 1) throw new Error(`unexpected tab count for ${py}`);
  if (!new RegExp(`<div class="tab-content active" id="${mojo}">`).test(h)) {
    throw new Error(`${mojo} is not the active pane - active would have to move`);
  }
  h = removeTabBtn(h, py);
  h = removePaneDiv(h, py);
}

/* ---- editorial: keep the NumPy comparisons the removed panes carried, as prose ---- */

/* 1. List vs Array - the removed pane had Python's single dynamic list plus the
 *    tuple as its nearest "fixed-size" container. */
h = replaceOnce(
  h,
  `<p><code class="inline">Array</code> is a fixed-size, stack-allocated collection. Because the compiler knows the size at compile time, it can place the data directly on the stack — no heap allocation, no pointer chasing. This makes <code class="inline">Array</code> significantly faster for small, known-size collections.</p>`,
  `<p><code class="inline">Array</code> is a fixed-size, stack-allocated collection. Because the compiler knows the size at compile time, it can place the data directly on the stack — no heap allocation, no pointer chasing. This makes <code class="inline">Array</code> significantly faster for small, known-size collections.</p>
    <p>Python has only one of these: a single dynamically-sized list. A Python tuple is the nearest equivalent to a fixed-size <code class="inline">Array</code>, but it is a layout of pointers to boxed objects, not a contiguous run of unboxed <code class="inline">Float64</code> — which is exactly the difference Mojo's stack-allocated <code class="inline">Array[Float64, 3]</code> makes. In NumPy the same contrast appears as <code class="inline">np.zeros((3,), dtype=np.float32)</code> against a list of Python floats.</p>`
);

/* 2. Tensors - the removed pane was the NumPy creation spellings. */
h = replaceOnce(
  h,
  `<p>Mojo tensors are stored in row-major (C-style) order by default, just like NumPy arrays. The contiguous memory layout means that iterating over elements in row-major order is cache-friendly and maximizes memory bandwidth.</p>`,
  `<p>Mojo tensors are stored in row-major (C-style) order by default, just like NumPy arrays. The contiguous memory layout means that iterating over elements in row-major order is cache-friendly and maximizes memory bandwidth.</p>
      <p>The NumPy spellings map across one-for-one, with the dtype becoming the parameter: <code class="inline">np.zeros((2, 3), dtype=np.float32)</code> is <code class="inline">Tensor[Float32](2, 3)</code>, and the fill helper <code class="inline">np.ones((3, 3), dtype=np.float32)</code> is <code class="inline">Tensor[Float32](3, 3)</code> followed by <code class="inline">.fill(1.0)</code>. Where NumPy infers the shape from a nested list, Mojo wants the dimensions stated up front and the values assigned by index — which is what lets the compiler size the allocation before the program runs.</p>`
);

/* 3. vectorized - the removed pane built its inputs with np.arange. */
h = replaceOnce(
  h,
  `    <p>When you write element-wise operations on tensors, the Mojo compiler automatically vectorizes them using SIMD. This means a loop that adds two arrays of 1 million elements can execute 4–16 elements at a time (depending on your CPU's SIMD width), giving you near-linear speedups.</p>`,
  `    <p>When you write element-wise operations on tensors, the Mojo compiler automatically vectorizes them using SIMD. This means a loop that adds two arrays of 1 million elements can execute 4–16 elements at a time (depending on your CPU's SIMD width), giving you near-linear speedups.</p>
    <p>The initialization loop above is where NumPy would reach for <code class="inline">np.arange(n, dtype=np.float32)</code>. Writing the loop out is the point: it is the one part of the kernel Mojo will not fold away, and it is still compiled to straight-line SIMD. Everything after it — the additions, the multiplies, the scalar broadcast — is a single overloaded operator that the compiler lowers for you.</p>`
);

/* 4. broadcasting + matmul - the removed pane used the @ operator and np.full. */
h = replaceOnce(
  h,
  `      <p>Broadcasting rules in Mojo follow NumPy's conventions: dimensions are aligned from the right, and a dimension of size 1 is stretched to match. However, Mojo enforces type consistency — you cannot broadcast between <code class="inline">Float32</code> and <code class="inline">Int32</code> without explicit conversion.</p>`,
  `      <p>Broadcasting rules in Mojo follow NumPy's conventions: dimensions are aligned from the right, and a dimension of size 1 is stretched to match. However, Mojo enforces type consistency — you cannot broadcast between <code class="inline">Float32</code> and <code class="inline">Int32</code> without explicit conversion.</p>
      <p>Matrix multiplication has two spellings on either side of the interop line. In NumPy it is the <code class="inline">@</code> operator, <code class="inline">c = a @ b</code>, with <code class="inline">np.matmul(a, b)</code> as the spelled-out form; in Mojo it is the <code class="inline">matmul</code> function, <code class="inline">c = matmul(a, b)</code>, which dispatches to the same optimized BLAS routines. Both return the same 2×2 result above, and both spell the constant-fill differently: <code class="inline">np.full((3, 3), 2.0, dtype=np.float32)</code> against <code class="inline">Tensor[Float32](3, 3)</code> plus <code class="inline">.fill(2.0)</code>.</p>`
);

/* no Python control may survive */
if (/data-tab="[^"]*-py"/.test(h)) throw new Error("python tab button survived");
if (/id="[^"]*-py"/.test(h)) throw new Error("python pane survived");

const after = counts(h);
savePage(page, h, P);

const cy = (s) => (s.match(/\r\n/g) || []).length ? "CRLF" : "LF";
console.log(`py pre  ${PANES.length} -> 0`);
console.log(`pre    ${before.pre[0]} -> ${after.pre[0]}  ${after.pre[0] === after.pre[1] ? "balanced" : "UNBALANCED"}`);
console.log(`div    ${before.div} -> ${after.div}  ${after.div[0] === after.div[1] ? "balanced" : "UNBALANCED"}`);
console.log(`panes  ${before.panes} -> ${after.panes}`);
console.log(`tabBtn ${before.tabBtn} -> ${after.tabBtn}`);
console.log(`span   ${before.span} -> ${after.span}`);
console.log(`eol    ${JSON.stringify(page.eol)} (${cy(h)})  bom=${page.bom}`);
