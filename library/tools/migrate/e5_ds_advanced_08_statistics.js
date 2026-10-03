/* Migrate ds_advanced_08_statistics.html - drop the three Python panes.
 *
 * `python` (numpy), `python2` (numpy MLE) and `python3` (scipy) each sit beside
 * an already-active Mojo tab, so nothing has to move the `active` class. The
 * prose that contrasts them ("Most Python users reach for SciPy...") stays.
 */
import { loadPage, savePage, removeTab, removePre, counts } from "../lib/edit.js";

const P = "public/data_science/ds_advanced_08_statistics.html";
const page = loadPage(P);
let h = page.text;

const before = counts(h);
const presBefore = (h.match(/<pre[ >]/g) || []).length;
const tabsBefore = (h.match(/class="tab[ "]/g) || []).length;

for (const id of ["python", "python2", "python3"]) {
  h = removeTab(h, id);
  h = removePre(h, id);
}

const after = counts(h);
savePage(page, h, P);

console.log(`pres  ${presBefore} -> ${(h.match(/<pre[ >]/g) || []).length}  (removed 3)`);
console.log(`tabs  ${tabsBefore} -> ${(h.match(/class="tab[ "]/g) || []).length}`);
console.log(`div   ${before.div} -> ${after.div}  ${after.div[0] === after.div[1] ? "balanced" : "UNBALANCED"}`);
console.log(`pre   ${before.pre} -> ${after.pre}  ${after.pre[0] === after.pre[1] ? "balanced" : "UNBALANCED"}`);
console.log(`span  ${before.span} -> ${after.span}`);
console.log(`eol   ${JSON.stringify(page.eol)}  bom=${page.bom}`);
