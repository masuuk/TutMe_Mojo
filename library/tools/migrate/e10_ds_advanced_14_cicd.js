/* Migrate ds_advanced_14_cicd.html - drop the one real Python pane and relabel
 * the one pane that was only ever *named* python.
 *
 * The page reuses the id `python` twice:
 *   · line 121/146  "Python (pytest)"        -> genuine Python, REMOVE
 *   · line 319/359  "Python (GitHub Actions)"-> `# .github/workflows/train.yml`,
 *     a YAML CI config. classify() files it as output (no `:`-terminated Python
 *     statements, `#` comment header, `on:`/`jobs:`/`steps:` keys) so the census
 *     never counted it, but it still shipped under a python data-target, which
 *     fails verify_page. Relabel it honestly as GitHub Actions YAML.
 *
 * Order matters: removeTab/removePre are first-occurrence-only, so the pytest
 * pair has to go before the surviving GHA pair can be renamed.
 *
 * The prose never promised a Python block - "Python", "pytest" and "GitHub"
 * appear only inside the two tab labels - so no text edits are needed.
 */
import { loadPage, savePage, removeTab, removePre, replaceOnce, counts } from "../lib/edit.js";

const P = "public/data_science/ds_advanced_14_cicd.html";
const page = loadPage(P);
let h = page.text;

const before = counts(h);
const presBefore = (h.match(/<pre[ >]/g) || []).length;
const tabsBefore = (h.match(/class="tab[ "]/g) || []).length;

/* 1. The genuine Python pane (pytest) comes first in document order. */
h = removeTab(h, "python");
h = removePre(h, "python");

/* 2. Exactly one python-id'd control must survive, and it is the YAML one. */
const leftTabs = (h.match(/data-(?:target|tab)="python"/g) || []).length;
const leftPres = (h.match(/<pre\b[^>]*id="python"/g) || []).length;
if (leftTabs !== 1 || leftPres !== 1) {
  throw new Error(`expected 1 surviving python control, got tabs=${leftTabs} pres=${leftPres}`);
}

/* 3. Relabel the YAML pane and its tab. */
h = replaceOnce(
  h,
  `<div class="tab" data-target="python">Python (GitHub Actions)</div>`,
  `<div class="tab" data-target="gha">GitHub Actions (YAML)</div>`
);
h = replaceOnce(h, `<pre class="code-block" id="python">`, `<pre class="code-block" id="gha">`);

const after = counts(h);
savePage(page, h, P);

console.log(`pres  ${presBefore} -> ${(h.match(/<pre[ >]/g) || []).length}  (removed 1 pytest, relabelled 1 YAML)`);
console.log(`tabs  ${tabsBefore} -> ${(h.match(/class="tab[ "]/g) || []).length}  (removed 1 pytest, relabelled 1 YAML)`);
console.log(`div   ${before.div} -> ${after.div}  ${after.div[0] === after.div[1] ? "balanced" : "UNBALANCED"}`);
console.log(`pre   ${before.pre} -> ${after.pre}  ${after.pre[0] === after.pre[1] ? "balanced" : "UNBALANCED"}`);
console.log(`span  ${before.span} -> ${after.span}`);
console.log(`eol   ${JSON.stringify(page.eol)}  bom=${page.bom}`);
