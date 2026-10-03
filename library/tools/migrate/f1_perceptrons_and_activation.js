/* Migrate perceptrons_and_activation.html : drop the 4 Python panes from the
 * .code-tabs / .code-tab-content tab groups, leaving one live Mojo example each.
 *
 * Shape (per group, x4):
 *   <div class="code-tabs" data-tab-group="NAME">
 *     <div class="code-tab-header">
 *       <button class="code-tab-btn active" data-tab="python"> ... </button>
 *       <button class="code-tab-btn" data-tab="mojo"> ... </button>
 *     <div class="code-tab-content active" data-tab-content="python"><pre><code>py</code></pre></div>
 *     <div class="code-tab-content" data-tab-content="mojo"><pre><code>mojo</code></pre></div>
 *   </div>
 *
 * Every Python pane here is a full NumPy twin of the Mojo pane beside it, so the
 * pane is removed rather than rewritten - the same call c1 made on
 * ds_ml_textbook_02. Unlike c1 the Python pane is the *active* one, so `active`
 * has to move onto the Mojo button and the Mojo content div. The content divs
 * also had no id, which verify_page's tab-target/pane bijection rejects for all
 * 8 groups, so ids are added as the targets are renamed.
 *
 * Vocabulary: .tok-k .tok-s .tok-c .tok-n .tok-f .tok-num  ->  MAPS.shorttok
 * Every surviving <pre> is hand-authored spans; nothing is re-highlighted here,
 * so buildPre is not used.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/perceptrons_and_activation.html";
const page = loadPage(P);
let h = page.text;

/* Document order of the four tab groups. */
const GROUPS = ["perceptron", "decision-boundary", "activations", "numeric-tour"];

const before = counts(h);

/* ---- 1. the Python tab button, in all four groups ------------------------- */
/* The lang-icon glyph is matched as "any text" - some of these buttons carry a
 * variation selector after the emoji, so pinning the code point is brittle. */
const BTN = '[ \\t]*<button class="code-tab-btn active" data-tab="python">\\r?\\n[ \\t]*<span class="lang-icon">[^<]*</span> Python\\r?\\n[ \\t]*</button>\\r?\\n';
if (countOf(h, `data-tab="python"`) !== 4) throw new Error("expected 4 python tab buttons");
h = h.replace(new RegExp(BTN, "g"), "");
if (/data-tab="python"/.test(h)) throw new Error("a python tab button survived");

/* ---- 2. the Python content pane, in all four groups ----------------------- */
const PANE = '[ \\t]*<div class="code-tab-content active" data-tab-content="python">\\r?\\n[ \\t]*<pre><code>[\\s\\S]*?</code></pre>\\r?\\n[ \\t]*</div>\\r?\\n';
if (countOf(h, `data-tab-content="python"`) !== 4) throw new Error("expected 4 python panes");
h = h.replace(new RegExp(PANE, "g"), "");
if (/data-tab-content="python"/.test(h)) throw new Error("a python pane survived");
if (/<pre><code><span class="tok-k">import<\/span> numpy/.test(h)) throw new Error("a numpy <pre> survived");

/* ---- 3. the surviving Mojo control becomes the active one ----------------- */
let bi = 0;
h = h.replace(
  /<button class="code-tab-btn" data-tab="mojo">\r?\n([ \t]*)<span class="lang-icon">([^<]*)<\/span> Mojo 1\.x\r?\n[ \t]*<span class="mojo-badge">NEW<\/span>\r?\n[ \t]*<\/button>/g,
  (_m, ind, icon) => {
    const id = `mojo-${GROUPS[bi++]}`;
    return `<button class="code-tab-btn active" data-tab="${id}">\n${ind}<span class="lang-icon">${icon}</span> Mojo 1.x\n${ind}</button>`;
  }
);
if (bi !== 4) throw new Error(`renamed ${bi} mojo buttons, expected 4`);

let ci = 0;
h = h.replace(/<div class="code-tab-content" data-tab-content="mojo">/g, () => {
  const id = `mojo-${GROUPS[ci++]}`;
  return `<div class="code-tab-content active" id="${id}" data-tab-content="mojo">`;
});
if (ci !== 4) throw new Error(`renamed ${ci} mojo panes, expected 4`);
if (/<span class="mojo-badge">/.test(h)) throw new Error("the NEW badge outlived its comparison");
if (countOf(h, `data-tab-content="mojo"`) !== 4) throw new Error("lost a mojo pane");

/* ---- 4. Mojo 1.1 stdlib spelling in the blocks that just became the only
 *         example in their section (compliance report B1: stdlib lives under
 *         `std.`). `from tensor import` is left alone - see the report note. */
const IMPORTS = [
  [`<span class="tok-k">from</span> python <span class="tok-k">import</span> Python`,
   `<span class="tok-k">from</span> std.python <span class="tok-k">import</span> Python`],
  [`<span class="tok-k">from</span> math <span class="tok-k">import</span> sqrt, exp, min, max`,
   `<span class="tok-k">from</span> std.math <span class="tok-k">import</span> sqrt, exp, min, max`],
  [`<span class="tok-k">from</span> math <span class="tok-k">import</span> exp, min, max`,
   `<span class="tok-k">from</span> std.math <span class="tok-k">import</span> exp, min, max`],
  [`<span class="tok-k">from</span> collections <span class="tok-k">import</span> List`,
   `<span class="tok-k">from</span> std.collections <span class="tok-k">import</span> List`],
];
let fixed = 0;
for (const [from, to] of IMPORTS) {
  const n = countOf(h, from);
  fixed += n;
  h = h.split(from).join(to);
}
if (fixed !== 6) throw new Error(`expected 6 bare stdlib imports, rewrote ${fixed}`);

/* ---- 5. editorial: nothing may still promise the removed Python ----------- */

/* hero dek */
h = replaceOnce(
  h,
  `every equation,\n                every derivative, implemented in Python and Mojo 1.x.`,
  `every equation,\n                every derivative, implemented in Mojo 1.x.`
);

/* 2.5 - the removed twin is gone, so "both implementations" is now one */
h = replaceOnce(
  h,
  `always subtract the max logit first (both implementations below do):`,
  `always subtract the max logit first (the implementation below does):`
);

/* self-check 5 */
h = replaceOnce(
  h,
  `Run the numeric tour (Chapter 3) in both languages and extend it with GELU`,
  `Run the numeric tour (Chapter 3) and extend it with GELU`
);

/* 1.4 - the removed twin was the *active* pane, and this output panel was
 * transcribed from the NumPy print format (`[0 0] -> 0`). Retarget it at the
 * surviving Mojo block, which prints the statement it declares and Mojo's own
 * List rendering. */
h = replaceOnce(
  h,
  `                <strong>Expected output:</strong>
                <div class="output">
                    Predictions for AND gate:<br>
                    [0 0] -> 0<br>
                    [0 1] -> 0<br>
                    [1 0] -> 0<br>
                    [1 1] -> 1
                </div>`,
  `                <strong>Expected output (Mojo 1.x):</strong>
                <div class="output">
                    Perceptron Predictions for AND gate:<br>
                    [0.0, 0.0] -> 0<br>
                    [0.0, 1.0] -> 0<br>
                    [1.0, 0.0] -> 0<br>
                    [1.0, 1.0] -> 1
                </div>`
);

/* ---- 6. nothing Python may survive as a control or a claim --------------- */
if (/data-(?:target|tab)="python/.test(h)) throw new Error("leftover Python tab control");
if (/data-tab-content="python"/.test(h)) throw new Error("leftover Python pane");
if (/import<\/span> numpy|import<\/span> matplotlib/.test(h)) throw new Error("numpy/matplotlib <pre> survived");
if (/implemented in Python and Mojo|both implementations below|both languages and extend/.test(h)) {
  throw new Error("dangling Python promise");
}

const after = counts(h);
savePage(page, h, P);

console.log(`py pane 4 -> 0   (groups: ${GROUPS.join(", ")})`);
console.log(`imports ${fixed} bare stdlib -> std.`);
console.log(`pre    ${before.pre[0]} -> ${after.pre[0]}  ${after.pre[0] === after.pre[1] ? "balanced" : "UNBALANCED"}`);
console.log(`div    ${before.div[0]}/${before.div[1]} -> ${after.div[0]}/${after.div[1]}  ${after.div[0] === after.div[1] ? "balanced" : "UNBALANCED"}`);
console.log(`span   ${before.span} -> ${after.span}`);
console.log(`eol    ${JSON.stringify(page.eol)}  bom=${page.bom}`);
