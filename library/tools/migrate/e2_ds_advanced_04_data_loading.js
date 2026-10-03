/* Migrate ds_advanced_04_data_loading.html - drop the three Python panes and fix
 * the one Mojo block the census misfiles as Python.
 *
 * 1. python-stream (pandas/csv), python-memmap (numpy/mmap) and
 *    python-formats (struct) all sit beside an already-active Mojo tab, so the
 *    `active` class does not move. All three are genuine Python; the third only
 *    scores "unknown" (f-string inside struct.unpack offsets the imports) but a
 *    leftover data-target="python*" control still fails verify_page.
 *
 * 2. mojo-async is *Mojo*, not Python, but the census scores it -2 because the
 *    first 260 characters it inspects are dominated by
 *    `from collections import Dict` (-5) plus `__init__` (-4). The std. prefix
 *    the compliance report (B1) requires anyway turns that into +5 and the
 *    block scores +9. Applied to mojo-stream and mojo-formats too so the three
 *    FileHandle imports on this page agree.
 */
import { loadPage, savePage, removeTab, removePre, replaceOnce, countOf, counts } from "../lib/edit.js";

const P = "public/data_science/ds_advanced_04_data_loading.html";
const page = loadPage(P);
let h = page.text;

const before = counts(h);
const presBefore = (h.match(/<pre[ >]/g) || []).length;
const tabsBefore = (h.match(/class="tab[ "]/g) || []).length;

/* 1. Python panes. */
for (const id of ["python-stream", "python-memmap", "python-formats"]) {
  h = removeTab(h, id);
  h = removePre(h, id);
}

/* 2. std. prefixes on the FileHandle / Dict imports. */
function replaceAllN(html, find, repl, n) {
  if (countOf(html, find) !== n) throw new Error(`expected ${n} of ${find}, got ${countOf(html, find)}`);
  return html.split(find).join(repl);
}
h = replaceAllN(
  h,
  `<span class="kw">from</span> sys.io <span class="kw">import</span> FileHandle`,
  `<span class="kw">from</span> std.sys.io <span class="kw">import</span> FileHandle`,
  3
);
h = replaceOnce(
  h,
  `<span class="kw">from</span> collections <span class="kw">import</span> Dict`,
  `<span class="kw">from</span> std.collections <span class="kw">import</span> Dict`
);

const after = counts(h);
savePage(page, h, P);

console.log(`pres  ${presBefore} -> ${(h.match(/<pre[ >]/g) || []).length}`);
console.log(`tabs  ${tabsBefore} -> ${(h.match(/class="tab[ "]/g) || []).length}`);
console.log(`div   ${before.div} -> ${after.div}  ${after.div[0] === after.div[1] ? "balanced" : "UNBALANCED"}`);
console.log(`pre   ${before.pre} -> ${after.pre}  ${after.pre[0] === after.pre[1] ? "balanced" : "UNBALANCED"}`);
console.log(`span  ${before.span} -> ${after.span}`);
console.log(`eol   ${JSON.stringify(page.eol)}  bom=${page.bom}`);
