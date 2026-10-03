/* Migrate ds_ml_textbook_02_getting_started.html : drop the 4 labelled Python panes
 * from the Mojo/Python tab bars.
 *
 * Shape: <button class="tab-btn" data-tab="..."> over <div class="tab-content" id="...">,
 * so edit.js's div-shaped removeTab/pane helpers do not apply verbatim (same as p9).
 * House style, taken from the already-migrated chapters of this same textbook
 * (ds_ml_textbook_00_cover): keep the tab bar with its single "Mojo" control, keep
 * `active` where it already is, and fold the removed Python into prose rather than
 * leaving a dangling "here is the Python" promise.
 *
 * Vocabulary: .kw .fn .str .num .cmt .op .type .var  ->  MAPS.cmt
 * Every surviving <pre> is hand-authored spans, so nothing is re-highlighted here.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_ml_textbook_02_getting_started.html";
const page = loadPage(P);
let h = page.text;

/* [python pane id, mojo pane id that must already be the active one] */
const PANES = [
  ["ch2-def-vs-fn-py", "ch2-def-vs-fn"],   // 1. def vs fn
  ["ch2-vars-py", "ch2-vars-mojo"],       // 2. variables
  ["ch2-control-py", "ch2-control-mojo"], // 3. control flow
  ["ch2-first-py", "ch2-first-mojo"],     // 4. first program
];

function removeTabBtn(hh, id) {
  const re = new RegExp(`[ \\t]*<button\\b[^>]*\\bdata-tab="${id}"[^>]*>[\\s\\S]*?</button>\\r?\\n?`);
  if (!re.test(hh)) throw new Error(`removeTabBtn: no button for ${id}`);
  return hh.replace(re, "");
}
function removePaneDiv(hh, id) {
  /* No `active` allowed in the open tag: that is the assertion that the Python pane
   * was never the selected one, so no `active` has to be moved afterwards. */
  const re = new RegExp(`[ \\t]*<div class="tab-content" id="${id}">\\r?\\n[ \\t]*<pre>[\\s\\S]*?</pre>\\r?\\n[ \\t]*</div>\\r?\\n?`);
  if (!re.test(hh)) throw new Error(`removePaneDiv: no (inactive) pane ${id}`);
  return hh.replace(re, "");
}

const before = counts(h);
for (const [py, mojo] of PANES) {
  if (countOf(h, `data-tab="${py}"`) !== 1) throw new Error(`unexpected tab count for ${py}`);
  if (!new RegExp(`<div class="tab-content active" id="${mojo}">`).test(h)) {
    throw new Error(`${mojo} is not the active pane - active would have to move`);
  }
  h = removeTabBtn(h, py);
  h = removePaneDiv(h, py);
}

/* ---- editorial: keep the comparisons that the removed panes carried, as prose ---- */

/* 1. def vs fn - the removed pane contrasted f-strings, `str`/`int` hints, and the
 *    absence of any mutability concept on parameters. */
h = replaceOnce(
  h,
  `<p>Notice the <code class="inline">mut</code> keyword (renamed from the pre-1.0 <code class="inline">inout</code>) — this is how Mojo marks a parameter as mutable. By default, function arguments are immutable, which prevents accidental side effects.</p>`,
  `    <p>Notice the <code class="inline">mut</code> keyword (renamed from the pre-1.0 <code class="inline">inout</code>) — this is how Mojo marks a parameter as mutable. By default, function arguments are immutable, which prevents accidental side effects.</p>

    <div class="info-box">
      <strong>💡 Coming from Python:</strong>
      <p>Three spellings change when you port. Type hints are optional in Python but enforced in Mojo, so <code class="inline">def greet(name: str) -&gt; str:</code> becomes <code class="inline">def greet(name: String) -&gt; String:</code> with the <code class="inline">str</code> spellings capitalized. Python's integers are immutable and simply rebound by name, so it has no <code class="inline">mut</code> at all — in Mojo a parameter that is rebound has to be declared <code class="inline">mut</code> or the call is an error. And formatted output moves from an f-string, <code class="inline">f"Hello, {name}"</code>, to a t-string, <code class="inline">t"Hello, {name}"</code>, or to separate <code class="inline">print</code> arguments.</p>
    </div>`
);

/* 2. variables - the removed pane showed Python's advisory hints and the tuple as
 *    "the closest thing to immutable". */
h = replaceOnce(
  h,
  `      <p>Mojo performs <strong>type inference</strong> when you don't specify a type — the compiler deduces the type from the right-hand side. This keeps code concise while maintaining full static typing under the hood.</p>`,
  `      <p>Mojo performs <strong>type inference</strong> when you don't specify a type — the compiler deduces the type from the right-hand side. This keeps code concise while maintaining full static typing under the hood.</p>
      <p>In Python the annotation is purely advisory and the name is just a label on a mutable cell, so <code class="inline">x = 10</code> can be rebound freely. In Mojo the declaration is the contract, and "a variable you never reassign" is the safe default. If you need a genuinely fixed, hashable value in Python, the usual stand-in is a tuple — a tuple cannot be rebound but its contents still can. Mojo has no need for that workaround: the absence of reassignment is already what <code class="inline">var</code> expresses, and <code class="inline">let</code> is gone.</p>`
);

/* 3. control flow - the removed pane was, by the page's own admission, "virtually
 *    identical syntax"; nothing is lost but the explicit statement. */
h = replaceOnce(
  h,
  `    <p>Like Python, Mojo uses indentation — not curly braces — to delimit blocks. Where Python opens a block with a colon and indents, Mojo does exactly the same: there are no <code class="inline">{ }</code> in sight.</p>`,
  `    <p>Like Python, Mojo uses indentation — not curly braces — to delimit blocks. Where Python opens a block with a colon and indents, Mojo does exactly the same: there are no <code class="inline">{ }</code> in sight. The <code class="inline">if</code> / <code class="inline">elif</code> / <code class="inline">else</code> chain and the <code class="inline">for</code> / <code class="inline">in</code> / <code class="inline">range()</code> loop above are the whole story: the syntax a Python reader expects is the syntax Mojo uses, and <code class="inline">while</code> behaves identically too.</p>`
);

/* 4. first program - the removed pane used f-strings throughout and a bare top-level
 *    script; the Mojo pane shows the print-args form. */
h = replaceOnce(
  h,
  `      <p>Notice how the Mojo version uses <code class="inline">def main()</code> — in Mojo, the entry point is a regular function, not a script. Every <code class="inline">.mojo</code> file can contain multiple functions, but <code class="inline">main()</code> is what the compiler targets when you run <code class="inline">mojo file.mojo</code>.</p>`,
  `      <p>Notice how the Mojo version uses <code class="inline">def main()</code> — in Mojo, the entry point is a regular function, not a script. Every <code class="inline">.mojo</code> file can contain multiple functions, but <code class="inline">main()</code> is what the compiler targets when you run <code class="inline">mojo file.mojo</code>. A Python script would instead run top-level statements in order, and its per-row output would be an f-string like <code class="inline">f"{temp}°C → {category}"</code>; the Mojo pane gets the same line by passing the values as separate <code class="inline">print</code> arguments, so no interpolation is needed at all.</p>`
);

/* no Python control may survive */
if (/data-tab="[^"]*-py"/.test(h)) throw new Error("python tab button survived");
if (/id="[^"]*-py"/.test(h)) throw new Error("python pane survived");
/* nothing may promise a Python block that is no longer there */
if (/<h2>Basic Syntax: one keyword, <code class="inline">def<\/code><\/h2>\s*<p>[^<]*Mojo and Python/.test(h)) {
  throw new Error("dangling Mojo-and-Python promise");
}

const after = counts(h);
savePage(page, h, P);

const cy = (s) => (s.match(/\r\n/g) || []).length ? "CRLF" : "LF";
console.log(`py pre  ${PANES.length} -> 0`);
console.log(`pre    ${before.pre[0]} -> ${after.pre[0]}  ${after.pre[0] === after.pre[1] ? "balanced" : "UNBALANCED"}`);
console.log(`div    ${before.div} -> ${after.div}  ${after.div[0] === after.div[1] ? "balanced" : "UNBALANCED"}`);
console.log(`panes  ${before.panes} -> ${after.panes}`);
console.log(`tabBtn ${before.tabBtn} -> ${after.tabBtn}`);
console.log(`span   ${before.span} -> ${after.span}`);
console.log(`eol    ${JSON.stringify(page.eol)} (${cy(h)})  bom=${page.bom}`);
