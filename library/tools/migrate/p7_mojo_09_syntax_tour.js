/* Migrate mojo_09_syntax_tour.html : drop the 6 labelled Python panes from the
 * Mojo/Python tab bars. Every Mojo tab/pane already holds `active`, so nothing
 * has to move. Each removed pane is replaced by a sentence in the section's
 * existing info-box, which keeps the comparison as prose (house style, same as
 * mojo_02_basics / mojo_11_interop).
 *
 * Vocabulary: .kw .fn .str .num .cmt .op .type .var  ->  MAPS.cmt
 * (blocks on this page are hand-authored spans, so no build-time highlighting is
 *  emitted here and the token classes are untouched.)
 */
import { loadPage, savePage, counts, replaceOnce } from "../lib/edit.js";

const P = "public/mojo_v1/mojo_09_syntax_tour.html";
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
const pyBefore = (h.match(/<pre\b/g) || []).length;

function removeTab(hh, id) {
  const re = new RegExp(`[ \\t]*<button\\b[^>]*\\bdata-tab="${id}"[^>]*>[\\s\\S]*?</button>\\r?\\n?`);
  if (!re.test(hh)) throw new Error(`removeTab: no button for ${id}`);
  return hh.replace(re, "");
}
function removePane(hh, id) {
  const re = new RegExp(`[ \\t]*<div class="tab-content" id="${id}">\\r?\\n[ \\t]*<pre>[\\s\\S]*?</pre>\\r?\\n[ \\t]*</div>\\r?\\n?`);
  if (!re.test(hh)) throw new Error(`removePane: no pane ${id}`);
  return hh.replace(re, "");
}

for (const id of PANES) {
  h = removeTab(h, id);
  h = removePane(h, id);
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
/* 1. quadratic — the removed pane used math.sqrt */
h = replaceOnce(h, `error handling in both languages.`, `error handling in a single screen.`);
h = replaceOnce(
  h,
  `<code class="inline">raises</code> keyword in its signature, so callers know at a glance that the call can fail.</p>`,
  `<code class="inline">raises</code> keyword in its signature, so callers know at a glance that the call can fail. The square root needs no import either: <code class="inline">discriminant ** 0.5</code> is the Mojo spelling of Python's <code class="inline">math.sqrt(discriminant)</code>, because <code class="inline">**</code> is overloaded for <code class="inline">Float64</code>.</p>`
);
/* 2. compound interest — the removed pane used an f-string */
h = replaceOnce(
  h,
  `This highlights how each language handles exponentiation, floating-point arithmetic, and formatted output.`,
  `This highlights how Mojo handles exponentiation, floating-point arithmetic, and formatted output.`
);
h = replaceOnce(
  h,
  `Mojo won't silently mix <code class="inline">Int</code> and <code class="inline">Float64</code> arithmetic the way Python does.</p>`,
  `Mojo won't silently mix <code class="inline">Int</code> and <code class="inline">Float64</code> arithmetic the way Python does. Formatted output splits the same way: Python's <code class="inline">f"Accumulated: {amount:.2f}"</code> becomes a t-string, <code class="inline">t"Accumulated: {amount:.2f}"</code>.</p>`
);
/* 3. NPV — the removed pane used enumerate() */
h = replaceOnce(
  h,
  `<code class="inline">**</code> operator handles <code class="inline">Float64</code> exponents directly. In production finance code, prefer an integer exponent when you can — it's faster and avoids floating-point drift in the discount factor.</p>`,
  `<code class="inline">**</code> operator handles <code class="inline">Float64</code> exponents directly. In production finance code, prefer an integer exponent when you can — it's faster and avoids floating-point drift in the discount factor. There is no <code class="inline">enumerate</code> either: the loop walks indices with <code class="inline">range(len(cash_flows))</code> and indexes the list, which is why the exponent is cast with <code class="inline">Float64(t)</code> instead of being used bare.</p>`
);
/* 4. simultaneous equations */
h = replaceOnce(
  h,
  `This example demonstrates <strong>structs</strong>: Mojo's <code class="inline">struct</code> and Python's <code class="inline">dataclass</code>.`,
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
  `For performance-critical sequences, pre-allocate in Mojo with <code class="inline">List[Int](capacity=n)</code> to avoid repeated reallocations.</p>`,
  `For performance-critical sequences, pre-allocate in Mojo with <code class="inline">List[Int](capacity=n)</code> to avoid repeated reallocations. Python's one-line <code class="inline">" ".join(map(str, fib))</code> has no Mojo equivalent, so the driver loop just prints each value.</p>`
);

const after = counts(h);
savePage(page, h, P);

const cy = (s) => (s.match(/\r\n/g) || []).length ? "CRLF" : "LF";
console.log(`pre    ${pyBefore} -> ${(h.match(/<pre\b/g) || []).length}`);
console.log(`panes  ${(before.panes[0])} -> ${after.panes[0]}`);
console.log(`div    ${before.div} -> ${after.div}  ${after.div[0] === after.div[1] ? "balanced" : "UNBALANCED"}`);
console.log(`pre    ${before.pre} -> ${after.pre}  ${after.pre[0] === after.pre[1] ? "balanced" : "UNBALANCED"}`);
console.log(`span   ${before.span} -> ${after.span}`);
console.log(`eol    ${JSON.stringify(page.eol)} (${cy(h)})  bom=${page.bom}`);
