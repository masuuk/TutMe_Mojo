/* Migrate ds_textbook_13_performance.html : drop the 3 Python tabs and the 3 Python panes
 * they control (data_pipeline.py / simd_transform.py / orchestrator.py).
 *
 * Same third shape as ds_textbook_02..05 / 07..12 / 14 (p10): no data-target, no ids -
 *   <div class="tab" data-lang="python" data-group="pipeline"><span class="sw"></span>data_pipeline.py</div>
 *   <div class="pane" data-lang="python"><pre>...</pre></div>
 * The Mojo tab and pane already hold `active` in all three groups, so nothing has to move, and
 * each tab bar keeps its single `*.mojo` tab.
 *
 * This page has no `class="tok-cast"` spans, so nothing outside the panes needs tidying.
 *
 * The group id `mosql` is a typo carried over from an earlier MojoSQL draft and is left exactly
 * as-is: renaming it would be an unrequested change to markup nothing else depends on.
 *
 * Vocabulary: .tok-kw .tok-str .tok-com .tok-fn .tok-num .tok-ty  ->  MAPS.com
 * (every surviving <pre> is hand-authored spans, so no build-time highlighting is emitted
 * here and the token classes are untouched.)
 *
 * NOT changed here, flagged instead:
 *   - A2  f-strings in the two surviving Mojo panes: f"Processed {len(results)} records" and
 *        f"Predictions: {predictions}". A2's prescribed alternatives (t-strings, `print(a, b)`)
 *        need a decision the static audit cannot make on its own.
 *   - B1  `from math import sqrt` in the simd pane, missing the `std.` prefix.
 *   - D1  the pipeline pane calls `read_file(path)` and `json.loads(content)` but neither is
 *        defined or imported in the block, and the `Record(...)` keyword construction is shown
 *        without its argument types.
 * The report's recommended next step is to install the toolchain and compile block by block.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_textbook_13_performance.html";
const page = loadPage(P);
let h = page.text;

/* data-group value -> the file name shown on the .py tab that goes away. */
const GROUPS = [
  ["pipeline", "data_pipeline.py"],
  ["mosql", "simd_transform.py"],
  ["hybrid", "orchestrator.py"],
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
/* 1. pipeline - the removed pane was the json + list-comprehension version. The paragraph
 *    after the demo already makes the owned-types / C-libraries argument. */
h = replaceOnce(
  h,
  `\n\n    <p>The Mojo version compiles to a fast native binary`,
  `\n\n    <p class="cap">The Python version of that pipeline is <code class="inline">import json</code>, a <code class="inline">with open(path) as f: data = json.load(f)</code> block, and a one-line list comprehension — <code class="inline">return [r for r in data if r["value"] &gt; 0.0]</code> — with no declared record type at all, so every element stays a dict of boxed objects and every iteration allocates.</p>\n\n    <p>The Mojo version compiles to a fast native binary`
);
/* 2. mosql - the removed pane was the three-line np.mean / np.std version. The paragraph
 *    after the demo already contrasts vectorize with "calling C under the hood". */
h = replaceOnce(
  h,
  `\n\n    <p>The contrast is stark: Mojo's`,
  `\n\n    <p class="cap">The <code class="inline">numpy</code> version of that same normalization is three lines: <code class="inline">mean = np.mean(data)</code>, <code class="inline">std = np.std(data)</code>, <code class="inline">return (data - mean) / std</code>. Each one is a C loop, so it is fast — but the caller is handing NumPy a fresh buffer and getting a new one back, and it cannot tell the compiler anything about the width.</p>\n\n    <p>The contrast is stark: Mojo's`
);
/* 3. hybrid - the removed pane was the Python orchestrator importing the Mojo worker. */
h = replaceOnce(
  h,
  `\n\n    <p>This architecture gives you the best of both worlds`,
  `\n\n    <p class="cap">The Python side of that split is three lines: <code class="inline">import mojo</code>, <code class="inline">from mojo import InferenceWorker</code>, then <code class="inline">worker = InferenceWorker("model.pt")</code> and <code class="inline">worker.predict(features)</code> — the same two methods the <code class="inline">InferenceWorker</code> struct declares on the Mojo side, called across the boundary.</p>\n\n    <p>This architecture gives you the best of both worlds`
);

/* ---- dead CSS: the only consumer of --py-blue / --py-yellow was the .py tab swatch ---- */
h = replaceOnce(h, `  --py-blue:#4b8bbe; --py-yellow:#ffd43b;\n`, ``);
h = replaceOnce(h, `.tab[data-lang="python"] .sw{background:var(--py-blue);}\n`, ``);

/* no Python control may survive */
if (/data-lang="python"/.test(h)) throw new Error("data-lang=python survived");
if (/--py-/.test(h)) throw new Error("dead --py-* CSS survived");
if (countOf(h, '<div class="pane active" data-lang="mojo">') !== 3) throw new Error("lost a mojo pane");
if (countOf(h, `<div class="tab active" data-lang="mojo"`) !== 3) throw new Error("lost a mojo tab");
if (countOf(h, `<div class="tab" data-lang="mojo"`)) throw new Error("an inactive mojo tab survived");
if (countOf(h, `<div class="pane" data-lang="mojo">`)) throw new Error("an inactive mojo pane survived");
/* the removed panes were the page's only json / np.mean / mojo-import code */
if (countOf(h, `<span class="tok-kw">import</span> json`) !== 0) throw new Error("bare json import survived");
if (countOf(h, `numpy <span class="tok-kw">as</span> np`) !== 0) throw new Error("bare numpy import survived");
if (countOf(h, `from mojo import InferenceWorker`) !== 1) throw new Error("mojo-import lesson lost from prose");
/* each of the three removed panes' lessons must survive somewhere in prose */
const LESSONS = [
  `json.load(f)`,
  `np.std(data)`,
  `worker.predict(features)`,
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
