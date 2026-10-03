/* Migrate fine_tuning_llms.html : drop the 6 `pre.py` reference blocks.
 *
 * Same CSS-paired shape as decision_aware_ml (f2): `pre.py{border-left...}` +
 * `pre.py::before{content:"python - reference"}`, no tab bar, no ids. Sections
 * 1-5 and 7 each keep their Mojo block; the Python one goes.
 *
 * Three sections lose live content the Mojo block does not carry:
 *   Section 2 - "# gradient flows ONLY through B and A; W is a constant"
 *               -> folded into the existing note (no new code; that section is
 *                  about the forward pass)
 *   Section 3 - the NF4 codebook itself. Prose + the eq block already define it,
 *               so the surviving block is retargeted honestly as the uniform-grid
 *               half and the codebook swap is left as the exercise it already is
 *               (self-check 4).
 *   Section 5 - the *full* HF recipe under a heading called "The Full Training
 *               Pipeline", against a 15-line load-the-base sketch, and
 *               self-check 6 says "Run the Section 5 pipeline end to end". The
 *               Mojo block is therefore re-emitted with the whole recipe driven
 *               through `Python.import_module`, ending in the trainable-% check.
 *   Section 7 - format validity (the removed block's json.loads parse test) and
 *               the decision-cost pointer. `format_validity` is added; decision
 *               cost stays a pointer to decision_aware_ml Section 8.
 *
 * Vocabulary: .tok-k .tok-s .tok-c .tok-n .tok-f .tok-num  ->  MAPS.shorttok
 * §5 and §7 are re-emitted with buildPre(), which also gives §5 the <code>
 * wrapper its six sibling blocks already have.
 */
import { loadPage, savePage, counts, replaceOnce, countOf } from "../lib/edit.js";
import { buildPre } from "../lib/tok.js";

const P = "public/data_science/fine_tuning_llms.html";
const page = loadPage(P);
let h = page.text;

const before = counts(h);

/* ---- 1. remove the 6 Python reference blocks ----------------------------- */
if (countOf(h, `<pre class="py">`) !== 6) throw new Error("expected 6 pre.py blocks");
h = h.replace(/[ \t]*<pre class="py"><code>[\s\S]*?<\/code><\/pre>\r?\n/g, "");
if (/<pre class="py">/.test(h)) throw new Error("a pre.py block survived");
if (/tok-k">import<\/span> numpy|import<\/span> json|merge_and_unload/.test(h)) {
  throw new Error("python code survived outside a pre.py");
}

/* ---- 2. Section 5: the full pipeline, driven from Mojo ------------------- */
const S5 = `from std.python import Python

# The same run driven from Mojo: the HF stack through the bridge, the
# orchestration compiled, then the adapter merges natively (Section 4).
var tf   = Python.import_module("transformers")
var peft = Python.import_module("peft")
var trl  = Python.import_module("trl")
var dsn  = Python.import_module("datasets")

def main() raises:
    # 1) 4-bit base
    var bnb = tf.BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True)
    var repo = "microsoft/Phi-3-mini-4k-instruct"
    var model = tf.AutoModelForCausalLM.from_pretrained(
        repo, device_map="auto", quantization_config=bnb)

    # 2) LoRA on ALL linear layers
    model = peft.prepare_model_for_kbit_training(model)
    model = peft.get_peft_model(model, peft.LoraConfig(
        r=8, lora_alpha=16, lora_dropout=0.05,
        task_type="CAUSAL_LM",
        target_modules=["o_proj", "qkv_proj",
                        "gate_up_proj", "down_proj"]))

    # 3) data + tokenizer
    var data = dsn.load_dataset("dvgodoy/yoda_sentences", split="train")
    var tok = tf.AutoTokenizer.from_pretrained(repo)
    tok.pad_token = tok.unk_token       # keep EOS unmasked

    # 4) train — paged optimizer absorbs long-sequence spikes
    var trainer = trl.SFTTrainer(
        model=model, processing_class=tok, train_dataset=data,
        args=trl.SFTConfig(
            output_dir="./phi3-yoda-adapter",
            per_device_train_batch_size=16,
            gradient_checkpointing=True,
            max_length=64,              # shortest sensible
            num_train_epochs=10, learning_rate=3e-4,
            optim="paged_adamw_8bit",
            logging_steps=10, report_to="none"))
    trainer.train()
    trainer.save_model()                # saves only the adapter

    # 5) the number that tells you it worked
    var counts = model.get_nb_trainable_parameters()   # (trainable, total)
    print("trainable %:", 100.0 * counts[0] / counts[1])   # ~0.3% — check it!
    print("footprint GB:", model.get_memory_footprint() / 1e9)`;

/* ---- 3. Section 7: exact match + Elo, plus the parse test that gates EM - */
const S7 = `from std.collections import List
from std.python import Python

var json = Python.import_module("json")

# format validity: does the output parse as the target schema at all?
# A loss curve cannot tell you this — a model plateaus and still emits
# text that no parser will accept.
def parses(o: String) raises -> Bool:
    try:
        json.loads(o)
        return True
    except:
        return False

def format_validity(outs: List[String]) -> Float64:
    var ok = 0
    for i in range(len(outs)):
        if parses(outs[i]):
            ok += 1
    return Float64(ok) / Float64(len(outs))

def exact_match(outs: List[String],
                tgts: List[String]) -> Float64:
    var hits = 0
    for i in range(len(outs)):
        if outs[i].strip() == tgts[i].strip():
            hits += 1
    return Float64(hits) / Float64(len(outs))

# Elo update after one judged match (K = 32, S = 1/0/0.5):
def elo_update(ra: Float64, rb: Float64,
               s_a: Float64) -> (Float64, Float64):
    var ea = 1.0 / (1.0 + 10.0 ** ((rb - ra) / 400.0))
    var delta = 32.0 * (s_a - ea)
    return (ra + delta, rb - delta)

# decision cost is the primary metric when the outputs drive decisions —
# see decision_aware_ml.html Section 8 for the loop.`;

/* Replace the Nth <pre class="mojo"> in the page (document order, 0-based).
 * The two alternatives matter: §5's block shipped as bare <pre class="mojo"> with
 * no <code> wrapper, and an *optional* group does not work here - the engine
 * would skip the group and then fail to find </pre> right after the open tag,
 * dropping the block from the match list entirely. */
function replaceNthMojo(html, n, code) {
  const re = /<pre class="mojo">(?:<code>[\s\S]*?<\/code>|[\s\S]*?)<\/pre>/g;
  const all = [...html.matchAll(re)];
  if (all.length !== 7) throw new Error(`expected 7 pre.mojo blocks, found ${all.length}`);
  if (!all[n]) throw new Error(`no pre.mojo #${n}`);
  const at = all[n];
  return html.slice(0, at.index) + buildPre(code, "shorttok", { cls: "mojo" }) + html.slice(at.index + at[0].length);
}

/* After the pre.py removal the surviving Mojo blocks are 0-indexed by section:
 * §1 §2 §3 §4 §4 §5 §7 -> section 5 is #5 and section 7 is #6. */
h = replaceNthMojo(h, 5, S5);
h = replaceNthMojo(h, 6, S7);

/* ---- 4. Mojo 1.1 stdlib spelling (compliance report B1) ------------------ */
const IMPORTS = [
  [`<span class="tok-k">from</span> random <span class="tok-k">import</span> normal_float64, seed`,
   `<span class="tok-k">from</span> std.random <span class="tok-k">import</span> normal_float64, seed`],
  [`<span class="tok-k">from</span> collections <span class="tok-k">import</span> List`,
   `<span class="tok-k">from</span> std.collections <span class="tok-k">import</span> List`],
  [`<span class="tok-k">from</span> math <span class="tok-k">import</span> abs, max`,
   `<span class="tok-k">from</span> std.math <span class="tok-k">import</span> abs, max`],
];
let fixed = 0;
for (const [from, to] of IMPORTS) {
  const n = countOf(h, from);
  fixed += n;
  h = h.split(from).join(to);
}
if (fixed !== 3) throw new Error(`expected 3 bare stdlib imports, rewrote ${fixed}`);

/* ---- 5. dead Python-only CSS --------------------------------------------- */
h = replaceOnce(
  h,
  `  pre.py{border-left:3px solid #a5d6ff;}
  pre.mojo{border-left:3px solid #4fc1ff; background:rgba(79,193,255,.05);}
  pre.py::before, pre.mojo::before{
    display:block;font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;
    font-family:"Cascadia Code",Consolas,Menlo,monospace;margin-bottom:8px;color:var(--mut);
  }
  pre.py::before{content:"python — reference";}
  pre.mojo::before{content:"mojo 1.x — native port";color:#4fc1ff;}`,
  `  pre.mojo{border-left:3px solid #4fc1ff; background:rgba(79,193,255,.05);}
  pre.mojo::before{
    display:block;font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;
    font-family:"Cascadia Code",Consolas,Menlo,monospace;margin-bottom:8px;color:var(--mut);
    content:"mojo 1.x";color:#4fc1ff;
  }`
);

/* ---- 6. editorial: no surviving promise of a Python block --------------- */

/* header kicker */
h = replaceOnce(h, `<span>Python · Mojo 1.x</span>`, `<span>Mojo 1.x</span>`);

/* footer */
h = replaceOnce(
  h,
  `pipeline · decision flowchart · metrics — in Python and Mojo 1.x.`,
  `pipeline · decision flowchart · metrics — in Mojo 1.x.`
);

/* §2 - "From scratch in NumPy, the whole mechanism is four lines" named a
 * language that is no longer on the page. */
h = replaceOnce(
  h,
  `  <p>Example: a 4096×4096 linear layer with r = 16 trains 131k parameters instead of 16.8M —
  0.8%. The adapter is a few MB, swappable per task, and merges away at deploy time (Section 4).
  From scratch in NumPy, the whole mechanism is four lines:</p>`,
  `  <p>Example: a 4096×4096 linear layer with r = 16 trains 131k parameters instead of 16.8M —
  0.8%. The adapter is a few MB, swappable per task, and merges away at deploy time (Section 4).
  The whole mechanism as pure arithmetic:</p>`
);

/* §2 - the removed block's last line was the point of the whole section */
h = replaceOnce(
  h,
  `  and are the biggest slice of memory.</p>`,
  `  and are the biggest slice of memory. And note what is <em>not</em> trainable: the base
  <code>W</code> is a constant, so the gradient flows only through <code>A</code> and
  <code>B</code> — which is exactly why the init rule can afford <code>B = 0</code> without
  stalling the first step.</p>`
);

/* §2 - "both languages" in the surviving block's init comment */
h = replaceOnce(
  h,
  `<span class="tok-c"># init rule, both languages: B = 0 exactly, A ~ N(0, 0.02²)</span>`,
  `<span class="tok-c"># init rule: B = 0 exactly, A ~ N(0, 0.02²)</span>`
);

/* §3 - the surviving block is the uniform-grid half; say so, and point at the
 * NF4 codebook swap that the removed block used to carry. */
h = replaceOnce(
  h,
  `  stay quantized during backprop.</p>`,
  `  stay quantized during backprop.</p>

  <p>The codebook is the only thing separating NF4 from ordinary int4, and it is one line: the 16
  codes are the equal-mass quantiles of <span class="math">N(0,1)</span> rescaled to
  <span class="math">[−1, 1]</span>, so a nearest-code search against that table replaces the
  uniform grid. The kernel below is the uniform-grid half — block-wise absmax down to 16 codes in
  one compiled pass — and it is the half that has to be fast, because it runs over every weight at
  load and again over every block whenever an adapter is swapped. Swapping the grid for the NF4
  table and measuring the relative-error win is exercise 4.</p>`
);

/* §4 - the peft one-liner was a Python API note; keep it as prose, since the
 * prose is where an ecosystem call belongs. */
h = replaceOnce(
  h,
  `  <p>At deploy time the adapter folds into the base — one small matmul per layer, zero inference
  overhead afterwards:</p>`,
  `  <p>At deploy time the adapter folds into the base — one small matmul per layer, zero inference
  overhead afterwards. From the Python side the whole fold is one call,
  <code>model.merge_and_unload()</code>, followed by a <code>save_pretrained</code>; there is just no
  reason to pay a process boundary to do arithmetic that is already this cheap:</p>`
);

/* §5 - the block is now the recipe, so the intro should not read as a
 * comparison against a block that no longer exists. */
h = replaceOnce(
  h,
  `  <p>The end-to-end recipe with Hugging Face (Python trains — its CUDA stack is unmatched; Mojo
  orchestrates and takes over at merge/serve time).</p>`,
  `  <p>The end-to-end recipe, driven from Mojo. The Hugging Face stack still does the training — its
  CUDA kernels are unmatched — but the orchestration, the load-time accounting and the handoff to the
  native merge in Section 4 are all compiled.</p>`
);

/* §5 - keep the trl note honest about the route this block now takes */
h = replaceOnce(
  h,
  `  <code>torch.cuda.is_bf16_supported()</code> on older GPUs; in trl 0.21 prefer passing
  <code>peft_config=</code> to SFTTrainer over pre-applying adapters.</p>`,
  `  <code>torch.cuda.is_bf16_supported()</code> on older GPUs; in trl 0.21 prefer passing
  <code>peft_config=</code> to SFTTrainer over the pre-applied adapters this block uses.</p>`
);

/* ---- 7. nothing Python may survive as a control or a claim --------------- */
if (/pre\.py|python — reference/.test(h)) throw new Error("dead pre.py CSS survived");
if (/class="py"/.test(h)) throw new Error("a .py class survived");
if (/in Python and Mojo|<span>Python ·|in NumPy/.test(h)) throw new Error("dangling Python claim");
if (/tok-k">import<\/span> numpy/.test(h)) throw new Error("numpy import survived");

const after = counts(h);
savePage(page, h, P);

console.log(`pre.py 6 -> 0   (sections 1,2,3,4,5,7; Mojo block kept in each)`);
console.log(`re-emitted 2 Mojo blocks with buildPre("shorttok"): section 5 (full pipeline), section 7`);
console.log(`imports ${fixed} bare stdlib -> std.  (from tensor import left for the report)`);
console.log(`pre    ${before.pre[0]} -> ${after.pre[0]}  ${after.pre[0] === after.pre[1] ? "balanced" : "UNBALANCED"}`);
console.log(`div    ${before.div[0]}/${before.div[1]} -> ${after.div[0]}/${after.div[1]}  ${after.div[0] === after.div[1] ? "balanced" : "UNBALANCED"}`);
console.log(`span   ${before.span} -> ${after.span}`);
console.log(`eol    ${JSON.stringify(page.eol)}  bom=${page.bom}`);
