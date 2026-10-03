/* Migrate ds_textbook_03_type_system.html : drop the 3 Python tabs and the 3 Python
 * panes they control (scalars.py / simd_numpy.py / metaclass.py).
 *
 * Same third shape as ds_textbook_02 / ds_textbook_14 (p10): no data-target, no ids -
 *   <div class="tab" data-lang="python" data-group="g"><span class="sw"></span>scalars.py</div>
 *   <div class="pane" data-lang="python"><pre>...</pre></div>
 * The `traits` group on this page is already Mojo-only and is left untouched. In the three
 * groups below the Mojo tab and pane already hold `active`, so nothing has to move, and
 * each tab bar keeps its single `*.mojo` filename tab (never the plain word "Mojo").
 *
 * Vocabulary: .tok-kw .tok-str .tok-com .tok-fn .tok-num .tok-ty  ->  MAPS.com
 * (every surviving <pre> is hand-authored spans, so no build-time highlighting is emitted
 * here and the token classes are untouched.)
 *
 * Compliance-report section E (comment/doc inaccuracy with a verbatim prescribed
 * correction): the traits pane claimed Mojo synthesises
 * `__init__(out self, *, take: Self)` for `Movable`; the 1.1 spelling is
 * `__init__(out self, *, deinit move: Self)`. Corrected.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";

const P = "public/data_science/ds_textbook_03_type_system.html";
const page = loadPage(P);
let h = page.text;

/* data-group value -> the file name shown on the .py tab that goes away. */
const GROUPS = [
  ["scalars", "scalars.py"],
  ["simd", "simd_numpy.py"],
  ["comptime", "metaclass.py"],
];

const before = counts(h);
/* 6 controls (3 tabs + 3 panes) plus the one `.tab[data-lang="python"] .sw` CSS rule. */
if (countOf(h, 'data-lang="python"') !== GROUPS.length * 2 + 1) throw new Error("unexpected data-lang=python count");

function removePyTab(hh, group, file) {
  const re = new RegExp(`[ \\t]*<div class="tab" data-lang="python" data-group="${group}"><span class="sw"></span>${file.replace(/\./g, "\\.")}</div>\\r?\\n?`);
  if (!re.test(hh)) throw new Error(`removePyTab: no python tab for ${group}`);
  return hh.replace(re, "");
}
function removePyPane(hh, group) {
  const body = `[ \\t]*<div class="pane" data-lang="python"><pre>[\\s\\S]*?</pre></div>\\r?\\n?`;
  const n = (hh.match(new RegExp(body, "g")) || []).length;
  if (n !== expect) throw new Error(`removePyPane: expected ${expect} python panes at ${group}, found ${n}`);
  expect -= 1;
  return hh.replace(new RegExp(body), ""); // non-global: consume exactly one
}
let expect = GROUPS.length;

for (const [group, file] of GROUPS) {
  if (!new RegExp(`<div class="tab active" data-lang="mojo" data-group="${group}">`).test(h)) {
    throw new Error(`mojo tab for ${group} is not the active one`);
  }
  h = removePyTab(h, group, file);
  h = removePyPane(h, group);
}

/* ---- compliance report E: the 1.1 spelling of the Movable `__init__` overload ---- */
h = replaceOnce(
  h,
  `<span class="tok-com">#   Mojo synthesizes __init__(out self, *, take: Self) for Movable</span>`,
  `<span class="tok-com">#   Mojo synthesizes __init__(out self, *, deinit move: Self) for Movable</span>`
);

/* ---- editorial: every removed pane's lesson becomes prose ---- */
/* 1. scalars - the removed pane carried arbitrary precision, missing BFloat16, and the
 *    silent `int(3.9)` truncation. */
h = replaceOnce(
  h,
  `<p class="cap">Mojo requires explicit casts between numeric types — no implicit widening or narrowing. This prevents an entire class of silent numeric bugs.</p>`,
  `<p class="cap">Mojo requires explicit casts between numeric types — no implicit widening or narrowing. This prevents an entire class of silent numeric bugs: in Python <code class="inline">int(3.9)</code> quietly becomes <code class="inline">3</code>, whereas <code class="inline">Int(c)</code> above is explicit about doing the same thing. The other side of the trade is that Python's <code class="inline">int</code> is arbitrary-precision, so <code class="inline">10 ** 100</code> simply works; Mojo's <code class="inline">Int</code> is a fixed 64 bits. Python's standard library has no <code class="inline">BFloat16</code> at all either — you reach for <code class="inline">numpy.bfloat16</code> — while here it is a built-in type.</p>`
);
/* 2. simd - the removed pane was the only numpy comparison; the Mojo side already has
 *    .fma(), reduce_add() and a dot_product, so the prose names the numpy equivalents. */
h = replaceOnce(
  h,
  `<p class="cap">Mojo's SIMD type is comptime-parameterized — the width and element type are baked in at compile time, generating optimal machine code.</p>`,
  `<p class="cap">Mojo's SIMD type is comptime-parameterized — the width and element type are baked in at compile time, generating optimal machine code. <code class="inline">numpy</code> gives you the same arithmetic through <code class="inline">a + b</code>, <code class="inline">np.sum(a)</code> and <code class="inline">np.dot(a, b)</code>, but each of those crosses the Python↔C boundary, and stock <code class="inline">numpy</code> has no fused multiply-add — the <code class="inline">.fma()</code> above is a single instruction the compiler emits for you.</p>`
);
/* 3. comptime - the removed pane was the "Python has no true compile-time execution"
 *    argument; keep it as prose. */
h = replaceOnce(
  h,
  `<p class="cap">Mojo's comptime can execute arbitrary Mojo code during compilation — not just simple constant expressions.</p>`,
  `<p class="cap">Mojo's comptime can execute arbitrary Mojo code during compilation — not just simple constant expressions. Python's nearest neighbours all run at import time instead: a class body evaluated when the module loads, a <code class="inline">__new__</code> that fires when a class is <i>defined</i> rather than instantiated, or a module-level <code class="inline">platform.machine()</code> check picking a width. None of those unroll a loop or emit specialised machine code, which is what the <code class="inline">SIMD_WIDTH</code> branch above gets for free.</p>`
);

/* ---- dead CSS: the only consumer of --py-blue / --py-yellow was the .py tab swatch ---- */
h = replaceOnce(h, `  --py-blue:#4b8bbe; --py-yellow:#ffd43b;\n`, ``);
h = replaceOnce(h, `.tab[data-lang="python"] .sw{background:var(--py-blue);}\n`, ``);

/* no Python control may survive */
if (/data-lang="python"/.test(h)) throw new Error("data-lang=python survived");
if (/--py-/.test(h)) throw new Error("dead --py-* CSS survived");
if (countOf(h, '<div class="pane active" data-lang="mojo">') !== 4) throw new Error("lost a mojo pane");
if (countOf(h, `*, take: Self`) !== 0) throw new Error("pre-1.0 `take: Self` comment survived");
/* the removed panes were the only numpy / dataclass / metaclass code on the page */
if (countOf(h, `<span class="tok-kw">import</span> numpy`) !== 0) throw new Error("bare numpy import survived");
if (countOf(h, `<span class="tok-ty">Meta</span>`) !== 0) throw new Error("metaclass survived");

const after = counts(h);
savePage(page, h, P);

const cy = (s) => (s.match(/\r\n/g) || []).length ? "CRLF" : "LF";
console.log(`py pre  ${GROUPS.length} -> 0`);
console.log(`pre    ${before.pre[0]} -> ${after.pre[0]}  ${after.pre[0] === after.pre[1] ? "balanced" : "UNBALANCED"}`);
console.log(`panes  ${before.panes} -> ${after.panes}`);
console.log(`tabBtn ${before.tabBtn} -> ${after.tabBtn}`);
console.log(`div    ${before.div} -> ${after.div}  ${after.div[0] === after.div[1] ? "balanced" : "UNBALANCED"}`);
console.log(`span   ${before.span} -> ${after.span}`);
console.log(`eol    ${JSON.stringify(page.eol)} (${cy(h)})  bom=${page.bom}`);
