/* Migrate ds_advanced_09_autodiff.html - drop the three Python panes.
 *
 * `python` (torch), `python3` (numpy gradient) and `python4` (numpy losses) each
 * sit beside an already-active Mojo tab, so the `active` class does not move.
 *
 * NOTE: `mojo4` is a bare <pre> with no <code> and no token spans. It is
 * highlighted at runtime by the page's own highlighter (see the `pres` loop at
 * the bottom of this file: it re-highlights any childless <pre> matching the
 * Mojo keyword set), which is why hl_audit reports zero flat blocks. Leave it
 * exactly as-is - rewriting it into static spans would be redundant, and
 * hl_audit reads the rendered DOM, so it is not at risk from the removals.
 */
import { loadPage, savePage, removeTab, removePre, counts } from "../lib/edit.js";

const P = "public/data_science/ds_advanced_09_autodiff.html";
const page = loadPage(P);
let h = page.text;

const before = counts(h);
const presBefore = (h.match(/<pre[ >]/g) || []).length;
const tabsBefore = (h.match(/class="tab[ "]/g) || []).length;

for (const id of ["python", "python3", "python4"]) {
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
