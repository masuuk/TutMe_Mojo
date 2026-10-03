/* Migrate ds_advanced_12_inference.html - drop the three Python panes.
 *
 * The page reuses the id `python` for all three tab/panes (TorchScript,
 * ONNX Runtime, torch.onnx export), so the first-occurrence-only helpers have to
 * be driven in a loop. All three are genuine Python and all three sit beside an
 * already-active Mojo tab, so no `active` class moves.
 *
 * Note `python3`'s ONNX Runtime pane only scores "unknown" to the census (a
 * f-string-free numeric-heavy body offsets the import), but it is real Python
 * and a leftover data-target="python" control fails verify_page either way.
 */
import { loadPage, savePage, removeTab, removePre, counts } from "../lib/edit.js";

const P = "public/data_science/ds_advanced_12_inference.html";
const page = loadPage(P);
let h = page.text;

const before = counts(h);
const presBefore = (h.match(/<pre[ >]/g) || []).length;
const tabsBefore = (h.match(/class="tab[ "]/g) || []).length;

const TAB = /<div\b[^>]*\bdata-(?:target|tab)="python"/;
const PRE = /<pre\b[^>]*\bid="python"/;
if (!TAB.test(h) || !PRE.test(h)) throw new Error("expected python tab+pre pairs");

let tabsRemoved = 0, presRemoved = 0;
while (TAB.test(h)) { h = removeTab(h, "python"); tabsRemoved++; }
while (PRE.test(h)) { h = removePre(h, "python"); presRemoved++; }
if (tabsRemoved !== 3 || presRemoved !== 3) {
  throw new Error(`expected 3 removals, got tabs=${tabsRemoved} pres=${presRemoved}`);
}

const after = counts(h);
savePage(page, h, P);

console.log(`pres  ${presBefore} -> ${(h.match(/<pre[ >]/g) || []).length}  (removed ${presRemoved})`);
console.log(`tabs  ${tabsBefore} -> ${(h.match(/class="tab[ "]/g) || []).length}  (removed ${tabsRemoved})`);
console.log(`div   ${before.div} -> ${after.div}  ${after.div[0] === after.div[1] ? "balanced" : "UNBALANCED"}`);
console.log(`pre   ${before.pre} -> ${after.pre}  ${after.pre[0] === after.pre[1] ? "balanced" : "UNBALANCED"}`);
console.log(`span  ${before.span} -> ${after.span}`);
console.log(`eol   ${JSON.stringify(page.eol)}  bom=${page.bom}`);
