/* Migrate ds_textbook_14_syntax_tour.html : drop the 6 Python tabs and the 6 Python
 * panes they control. Same house style as p7 / p9 on the two sibling syntax tours:
 * the Mojo tab and pane already hold `active` in every group, so nothing has to
 * move, and the tab bar keeps its single `*.mojo` filename tab (it never claimed
 * the plain word "Mojo", so per the brief it is not renamed). Each removed pane is
 * replaced by a sentence in the section's existing .cap / .callout.
 *
 * Markup here is a third shape: no data-target, no ids -
 *   <div class="tab" data-lang="python" data-group="g">...<span class="sw">.py</div>
 *   <div class="pane" data-lang="python"><pre>...</pre></div>
 * so both the tab and the pane are located by data-lang + data-group / text.
 *
 * Vocabulary: .tok-kw .tok-str .tok-com .tok-fn .tok-num .tok-ty  ->  MAPS.tok
 * (every surviving <pre> is hand-authored spans, so no build-time highlighting is
 * emitted here and the token classes are untouched.)
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_textbook_14_syntax_tour.html";
const page = loadPage(P);
let h = page.text;

/* data-group value -> the file name shown on the .py tab that goes away. */
const GROUPS = [
  ["quadratic", "quadratic.py"],
  ["compound", "compound.py"],
  ["npv", "npv.py"],
  ["simultaneous", "solve_2x2.py"],
  ["factorial", "factorial.py"],
  ["fibonacci", "fibonacci.py"],
];

const before = counts(h);
const pyBefore = GROUPS.length;
/* 12 controls (6 tabs + 6 panes) plus the one `.tab[data-lang="python"] .sw` CSS rule. */
if (countOf(h, 'data-lang="python"') !== GROUPS.length * 2 + 1) throw new Error("unexpected data-lang=python count");

function removePyTab(hh, group, file) {
  const re = new RegExp(`[ \\t]*<div class="tab" data-lang="python" data-group="${group}"><span class="sw"></span>${file.replace(/\./g, "\\.")}</div>\\r?\\n?`);
  if (!re.test(hh)) throw new Error(`removePyTab: no python tab for ${group}`);
  return hh.replace(re, "");
}
function removePyPane(hh, group) {
  /* No `active` allowed in the open tag: that is the assertion that the Mojo pane is
   * the selected one, so no `active` has to be moved afterwards. Panes carry no id
   * and no group, so they are consumed strictly in document order; `expect` is the
   * number that must still be on the page, and it drops by one every call. */
  const body = `[ \\t]*<div class="pane" data-lang="python"><pre>[\\s\\S]*?</pre></div>\\r?\\n?`;
  const n = (hh.match(new RegExp(body, "g")) || []).length;
  if (n !== expect) throw new Error(`removePyPane: expected ${expect} python panes at ${group}, found ${n}`);
  expect -= 1;
  return hh.replace(new RegExp(body), "");   // non-global: consume exactly one
}
let expect = GROUPS.length;

for (const [group, file] of GROUPS) {
  if (!new RegExp(`<div class="tab active" data-lang="mojo" data-group="${group}">`).test(h)) {
    throw new Error(`mojo tab for ${group} is not the active one`);
  }
  h = removePyTab(h, group, file);
  h = removePyPane(h, group);
}

/* ---- editorial: no dangling promises of a Python block ---- */
h = replaceOnce(
  h,
  `<title>Chapter 14 — Mojo vs Python: A Side-by-Side Syntax Tour · Mojo for Data Science</title>`,
  `<title>Chapter 14 — Mojo vs Python: A Syntax Tour · Mojo for Data Science</title>`
);
h = replaceOnce(
  h,
  `<h1>🔀 Mojo vs Python: A Side-by-Side Syntax Tour</h1>`,
  `<h1>🔀 Mojo vs Python: A Syntax Tour</h1>`
);
h = replaceOnce(
  h,
  `<p class="dek">The same algorithms, written idiomatically in both languages. If you already know Python, this chapter is a fast way to feel at home in Mojo.</p>`,
  `<p class="dek">Six algorithms written idiomatically in Mojo 1.x, with the Python habit each one replaces called out in prose. If you already know Python, this chapter is a fast way to feel at home in Mojo.</p>`
);
h = replaceOnce(
  h,
  `This chapter walks through six common algorithms: mathematical functions, financial formulas, and classic loops, all side by side.`,
  `This chapter walks through six common algorithms: mathematical functions, financial formulas, and classic loops, each one a single Mojo program.`
);
/* 3. NPV — the removed pane used enumerate() */
h = replaceOnce(
  h,
  `<p>Mojo's loop is Python-shaped: index with <code class="inline">range(len(...))</code>, accumulate with <code class="inline">var</code>. Python's version is cleanest to read but slowest in a hot loop — every iteration pays object overhead. Mojo keeps the same shape but compiles the loop to native code.</p>`,
  `<p>Mojo's loop is Python-shaped: index with <code class="inline">range(len(...))</code>, accumulate with <code class="inline">var</code>. There is no <code class="inline">enumerate</code>, so the loop walks indices and casts the discount exponent with <code class="inline">Float64(i)</code> instead of using it bare. Same shape you already know, compiled to native code.</p>`
);
/* 5. factorial */
h = replaceOnce(
  h,
  `This highlights how each language handles loops, recursion, and type safety for natural numbers.`,
  `This highlights how Mojo handles loops, recursion, and type safety for natural numbers.`
);
/* 6. fibonacci — the removed pane used the tuple swap */
h = replaceOnce(
  h,
  `This shows list/array construction, mutable state in loops, and how each language handles growing collections.`,
  `This shows list/array construction, mutable state in loops, and how Mojo handles growing collections.`
);
h = replaceOnce(
  h,
  `<p class="cap">Python's tuple swap <code class="inline">a, b = b, a + b</code> is the most concise. Mojo uses a <code class="inline">var</code> temp variable because assignment is a single binding. Both produce identical output: 0, 1, 1, 2, 3, 5, 8, ...</p>`,
  `<p class="cap">Python's one-line tuple swap <code class="inline">a, b = b, a + b</code> has no Mojo equivalent: assignment is a single binding, so the loop threads a <code class="inline">var</code> temp variable instead. The output is the same either way: 0, 1, 1, 2, 3, 5, 8, ...</p>`
);

/* ---- dead CSS: the only consumer of --py-blue / --py-yellow was the .py tab swatch ---- */
h = replaceOnce(
  h,
  `  --py-blue:#4b8bbe; --py-yellow:#ffd43b;\n`,
  ``
);
h = replaceOnce(
  h,
  `.tab[data-lang="python"] .sw{background:var(--py-blue);}\n`,
  ``
);

/* no Python control may survive */
if (/data-lang="python"/.test(h)) throw new Error("data-lang=python survived");
if (/--py-blue/.test(h)) throw new Error("dead --py-blue survived");
if (/Side-by-Side/.test(h)) throw new Error("dangling Side-by-Side promise");
if (/both languages/.test(h)) throw new Error("dangling 'both languages' promise");
if (countOf(h, '<div class="pane active" data-lang="mojo">') !== GROUPS.length) throw new Error("lost a mojo pane");

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
