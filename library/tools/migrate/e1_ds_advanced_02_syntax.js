/* Migrate ds_advanced_02_syntax.html - drop the three Python panes.
 *
 * All three are `class="tab"` (inactive) beside an active Mojo tab, so nothing has
 * to move the `active` class. Census only flags python-struct, but verify_page
 * rejects any leftover data-target="python*" control, so all three go.
 * No prose promised a Python block: the surrounding text compares constructs in
 * running prose ("Unlike Python classes, ..."), which survives the removal.
 */
import { loadPage, savePage, removeTab, removePre, counts } from "../lib/edit.js";

const P = "public/data_science/ds_advanced_02_syntax.html";
const page = loadPage(P);
let h = page.text;

const before = counts(h);
const presBefore = (h.match(/<pre[ >]/g) || []).length;
const tabsBefore = (h.match(/class="tab[ "]/g) || []).length;
const panes = ["python-fndef", "python-struct", "python-control"];

for (const id of panes) {
  h = removeTab(h, id);
  h = removePre(h, id);
}

const after = counts(h);
savePage(page, h, P);

console.log(`pres  ${presBefore} -> ${(h.match(/<pre[ >]/g) || []).length}  (removed ${panes.length})`);
console.log(`tabs  ${tabsBefore} -> ${(h.match(/class="tab[ "]/g) || []).length}`);
console.log(`div   ${before.div} -> ${after.div}  ${after.div[0] === after.div[1] ? "balanced" : "UNBALANCED"}`);
console.log(`code  ${before.pre} -> ${after.pre}  ${after.pre[0] === after.pre[1] ? "balanced" : "UNBALANCED"}`);
console.log(`span  ${before.span} -> ${after.span}`);
console.log(`eol   ${JSON.stringify(page.eol)}  bom=${page.bom}`);
