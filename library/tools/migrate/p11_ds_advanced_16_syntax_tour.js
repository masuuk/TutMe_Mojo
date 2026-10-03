/* Migrate ds_advanced_16_syntax_tour.html : drop the 5 Python panes and the 5 Python
 * tab controls that drive them.
 *
 * The census calls these blocks "heuristic" (their pane carries no data-lang, only
 * an id, so lang.js falls through to the text score and files them as Python), but
 * structurally this is the label-driven shape A: every group is
 *   <div class="tab active" data-target="mojo-X">Mojo</div>
 *   <div class="tab" data-target="python-X">Python</div>
 *   <pre class="code-block active" id="mojo-X"><code>…</code></pre>
 *   <pre class="code-block" id="python-X"><code>…</code></pre>
 * so edit.js's stock removeTab / removePre apply unchanged. The Mojo tab and pane
 * already hold `active` in every group, so nothing has to move, and the remaining
 * tab keeps its "Mojo" label (p7 / p9 do the same).
 *
 * Vocabulary: .kw .fn .str .num .com .op .type  ->  MAPS.com
 * (every surviving <pre> is hand-authored spans inside <code>, so no build-time
 * highlighting is emitted here and the token classes are untouched.)
 */
import { loadPage, savePage, counts, replaceOnce, removePre, removeTab, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_advanced_16_syntax_tour.html";
const page = loadPage(P);
let h = page.text;

const PANES = [
  ["python-quad", "mojo-quad", "1. quadratic equation solver"],
  ["python-compound", "mojo-compound", "2. compound interest"],
  ["python-npv", "mojo-npv", "3. net present value"],
  ["python-sim", "mojo-sim", "4. simultaneous equations"],
  ["python-fact", "mojo-fact", "5. factorial"],
  ["python-fib", "mojo-fib", "6. fibonacci"],
];

const before = counts(h);
const pyBefore = PANES.length;
if (countOf(h, 'data-target="python-') !== PANES.length) throw new Error("unexpected python tab count");

for (const [py, mojo] of PANES) {
  /* If the Mojo block was not the active one, `active` would have to move. Assert. */
  if (!new RegExp(`<pre class="code-block active" id="${mojo}">`).test(h)) {
    throw new Error(`${mojo} is not the active block - active would have to move`);
  }
  h = removeTab(h, py);
  h = removePre(h, py);
}

/* ---- editorial: no dangling promises of a Python block ---- */
h = replaceOnce(
  h,
  `<title>Chapter 16 — Mojo vs Python: A Side-by-Side Syntax Tour · Mojo 1.x</title>`,
  `<title>Chapter 16 — Mojo vs Python: A Syntax Tour · Mojo 1.x</title>`
);
h = replaceOnce(
  h,
  `<h1>🔀 Mojo vs Python: <span class="hl">A Side-by-Side Syntax Tour</span></h1>`,
  `<h1>🔀 Mojo vs Python: <span class="hl">A Syntax Tour</span></h1>`
);
h = replaceOnce(
  h,
  `<p class="dek">Seven practical examples implemented in both languages — one compiled, one interpreted. Compare syntax, idioms, and trade-offs in one place.</p>`,
  `<p class="dek">Seven practical examples implemented in Mojo 1.x, with the Python habit each one replaces called out in prose. Compare syntax, idioms, and trade-offs in one place.</p>`
);
/* 1. quadratic — the removed pane used math.sqrt and three f-strings */
h = replaceOnce(
  h,
  `This example highlights how each language handles the <code>math</code> module, variable declarations, and conditional branches.`,
  `This example highlights how Mojo handles the <code>math</code> module, variable declarations, and conditional branches.`
);
h = replaceOnce(
  h,
  `Python checks types at runtime; Mojo enforces annotations at compile time.</p>`,
  `Python checks types at runtime; Mojo enforces annotations at compile time. Python's f-strings become t-strings, so <code>f"Two real roots: {x1} and {x2}"</code> is <code>t"Two real roots: {x1} and {x2}"</code> — though handing the values to <code>print</code> as separate arguments, as below, needs no quoting at all.</p>`
);
/* 2. compound interest — the removed pane used an f-string with a format spec */
h = replaceOnce(
  h,
  `This example demonstrates how each language handles exponentiation, the <code>pow</code> function, and formatted output.`,
  `This example demonstrates how Mojo handles exponentiation, the <code>**</code> operator, and formatted output.`
);
h = replaceOnce(
  h,
  `so no separate <code>pow</code> overloads are needed.</p>`,
  `so no separate <code>pow</code> overloads are needed. Python's <code>f"Future value: \${amount:.2f}"</code> becomes the t-string <code>t"Future value: \${amount:.2f}"</code>.</p>`
);
/* 3. NPV — the removed pane used enumerate() */
h = replaceOnce(
  h,
  `This example shows iteration patterns, list operations, and accumulators in both languages.`,
  `This example shows iteration patterns, list operations, and accumulators.`
);
h = replaceOnce(
  h,
  `<p>Mojo and Python both use explicit <code>for</code> loops with an accumulator — the code is nearly identical. Mojo's <code>List[T]</code> is a value type; Python's <code>list</code> is heap-allocated.</p>`,
  `<p>Mojo uses an explicit <code>for</code> loop with an accumulator, the shape Python programmers expect. There is no <code>enumerate</code>, so the loop walks indices and casts the discount exponent with <code>Float64(i)</code> instead of using it bare. <code>List[T]</code> is a value type; the heap-allocated <code>list</code> is its Python counterpart.</p>`
);
/* 4. simultaneous equations */
h = replaceOnce(
  h,
  `This demonstrates how both languages handle struct and class definitions and methods.`,
  `This demonstrates how Mojo handles struct definitions and methods.`
);
h = replaceOnce(
  h,
  `with zero overhead for small numerical structs like <code>LinearEq</code>. Python classes are heap-allocated.</p>`,
  `with zero overhead for small numerical structs like <code>LinearEq</code>. Python classes are heap-allocated. The pairing logic stays a free <code>solve(eq1, eq2)</code> function in Mojo too — only the type declaration changed.</p>`
);
/* 5. factorial — the box claimed Mojo's Int was arbitrary-precision, which it is not,
 *    and it did so by comparing the two blocks. */
h = replaceOnce(
  h,
  `This example highlights function signatures, return types, and recursion semantics in each language.`,
  `This example highlights function signatures, return types, and recursion semantics in Mojo.`
);
h = replaceOnce(h, `<strong>Arbitrary-precision integers</strong>`, `<strong>Integer width</strong>`);
h = replaceOnce(
  h,
  `<p>Both the iterative and recursive versions behave identically in Mojo and Python. Because Mojo's <code>Int</code> is arbitrary-precision (like Python's), <code>factorial(100)</code> returns the exact 158-digit result in both languages.</p>`,
  `<p>Mojo's <code>Int</code> is a fixed-size machine word, so add an explicit bounds check for negative inputs and watch for overflow on large factorials. Python's <code>int</code> has arbitrary precision, so <code>factorial(100)</code> returns the exact 158-digit result there and nowhere else.</p>`
);
/* 6. fibonacci — the removed pane sliced the list and printed the list repr */
h = replaceOnce(
  h,
  `This example compares list/array construction, pattern unpacking, and loop idioms.`,
  `This example shows list construction and loop idioms in Mojo.`
);
h = replaceOnce(
  h,
  `<p>Mojo's <code>List[T]</code> grows dynamically like Python's <code>list</code>, so this example reads almost identically in both languages. For very large <code>n</code>, consider a generator or iterator to avoid allocating the whole sequence at once.</p>`,
  `<p>Mojo's <code>List[T]</code> grows dynamically, like Python's <code>list</code>. For very large <code>n</code>, prefer a generator or iterator to avoid allocating the whole sequence at once.</p>`
);

/* no Python control may survive */
if (/data-target="python/.test(h)) throw new Error("python tab control survived");
if (/id="python-/.test(h)) throw new Error("python pane survived");
if (/Side-by-Side/.test(h)) throw new Error("dangling Side-by-Side promise");
if (/both languages/.test(h)) throw new Error("dangling 'both languages' promise");
if (countOf(h, '<pre class="code-block active" id="mojo-') !== PANES.length) throw new Error("lost a mojo block");

const after = counts(h);
savePage(page, h, P);

const cy = (s) => (s.match(/\r\n/g) || []).length ? "CRLF" : "LF";
console.log(`py pre  ${pyBefore} -> 0`);
console.log(`pre    ${before.pre[0]} -> ${after.pre[0]}  ${after.pre[0] === after.pre[1] ? "balanced" : "UNBALANCED"}`);
console.log(`tabBtn ${before.tabBtn} -> ${after.tabBtn}`);
console.log(`div    ${before.div} -> ${after.div}  ${after.div[0] === after.div[1] ? "balanced" : "UNBALANCED"}`);
console.log(`code   ${countOf(h, "<code>")} open tags`);
console.log(`span   ${before.span} -> ${after.span}`);
console.log(`eol    ${JSON.stringify(page.eol)} (${cy(h)})  bom=${page.bom}`);
