/* Migrate ds_ml_textbook_09_syntax_tour.html : drop the 6 labelled Python panes from
 * the Mojo/Python tab bars. Data-science twin of p7_mojo_09_syntax_tour.js and the
 * same markup shape (button.tab-btn[data-tab] over div.tab-content#id), so the same
 * house style applies: every Mojo tab/pane already holds `active`, nothing has to
 * move, the single remaining tab keeps its "Mojo" label, and each removed pane is
 * replaced by a sentence in the section's existing info-box/callout.
 *
 * Vocabulary: .kw .fn .str .num .cmt .op .type .var  ->  MAPS.cmt
 * (every surviving <pre> is hand-authored spans, so no build-time highlighting is
 * emitted here and the token classes are untouched.)
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_ml_textbook_09_syntax_tour.html";
const page = loadPage(P);
let h = page.text;

const PANES = [
  "ch9-quad-py",       // 1. quadratic equation solver
  "ch9-compound-py",   // 2. compound interest
  "ch9-npv-py",        // 3. net present value
  "ch9-simult-py",     // 4. simultaneous equations
  "ch9-fact-py",       // 5. factorial
  "ch9-fib-py",        // 6. fibonacci
];

const before = counts(h);
const pyBefore = PANES.length;
if (countOf(h, 'data-tab="ch9-quad-py"') !== 1) throw new Error("unexpected tab count");

/* The tab controls here are <button>, and the panes are <div class="tab-content">,
 * so edit.js's div-shaped removeTab cannot be used verbatim. */
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

for (const id of PANES) {
  const mojo = id.replace(/-py$/, "-mojo");
  if (!new RegExp(`<div class="tab-content active" id="${mojo}">`).test(h)) {
    throw new Error(`${mojo} is not the active pane - active would have to move`);
  }
  h = removeTabBtn(h, id);
  h = removePaneDiv(h, id);
}

/* ---- editorial: no dangling promises of a Python block ---- */
h = replaceOnce(
  h,
  "<title>Chapter 9 — Mojo vs Python: A Side-by-Side Syntax Tour · Mojo 1.x Textbook</title>",
  "<title>Chapter 9 — Mojo vs Python: A Syntax Tour · Mojo 1.x Textbook</title>"
);
h = replaceOnce(
  h,
  `<h1>🔀 Mojo vs Python: A <span class="highlight">Side-by-Side</span> Syntax Tour</h1>`,
  `<h1>🔀 Mojo vs Python: A <span class="highlight">Syntax Tour</span></h1>`
);
h = replaceOnce(
  h,
  `<p class="dek">Seven classic problems implemented in Mojo and Python — the fastest way to internalize Mojo's syntax by comparing it against what you already know.</p>`,
  `<p class="dek">Seven classic problems implemented in Mojo 1.x. Each one is a single program, with the Python habit it replaces called out in prose — the fastest way to internalize the syntax if you already write Python.</p>`
);
/* 1. quadratic — the removed pane raised ValueError and called math.sqrt */
h = replaceOnce(
  h,
  `This example shows function signatures, conditionals, and the <code class="inline">math</code> module in Mojo and Python.</p>`,
  `This example shows function signatures, conditionals, and the <code class="inline">math</code> module in a single screen.</p>`
);
h = replaceOnce(
  h,
  `Errors propagate the same way you're used to from Python — no return-type ceremony required.</p>`,
  `Errors propagate the same way you're used to from Python — no return-type ceremony required. Two spellings do change: Python's <code class="inline">ValueError("No real roots")</code> becomes a bare <code class="inline">raise "No real roots"</code>, and the square root is <code class="inline">sqrt(discriminant)</code> from the <code class="inline">math</code> import rather than <code class="inline">math.sqrt(discriminant)</code>.</p>`
);
/* 2. compound interest — the removed pane used an f-string */
h = replaceOnce(
  h,
  `This highlights how each language handles exponentiation, floating-point arithmetic, and formatted output.`,
  `This highlights how Mojo handles exponentiation, floating-point arithmetic, and formatted output.`
);
h = replaceOnce(
  h,
  `the <code class="inline">pow(base, exp)</code> function for explicit exponentiation.</p>`,
  `the <code class="inline">pow(base, exp)</code> function for explicit exponentiation. Formatted output splits the same way: Python's <code class="inline">f"Accumulated: {amount:.2f}"</code> becomes a t-string, <code class="inline">t"Accumulated: {amount:.2f}"</code>.</p>`
);
/* 3. NPV — the removed pane used enumerate() */
h = replaceOnce(
  h,
  `prefer an integer exponent when you can — it's faster and avoids floating-point drift in the discount factor.</p>`,
  `prefer an integer exponent when you can — it's faster and avoids floating-point drift in the discount factor. There is no <code class="inline">enumerate</code> either: the loop walks indices with <code class="inline">range(len(cash_flows))</code> and indexes the list, which is why the exponent is cast with <code class="inline">Float64(t)</code> instead of being used bare.</p>`
);
/* 4. simultaneous equations */
h = replaceOnce(
  h,
  `This example demonstrates <strong>structs</strong>: Mojo's <code class="inline">struct</code> and Python's <code class="inline">dataclass</code>.</p>`,
  `This example demonstrates <strong>structs</strong> — Mojo's <code class="inline">struct</code>, taking over the job Python's <code class="inline">@dataclass</code> does.`
);
/* 5. factorial */
h = replaceOnce(
  h,
  `This highlights loops, recursion, type annotations, and how each language handles base cases.`,
  `This highlights loops, recursion, type annotations, and how Mojo handles the base case.`
);
/* 6. fibonacci — the removed pane printed with join(map(str, ...)) */
h = replaceOnce(
  h,
  `This example reveals differences in mutable state, list construction, and iteration patterns in Mojo and Python.`,
  `This example reveals how mutable state, list construction, and iteration patterns work in Mojo.`
);
h = replaceOnce(
  h,
  `pre-allocate in Mojo with <code class="inline">List[Int64](capacity=n)</code> to avoid repeated reallocations.</p>`,
  `pre-allocate in Mojo with <code class="inline">List[Int64](capacity=n)</code> to avoid repeated reallocations. Python's one-line <code class="inline">" ".join(map(str, fib))</code> has no Mojo equivalent, so the driver loop prints each value in turn.</p>`
);

/* no Python control may survive */
if (/data-tab="[^"]*-py"/.test(h)) throw new Error("python tab button survived");
if (/id="[^"]*-py"/.test(h)) throw new Error("python pane survived");
if (/Side-by-Side/.test(h)) throw new Error("dangling Side-by-Side promise");

const after = counts(h);
savePage(page, h, P);

const cy = (s) => (s.match(/\r\n/g) || []).length ? "CRLF" : "LF";
console.log(`py pre  ${pyBefore} -> 0`);
console.log(`pre    ${before.pre[0]} -> ${after.pre[0]}  ${after.pre[0] === after.pre[1] ? "balanced" : "UNBALANCED"}`);
console.log(`panes  ${before.panes} -> ${after.panes}`);
console.log(`tabBtn ${before.tabBtn} -> ${after.tabBtn}`);
console.log(`div    ${before.div} -> ${after.div}  ${after.div[0] === after.div[1] ? "balanced" : "UNBALANCED"}`);
console.log(`span   ${before.span} -> ${after.span}`);
console.log(`eol    ${JSON.stringify(page.eol)} (${cy(h)})  bom=${page.bom}`);
