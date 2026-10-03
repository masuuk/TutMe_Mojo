/* Migrate ds_ml_textbook_05_ml_fundamentals.html : drop the 4 labelled Python panes
 * from the Mojo/Python tab bars. Same shape and house style as ds_ml_textbook_02
 * (see c1_ds_ml_textbook_02.js): <button class="tab-btn" data-tab> over
 * <div class="tab-content" id>, every Mojo pane already carries `active`, the single
 * remaining tab keeps its "Mojo" label, and the removed NumPy formulation is folded
 * into prose.
 *
 * Vocabulary: .kw .fn .str .num .cmt .op .type .var  ->  MAPS.cmt
 * This page also carries the site-wide runtime highlighter's `.hkw/.hty/.hfn/.hstr/
 * .hnum/.hcm/.hop` rules in a second <style> block, but those paint only the three
 * Mojo panes that are stored as plain text (ch5-gd, ch5-loss, ch5-loop); the
 * hand-authored spans use the .kw set, so MAPS.cmt is the vocabulary that matters.
 * Nothing is re-highlighted here - every surviving <pre> is left exactly as it is.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_ml_textbook_05_ml_fundamentals.html";
const page = loadPage(P);
let h = page.text;

/* [python pane id, mojo pane id that must already be the active one] */
const PANES = [
  ["ch5-gd-py", "ch5-gd-mojo"],       // 1. gradient descent
  ["ch5-loss-py", "ch5-loss-mojo"],   // 2. loss functions
  ["ch5-loop-py", "ch5-loop-mojo"],   // 3. training loop
  ["ch5-lr-py", "ch5-lr-mojo"],       // 4. linear regression
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

/* 1. gradient descent - the removed pane used sum(...) over a zip() generator. */
h = replaceOnce(
  h,
  `<p>Mojo's compiled loops make gradient descent ~100-1000x faster than pure Python for each epoch, which matters enormously when training on large datasets.</p>`,
  `<p>Mojo's compiled loops make gradient descent ~100-1000x faster than pure Python for each epoch, which matters enormously when training on large datasets.</p>

    <div class="info-box">
      <strong>💡 Key Insight:</strong>
      <p>Mojo has no <code class="inline">zip</code> and no generator expression, so the two gradients cannot be written as a pair of <code class="inline">sum(... for ...)</code> one-liners. The loop above is the replacement — and it is better than the one-liner for two reasons. It walks the data once instead of twice, accumulating <code class="inline">grad_w</code> and <code class="inline">grad_b</code> together, and it divides by <code class="inline">n</code> only once at the end, so every intermediate value stays inside a <code class="inline">Float64</code> the compiler can keep in a register. Note too that <code class="inline">gradient_step</code> takes <code class="inline">mut w</code> and <code class="inline">mut b</code>: the update happens in place, so there is no <code class="inline">return w, b</code> to unpack at the call site.</p>
    </div>`
);

/* 2. loss functions - the removed pane was the NumPy one-liners. */
h = replaceOnce(
  h,
  `      <li><strong>Cross-Entropy Loss:</strong> used for classification tasks</li>
    </ul>`,
  `      <li><strong>Cross-Entropy Loss:</strong> used for classification tasks</li>
    </ul>
    <p>Each of these takes two <code class="inline">List[Float64]</code> arguments and returns a <code class="inline">Float64</code>, so there is no array conversion to write: NumPy's <code class="inline">np.mean((np.array(pred) - np.array(target)) ** 2)</code> becomes a loop over two lists, and <code class="inline">np.abs</code> becomes <code class="inline">abs</code>. <code class="inline">rmse_loss</code> then shows the other half of the pattern — a derived loss is a one-line composition of the loss you already have with the <code class="inline">sqrt</code> imported from <code class="inline">std.math</code>.</p>`
);

/* 3. training loop - the info-box said "the Mojo version", which only made sense
 *    while the NumPy pane sat beside it. */
h = replaceOnce(
  h,
  `<p>The Mojo version uses explicit loops instead of NumPy vectorization, yet achieves comparable performance because the compiler auto-vectorizes the loop. This gives you Python-like readability with C-like speed.</p>`,
  `<p>The epoch here is written as one explicit loop rather than as the three whole-array expressions NumPy would use, yet it achieves comparable performance, because the compiler auto-vectorizes the loop for you. You keep the step-by-step readability of Python with C-like speed — and one detail is worth copying: printing every hundredth epoch with <code class="inline">print("Epoch", epoch, "Loss:", loss, "w:", w, "b:", b)</code> passes the values as separate arguments, so no f-string is needed to format the line.</p>`
);

/* 4. linear regression - the removed pane was the vectorized NumPy version. */
h = replaceOnce(
  h,
  `<p>This simple linear regression should converge to w ≈ 3.5 and b ≈ 2.0. If the RMSE is close to 1.0, your model has learned the noise level. This is the same pattern used in neural networks — just with more parameters and nonlinear activations.</p>`,
  `<p>This simple linear regression should converge to w ≈ 3.5 and b ≈ 2.0. If the RMSE is close to 1.0, your model has learned the noise level. This is the same pattern used in neural networks — just with more parameters and nonlinear activations.</p>
      <p>The NumPy version of this model is four lines per epoch, because <code class="inline">preds = w * x + b</code> produces a whole array at once and <code class="inline">2 * np.mean(errors * x)</code> reduces it in one call. The Mojo pane spells the same four steps out, and the final RMSE is computed the same way it is done in the loss section — accumulate the squared errors, divide by <code class="inline">n</code>, then <code class="inline">sqrt</code>. The two reach the same numbers; only the spelling of "multiply every element" differs.</p>`
);

/* no Python control may survive */
if (/data-tab="[^"]*-py"/.test(h)) throw new Error("python tab button survived");
if (/id="[^"]*-py"/.test(h)) throw new Error("python pane survived");
/* the info-box that compared two side-by-side panes must not keep comparing them */
if (/The Mojo version uses explicit loops/.test(h)) throw new Error("dangling side-by-side comparison");

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
