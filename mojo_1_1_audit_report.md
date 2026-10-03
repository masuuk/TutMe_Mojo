# Mojo 1.1 Syntax Audit — TutMe Learning Site

**Date:** 2026-09-21
**Scope:** all 133 HTML files in the repo; every Mojo code block was extracted and audited.
**Reference standard:** the repo's own `structure.md` / `The Mojo Language Blue Print.md` (Mojo 1.1 line: `def`, `comptime`, `std.*` imports, `SIMD[DType.float32]`, unified closures) and the current Mojo compiler as arbiter.

---

## 1. Verdict

The site's Mojo is **substantially modern and mostly compliant**, but a significant fraction of the *data_science* tutorial pages (and a handful of core/geomatics/praxis pages) contains code that **will not compile** under the Mojo 1.1 line. There are no legacy-keyword regressions (`fn`, `alias`, `let`, `inout`, `@parameter`, `DynamicVector`, `@value`, `owned`/`borrowed`, `__moveinit__`) anywhere — the problems are subtler: changed standard-library APIs, tuple-return syntax, missing `raises`, `//`-as-comment misuse, and Python-isms.

**Headline numbers**

| Metric | Count |
|---|---|
| HTML files scanned | 133 |
| Mojo code blocks extracted | 992 (from 112 files) |
| Python blocks excluded (heuristic) | 127 |
| Static findings | 71 ERR · 1 WARN · 182 INFO |
| Blocks spot-compiled with the real compiler | 291 "complete-looking" candidates |
| — compile clean (OK) | 163 (56%) |
| — fail | 128 (44%), of which 97 are genuine code issues |

| Compile candidates by area | OK | FAIL | OK % |
|---|---:|---:|---:|
| `mojo_v1` (core chapters) | 51 | 24 | 68% |
| `praxis/progressive` | 68 | 11 | 86% |
| `praxis` (drill pages) | 11 | 14 | 44% |
| `applications/finance` | 12 | 3 | 80% |
| `applications/geomatics` | 5 | 11 | 31% |
| `applications/operations_research` | 2 | 2 | 50% |
| `data_science` (+ textbooks/advanced) | 14 | 63 | 18% |

> Note: the per-area OK% is computed over the 291 candidates only. Many excluded blocks are intentionally-illustrative fragments (single `def`s, pseudocode, hypothetical APIs) that are never expected to compile standalone.

---

## 2. Method

1. **Extraction** (`extract.py`): regex-extract every `<pre>` block from all HTML files, strip tags, unescape entities, decide Mojo vs Python by language hints + content heuristics. Produced 992 `*.mojo` snippets in `/tmp/opencode/mojo_audit/extracted/` with a `manifest.json` (block index → HTML file + line).
2. **Static analysis** (`analyze.py`): a rule list covering removed syntax (`fn`, `alias`, `let`, `@parameter`, `inout`, `borrowed`, `@value`, `@register_passable`, `DynamicVector`, `match`, f-strings, tuple return types, missing operators, bare stdlib imports) plus INFO/warn rules (`len()` deprecation, `.free()`, `.to_string()`, `read` convention, custom imports). Comment text is stripped before matching. Full output: `/tmp/opencode/mojo_audit/audit_report.txt`.
3. **Compiler verification**: the installed Mojo toolchain `1.2.0.dev2026092105` (nightly, "Mojo 1.x" line — `fn` hard-errors with "use `def` instead"), run via `uv`-managed venv at `/tmp/opencode/mojo_audit/.venv`. 291 blocks considered "complete-looking" (go to the bottom of a `def`/`struct` without dangling `...`, and don't reference obviously-mockup APIs only) were spot-compiled (`mojo build`). Each failure was recorded with the exact compiler error (`spot_compile.txt` → `inventory.json`).
4. Individual fixes were verified to compile when non-obvious (tuple returns + `raises`, `Tuple[A,B]`, bracket list literals, `.copy()`/`^`, t-strings).

**Measurement artifacts** (not site bugs): 12 blocks in `time_series_analytics.html` had the `<span class="lang-label">Mojo 1.x</span>` label captured into the snippet (the HTML label sits inside the `<pre>`); recompiling with the label removed shows the code beneath has the *same* real issues (implicit `List` copies, missing `raises`). These 12 are classified separately below and excluded from the 97.

---

## 3. What's already compliant (good news)

- **Zero legacy-keyword usage.** After comment stripping, no extracted block contains `fn`, `alias`, `let`, `inout`, `@parameter`, `@value`, `@register_passable`, `DynamicVector`, `InlinedFixedVector`, `owned`, `borrowed`, or `__moveinit__`/`__copyinit__` as code. The site's authors already followed the "Mojo 1.1" migration for these.
- **`def`, `comptime`, `std.` prefix culture.** Core chapters consistently use `def main():`, `comptime` (e.g. `advisory.html` `comptime N = 1024`, `comptime LANES = simdwidthof[DType.float64]()`), and `from std.*` imports.
- **`SIMD[DType.float32]` / `DType` usage** in `mojo_v1` is correct per the repo standard.
- **Most of `mojo_v1` compiles AND runs.** 51/75 compiled candidates OK. For instance `mojo_01_intro`, `mojo_02_basics`, `mojo_03_types`, `mojo_13_closures` (15/15 blocks OK) build cleanly.
- **`praxis/progressive` is strong:** 68/79 (86%) compile, including the SIMD and ECEF pieces (their failures are `std.math` member removals, not syntax).

---

## 4. Static findings (what the rules alone catch)

```
blocks scanned: 992 | files: 112 | python blocks excluded: 127
total: 71 ERR, 1 WARN, 182 INFO
```

| Rule | Severity | Count | Files |
|---|---:|---:|---:|
| `len()` deprecation check | INFO | 134 | 48 |
| custom (`non-std`) imports | INFO | 48 | 16 |
| **import-prefix (missing `std.`)** | **ERR** | **47** | **21** |
| **tuple-return-type (`-> (A, B)`)** | **ERR** | **17** | **10** |
| **missing-operator (`if n 1:`)** | **ERR** | **3** | 1 |
| **f-string** | **ERR** | **3** | 3 |
| **match statement** | **ERR** | **1** | 1 |
| `.free()` | WARN | 1 | 1 |

### 4.1 ERR – `import-prefix` (47, in 21 files)

`from math import …`, `from tensor import …`, `from random import …`, `from collections import …`, `from algorithm import …`, `from memory import …`, `from time import …`, `from testing import …`, `from simd import …`, `from gpu import …`, `from sys.intrinsics import …`, `from python import …` — these are **not** stdlib-qualified. In Mojo 1.1 the correct form is `from std.math import …` **where the module exists in the stdlib**; notably:

- `std.tensor`, `std.simd`, `std.gpu` **do not exist** in the modern stdlib — code that does `from tensor import Tensor` or `from simd import …` needs a different home (e.g. MAX's `tensor`/`algorithm` packages, or inline `SIMD`/`Tensor` from the appropriate module). This affects the whole `data_science` advanced track.
- `from math import radians/degrees` → `std.math` has no `radians`/`degrees` (see §5).
- `from python import Python` (karney_krueger_equations.html@1407) → use `from std.python import Python`.

Files with `import-prefix` ERRs (21): `karney_krueger_equations` (6), `ds_ml_textbook_06_building_models` (5), `ds_advanced_10_tensors` (4), `ds_advanced_08_statistics` (3), `ds_advanced_11_training` (3), `ds_ml_textbook_00_cover` (3), `fine_tuning_llms` (3), `data_science` (2), `ds_advanced_00_cover` (2), `ds_advanced_05_vectorized` (2), `ds_advanced_06_zero_copy` (2), `ds_advanced_14_cicd` (2), `ds_ml_textbook_03_data_structures` (2), plus 8 files with one each (`operations_research`, `decision_aware_ml`, `ds_advanced_01_why_mojo`, `ds_advanced_04_data_loading`, `ds_advanced_09_autodiff`, `ds_advanced_13_benchmarking`, `ds_advanced_16_syntax_tour`, `ds_ml_textbook_04_numerical`).

### 4.2 ERR – `tuple-return-type` (17, in 10 files)

`-> (Float64, Float64)` style is invalid modern Mojo. The compiler is explicit:

```
error: expected a type, found a tuple value; use 'Tuple[...]' to write a tuple type
```

Fix: `-> (Float64, Float64)` → `-> Tuple[Float64, Float64]`, and unpack with `var (x, y) = f(...)`. Verified to compile.

Files: `karney_krueger_equations` (5), `drill_25` (3), `ds_ml_textbook_09_syntax_tour` (2), and one each in `operations_research`, `data_science.html`, `ds_advanced_08_statistics`, `ds_advanced_09_autodiff`, `fine_tuning_llms`, `mojo_09_syntax_tour`, `drill_11`.

### 4.3 ERR – `missing-operator` (3, mojo_09_syntax_tour.html @343/386/404)

`if n 1:` / `if n 0:` — no comparison operator. Fix: `if n == 1:` / `if n == 0:`. Compiler fails with `expected ':' after 'if' expression`. Blocks 0202 (l336) and 0204 (l385) confirmed failing; marked also in static at l343/l386/l404 (the 404 instance is inside a block not in the compile set).

### 4.4 ERR – `f-string` (3 files)

`ds_textbook_02_syntax.html@328`, `ds_textbook_08_neural_network.html@370`, `ds_textbook_12_pytorch.html@258`: `f"..."` is a parse error. Fix: t-strings `` `...` `` or `String.format()`. Note the `{:.6f}` format specifier is not supported by `String.format()` in this Mojo — use `Float64` printing with `t`-string interpolation or `str(x)`.

### 4.5 ERR – `match` (1)

`ds_advanced_02_syntax.html@253` `match x:` — Mojo has no `match`/`case`. Replace with `if/elif` chains.

### 4.6 WARN – `.free()` (1, ds_advanced_03_interop.html@236)

`p.free()` deprecated → `dealloc(p^)`.

### 4.7 INFO notes

- **`len-deprec` 134**: overwhelmingly `len()` on `List`/array — still fine in Mojo 1.1. Only 3 appear to operate on `String`/`StringSlice` (mojo_04_functions@307 `len(strs)`, prog_01_moves@350 `len(s)`, ds_textbook_04_ownership@181 `len(s)`); of those, block 0527 (prog_01_moves@350) is a confirmed hard error (*"len(String/StringSlice) is not supported"*) → use `.byte_length()`.
- **`import-custom` 48**: imports such as `from max.algorithm`, `from inference`, `from mypackage` — mostly illustrative/pedagogical; only flagged if actually required to compile (see §5 `env`).

---

## 5. Compiler verification — failure inventory (128 fails)

Broken down into categories. Locations are `file@HTML-line` (the line where the block starts in the page source) plus block index `b####` into the extraction manifest.

### 5A. Extraction artifacts (12) + 1 content issue — not code bugs

| Block | Location |
|---|---|
| b0976–b0986, b0992 | `public/data_science/time_series_analytics.html` @968, 997, 1070, 1141, 1192, 1324, 1402, 1492, 1602, 1711, 1810, 2443 |

The literal heading `Mojo 1.x` (a `<span class="lang-label">` inside the `<pre>`) was captured as code line 1, producing `error: expressions must not appear at file scope`. With the label stripped, the underlying blocks still fail for the *same real reasons* listed below (implicit `List` copies, missing `raises` on `main()`), so these pages are already counted via their root causes where applicable.

Also: **b0493** `drill_03.html@13` — the "Solution" block mixes Mojo code with shell commands (`mojo hello.mojo`, `mojo build … -o hello`, `./hello`) inside one `<pre class="code">`. That is *site content* (not extractor noise): shell commands are not Mojo and will never compile. Recommend splitting into a terminal pane.

### 5B. Environment-dependent (15) — code is fine, host missing the dependency

- **12 × "No module named …" at runtime**: `numpy` (b0237 mojo_11_interop@142, b0714/b0724 data_science@968/1227), `geographiclib` (b0420), `openai` (b0516 drill_26, b0677–b0681/b0683 ai_agents_python_vs_mojo), `transformers` (b0950 fine_tuning_llms@453). These compile and run until `Python.import_module` executes. Not syntax bugs.
- **2 × MAX/project-only modules**: b0188 (`from max import …`, metaprogramming@584), b0904 (`from inference import …`, ds_ml_textbook_08@214) — need MAX/pipeline packages present.
- **1 × `Tensor` unqualified** (b0872 ds_ml_textbook_04@294): needs `from tensor import Tensor`-style root; `std.tensor` does not exist in stdlib.

### 5C. Demo/intentional (2)

b0279 / b0285 (`mojo_12_modules.html@199/@287`): `from mypackage import …` / `from "package-with-hyphens …" import …` are deliberate illustrations of the module system (including the invalid-identifier case). Not bugs.

### 5D. Genuine code issues (97)

Ranked by frequency:

| # | Issue | Blocks | Fix |
|---|---|---|---|
| 14 | **`List` cannot be implicitly copied** | b0388, b0392, b0396, b0398 (gnss_surveying), b0452 (simplex), b0512/b0513 (drill_22/23), b0575 (prog_05), b0722 (data_science), b0725 (decision_aware_ml), b0880 (ml_fundamentals), b0944 (ds_textbook_12), b0969/b0973 (perceptrons) | `return x` → `return x^` (or `.copy()`). Mojo 1.1 dropped implicit copies of non-`ImplicitlyCopyable` values. |
| 12 | **List-vs-`Array` literal mismatch** | b0143 (@mojo_07_ownership l253), b0168, b0472 (future_value), b0474 (npv_amortisation), b0509/b0511 (drill_19/21), b0686/b0710/b0712 (data_science), b0868 (numerical), b0914 (syntax_tour), b0922 (why_mojo) | `[1, 2, 3]` infers `Array[N]`, not `List` — annotate the param as `Array` or build a `List` via `List[Float64]([...])` / `List([...])` (bracket literal). |
| 9 | **`std.math` lacks `radians`/`degrees`** | b0379/b0381/b0383/b0394 (gnss_surveying), b0515 (drill_25), b0653/b0655/b0657/b0659 (prog_12_ecef) | compute inline: `deg * Float64.constants.pi / 180.0` etc. (the whole geomatics track needs this). |
| 8 | **Constructor signature changed** | b0235 (mojo_10_errors Random), b0416 (karney_krueger), b0440 (operations_research), b0505 (drill_15), b0577 (prog_05), b0690/b0708 (data_science `Random(7)`, `List[Int](0,1)`), b0813 (advanced_16 `List[Int](0,1)`) | modern `Random(seed)` / variadic `List[T](...)` ctors no longer exist — use `Random(Int(7))` as appropriate and bracket-list literals. |
| 8 | **Unknown identifier / typo** | b0217/b0231 (mojo_10_errors), b0424 (karney `s`), b0489 (annuity_codex), b0506 (drill_16), b0720 (data_science `loss`, `Python.slice`) | reviewer pass per block; mostly downstream of tuple-return unpacking or stale names. |
| 6 | **Raising call in non-raising `def`** | b0213 (mojo_101 @1516), b0503 (drill_13), b0700 (data_science), b0955/b0959/b0967 (linear_regression_detailed) | `Python.import_module(...)`, `String.format`, `atol`, `Float64(dict[i])` raise → mark the function `raises`. |
| 5 | **FFI/Python type not imported** | b0269/b0274 (mojo_11_interop `c_int`, `c_size_t`, `OwnedDLHandle`, `external_call`), b0518 (drill_28), b0682/b0684 (ai_agents `PythonObject`) | `from std.ffi import c_int, c_size_t, external_call, OwnedDLHandle` and `from std.python import PythonObject`. |
| 5 | **`x.size` / `x.len()` on `List` invalid** | b0698/b0702/b0704/b0706 (data_science), b0810 (advanced_16) | use `len(x)`. |
| 6 | **Tuple return type `-> (A, B)`** | b0194/b0200 (mojo_09_syntax_tour l139/270), b0501 (drill_11), b0716 (data_science), b0910/b0916 (ds_ml_textbook_09 l139/275) | `-> Tuple[A, B]` (see §4.2). |
| 3 | **`//` used as a comment (parse error)** | b0826/b0830/b0833 (ds_ml_textbook_00_cover l1199/1291/1436) | `//` is floor-division, not a comment. Use `#`. |
| 2 | **`if n 1:` missing operator** | b0202/b0204 (mojo_09_syntax_tour l336/385) | `if n == 1:` |
| 2 | **Array literal in comptime context** | b0190 (metaprogramming@613), b0500 (drill_10) | `Array[...]` can't be a comptime value — use comptime-friendly containers. |
| 2 | **Assignment through immutable reference** | b0525/b0529 (prog_01_moves l321/380) | make target mutable or copy. |
| 2 | **SIMD width not power-of-two (3 lanes)** | b0583/b0587 (prog_06_simd l289/335) | use 2/4/8/16 lanes. |
| 2 | **MLIR op attribute escapes** | b0819/b0822 (ds_advanced_17_mlir l248/317) | `#index<cmp_predicate slt>` style attrs need the modern `<>` form / quoting. |
| 2 | **`range()` Int64-vs-Int mismatch** | b0918/b0920 (ds_ml_textbook_09 l349/398) | `range(2, n)` with `Int64` → use `Int` or untyped. |

Singles (1 each):

| Issue | Block |
|---|---|
| unqualified struct param `T` → `Self.T` | b0005 (`advisory.html@382`) — inside the flagship "Mojo 1.1 advisory" page |
| transfer out of imm reference (`create_immovable_object`, `out` param) | b0077 (`mojo_04_functions@438`) |
| `Complex` lacks `Boolable` in modern stdlib | b0125 (`mojo_06_structs@501`) |
| reference-return origin mismatch (`ref self` + `var`? binding) | b0154 (`mojo_07_ownership@471`) |
| `//` comment inside parameter list | b0164 (`mojo_08_metaprogramming@208`) |
| member-method closure needs `()` / capturing form removed | b0267 (`mojo_11_interop@726`) |
| `Error` struct `.field`/`.reason` removed | b0502 (`drill_12`) |
| `len(String)` removed → `.byte_length()` | b0527 (`prog_01_moves@350`) |
| old string-LLVM extern syntax (`"libc_math".add`, body in quotes) | b0745 (`ds_advanced_03_interop@222`) |
| `float` used as type (Python habit) | b0809 (`ds_advanced_16_syntax_tour@192`) |
| `raise` outside raising context | b0811 (`ds_advanced_16_syntax_tour@284`) |

One more block (**b0366** `mojo_14_literals@646`) is a module-scope `with open(...)` fragment — the `with` block must live inside a function; classified as a fragment rather than a code issue.

---

## 6. What to fix first (impact-weighted)

1. **`data_science/` advanced track** — 63 of 77 compiled candidates fail. Root causes are mechanical and cheap to fix: prefix imports (`std.`), `Tuple[A, B]` returns, `^` on returned `List`s, `raises` on interop `def main()`, `len()`/`.size`, `//`→`#`. A bulk pass would lift this area from 18% to ~90%.
2. **Geomatics** (`gnss_surveying`, `karney_krueger_equations`) — `radians/degrees` helpers + `List` copy discipline + tuple returns bring the track to green.
3. **Drill pages** (`praxis/drill_*`) — clusters of the same three mechanical errors (`Tuple`, `List` copies, `Random` ctor).
4. **Core `mojo_v1` spots** — advisory (Self.T), mojo_04/06/07/08/09 (10 blocks) — these are the *teaching* pages, so they carry the most pedagogical weight.
5. **Environment note in the docs** — add a "these demos need numpy / openai / transformers / geographiclib / MAX installed" call-out so the 15 env-dependent blocks are not mistaken for bugs.

Reproducible artifacts (scripts, manifests, full failure text, and the per-block `inventory.json`) are in `/tmp/opencode/mojo_audit/`.

---

## 7. Compiler details

- `mojo 1.2.0.dev2026092105` (nightly, the "Mojo 1.x" line matching the repo's standard). Verified behaviors: `fn`→"use `def`", `alias`→"use `comptime`", `match`/`case` unsupported, f-strings unsupported, `read` convention→`imm`, bare `from math/collections/tensor/python`→"unable to locate module", `(A, B)` types→`Tuple`, `//` is floor-division not comment, `[1,2,3]` infers `Array[Int,3]`, `List` not `ImplicitlyCopyable`, `Random(7)` ctor changed, FFI types now need `from std.ffi import`, no `std.math.radians/degrees`, `len(String)` hard error.