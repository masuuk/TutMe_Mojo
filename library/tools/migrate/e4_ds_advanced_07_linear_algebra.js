/* Migrate ds_advanced_07_linear_algebra.html - drop the two NumPy panes.
 *
 * `python` (numpy.matmul) and `python3` (numpy.linalg.eigh) both sit beside an
 * already-active Mojo tab, so the `active` class does not move. The prose
 * around them ("Numpy provides ... Mojo calls BLAS directly") is the actual
 * comparison and stays.
 */
import { loadPage, savePage, removeTab, removePre, counts } from "../lib/edit.js";

const P = "public/data_science/ds_advanced_07_linear_algebra.html";
const page = loadPage(P);
let h = page.text;

const before = counts(h);
const presBefore = (h.match(/<pre[ >]/g) || []).length;
const tabsBefore = (h.match(/class="tab[ "]/g) || []).length;

for (const id of ["python", "python3"]) {
  h = removeTab(h, id);
  h = removePre(h, id);
}

const after = counts(h);
savePage(page, h, P);

console.log(`pres  ${presBefore} -> ${(h.match(/<pre[ >]/g) || []).length}  (removed 2)`);
console.log(`tabs  ${tabsBefore} -> ${(h.match(/class="tab[ "]/g) || []).length}`);
console.log(`div   ${before.div} -> ${after.div}  ${after.div[0] === after.div[1] ? "balanced" : "UNBALANCED"}`);
console.log(`pre   ${before.pre} -> ${after.pre}  ${after.pre[0] === after.pre[1] ? "balanced" : "UNBALANCED"}`);
console.log(`span  ${before.span} -> ${after.span}`);
console.log(`eol   ${JSON.stringify(page.eol)}  bom=${page.bom}`);
