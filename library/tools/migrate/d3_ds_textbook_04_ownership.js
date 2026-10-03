/* Migrate ds_textbook_04_ownership.html : drop the 1 Python tab and the 1 Python pane it
 * controls (aliasing.py). The `args` and `excl` groups on this page are already Mojo-only
 * and are left untouched.
 *
 * Same third shape as ds_textbook_02 / 03 / 14 (p10): no data-target, no ids -
 *   <div class="tab" data-lang="python" data-group="ownership"><span class="sw"></span>aliasing.py</div>
 *   <div class="pane" data-lang="python"><pre>...</pre></div>
 * The Mojo tab and pane already hold `active`, so nothing has to move, and the tab bar
 * keeps its single `ownership.mojo` filename tab.
 *
 * The `var b = a  # COMPILE ERROR` line in the surviving Mojo pane is left alone on
 * purpose: like ds_textbook_04 B8 in the compliance report (section E), it is a
 * deliberate compile-error illustration, not a defect.
 *
 * Vocabulary: .tok-kw .tok-str .tok-com .tok-fn .tok-num .tok-ty  ->  MAPS.com
 * (every surviving <pre> is hand-authored spans, so no build-time highlighting is emitted
 * here and the token classes are untouched.)
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_textbook_04_ownership.html";
const page = loadPage(P);
let h = page.text;

/* data-group value -> the file name shown on the .py tab that goes away. */
const GROUPS = [["ownership", "aliasing.py"]];

const before = counts(h);
/* 2 controls (1 tab + 1 pane) plus the one `.tab[data-lang="python"] .sw` CSS rule. */
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

/* ---- editorial: the removed pane's lesson becomes prose ----
 * The aliasing surprise itself is already stated in the section's opening paragraph; what
 * only lived in the pane was how you get the copy behaviour by hand, and where the GC's
 * costs come from. */
h = replaceOnce(
  h,
  `Python's reference semantics are simpler but sacrifice control.</p>`,
  `Python's reference semantics are simpler but sacrifice control: the two names for one list above cost you nothing, but the <code class="inline">d = d.copy()</code> / <code class="inline">copy.deepcopy(a)</code> calls that buy Mojo's behaviour back are explicit in Python, and freeing is the collector's problem — which is also where the hidden copies, the race conditions and the unpredictable pauses come from.</p>`
);

/* ---- dead CSS: the only consumer of --py-blue / --py-yellow was the .py tab swatch ---- */
h = replaceOnce(h, `  --py-blue:#4b8bbe; --py-yellow:#ffd43b;\n`, ``);
h = replaceOnce(h, `.tab[data-lang="python"] .sw{background:var(--py-blue);}\n`, ``);

/* no Python control may survive */
if (/data-lang="python"/.test(h)) throw new Error("data-lang=python survived");
if (/--py-/.test(h)) throw new Error("dead --py-* CSS survived");
if (countOf(h, '<div class="pane active" data-lang="mojo">') !== 3) throw new Error("lost a mojo pane");
if (countOf(h, `deepcopy`) !== 1) throw new Error("deepcopy lesson lost from prose");
/* the removed pane was the page's only `import copy` */
if (countOf(h, `<span class="tok-kw">import</span> copy`) !== 0) throw new Error("import copy survived");

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
