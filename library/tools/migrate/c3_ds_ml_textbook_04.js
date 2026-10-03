/* Migrate ds_ml_textbook_04_numerical.html : drop the 4 labelled Python/NumPy panes
 * from the Mojo/Python tab bars. Same shape and house style as ds_ml_textbook_02
 * (see c1_ds_ml_textbook_02.js): <button class="tab-btn" data-tab> over
 * <div class="tab-content" id>, every Mojo pane already carries `active`, the single
 * remaining tab keeps its "Mojo" label, and each removed NumPy/Python comparison is
 * folded into the section's existing info-box/prose.
 *
 * Vocabulary: .kw .fn .str .num .cmt .op .type .var  ->  MAPS.cmt
 * Every surviving <pre> is hand-authored spans, so nothing is re-highlighted here.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_ml_textbook_04_numerical.html";
const page = loadPage(P);
let h = page.text;

/* [python pane id, mojo pane id that must already be the active one] */
const PANES = [
  ["ch4-la-py", "ch4-la-mojo"],       // 1. BLAS/LAPACK
  ["ch4-stats-py", "ch4-stats-mojo"], // 2. descriptive statistics
  ["ch4-rng-py", "ch4-rng-mojo"],     // 3. random numbers
  ["ch4-bench-py", "ch4-bench-mojo"], // 4. benchmark
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

/* 1. BLAS/LAPACK - the removed pane was the NumPy call spellings. */
h = replaceOnce(
  h,
  `<p>Mojo's <code class="inline">matmul</code> dispatches to the best available implementation at compile time — MKL on Intel, cuBLAS on NVIDIA GPUs, or an optimized pure-Mojo fallback. You get hardware-optimal performance without platform-specific code.</p>`,
  `<p>Mojo's <code class="inline">matmul</code> dispatches to the best available implementation at compile time — MKL on Intel, cuBLAS on NVIDIA GPUs, or an optimized pure-Mojo fallback. You get hardware-optimal performance without platform-specific code.</p>
      <p>Each NumPy spelling has a Mojo counterpart, usually just a different name: <code class="inline">np.dot(a, b)</code> is <code class="inline">dot(a, b)</code>, the <code class="inline">@</code> operator <code class="inline">M @ v</code> is <code class="inline">matmul(M, v)</code>, and <code class="inline">A.T</code> is <code class="inline">A.T</code> as well — a transposed view, not a copy. The one that deliberately looks different is the norm: <code class="inline">np.linalg.norm(M)</code> is a single call into LAPACK, while the Mojo pane above writes the Frobenius norm out as the double loop that defines it, because writing the loop is what lets the compiler keep the accumulation in a register.</p>`
);

/* 2. descriptive statistics - the removed pane was np.mean/np.std/np.min/np.max.
 *    This section has no info-box of its own, so the comparison goes in a new one. */
h = replaceOnce(
  h,
  `    <span class="fn">print</span>(<span class="str">"Std Dev:"</span>, std_dev(data))</pre>
      </div>
    </div>
  </section>`,
  `    <span class="fn">print</span>(<span class="str">"Std Dev:"</span>, std_dev(data))</pre>
      </div>
    </div>

    <div class="info-box">
      <strong>💡 Key Insight:</strong>
      <p>In NumPy the same numbers are four one-liners — <code class="inline">np.mean(data)</code>, <code class="inline">np.std(data)</code>, <code class="inline">np.min(data)</code>, <code class="inline">np.max(data)</code> — and the two functions above are what they are computing underneath. Dividing by <code class="inline">Float64(len(data))</code> is what makes this the population standard deviation, the same default <code class="inline">np.std</code> uses; pass <code class="inline">n - 1</code> instead for the sample deviation. Min and max need no library at all: they are a single comparison per element in a <code class="inline">for</code> loop over the list.</p>
    </div>
  </section>`
);

/* 3. random numbers - the removed pane seeded both the stdlib and NumPy. */
h = replaceOnce(
  h,
  `<p>Random number generation is essential for machine learning — initializing weights, data augmentation, Monte Carlo simulations, and stochastic gradient descent. Mojo provides a high-performance <code class="inline">random</code> module. Unlike Python's <code class="inline">random</code> module (single-threaded), Mojo's RNG is designed for parallelism with independent streams per thread.</p>`,
  `<p>Random number generation is essential for machine learning — initializing weights, data augmentation, Monte Carlo simulations, and stochastic gradient descent. Mojo provides a high-performance <code class="inline">random</code> module. Unlike Python's <code class="inline">random</code> module (single-threaded), Mojo's RNG is designed for parallelism with independent streams per thread.</p>
    <p>There is one seed, not two. A NumPy script that wants reproducibility has to seed the standard library <em>and</em> NumPy separately, <code class="inline">random.seed(42)</code> alongside <code class="inline">np.random.seed(42)</code>, because they are two unrelated generators. The Mojo pane calls <code class="inline">seed(42)</code> once and every later draw — <code class="inline">random_float64()</code> for the unit interval, <code class="inline">random_uniform(5.0, 10.0)</code> for a scaled range, <code class="inline">random_normal()</code> for the standard normal — comes from that one seeded stream. The <code class="inline">random_float64</code> name is also the honest one: the return type is part of the function, where <code class="inline">random.random()</code> hides it.</p>`
);

/* 4. benchmark - the removed pane was the NumPy timing harness. */
h = replaceOnce(
  h,
  `<p>The benchmark shows Mojo reaching near-native performance for raw loop work — roughly 1600x faster than a Python for-loop. Mojo achieves this while maintaining Python-like syntax, making it much more accessible for data scientists.</p>`,
  `<p>The benchmark shows Mojo reaching near-native performance for raw loop work — roughly 1600x faster than a Python for-loop. Mojo achieves this while maintaining Python-like syntax, making it much more accessible for data scientists.</p>
      <p>The <code class="inline">now()</code> clock and the <code class="inline"># 1_000_000</code> size make the two harnesses directly comparable. The NumPy version reaches for <code class="inline">np.random.rand(n)</code> to fill the vectors, brackets the timed region with <code class="inline">time.perf_counter()</code>, and expresses the whole computation as one expression, <code class="inline">np.sum((a - b) ** 2)</code> — hence its ~3 ms row in the table above, against ~800 ms for an explicit Python loop and ~0.5 ms for the compiled Mojo loop that walks the same two arrays. The Mojo pane is deliberately the slowest-looking of the three: a plain <code class="inline">for</code> loop, which is the thing being measured.</p>`
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
