/* Migrate ds_textbook_07_pipelines.html : drop the 4 Python tabs and the 4 Python panes
 * they control (load.py / stream.py / clean.py / batch.py).
 *
 * Same third shape as ds_textbook_02..05 / 14 (p10): no data-target, no ids -
 *   <div class="tab" data-lang="python" data-group="load1"><span class="sw"></span>load.py</div>
 *   <div class="pane" data-lang="python"><pre>...</pre></div>
 * Note the .py tab filename repeats the .mojo one (load.mojo / load.py), so each tab is
 * located by data-group *and* filename. The Mojo tab and pane already hold `active` in all
 * four groups, so nothing has to move, and each tab bar keeps its single `*.mojo` tab.
 *
 * Side effect worth knowing: the two `class="tok-cast"` spans on this page both sit inside
 * Python panes, and `tok-cast` is not defined in this page's stylesheet, so they go away
 * with the removal. No undefined token class is left behind.
 *
 * Vocabulary: .tok-kw .tok-str .tok-com .tok-fn .tok-num .tok-ty  ->  MAPS.com
 * (every surviving <pre> is hand-authored spans, so no build-time highlighting is emitted
 * here and the token classes are untouched.)
 *
 * NOT changed here, flagged instead (all pre-existing, none caused by this migration):
 *   - A2  f-strings in the three surviving Mojo panes (load1 / stream / batch)
 *   - B1  `import sys` and `from collections import ...` missing the `std.` prefix
 *   - D   `load_csv` calls raising I/O without declaring `raises`
 * The audit is static and its recommended next step is to install the toolchain, so none of
 * these can be compiler-confirmed here; a half-fix would be worse than a reported item.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_textbook_07_pipelines.html";
const page = loadPage(P);
let h = page.text;

/* data-group value -> the file name shown on the .py tab that goes away. */
const GROUPS = [
  ["load1", "load.py"],
  ["stream", "stream.py"],
  ["clean", "clean.py"],
  ["batch", "batch.py"],
];

const before = counts(h);
/* 8 controls (4 tabs + 4 panes) plus the one `.tab[data-lang="python"] .sw` CSS rule. */
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
/* 1. load1 - the one-liner being replaced is the point; the PyObject cost is already
 *    covered by the "Why Mojo is faster" paragraph and the memory-math callout below. */
h = replaceOnce(
  h,
  `enabling SIMD-accelerated operations downstream.</p>`,
  `enabling SIMD-accelerated operations downstream. The whole of the <code class="inline">pd.read_csv(path)</code> one-liner is what those lines buy: the same table, without a <code class="inline">PyObject</code> per cell.</p>`
);
/* 2. stream - the removed pane was the chunksize= comparison. */
h = replaceOnce(
  h,
  `\n\n    <p>The Mojo streaming approach gives you control over memory usage at the cost of writing a loop.`,
  `\n\n    <p class="cap">The pandas route to the same shape is <code class="inline">pd.read_csv(path, chunksize=chunk_size)</code> iterated in a <code class="inline">for</code> loop — identical control flow, except every chunk is still a DataFrame of Python objects rather than a flat <code class="inline">List</code>[Float64].</p>\n\n    <p>The Mojo streaming approach gives you control over memory usage at the cost of writing a loop.`
);
/* 3. clean - the removed pane was the fillna / z-score / clip(lower=, upper=) comparison. */
h = replaceOnce(
  h,
  `<span class="tok-com"># cleaned == [1.0, 2.0, 3.0, 3.0, 4.0, 5.0]</span></pre></div>\n      </div>\n    </div>\n\n    <div class="callout">`,
  `<span class="tok-com"># cleaned == [1.0, 2.0, 3.0, 3.0, 4.0, 5.0]</span></pre></div>\n      </div>\n    </div>\n\n    <p class="cap">pandas spells the same three steps as chained column expressions — <code class="inline">fillna(df['temperature'].mean())</code>, a <code class="inline">(x - mean) / std</code> assignment, and <code class="inline">.clip(lower=mean - 3*std, upper=mean + 3*std)</code> — each one vectorised in C, each one building a new object per cell.</p>\n\n    <div class="callout">`
);
/* 4. batch - the removed pane was the torch DataLoader / TensorDataset comparison. */
h = replaceOnce(
  h,
  `<span class="tok-str">f"Batch: {bx}, Labels: {by}"</span>)</pre></div>\n      </div>\n    </div>\n\n    <div class="callout">`,
  `<span class="tok-str">f"Batch: {bx}, Labels: {by}"</span>)</pre></div>\n      </div>\n    </div>\n\n    <p class="cap">PyTorch's version of the same walk is <code class="inline">TensorDataset(X, y)</code> handed to a <code class="inline">DataLoader(dataset, batch_size=32, shuffle=True)</code>, which yields exactly these <code class="inline">(batch_x, batch_y)</code> pairs. Convenient, but bound to PyTorch's memory model — the batches cannot reach a Mojo kernel without a copy first.</p>\n\n    <div class="callout">`
);
/* 4b. that callout promised "the same struct works in Python"; point it at the shape
 *     instead, now that there is no Python listing to point at. */
h = replaceOnce(
  h,
  `The <code class="inline">BatchIterator</code> pattern is language-agnostic — the same struct works in Python and Mojo. What changes is the performance:`,
  `The <code class="inline">BatchIterator</code> pattern is language-agnostic — the same struct shape is what a Python class would hold too, which is why <code class="inline">DataLoader</code> looks so familiar. What changes is the performance:`
);

/* ---- dead CSS: the only consumer of --py-blue / --py-yellow was the .py tab swatch ---- */
h = replaceOnce(h, `  --py-blue:#4b8bbe; --py-yellow:#ffd43b;\n`, ``);
h = replaceOnce(h, `.tab[data-lang="python"] .sw{background:var(--py-blue);}\n`, ``);

/* no Python control may survive */
if (/data-lang="python"/.test(h)) throw new Error("data-lang=python survived");
if (/--py-/.test(h)) throw new Error("dead --py-* CSS survived");
if (countOf(h, '<div class="pane active" data-lang="mojo">') !== 4) throw new Error("lost a mojo pane");
if (countOf(h, "tok-cast") !== 0) throw new Error("undefined .tok-cast span survived");
/* the removed panes were the page's only pandas / torch / numpy code */
for (const gone of [`pandas <span class="tok-kw">as</span> pd`, `torch.utils.data`, `numpy <span class="tok-kw">as</span> np`]) {
  if (countOf(h, gone) !== 0) throw new Error(`python-only code survived: ${gone}`);
}
/* each removed pane's API has to be named in prose instead */
for (const kept of [`read_csv`, `chunksize`, `clip(lower=`, `DataLoader`]) {
  if (countOf(h, kept) < 1) throw new Error(`comparison lost from prose: ${kept}`);
}

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
