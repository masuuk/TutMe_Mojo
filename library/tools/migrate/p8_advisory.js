/* Migrate advisory.html : the page pairs every idea as "Python | Mojo" in a
 * .grid2 of two .card elements. Each Python card is removed whole (its
 * <span class="lang">🐍 Python…</span> label plus its <pre>), which takes 8
 * heuristic-detected Python blocks plus 5 the scorer misses (4 score 0, 1
 * interop-flagged) to zero. The Mojo twin of every pair is untouched.
 *
 * Vocabulary: the page highlights its own <pre>s at runtime with an inline
 * script emitting .cm .st .de .kw .ty .nu .bi (see CLS= in the page), so the
 * surviving blocks stay plain text and there is no MAPS/buildPre work here.
 * A single .grid2 > :only-child rule keeps a one-card grid full width.
 */
import { loadPage, savePage, counts, replaceOnce } from "../lib/edit.js";

const P = "public/mojo_v1/advisory.html";
const page = loadPage(P);
let h = page.text;

const before = counts(h);
const preBefore = before.pre[0];

/* ---- 1. remove every 🐍 Python card (label + <pre> + wrapper) ---- */
const pyCard = /[ \t]*<div class="card">\r?\n[ \t]*<span class="lang">🐍 Python[^\n]*<\/span>\r?\n<pre>[\s\S]*?<\/pre>\r?\n[ \t]*<\/div>\r?\n/g;
const cards = h.match(pyCard) || [];
if (cards.length !== 13) throw new Error(`expected 13 Python cards, found ${cards.length}`);
h = h.replace(pyCard, "");
if (/🐍/.test(h)) throw new Error("a 🐍 label survived the card removal");

/* ---- 2. layout: a .grid2 that lost its sibling keeps one card ---- */
h = replaceOnce(
  h,
  `.grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:24px}`,
  `.grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:24px}\n.grid2 > :only-child{grid-column:1 / -1}`
);

/* ---- 2b. pre-existing verify_page failure: the highlighter's own comment
 * contains a literal `<pre>`, so the tag counter saw 28 opens / 27 closes on
 * the untouched page. Reword the comment; the real 27 blocks were balanced. --- */
h = replaceOnce(
  h,
  `  // Single-pass tokenizer over each <pre>: comments and strings first,`,
  `  // Single-pass tokenizer over each code block: comments and strings first,`
);

/* ---- 3. editorial: the page promised Python code in 12 places ---- */
h = replaceOnce(
  h,
  `<meta name="description" content="A code-first companion for learning Mojo 1.x and Python side by side: algorithms, kernels and equations for data science, geomatics, operations research and AI engineering.">`,
  `<meta name="description" content="A code-first companion for learning Mojo 1.x: algorithms, kernels and equations for data science, geomatics, operations research and AI engineering, with the Python baseline they replace called out in prose.">`
);
h = replaceOnce(
  h,
  `<title>🔥 Mojo 1.x × Python — Algorithms &amp; Equations</title>`,
  `<title>🔥 Mojo 1.x — Algorithms &amp; Equations</title>`
);
h = replaceOnce(
  h,
  `<span class="eyebrow">🔥 Code-First Companion · Mojo 1.x × Python</span>`,
  `<span class="eyebrow">🔥 Code-First Companion · Mojo 1.x</span>`
);
h = replaceOnce(h, `<h1>Algorithms &amp; Equations,<br>in Python and Mojo</h1>`, `<h1>Algorithms &amp; Equations,<br>in Mojo 1.x</h1>`);
h = replaceOnce(
  h,
  `      Every idea appears twice: once in the Python you already know, once in Mojo 1.x.
      Read the equation, read both programs, port something of your own. That is the whole method.`,
  `      Twelve algorithms and kernels, each as one typed Mojo 1.x program with the equation
      above it and the Python baseline it replaces named in prose. Read the equation, read
      the program, port something of your own. That is the whole method.`
);
h = replaceOnce(h, `<div class="stat"><b>12</b><span>algorithms, side by side</span></div>`, `<div class="stat"><b>12</b><span>algorithms &amp; kernels</span></div>`);
h = replaceOnce(h, `<div class="stat"><b>2</b><span>languages, one syntax family</span></div>`, `<div class="stat"><b>SIMD</b><span>lanes chosen per CPU</span></div>`);
h = replaceOnce(h, `<span class="dot">🔥</span>Mojo × Python</a>`, `<span class="dot">🔥</span>Mojo 1.x</a>`);

/* nav (2 copies: desktop dropdown + mobile menu) follows the section titles below */
const navOld = `<a href="#syntax" data-spy="" class="">Syntax: Python → Mojo</a>`;
const navNew = `<a href="#syntax" data-spy="" class="">Syntax: What Changes in Mojo</a>`;
if (h.split(navOld).length - 1 !== 2) throw new Error("expected the #syntax nav link twice");
h = h.split(navOld).join(navNew);

h = replaceOnce(h, `<h2>🔧 Syntax: Python → Mojo in One Screen</h2>`, `<h2>🔧 Syntax: What Changes in Mojo, in One Screen</h2>`);
h = replaceOnce(
  h,
  `<p class="lead">Same idea, both languages. Note what changes in Mojo: explicit types on <code>def</code> signatures, mandatory <code>var</code> for locals, and <code>raises</code> on any function that can fail.</p>`,
  `<p class="lead">Two screens of ordinary code, written the way Mojo 1.x insists on: explicit types on <code>def</code> signatures, mandatory <code>var</code> for locals, and <code>raises</code> on any function that can fail. The Python version of each program is the one already in your head — these three rules are the whole difference.</p>`
);
h = replaceOnce(
  h,
  `    <p style="margin-bottom:0">Loop order <code>i,k,j</code> walks B row-wise and C row-wise — all sequential
    memory. Identical FLOPs, dramatically fewer cache misses. Try it in <em>both</em> languages; it speeds
    up the Python triple loop too.</p>`,
  `    <p style="margin-bottom:0">Loop order <code>i,k,j</code> walks B row-wise and C row-wise — all sequential
    memory. Identical FLOPs, dramatically fewer cache misses. It is a free win in Mojo, and just as
    free in whatever language your reference implementation is written in.</p>`
);
h = replaceOnce(
  h,
  `<p class="small" style="margin-top:14px">k-means is your first "real" migration candidate: pure arithmetic,
no Python objects in the loop, and the distance kernel is exactly the dot-product code from
<a href="#simd">the SIMD section</a>.</p>`,
  `<p class="small" style="margin-top:14px">k-means is your first "real" migration candidate: pure arithmetic,
no heap objects in the loop, and the distance kernel is exactly the dot-product code from
<a href="#simd">the SIMD section</a>.</p>`
);
h = replaceOnce(
  h,
  `ideal Mojo targets when W is large (millions of states). Watch the loop direction: it is
the algorithm's core invariant, identical in both languages.</p>`,
  `ideal Mojo targets when W is large (millions of states). Watch the loop direction: it is
the algorithm's core invariant, and it is the same invariant in any implementation.</p>`
);
h = replaceOnce(
  h,
  `CSR (compressed sparse row) turns linked structures into flat arrays that both cache lines and
SIMD love. The same layout upgrade also speeds up the Python version via NumPy.</p>`,
  `CSR (compressed sparse row) turns linked structures into flat arrays that both cache lines and
SIMD love. The same layout upgrade helps any array-based version too, because CSR stores the edges
in the order the traversal reads them.</p>`
);
h = replaceOnce(
  h,
  `<p><strong>Read the equation, port the kernel, benchmark honestly — Python and Mojo, side by side.</strong></p>`,
  `<p><strong>Read the equation, port the kernel, benchmark honestly — one typed program per idea.</strong></p>`
);

/* the interop section lost its Python caller: keep it as prose, and use the
 * approved std.python idiom for the reverse direction (BRIEF.md) */
h = replaceOnce(
  h,
  `<p class="lead">The pattern that makes migration incremental: Python orchestrates, Mojo computes.</p>`,
  `<p class="lead">The pattern that makes migration incremental: the host language orchestrates, Mojo computes. The caller side is three ordinary Python lines — <code>import mojo.importer</code> installs the import hook, <code>import kernels</code> loads the compiled package, and <code>print(kernels.pi_mc_py(50_000_000))</code> prints the estimate (3.1415…). One crossing, fifty million samples, nothing in the inner loop. The reverse direction, when a kernel needs a library, is <code>from std.python import Python</code> followed by <code>var np = Python.import_module("numpy")</code>.</p>`
);

const after = counts(h);
savePage(page, h, P);

console.log(`cards  13 Python cards -> 0`);
console.log(`pre    ${preBefore} -> ${after.pre[0]}  ${after.pre[0] === after.pre[1] ? "balanced" : "UNBALANCED"}`);
console.log(`div    ${before.div} -> ${after.div}  ${after.div[0] === after.div[1] ? "balanced" : "UNBALANCED"}`);
console.log(`sect   ${before.section} -> ${after.section}  ${after.section[0] === after.section[1] ? "balanced" : "UNBALANCED"}`);
console.log(`span   ${before.span} -> ${after.span}`);
console.log(`eol    ${JSON.stringify(page.eol)}  bom=${page.bom}`);
