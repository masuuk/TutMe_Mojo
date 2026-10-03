/* Migrate ds_ml_textbook_08_advanced.html : drop the 4 labelled Python panes
 * (PyTorch CUDA / FastAPI / torch.onnx.export / pandas+sklearn) from the Mojo/Python
 * tab bars. Same shape and house style as ds_ml_textbook_02 (see
 * c1_ds_ml_textbook_02.js): <button class="tab-btn" data-tab> over
 * <div class="tab-content" id>, every Mojo pane already carries `active`, the single
 * remaining tab keeps its "Mojo" label.
 *
 * This page's panes are written with the <pre> flush to column 0, which
 * removePaneDiv's `[ \t]*` allowance already handles.
 *
 * The ONNX section needs more care than the other three: its removed pane was the
 * *export* half of a two-toolchain workflow, not a Python tutorial. Rather than
 * inventing a `Python["torch"]...` interop block (which the compliance report does
 * not bless and whose nested-attribute form is not a documented 1.1 API), the export
 * step is described in prose and the section points at the approved interop idiom
 * `from std.python import Python` / `Python.import_module(...)`.
 *
 * Vocabulary: .kw .fn .str .num .cmt .op .type .var  ->  MAPS.cmt
 * Every surviving <pre> is hand-authored spans, so nothing is re-highlighted here.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_ml_textbook_08_advanced.html";
const page = loadPage(P);
let h = page.text;

/* [python pane id, mojo pane id that must already be the active one] */
const PANES = [
  ["ch8-python-gpu", "ch8-mojo-gpu"],       // 1. GPU acceleration
  ["ch8-python-deploy", "ch8-mojo-deploy"], // 2. deployment
  ["ch8-python-onnx", "ch8-mojo-onnx"],     // 3. ONNX / PyTorch interop
  ["ch8-python-pipe", "ch8-mojo-pipe"],     // 4. production pipelines
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

/* 1. GPU - the removed pane was torch device tensors plus torch.utils.cpp_extension. */
h = replaceOnce(
  h,
  `<p>Mojos GPU story is different from PyTorch: the kernel is written in the same language as your host code, sharing types and data structures. No language boundary between CPU and GPU code.</p>`,
  `<p>Mojos GPU story is different from PyTorch: the kernel is written in the same language as your host code, sharing types and data structures. No language boundary between CPU and GPU code.</p>
    <p>PyTorch draws that boundary twice. An element-wise add is easy — <code class="inline">A = torch.randn(N, device="cuda")</code> and <code class="inline">C = A + B</code>, because the framework dispatches the whole tensor expression to a kernel it already ships. A <em>custom</em> kernel is where the boundary bites: <code class="inline">torch.utils.cpp_extension.load</code> compiles <code class="inline">kernel.cu</code> at runtime and hands you back an opaque callable, so the kernel is C++/CUDA, it cannot see your model's types, and its buffers are raw pointers with no shape or dtype attached. The Mojo pane above has neither problem — <code class="inline">add_kernel</code> takes the same <code class="inline">DeviceBuffer</code> type the host code holds, and the launch is one <code class="inline">ctx.enqueue_function[add_kernel](...)</code> with <code class="inline">grid_dim</code> and <code class="inline">block_dim</code> as arguments rather than a build step.</p>`
);

/* 2. deployment - the removed pane was the FastAPI + uvicorn server. */
h = replaceOnce(
  h,
  `<p>Mojos binary deployment means no Python version conflicts, no <code class="inline">pip install</code> failures, and no <code class="inline">__pycache__</code> directories. The compiled binary is self-contained and deterministic.</p>`,
  `<p>Mojos binary deployment means no Python version conflicts, no <code class="inline">pip install</code> failures, and no <code class="inline">__pycache__</code> directories. The compiled binary is self-contained and deterministic.</p>
      <p>The shape of the serving code is the other half of the story. The FastAPI version is a framework you install, decorate, and hand to an ASGI server: <code class="inline">@app.post("/predict")</code>, a <code class="inline">torch.no_grad()</code> block, <code class="inline">pred.tolist()</code> to make the result JSON-shaped, and <code class="inline">uvicorn.run(app, host="0.0.0.0", port=8080)</code> to keep it alive. The Mojo <code class="inline">struct ModelServer</code> replaces all of that with a <code class="inline">handle</code> method that takes a <code class="inline">Request</code> and returns a <code class="inline">Response</code>, plus one <code class="inline">serve(server.handle, port=8080)</code> call. The prediction never leaves a tensor on its way out, and the thing you ship is the executable from <code class="inline">mojo build -o model_server model.mojo</code> — not a virtualenv.</p>`
);

/* 3. ONNX interop - the removed pane was the PyTorch-side export. */
h = replaceOnce(
  h,
  `<p>The most common migration path is: train in PyTorch, export to ONNX, load in Mojo for inference. Mojo's ONNX runtime can execute pre-trained models with full performance.</p>`,
  `<p>The most common migration path is: train in PyTorch, export to ONNX, load in Mojo for inference. Mojo's ONNX runtime can execute pre-trained models with full performance.</p>
    <p>Export is a one-time, offline step and it happens on the PyTorch side — it is the half of the workflow that is not Mojo, and the pane below is the half that is. The export call is <code class="inline">torch.onnx.export(model, dummy, "resnet50.onnx", ...)</code>, where <code class="inline">dummy</code> is a correctly shaped <code class="inline">torch.randn(1, 3, 224, 224)</code> input and <code class="inline">dynamic_axes={"input": {0: "batch"}}</code> is what keeps the batch dimension free afterwards; name the input and output tensors with <code class="inline">input_names</code> and <code class="inline">output_names</code> so the graph is readable at load time. Once the file exists, everything from that point on is the Mojo pane.</p>

    <div class="info-box">
      <strong>💡 Coming from Python:</strong>
      <p>When the dependency is a library you cannot export — a preprocessor, a tokenizer, a metric that only exists as a Python package — reach for the interop layer instead of porting it. <code class="inline">from std.python import Python</code> followed by <code class="inline">var np = Python.import_module("numpy")</code> hands you a live handle on the installed module, and the call goes through to the real implementation. The result is a Mojo program that is genuinely mixed: your own code compiled, one library borrowed. Use ONNX for anything that exports cleanly — it is the faster path, because the graph runs natively — and interop for the leftovers.</p>
    </div>`
);

/* 4. pipelines - the removed pane was pandas + sklearn Pipeline + torch.split. */
h = replaceOnce(
  h,
  `<p>Mojo's pipeline APIs are newer than the rest of the standard library. In practice, you might still need to build your own pipeline abstractions using Mojo's struct system. The key advantage is that every stage runs at compiled speed — no Python interpreter overhead between stages.</p>`,
  `<p>Mojo's pipeline APIs are newer than the rest of the standard library. In practice, you might still need to build your own pipeline abstractions using Mojo's struct system. The key advantage is that every stage runs at compiled speed — no Python interpreter overhead between stages.</p>
      <p>Compare what the stage list costs in the pandas version: <code class="inline">pd.read_csv</code> builds a DataFrame, <code class="inline">StandardScaler().fit_transform(df.values)</code> converts it back out to an array, <code class="inline">torch.tensor(X).float()</code> copies it a third time, and <code class="inline">torch.split(..., 64)</code> hands back a tuple of views that a list comprehension walks before <code class="inline">torch.cat</code> reassembles the result. Four full traversals of the data and at least three copies, all of them ordinary data-movement work. The Mojo pane names the same four stages — read, preprocess, batch, predict — and hands each one a function, so there is nothing to copy between them and nothing to concatenate afterwards.</p>`
);

/* no Python control may survive */
if (/data-tab="[^"]*-py/.test(h)) throw new Error("python tab button survived");
if (/id="ch8-python-/.test(h)) throw new Error("python pane survived");

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
