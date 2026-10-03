/* Editorial pass on linear_regression_detailed.html - no code blocks change.
 *
 * This page was already at 0 Python blocks (all 9 listings are Mojo, several via
 * `Python.import_module`). What is left is the residue a block removal leaves
 * behind: prose and chrome that still advertise a second implementation.
 *
 * Deliberately NOT changed, because the brief keeps comparisons:
 *   <title> / footer "Linear Regression - Python & Mojo 1.x"
 *   TOC 11. Python vs Mojo 1.x, 12. Quick Reference: Python <-> Mojo
 *   the whole of Chapter 11 and the Chapter 12 side-by-side table
 *   every `Python.import_module(...)` interop idiom (that *is* the Mojo code)
 * Those are honest: they describe the NumPy equivalent of the Mojo on screen.
 * What is not honest is claiming this book ships a Python implementation.
 *
 * Removed: the `dot python` language dot and the two `--python-accent` custom
 * properties, which no element references any more (all 9 headers are
 * `dot mojo`), plus the four claims that a Python version of the code follows.
 */
import { loadPage, savePage, counts, replaceOnce } from "../lib/edit.js";

const P = "public/data_science/linear_regression_detailed.html";
const page = loadPage(P);
let h = page.text;

const before = counts(h);
if (countOf2(h, `<pre`) !== before.pre[0]) throw new Error("unexpected pre count");

/* ---- 1. sidebar brand ---------------------------------------------------- */
h = replaceOnce(h, `<p>Python · Mojo 1.x</p>`, `<p>Mojo 1.x</p>`);

/* ---- 2. sidebar footer count --------------------------------------------- */
h = replaceOnce(
  h,
  `<div class="sidebar-foot">14 chapters · 2 languages · 1 great model</div>`,
  `<div class="sidebar-foot">14 chapters · 1 language · 1 great model</div>`
);

/* ---- 3. hero: "expressing the same kernel twice" promised a second listing - */
h = replaceOnce(
  h,
  `            The goal is to find coefficients <strong>β</strong> that minimize the sum of squared
            residuals (ordinary least squares). We implement everything from scratch in
            <strong>Python</strong> (with NumPy) and <strong>Mojo 1.x</strong> — a high-performance
            Python superset designed for AI systems. Learning the mathematics first, then expressing
            the same kernel twice, is how the "two-world" gap between prototyping and production
            finally closes.`,
  `            The goal is to find coefficients <strong>β</strong> that minimize the sum of squared
            residuals (ordinary least squares). We implement everything from scratch in
            <strong>Mojo 1.x</strong> — a high-performance Python superset designed for AI systems.
            Learning the mathematics first, then writing each kernel out in full, is how the
            "two-world" gap between prototyping and production finally closes. Where a step is
            usually reached for NumPy, the listing drives NumPy through Mojo's interop bridge
            instead; Chapter 11 and the Chapter 12 table map every step back to its NumPy
            equivalent.`
);

/* ---- 4. Chapter 11 strategy note: "the same kernels in both languages" ----- */
h = replaceOnce(
  h,
  `            <strong>💡 Strategy:</strong> Learn the mathematics first, then implement the same kernels
            in both languages. Use Python's mature ecosystem (scikit-learn, pandas) for production ML,
            and Mojo where you need compiled high-performance kernels.`,
  `            <strong>💡 Strategy:</strong> Learn the mathematics first, then implement the kernels
            yourself — the left column of the Chapter 12 table is what you would write in Python, the
            right column is what compiles. Use Python's mature ecosystem (scikit-learn, pandas) for
            production ML, and Mojo where you need compiled high-performance kernels.`
);

/* ---- 5. dead Python-only chrome ------------------------------------------ */
h = replaceOnce(
  h,
  `        .code-block .header .lang .dot.python {
            background: var(--python-accent);
        }
`,
  ``
);
h = replaceOnce(h, `            --python-accent: #3572a5;\n`, ``);
h = replaceOnce(h, `            --python-accent: #8ab4f8;\n`, ``);

/* ---- 6. nothing may still advertise a Python listing --------------------- */
if (/--python-accent|dot\.python/.test(h)) throw new Error("dead python chrome survived");
if (/2 languages|both languages|and <strong>Mojo 1\.x<\/strong> — a high-performance/.test(h)) {
  throw new Error("dangling two-language claim");
}
/* the comparison itself must still be reachable. Note the title/footer use an
 * en dash (U+2013), not a hyphen - match around it. */
for (const keep of [
  `id="ch11">11. Why Mojo 1.x? Python vs Mojo`,
  `12. Quick Reference: Python ↔ Mojo`,
  `Python.import_module("numpy")`,
  `&amp; Mojo 1.x</title>`,
  `&amp; Mojo 1.x &nbsp;`,
]) {
  if (!h.includes(keep)) throw new Error(`comparison prose was collateral damage: ${keep}`);
}

const after = counts(h);
if (after.pre[0] !== before.pre[0]) throw new Error("a code block changed on a prose-only pass");
if (after.span !== before.span) throw new Error("a highlighted span changed on a prose-only pass");
savePage(page, h, P);

console.log(`code blocks  ${before.pre[0]} -> ${after.pre[0]}  (untouched)`);
console.log(`spans        ${before.span} -> ${after.span}  (untouched)`);
console.log(`removed      1 language dot rule, 2 --python-accent properties, 4 two-language claims`);
console.log(`kept         ch11, ch12 table, <title>, footer, every Python.import_module idiom`);
console.log(`eol          ${JSON.stringify(page.eol)}  bom=${page.bom}`);

function countOf2(s, find) {
  return s.split(find).length - 1;
}
