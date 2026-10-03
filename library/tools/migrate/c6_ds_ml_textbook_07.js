/* Migrate ds_ml_textbook_07_performance.html : drop the 5 labelled Python panes
 * (NumPy / numba / C-intrinsics / multiprocessing / time) from the Mojo/Python tab
 * bars. Same shape and house style as ds_ml_textbook_02 (see c1_ds_ml_textbook_02.js):
 * <button class="tab-btn" data-tab> over <div class="tab-content" id>, every Mojo pane
 * already carries `active`, the single remaining tab keeps its "Mojo" label.
 *
 * This page's panes are written with the <pre> flush to column 0, which
 * removePaneDiv's `[ \t]*` allowance already handles.
 *
 * Vocabulary: .kw .fn .str .num .cmt .op .type .var  ->  MAPS.cmt
 * Every surviving <pre> is hand-authored spans, so nothing is re-highlighted here.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_ml_textbook_07_performance.html";
const page = loadPage(P);
let h = page.text;

/* [python pane id, mojo pane id that must already be the active one] */
const PANES = [
  ["ch7-python-vec", "ch7-mojo-vec"],     // 1. loop vectorization
  ["ch7-python-simd", "ch7-mojo-simd"],   // 2. SIMD intrinsics
  ["ch7-python-par", "ch7-mojo-par"],     // 3. parallelization
  ["ch7-python-mem", "ch7-mojo-mem"],     // 4. memory layout
  ["ch7-python-prof", "ch7-mojo-prof"],   // 5. profiling
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

/* ---- editorial: keep the comparisons the removed panes carried, as prose ---- */

/* 1. vectorization - the removed pane was np.dot plus the numba @njit/prange route. */
h = replaceOnce(
  h,
  `<p>Mojos <code class="inline">SIMD[Float32, S]</code> type is a compile-time fixed-width vector. The compiler knows exactly how many elements it holds, so it can map directly to AVX2/AVX-512 instructions without any runtime dispatch.</p>`,
  `<p>Mojos <code class="inline">SIMD[Float32, S]</code> type is a compile-time fixed-width vector. The compiler knows exactly how many elements it holds, so it can map directly to AVX2/AVX-512 instructions without any runtime dispatch.</p>
    <p>Python has two routes to the same hardware, and neither is this one. The cheap route is <code class="inline">np.dot(a, b)</code>, which hands the work to a SIMD-optimized BLAS and returns the answer in one call — fast, but the vector width is the library's decision, not yours. The explicit route is numba: <code class="inline">@njit(parallel=True)</code> over a <code class="inline">prange</code> lets a plain Python loop compile to native code, which gets you SIMD as a side effect of the JIT. The Mojo version is the explicit route without the JIT — the width is <code class="inline">simdwidthof[Float32]()</code>, the loop steps by that width, and the horizontal reduction is written out. Note the remainder loop: an explicit vector kernel always needs one, because the length rarely divides evenly.</p>`
);

/* 2. SIMD intrinsics - the removed pane was the scalar Python softmax and the C note. */
h = replaceOnce(
  h,
  `<p>Mojos <code class="inline">load</code> and <code class="inline">store</code> methods on Tensor use aligned memory access when possible. Aligned loads are significantly faster on x86 — up to 2x throughput for large arrays.</p>`,
  `<p>Mojos <code class="inline">load</code> and <code class="inline">store</code> methods on Tensor use aligned memory access when possible. Aligned loads are significantly faster on x86 — up to 2x throughput for large arrays.</p>
    <p>From Python this level of control is out of reach without leaving Python. The honest options are NumPy, which gives you whole-array operations and no width control, or a C extension that reaches for intrinsics like <code class="inline">_mm256_fmadd_ps</code> for an AVX2 fused multiply-add. Anything in between is a scalar list comprehension — the three-line softmax, subtract the max, exponentiate, divide — which is correct, portable, and around an order of magnitude off the vectorized version above. That gap is the argument for having a <code class="inline">SIMD</code> type in the language rather than behind an extension boundary.</p>`
);

/* 3. parallelization - the removed pane was the multiprocessing.Pool version. */
h = replaceOnce(
  h,
  `<p>Mojos <code class="inline">parallelize[fn](total_items, num_cores)</code> abstracts thread pool management. Unlike Python's <code class="inline">multiprocessing</code>, it uses lightweight threads that share memory — no pickling overhead, no process startup cost.</p>`,
  `<p>Mojos <code class="inline">parallelize[fn](total_items, num_cores)</code> abstracts thread pool management. Unlike Python's <code class="inline">multiprocessing</code>, it uses lightweight threads that share memory — no pickling overhead, no process startup cost.</p>
      <p>The reason Python reaches for <code class="inline">multiprocessing</code> here at all is the GIL: <code class="inline">Pool().map</code> is the only way to put a CPU-bound loop on more than one core, and it pays for that with a copy. Every argument tuple crossing the process boundary is pickled, so the <code class="inline">[(i, A, B) for i in range(...)]</code> argument list pickles the whole of <code class="inline">A</code> and <code class="inline">B</code> once per row, and the result comes back the same way. In the Mojo pane <code class="inline">A</code>, <code class="inline">B</code> and <code class="inline">C</code> are already in one address space, so <code class="inline">parallelize[compute_row](M, num_cores=logical_cores())</code> passes nothing but an index — the row function reads and writes the shared tensors directly, and the nested function needs no arguments plumbed to it at all.</p>`
);

/* 4. memory - the removed pane was the always-heap NumPy buffer. */
h = replaceOnce(
  h,
  `<p>Mojos <code class="inline">stack_allocation</code> is for fixed-size, compile-time-known sizes only. For dynamic sizes, you'll use the heap. Profile before optimizing — premature stack allocation can actually hurt if it causes stack overflow on large inputs.</p>`,
  `<p>Mojos <code class="inline">stack_allocation</code> is for fixed-size, compile-time-known sizes only. For dynamic sizes, you'll use the heap. Profile before optimizing — premature stack allocation can actually hurt if it causes stack overflow on large inputs.</p>
      <p>Python has no equivalent switch. Every buffer is a heap object, so the closest equivalent to the Mojo pane is <code class="inline">np.zeros(256, dtype=np.float32)</code> followed by <code class="inline">buf[:len(input_arr)] = input_arr[:256]</code>: a <code class="inline">malloc</code> on every call, a bounds check on every slice, and no way to ask the language for the stack instead. The three-line form works, but note what it costs — the allocation is the expensive part, not the arithmetic, and that is exactly the cost <code class="inline">stack_allocation[Float32, BUF_SIZE]()</code> removes.</p>`
);

/* 5. profiling - the removed pane was time.perf_counter + cProfile/py-spy. */
h = replaceOnce(
  h,
  `<p>Mojos <code class="inline">--baseline</code> flag runs a function multiple times to compute statistically robust timing measurements. It handles warmup, outlier rejection, and reports confidence intervals — essential for micro-benchmarking.</p>`,
  `<p>Mojos <code class="inline">--baseline</code> flag runs a function multiple times to compute statistically robust timing measurements. It handles warmup, outlier rejection, and reports confidence intervals — essential for micro-benchmarking.</p>
      <p>The Python equivalent of the timer alone is <code class="inline">time.perf_counter()</code> on both sides of the call, but stopping there is what makes micro-benchmarks lie: one run on a shared machine is noise, and <code class="inline">timeit</code> is the usual answer. Everything past the timer has no equivalent worth copying — <code class="inline">python -m cProfile -s cumulative</code> and <code class="inline">py-spy top</code> profile the interpreter, so their overhead is the interpreter, and neither can report a confidence interval. The Mojo pane just runs <code class="inline">mojo run --baseline bench.mojo</code> and gets the statistics with the measurement.</p>`
);

/* no Python control may survive */
if (/data-tab="[^"]*-py/.test(h)) throw new Error("python tab button survived");
if (/id="ch7-python-/.test(h)) throw new Error("python pane survived");

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
