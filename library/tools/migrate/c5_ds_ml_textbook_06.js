/* Migrate ds_ml_textbook_06_building_models.html : drop the 5 labelled Python panes
 * (NumPy / PyTorch / scikit-learn) from the Mojo/Python tab bars. Same shape and
 * house style as ds_ml_textbook_02 (see c1_ds_ml_textbook_02.js): <button
 * class="tab-btn" data-tab> over <div class="tab-content" id>, every Mojo pane
 * already carries `active`, the single remaining tab keeps its "Mojo" label.
 *
 * This page's panes are written with the <pre> flush to column 0 and the closing
 * </div> indented, which removePaneDiv's `[ \t]*` allowances already handle.
 *
 * Vocabulary: .kw .fn .str .num .cmt .op .type .var  ->  MAPS.cmt
 * Every surviving <pre> is hand-authored spans, so nothing is re-highlighted here.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_ml_textbook_06_building_models.html";
const page = loadPage(P);
let h = page.text;

/* [python pane id, mojo pane id that must already be the active one] */
const PANES = [
  ["ch6-python-tensor", "ch6-mojo-tensor"], // 1. From NumPy to Mojo Tensors
  ["ch6-python-ops", "ch6-mojo-ops"],       // 2. essential tensor operations
  ["ch6-python-nn", "ch6-mojo-nn"],         // 3. two-layer network
  ["ch6-python-train", "ch6-mojo-train"],   // 4. training loop / backprop
  ["ch6-python-eval", "ch6-mojo-eval"],     // 5. evaluation
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

/* ---- editorial: no dangling promises, and the useful comparisons kept as prose ---- */

/* 1. overview - the trailing paragraph repeated the Key Insight box verbatim. It is
 *    where the removed pane's one-line NumPy spellings now live. */
h = replaceOnce(
  h,
  `<p>Mojo's <code class="inline">Tensor[Float32]</code> carries its element type at compile time, so the compiler knows the exact memory layout and can inline the math. Yet the code reads like Python — no extra annotations or boilerplate for this pattern.</p>`,
  `<p>Mojo's <code class="inline">Tensor[Float32]</code> carries its element type at compile time, so the compiler knows the exact memory layout and can inline the math. Compare the two primitives above: in NumPy a matrix multiply is <code class="inline">A @ B</code> and a ReLU is <code class="inline">np.maximum(T, 0.0)</code> — one line each, delegated to the library. The Mojo versions are the triple loop and the element-wise clamp, written out. That extra length buys something specific: <code class="inline">A.shape()[0]</code> is a compile-time-known layout, the accumulator <code class="inline">acc</code> stays in a register across the innermost loop, and <code class="inline">relu</code> takes <code class="inline">mut T</code> so it clamps in place instead of allocating a second tensor the way the returning NumPy form must.</p>`
);

/* 2. tensor ops - "in each language" promised a second pane that no longer exists. */
h = replaceOnce(
  h,
  `<p>A neural network needs tensor primitives: element-wise operations, summation, and activation functions. Let's build reusable loss and activation functions in each language.</p>`,
  `<p>A neural network needs tensor primitives: element-wise operations, summation, and activation functions. Let's build the two this chapter leans on — a loss and a softmax — as reusable functions.</p>`
);

/* 3. neural network - the removed pane was the nn.Module version. */
h = replaceOnce(
  h,
  `<p>The Mojo example uses manual loops for bias addition to demonstrate low-level control. In production, wrap common operations into utility functions to keep code clean and avoid off-by-one errors.</p>`,
  `<p>The Mojo example uses manual loops for bias addition to demonstrate low-level control. In production, wrap common operations into utility functions to keep code clean and avoid off-by-one errors.</p>
      <p>Worth naming what PyTorch was doing for you. As an <code class="inline">nn.Module</code>, <code class="inline">TwoLayerNet</code> gets <code class="inline">nn.Linear</code> layers, parameter registration, and the whole <code class="inline">super().__init__()</code> protocol for free — two lines of constructor become a full framework contract. The <code class="inline">struct TwoLayerNet</code> above has to spell out all four tensors, initialize them by hand, and write Xavier scaling inline. In exchange the tensors are compile-time typed, the forward pass is straight-line code with no dispatch layer, and nothing is hidden behind a <code class="inline">.backward()</code> you did not ask for.</p>`
);

/* 4. training - the removed pane used loss.backward() and torch.no_grad(). */
h = replaceOnce(
  h,
  `<p>Mojo's <code class="inline">mut</code> parameter makes it explicit that <code class="inline">train_epoch</code> mutates the model. The compiler guarantees exclusive access to the tensors during the call, which prevents the aliasing bugs that can appear in Python autograd.</p>`,
  `<p>Mojo's <code class="inline">mut</code> parameter makes it explicit that <code class="inline">train_epoch</code> mutates the model. The compiler guarantees exclusive access to the tensors during the call, which prevents the aliasing bugs that can appear in Python autograd.</p>
      <p>The same idea replaces the <code class="inline">torch.no_grad()</code> block. PyTorch needs that guard because gradients are recorded by default and stepping them means walking <code class="inline">model.parameters()</code>, updating <code class="inline">p.grad</code>, and calling <code class="inline">p.grad.zero_()</code> so the next epoch does not accumulate on top of it. The Mojo update has no tape to manage: <code class="inline">d_logits</code> is an ordinary local tensor, the SGD step touches <code class="inline">model.W2</code> through a <code class="inline">mut</code> parameter, and there is nothing to zero out.</p>`
);

/* 5. evaluation - the removed pane was the sklearn/torch eval loop. */
h = replaceOnce(
  h,
  `<p>In production, Mojo's compiled evaluation loop runs inference on thousands of samples per second without the Python GIL bottleneck. The same binary that trains your model can serve predictions with zero interpreter overhead.</p>`,
  `<p>In production, Mojo's compiled evaluation loop runs inference on thousands of samples per second without the Python GIL bottleneck. The same binary that trains your model can serve predictions with zero interpreter overhead.</p>
      <p>Worth comparing the shape of the two evaluation routines. The scikit-learn version is four lines because <code class="inline">model.eval()</code>, <code class="inline">torch.no_grad()</code>, <code class="inline">probs.argmax(dim=1)</code>, and <code class="inline">accuracy_score(y_test, preds)</code> each do a whole stage for you. The Mojo version spells out the two stages that were hidden — find the arg-max over the class axis, then count the matches — and the inner loop is where the compile-time shape pays off: <code class="inline">nc</code> is loaded once, and the row start <code class="inline">i * nc</code> is arithmetic on a known layout rather than a stride lookup.</p>`
);

/* no Python control may survive */
if (/data-tab="[^"]*-py/.test(h)) throw new Error("python tab button survived");
if (/id="ch6-python-/.test(h)) throw new Error("python pane survived");
if (/in each language/.test(h)) throw new Error("dangling per-language promise");

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
