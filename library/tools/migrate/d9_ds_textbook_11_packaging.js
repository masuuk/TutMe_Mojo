/* Migrate ds_textbook_11_packaging.html : drop the 5 Python tabs and the 5 Python panes they
 * control. This is the biggest page in the batch - 5 groups, 5 tabs, 5 panes, 1 CSS rule.
 *
 * Same third shape as ds_textbook_02..05 / 07 / 08 / 09 / 10 / 14 (p10): no data-target, no ids -
 *   <div class="tab" data-lang="python" data-group="projtoml"><span class="sw"></span>pyproject.toml (Python)</div>
 *   <div class="pane" data-lang="python"><pre>...</pre></div>
 * The Mojo tab and pane already hold `active` in all five groups, so nothing has to move, and
 * each tab bar keeps its single surviving tab.
 *
 * Two of the five tabs are not Python *source* but Python-ecosystem config:
 *   projtoml -> pyproject.toml (compared against mojoproject.toml)
 *   cicd     -> a Python CI workflow (compared against the Mojo one)
 * They are still `data-lang="python"` and in scope, but they carry no token classes at all, so
 * each needs its lesson restated in prose rather than a code-token cleanup.
 *
 * This page has no `class="tok-cast"` spans, so nothing outside the panes needs tidying.
 *
 * Vocabulary: .tok-kw .tok-str .tok-com .tok-fn .tok-num .tok-ty  ->  MAPS.com
 * (every surviving <pre> is hand-authored spans, so no build-time highlighting is emitted
 * here and the token classes are untouched.)
 *
 * NOT changed here, flagged instead:
 *   - A2  f-strings in the surviving Mojo bench block: f"Median: {stats.median:.4f}s",
 *        f"Mean:   ...", f"Stddev: ...". (Two more were in the removed timeit pane.)
 *        A2's prescribed alternatives (t-strings, `print(a, b)`) need a decision the static
 *        audit cannot make on its own.
 *   - B1  `from math import sqrt, sin, cos` in the surviving deps block, missing the `std.`
 *        prefix. Its Python twin in the removed pane had the same defect, so nothing regressed.
 * The report's recommended next step is to install the toolchain and compile block by block.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_textbook_11_packaging.html";
const page = loadPage(P);
let h = page.text;

/* data-group value -> the exact text shown on the .py tab that goes away. */
const GROUPS = [
  ["projtoml", "pyproject.toml (Python)"],
  ["deps", "importing packages.py"],
  ["test", "test_data_loader.py"],
  ["bench", "bench_transform.py"],
  ["cicd", "Python CI (for comparison)"],
];

const before = counts(h);
/* 10 controls (5 tabs + 5 panes) plus the one `.tab[data-lang="python"] .sw` CSS rule. */
if (countOf(h, 'data-lang="python"') !== GROUPS.length * 2 + 1) throw new Error("unexpected data-lang=python count");

function removePyTab(hh, group, label) {
  const re = new RegExp(`[ \\t]*<div class="tab" data-lang="python" data-group="${group}"><span class="sw"></span>${label.replace(/[.()]/g, "\\$&")}</div>\\r?\\n?`);
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

for (const [group, label] of GROUPS) {
  if (!new RegExp(`<div class="tab active" data-lang="mojo" data-group="${group}">`).test(h)) {
    throw new Error(`mojo tab for ${group} is not the active one`);
  }
  h = removePyTab(h, group, label);
  h = removePyPane(h, group);
}

/* ---- editorial: every removed pane's lesson becomes prose ---- */
/* 1. projtoml - the removed pane was the pyproject.toml equivalent. The paragraphs after this
 *    section already cover the src/ layout and the reproducibility argument. */
h = replaceOnce(
  h,
  `\n\n    <p>Unlike Python, where source files are scattered into packages`,
  `\n\n    <p class="cap">The <code class="inline">pyproject.toml</code> equivalent is the same <code class="inline">[project]</code> table with three different keys: <code class="inline">requires-python = "&gt;=3.11"</code> instead of a MAX version, a <code class="inline">[project.dependencies]</code> table instead of <code class="inline">[dependencies]</code>, and a <code class="inline">[project.scripts]</code> entry pointing at <code class="inline">src.main:main</code> — so Python has to name both the module and the function to produce one runnable command.</p>\n\n    <p>Unlike Python, where source files are scattered into packages`
);
/* 2. deps - the removed pane was the same three imports in Python spelling. This demo closes
 *    its section, so the cap goes inside, just before </section>. */
h = replaceOnce(
  h,
  `    <span class="tok-kw">return</span> session</pre></div>\n      </div>\n    </div>\n  </section>`,
  `    <span class="tok-kw">return</span> session</pre></div>\n      </div>\n    </div>\n\n    <p class="cap">The same three imports in Python read <code class="inline">from max.engine import InferenceSession</code>, <code class="inline">from math import sqrt, sin, cos</code>, and <code class="inline">from collections import defaultdict</code> — with <code class="inline">str</code> where this page says <code class="inline">String</code>, and <code class="inline">defaultdict</code> where this page says <code class="inline">Dict</code>. Same lookup, different vocabulary.</p>\n  </section>`
);
/* 3. test - the removed pane was the pytest version of the same three test functions. */
h = replaceOnce(
  h,
  `\n\n    <p>Running your tests is a single command:</p>`,
  `\n\n    <p class="cap">The pytest spelling of those same three tests needs <code class="inline">import pytest</code>, wraps the raising case in <code class="inline">with pytest.raises(ValueError):</code>, and replaces the hand-written case list with <code class="inline">@pytest.mark.parametrize("input_val,expected", [...])</code> — a decorator that generates one test function per row, and that pytest has to reflect over at collection time.</p>\n\n    <p>Running your tests is a single command:</p>`
);
/* 4. bench - the removed pane was the timeit + numpy version. The paragraph after it already
 *    makes the "knows about SIMD width / GC" argument. */
h = replaceOnce(
  h,
  `\n\n    <p>The Mojo benchmarking module is integrated with the compiler`,
  `\n\n    <p class="cap">The <code class="inline">numpy</code> version of <code class="inline">standardize</code> is <code class="inline">np.mean</code> and <code class="inline">np.std</code> in three lines, timed with <code class="inline">timeit.timeit(lambda: standardize(data), number=50)</code> — one wall-clock number, carrying every failure mode the next paragraph names: no warmup, no distribution, and GC time counted as work.</p>\n\n    <p>The Mojo benchmarking module is integrated with the compiler`
);
/* 5. cicd - the removed pane was the Python CI workflow. */
h = replaceOnce(
  h,
  `\n\n    <p>Deployment options for Mojo data pipelines:</p>`,
  `\n\n    <p class="cap">The Python workflow for the same repository needs an <code class="inline">actions/setup-python@v5</code> step, a <code class="inline">pip install -r requirements.txt</code> step, and a build step that produces a <i>wheel</i> rather than an executable — <code class="inline">python -m build</code> — so the <code class="inline">pipeline-binary</code> artifact above has no direct counterpart to upload.</p>\n\n    <p>Deployment options for Mojo data pipelines:</p>`
);

/* ---- dead CSS: the only consumer of --py-blue / --py-yellow was the .py tab swatch ---- */
h = replaceOnce(h, `  --py-blue:#4b8bbe; --py-yellow:#ffd43b;\n`, ``);
h = replaceOnce(h, `.tab[data-lang="python"] .sw{background:var(--py-blue);}\n`, ``);

/* no Python control may survive */
if (/data-lang="python"/.test(h)) throw new Error("data-lang=python survived");
if (/--py-/.test(h)) throw new Error("dead --py-* CSS survived");
if (countOf(h, '<div class="pane active" data-lang="mojo">') !== 5) throw new Error("lost a mojo pane");
/* each of the five removed panes' lessons must survive somewhere in prose */
const LESSONS = [
  `requires-python = "&gt;=3.11"`,
  `from collections import defaultdict`,
  `@pytest.mark.parametrize`,
  `timeit.timeit(lambda: standardize(data), number=50)`,
  `python -m build`,
];
for (const s of LESSONS) if (countOf(h, s) !== 1) throw new Error(`prose lesson missing or duplicated: ${s}`);
/* the page must not now promise a Python listing it no longer has */
if (countOf(h, `MojoTest has a significant advantage over Python testing`) !== 1) throw new Error("testing prose lost");
/* the 5 surviving tab bars must each still have exactly one tab */
if (countOf(h, `<div class="tab active" data-lang="mojo"`) !== 5) throw new Error("lost a mojo tab");

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
