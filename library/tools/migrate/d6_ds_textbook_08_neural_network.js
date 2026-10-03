/* Migrate ds_textbook_08_neural_network.html : drop the 3 Python tabs and the 3 Python
 * panes they control (network.py / forward.py / backward.py).
 *
 * Same third shape as ds_textbook_02..05 / 07 / 14 (p10): no data-target, no ids -
 *   <div class="tab" data-lang="python" data-group="arch"><span class="sw"></span>network.py</div>
 *   <div class="pane" data-lang="python"><pre>...</pre></div>
 * The Mojo tab and pane already hold `active` in all three groups, so nothing has to move,
 * and each tab bar keeps its single `*.mojo` tab.
 *
 * Side effect worth knowing: the three `class="tok-cast"` spans on this page all sit inside
 * the Python forward pane, and `tok-cast` is not defined in this page's stylesheet, so they
 * go away with the removal. No undefined token class is left behind.
 *
 * Vocabulary: .tok-kw .tok-str .tok-com .tok-fn .tok-num .tok-ty  ->  MAPS.com
 * (every surviving <pre> is hand-authored spans, so no build-time highlighting is emitted
 * here and the token classes are untouched.)
 *
 * NOT changed here, flagged instead (all pre-existing, none caused by this migration):
 *   - A2  f-string in the training-loop block (`f"Epoch {epoch}: loss = {avg_loss:.6f}"`)
 *   - B1  `from math import sqrt, sigmoid` missing the `std.` prefix (two blocks)
 * Both need an API decision the static audit cannot make on its own, and the audit's own
 * recommended next step is to install the toolchain.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_textbook_08_neural_network.html";
const page = loadPage(P);
let h = page.text;

/* data-group value -> the file name shown on the .py tab that goes away. */
const GROUPS = [
  ["arch", "network.py"],
  ["fwd", "forward.py"],
  ["bwd", "backward.py"],
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
/* 1. arch - the removed pane was the 2-D numpy weight-matrix comparison. */
h = replaceOnce(
  h,
  `so that the variance of activations stays constant across layers — critical for training deep networks.</p>`,
  `so that the variance of activations stays constant across layers — critical for training deep networks. In <code class="inline">numpy</code> that constructor is one line, <code class="inline">self.W1 = np.random.randn(n_hidden, n_features) * scale1</code>, and the matrix keeps its own two dimensions. Here the same weights live in a flat <code class="inline">List</code>[Float64] with the shape carried in <code class="inline">n_features</code>, so every access from here on does its own index arithmetic.</p>`
);
/* 2. fwd - the removed pane was the @ / np.maximum / np.exp comparison. The paragraph
 *    below the demo already covers the BLAS-vs-transparency tradeoff. */
h = replaceOnce(
  h,
  `\n\n    <p>The Mojo version stores matrices as flat lists and computes the dot product explicitly.`,
  `\n\n    <p class="cap">The <code class="inline">numpy</code> version of those three lines is <code class="inline">self.z1 = self.W1 @ x + self.b1</code>, <code class="inline">np.maximum(0, self.z1)</code> for the ReLU, and <code class="inline">1 / (1 + np.exp(-self.z2))</code> for the sigmoid — compact and correct, with every element still a Python float on the heap.</p>\n\n    <p>The Mojo version stores matrices as flat lists and computes the dot product explicitly.`
);
/* 3. bwd - the removed pane was the five-line @ / .T / np.sum comparison. The callout
 *    below already covers the dW1 outer-product bug. */
h = replaceOnce(
  h,
  `self.lr * db2[<span class="tok-num">0</span>]</pre></div>\n      </div>\n    </div>\n\n    <div class="callout">`,
  `self.lr * db2[<span class="tok-num">0</span>]</pre></div>\n      </div>\n    </div>\n\n    <p class="cap">The same backward pass in <code class="inline">numpy</code> is five lines of <code class="inline">@</code> and <code class="inline">.T</code>, with <code class="inline">np.sum(..., axis=1, keepdims=True)</code> reducing the bias gradients. The flat-list version is longer for exactly one reason: it has to name the index, which is what makes the <code class="inline">dW1</code> mistake in the callout below possible in the first place.</p>\n\n    <div class="callout">`
);

/* ---- dead CSS: the only consumer of --py-blue / --py-yellow was the .py tab swatch ---- */
h = replaceOnce(h, `  --py-blue:#4b8bbe; --py-yellow:#ffd43b;\n`, ``);
h = replaceOnce(h, `.tab[data-lang="python"] .sw{background:var(--py-blue);}\n`, ``);

/* no Python control may survive */
if (/data-lang="python"/.test(h)) throw new Error("data-lang=python survived");
if (/--py-/.test(h)) throw new Error("dead --py-* CSS survived");
if (countOf(h, '<div class="pane active" data-lang="mojo">') !== 3) throw new Error("lost a mojo pane");
if (countOf(h, "tok-cast") !== 0) throw new Error("undefined .tok-cast span survived");
/* the removed panes were the page's only numpy code */
if (countOf(h, `numpy <span class="tok-kw">as</span> np`) !== 0) throw new Error("bare numpy import survived");
if (countOf(h, `keepdims`) !== 1) throw new Error("np.sum lesson lost from prose");
if (countOf(h, `np.random.randn`) !== 1) throw new Error("He-init comparison lost from prose");

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
