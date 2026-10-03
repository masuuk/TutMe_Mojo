/* Migrate decision_aware_ml.html : drop the 8 `pre.py` reference blocks.
 *
 * Every section (2-9) carried a NumPy reference next to a Mojo 1.x port, wired
 * together purely by CSS - `pre.py{border-left...}` + `pre.py::before{content:
 * "python - reference"}` - so there is no tab bar and no id to move. The Mojo
 * block in each section is the implementation the prose points at, so the Python
 * block is removed rather than rewritten. The `::before` label becomes
 * unconditional.
 *
 * Two sections lose live code that the Mojo block does not carry, and both are
 * referenced by the self-check, so the Mojo block is regenerated to absorb it:
 *   Section 2 - the mean-vs-fractile contrast (self-check 1: "Why does an MSE
 *               forecast order the wrong quantity?") -> mean_of() + both orders
 *   Section 7 - the SAA optimism experiment itself (self-check 5: "Run the SAA
 *               optimism experiment (Section 7)") -> the 500-rep in/out loop,
 *               which also restores the "1) ... 2) ..." pairing the removed
 *               Python block used to provide
 * The rest (3, 4, 5, 6, 8, 9) already carry their section's content in Mojo; §6's
 * missing `d_bar` is restored as a sentence rather than new code, since that
 * section is about the gradient estimator.
 *
 * Vocabulary: .tok-k .tok-s .tok-c .tok-n .tok-f .tok-num  ->  MAPS.shorttok
 * Section 2 is re-emitted with buildPre(), which is why this file is the one
 * script in the batch that emits its own markup. `from tensor import Tensor` is
 * left alone: the compliance report flags it (B3) but does not settle the
 * replacement spelling, so it is reported rather than guessed at.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";
import { buildPre } from "../lib/tok.js";

const P = "public/data_science/decision_aware_ml.html";
const page = loadPage(P);
let h = page.text;

const before = counts(h);

/* ---- 1. remove the 8 Python reference blocks ----------------------------- */
if (countOf(h, `<pre class="py">`) !== 8) throw new Error("expected 8 pre.py blocks");
h = h.replace(/[ \t]*<pre class="py"><code>[\s\S]*?<\/code><\/pre>\r?\n/g, "");
if (/<pre class="py">/.test(h)) throw new Error("a pre.py block survived");
if (/tok-k">import<\/span> numpy|import<\/span> scipy|np\./.test(h)) {
  throw new Error("numpy/scipy code survived outside a pre.py");
}

/* ---- 2. Section 2: keep the mean-vs-fractile contrast the Py block showed - */
const S2 = `from std.collections import List
from std.random import random_float64, seed
from std.math import sqrt, log, cos, exp, PI

def lognormal(mu: Float64, sigma: Float64, n: Int) -> List[Float64]:
    var xs = List[Float64]()
    for _ in range(n):                # Box–Muller
        var u1 = random_float64(1e-12, 1.0)
        var u2 = random_float64(0.0, 1.0)
        var z = sqrt(-2.0*log(u1)) * cos(2.0*PI*u2)
        xs.append(exp(mu + sigma*z))
    return xs

def mean_of(xs: List[Float64]) -> Float64:
    var s: Float64 = 0.0
    for x in xs:
        s += x
    return s / Float64(len(xs))

def quantile(xs: List[Float64], q: Float64) -> Float64:
    xs.sort()                          # empirical quantile = sorted index
    return xs[Int(q * Float64(len(xs)-1) + 0.5)]

def cost(q: Float64, d: Float64, c_u: Float64,
         c_o: Float64) -> Float64:
    return c_o*max(q-d, 0.0) + c_u*max(d-q, 0.0)

def main():
    seed(42)
    var c_u: Float64 = 8.0
    var c_o: Float64 = 1.0
    var fr = c_u / (c_u + c_o)
    var hist = lognormal(3.0, 0.6, 200)
    var q_da = quantile(hist, fr)      # cost-aware order: the quantile
    var q_mse = mean_of(hist)          # wrong target: the mean an MSE model gives
    var test = lognormal(3.0, 0.6, 1_000_000)
    var tot_da: Float64 = 0.0
    var tot_mse: Float64 = 0.0
    for d in test:
        tot_da  += cost(q_da,  d, c_u, c_o)
        tot_mse += cost(q_mse, d, c_u, c_o)
    print("mean order    :", tot_mse / 1e6)   # what an MSE forecast pays
    print("quantile order:", tot_da  / 1e6)   # quantile wins big`;

/* ---- 3. Section 7: restore the SAA optimism experiment -------------------- */
const S7 = `# 1) see the optimism yourself: SAA newsvendor on tiny samples.
#    (reuses quantile(), cost() and lognormal() from Section 2)
def main():
    seed(0)
    var c_u: Float64 = 8.0
    var c_o: Float64 = 1.0
    var n = 30                         # n = 30 only
    var reps = 500
    var in_sample: Float64 = 0.0
    var out_sample: Float64 = 0.0
    for _ in range(reps):
        var train = lognormal(3.0, 0.6, n)
        var q = quantile(train, c_u / (c_u + c_o))
        var c_in: Float64 = 0.0
        for d in train:
            c_in += cost(q, d, c_u, c_o)
        in_sample += c_in / Float64(n)     # looks great…
        var test = lognormal(3.0, 0.6, 10_000)
        var c_out: Float64 = 0.0
        for d in test:
            c_out += cost(q, d, c_u, c_o)
        out_sample += c_out / 10_000.0     # …but this is the truth
    in_sample /= Float64(reps)
    out_sample /= Float64(reps)
    print("in-sample    :", in_sample)
    print("out-of-sample:", out_sample)
    print("gap (the bias):", out_sample - in_sample)

# 2) VGC-style bootstrap debias, 1-D newsvendor:
#    perturb the sample, re-solve, measure sensitivity.
def vgc_debias(samples: List[Float64],
               c_u: Float64, c_o: Float64,
               delta: Float64) -> Float64:
    var q0 = quantile(samples, c_u/(c_u+c_o))
    var n = len(samples)
    var bias: Float64 = 0.0
    for i in range(n):
        samples[i] += delta              # perturb one sample
        var q1 = quantile(samples, c_u/(c_u+c_o))
        samples[i] -= delta              # restore
        # dC/dZ_i ≈ Δobjective / Δsample; accumulate squared sensitivities
        bias += (cost(q1, samples[i], c_u, c_o)
               - cost(q0, samples[i], c_u, c_o)) ** 2
    return bias * delta / Float64(n) / 2.0

# debiased estimate = in-sample cost + vgc_debias(...)`;

/* Replace the Nth <pre class="mojo"> in the page (document order, 0-based). */
function replaceNthMojo(html, n, code) {
  const re = /<pre class="mojo"><code>[\s\S]*?<\/code><\/pre>/g;
  const all = [...html.matchAll(re)];
  if (all.length !== 8) throw new Error(`expected 8 pre.mojo blocks, found ${all.length}`);
  if (!all[n]) throw new Error(`no pre.mojo #${n}`);
  const at = all[n];
  return html.slice(0, at.index) + buildPre(code, "shorttok", { cls: "mojo" }) + html.slice(at.index + at[0].length);
}

/* After the pre.py removal the surviving Mojo blocks are 0-indexed by section:
 * 2,3,4,5,6,7,8,9 -> section 2 is #0 and section 7 is #5. */
h = replaceNthMojo(h, 0, S2);
h = replaceNthMojo(h, 5, S7);

/* ---- 4. Mojo 1.1 stdlib spelling (compliance report B1) ------------------ */
const IMPORTS = [
  [`<span class="tok-k">from</span> collections <span class="tok-k">import</span> List`,
   `<span class="tok-k">from</span> std.collections <span class="tok-k">import</span> List`],
  [`<span class="tok-k">from</span> random <span class="tok-k">import</span> normal_float64, seed`,
   `<span class="tok-k">from</span> std.random <span class="tok-k">import</span> normal_float64, seed`],
  [`<span class="tok-k">from</span> math <span class="tok-k">import</span> sqrt`,
   `<span class="tok-k">from</span> std.math <span class="tok-k">import</span> sqrt`],
];
let fixed = 0;
for (const [from, to] of IMPORTS) {
  const n = countOf(h, from);
  fixed += n;
  h = h.split(from).join(to);
}
if (fixed !== 4) throw new Error(`expected 4 bare stdlib imports, rewrote ${fixed}`);

/* ---- 5. dead Python-only CSS --------------------------------------------- */
h = replaceOnce(
  h,
  `  /* side-by-side language labels: Python reference vs Mojo 1.x port */
  pre.py{border-left:3px solid #a5d6ff;}
  pre.mojo{border-left:3px solid #4fc1ff; background:rgba(79,193,255,.05);}
  pre.py::before, pre.mojo::before{
    display:block;font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;
    font-family:"Cascadia Code",Consolas,Menlo,monospace;margin-bottom:8px;color:var(--mut);
  }
  pre.py::before{content:"python — reference";}
  pre.mojo::before{content:"mojo 1.x — native port";color:#4fc1ff;}`,
  `  /* language label above each code block */
  pre.mojo{border-left:3px solid #4fc1ff; background:rgba(79,193,255,.05);}
  pre.mojo::before{
    display:block;font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;
    font-family:"Cascadia Code",Consolas,Menlo,monospace;margin-bottom:8px;color:var(--mut);
    content:"mojo 1.x";color:#4fc1ff;
  }`
);

/* ---- 6. editorial: no surviving claim of a Python implementation ---------- */

/* header kicker */
h = replaceOnce(h, `<span>Python · Mojo 1.x</span>`, `<span>Mojo 1.x</span>`);

/* footer */
h = replaceOnce(
  h,
  `SPO+ · perturbed optimizers · SAA/VGC — in Python and Mojo 1.x.`,
  `SPO+ · perturbed optimizers · SAA/VGC — in Mojo 1.x.`
);

/* §2 - the "In Mojo ..." comparative opener had nothing left to compare with,
 * and the block now runs both orders, so say what the two prints are. */
h = replaceOnce(
  h,
  `  <p>In Mojo the empirical quantile is visibly what it is — <em>sort, index at the fractile</em> —
  and the whole experiment (sample → quantile → evaluate on millions of draws) compiles to one
  pass with no interpreter in the loop:</p>`,
  `  <p>The empirical quantile is visibly what it is — <em>sort, index at the fractile</em> — and the
  whole experiment (sample → quantile → evaluate on a million draws) compiles to one pass with no
  interpreter in the loop. It runs the experiment twice, so the claim above is a measurement rather
  than an assertion: <code>q_mse</code> is what an MSE forecast hands you, <code>q_da</code> is what
  the fractile hands you, and the two expected costs are printed side by side.</p>`
);

/* §6 - the removed Py block also returned the smoothed decision d_bar */
h = replaceOnce(
  h,
  `  <p>Cost <span class="math">k</span> optimizer solves per training step — a throughput problem,
  i.e. exactly the workload where the Mojo version of the inner loop pays for itself.</p>`,
  `  <p>Cost <span class="math">k</span> optimizer solves per training step — a throughput problem,
  i.e. exactly the workload where the Mojo version of the inner loop pays for itself. The smoothed
  decision <span class="math">d̃ = (1/k) Σ d<sub>j</sub></span> comes out of the very same loop: keep
  a running sum alongside the gradient and it is the action you report, while the gradient is the
  thing you train on.</p>`
);

/* ---- 7. nothing Python may survive as a control or a claim --------------- */
if (/pre\.py|python — reference/.test(h)) throw new Error("dead pre.py CSS survived");
if (/class="py"/.test(h)) throw new Error("a .py class survived");
if (/in Python and Mojo|<span>Python ·/.test(h)) throw new Error("dangling Python claim");
if (/tok-k">import<\/span> numpy/.test(h)) throw new Error("numpy import survived");

const after = counts(h);
savePage(page, h, P);

console.log(`pre.py 8 -> 0   (sections 2-9; Mojo block kept in each)`);
console.log(`re-emitted 2 Mojo blocks with buildPre("shorttok"): section 2, section 7`);
console.log(`imports ${fixed} bare stdlib -> std.  (from tensor import left for the report)`);
console.log(`pre    ${before.pre[0]} -> ${after.pre[0]}  ${after.pre[0] === after.pre[1] ? "balanced" : "UNBALANCED"}`);
console.log(`div    ${before.div[0]}/${before.div[1]} -> ${after.div[0]}/${after.div[1]}  ${after.div[0] === after.div[1] ? "balanced" : "UNBALANCED"}`);
console.log(`span   ${before.span} -> ${after.span}`);
console.log(`eol    ${JSON.stringify(page.eol)}  bom=${page.bom}`);
