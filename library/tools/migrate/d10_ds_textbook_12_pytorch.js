/* Migrate ds_textbook_12_pytorch.html : drop the 4 Python tabs and the 4 Python panes they
 * control (pytorch_inference.py / export_onnx.py / python_serving.py / optimize_model.py).
 *
 * Same third shape as ds_textbook_02..05 / 07..11 / 14 (p10): no data-target, no ids -
 *   <div class="tab" data-lang="python" data-group="onnx"><span class="sw"></span>export_onnx.py</div>
 *   <div class="pane" data-lang="python"><pre>...</pre></div>
 *
 * ONE GROUP IS INVERTED - the only case in the whole batch.
 * Groups pytorch / max / opt all have the Mojo tab first and already `active`; the Python tab
 * is the second, inactive one. But `onnx` is the other way round:
 *     <div class="tab active" data-lang="python" data-group="onnx">export_onnx.py</div>
 *     <div class="tab" data-lang="mojo" data-group="onnx">inference_onnx.mojo</div>
 *     <div class="pane active" data-lang="python">...Step 1: train and export...</div>
 *     <div class="pane" data-lang="mojo">...Step 2: run inference...</div>
 * So `active` has to move onto the surviving Mojo tab AND the surviving Mojo pane, or the
 * onnx demo renders blank. `activeTabIn` records which language holds it per group.
 *
 * Consequence of that: the Mojo pane's opening comment reads "# Step 2: Run inference in Mojo
 * via MAX Engine", and with Step 1 gone "Step 2" is a promise the page can no longer keep. The
 * numbering prefix is dropped and the export half is restored as prose in the same section, so
 * the workflow stays complete without inventing a Step 1 that is no longer on the page.
 *
 * This page has no `class="tok-cast"` spans, so nothing outside the panes needs tidying.
 *
 * Vocabulary: .tok-kw .tok-str .tok-com .tok-fn .tok-num .tok-ty  ->  MAPS.com
 * (every surviving <pre> is hand-authored spans, so no build-time highlighting is emitted
 * here and the token classes are untouched.)
 *
 * NOT changed here, flagged instead:
 *   - A2  f-strings in all four surviving Mojo panes (13 sites). A2's prescribed alternatives
 *        (t-strings, `print(a, b)`) need a decision the static audit cannot make on its own.
 *   - B1  `from math import exp` in the onnx pane, missing the `std.` prefix.
 *   - D1  the max pane calls `session.execute(input_data)` and `create_input(i)` but defines
 *        neither in the block, so it cannot run as printed.
 *   - markup: `f"Throughput: {<span class="tok-num">1000</span>/avg_ms:.0f} ..."` nests a
 *        `tok-num` span *inside* a `tok-str` span, which is not valid nesting. hl_audit does
 *        not flag it and the prose is unaffected, but the literal is tokenised wrongly.
 * The report's recommended next step is to install the toolchain and compile block by block.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_textbook_12_pytorch.html";
const page = loadPage(P);
let h = page.text;

/* data-group -> [ .py tab label, does the *Mojo* tab hold `active`? ] */
const GROUPS = [
  ["pytorch", "pytorch_inference.py", true],
  ["onnx", "export_onnx.py", false], // inverted: Python is active here
  ["max", "python_serving.py", true],
  ["opt", "optimize_model.py", true],
];

const before = counts(h);
/* 8 controls (4 tabs + 4 panes) plus the one `.tab[data-lang="python"] .sw` CSS rule. */
if (countOf(h, 'data-lang="python"') !== GROUPS.length * 2 + 1) throw new Error("unexpected data-lang=python count");

function removePyTab(hh, group, label) {
  const re = new RegExp(`[ \\t]*<div class="tab active" data-lang="python" data-group="${group}"><span class="sw"></span>${label.replace(/\./g, "\\.")}</div>\\r?\\n?|[ \\t]*<div class="tab" data-lang="python" data-group="${group}"><span class="sw"></span>${label.replace(/\./g, "\\.")}</div>\\r?\\n?`);
  if (!re.test(hh)) throw new Error(`removePyTab: no python tab for ${group}`);
  return hh.replace(re, "");
}
function removePyPane(hh, group) {
  const body = `[ \\t]*<div class="pane active" data-lang="python"><pre>[\\s\\S]*?</pre></div>\\r?\\n?|[ \\t]*<div class="pane" data-lang="python"><pre>[\\s\\S]*?</pre></div>\\r?\\n?`;
  const n = (hh.match(new RegExp(body, "g")) || []).length;
  if (n !== expect) throw new Error(`removePyPane: expected ${expect} python panes at ${group}, found ${n}`);
  expect -= 1;
  return hh.replace(new RegExp(body), ""); // non-global: consume exactly one
}
let expect = GROUPS.length;

for (const [group, label, mojoActive] of GROUPS) {
  if (new RegExp(`<div class="tab active" data-lang="mojo" data-group="${group}">`).test(h) !== mojoActive) {
    throw new Error(`group ${group}: mojo-active mismatch, expected ${mojoActive}`);
  }
  h = removePyTab(h, group, label);
  h = removePyPane(h, group);
  if (!mojoActive) {
    // hand `active` to the only surviving control in this tab bar
    h = replaceOnce(h, `<div class="tab" data-lang="mojo" data-group="${group}">`, `<div class="tab active" data-lang="mojo" data-group="${group}">`);
    h = replaceOnce(h, `        <div class="pane" data-lang="mojo"><pre>`, `        <div class="pane active" data-lang="mojo"><pre>`);
  }
}

/* ---- editorial: every removed pane's lesson becomes prose ---- */
/* 1. pytorch - the removed pane was the same block written in plain PyTorch. */
h = replaceOnce(
  h,
  `\n\n    <p>The Python interop layer is not a toy`,
  `\n\n    <p class="cap">The pure-Python spelling of that same block is <code class="inline">import torch</code> / <code class="inline">import torch.nn as nn</code> at module scope, with <code class="inline">with torch.no_grad():</code> wrapping the forward pass. The Mojo pane reaches the identical module through <code class="inline">Python.import_module("torch")</code> and gets gradient suppression from a bare <code class="inline">torch.no_grad()</code> call rather than a context manager.</p>\n\n    <p>The Python interop layer is not a toy`
);
/* 2. onnx - the removed pane WAS Step 1, and the section intro still promises "train in
 *    PyTorch, export to ONNX". The architecture and the export call have to be restated here
 *    so the surviving inference pane still has a model to load. */
h = replaceOnce(
  h,
  `<span class="tok-com"># Step 2: Run inference in Mojo via MAX Engine</span>`,
  `<span class="tok-com"># Run inference in Mojo via MAX Engine</span>`
);
h = replaceOnce(
  h,
  `\n\n    <p>The ONNX format captures not just the model weights`,
  `\n\n    <p class="cap">The export half of that workflow still happens in Python: a <code class="inline">nn.Module</code> subclass whose <code class="inline">forward</code> wraps an <code class="inline">nn.Sequential(Linear(784, 256), ReLU, Dropout(0.2), Linear(256, 128), ReLU, Linear(128, 10))</code>, then <code class="inline">torch.onnx.export(model, dummy, "classifier.onnx", dynamic_axes={"input": {0: "batch"}}, opset_version=17)</code>. The <code class="inline">dynamic_axes</code> entry is what lets the Mojo pane vary the batch dimension later, and <code class="inline">opset_version=17</code> is the contract the MAX Engine has to honour when it reads the file.</p>\n\n    <p>The ONNX format captures not just the model weights`
);
/* 3. max - the removed pane was the onnxruntime version of the same benchmark loop. */
h = replaceOnce(
  h,
  `\n\n    <p>The MAX Engine automatically selects the best execution strategy`,
  `\n\n    <p class="cap">The same loop in Python runs through <code class="inline">onnxruntime</code>: <code class="inline">ort.InferenceSession("classifier.onnx", providers=["CPUExecutionProvider"])</code>, a warmup <code class="inline">session.run(None, {"input": input_data})</code>, and <code class="inline">time.perf_counter()</code> around the loop. Identical iteration count, identical <code class="inline">avg_ms</code> formula — and the number the 3-10x figure in the callout below is measured against.</p>\n\n    <p>The MAX Engine automatically selects the best execution strategy`
);
/* 4. opt - the removed pane was the onnxruntime quantization route. */
h = replaceOnce(
  h,
  `\n\n    <h3>Optimization strategies by use case</h3>`,
  `\n\n    <p class="cap">The Python equivalent is <code class="inline">onnxruntime.quantization.quantize_dynamic(model_input="classifier.onnx", model_output="classifier_int8.onnx", weight_type=QuantType.QInt8)</code>, which writes a second file and measures the win with <code class="inline">os.path.getsize(...)</code> on both paths — a post-hoc, file-level diff. The pipeline above fuses and re-plans in memory instead, so there is no second artifact to ship.</p>\n\n    <h3>Optimization strategies by use case</h3>`
);

/* ---- dead CSS: the only consumer of --py-blue / --py-yellow was the .py tab swatch ---- */
h = replaceOnce(h, `  --py-blue:#4b8bbe; --py-yellow:#ffd43b;\n`, ``);
h = replaceOnce(h, `.tab[data-lang="python"] .sw{background:var(--py-blue);}\n`, ``);

/* no Python control may survive */
if (/data-lang="python"/.test(h)) throw new Error("data-lang=python survived");
if (/--py-/.test(h)) throw new Error("dead --py-* CSS survived");
/* every group now has exactly one active mojo tab and one active mojo pane */
if (countOf(h, `<div class="tab active" data-lang="mojo"`) !== 4) throw new Error("mojo tab active count wrong");
if (countOf(h, `<div class="pane active" data-lang="mojo">`) !== 4) throw new Error("mojo pane active count wrong");
if (countOf(h, `<div class="tab" data-lang="mojo"`)) throw new Error("an inactive mojo tab survived");
if (countOf(h, `<div class="pane" data-lang="mojo">`)) throw new Error("an inactive mojo pane survived");
/* the onnx group must still be a single self-contained step */
if (/Step 2/.test(h)) throw new Error("dangling 'Step 2' reference");
if (countOf(h, `Step 1`) !== 0) throw new Error("dangling 'Step 1' reference");
if (countOf(h, `Run inference in Mojo via MAX Engine`) !== 1) throw new Error("onnx mojo comment lost");
/* each of the four removed panes' lessons must survive somewhere in prose */
const LESSONS = [
  `with torch.no_grad():`,
  `dynamic_axes={"input": {0: "batch"}}`,
  `ort.InferenceSession("classifier.onnx", providers=["CPUExecutionProvider"])`,
  `weight_type=QuantType.QInt8`,
];
for (const s of LESSONS) if (countOf(h, s) !== 1) throw new Error(`prose lesson missing or duplicated: ${s}`);

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
