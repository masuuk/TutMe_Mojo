# Mojo 1.1 Syntax Compliance Audit — Embedded HTML Code

**Date:** 2026-09-21
**Scope:** All Mojo code embedded in the static-site HTML files under `public/`
**Method:** Extraction of every Mojo-labelled code block (`class="mojo"`, `class="ide mojo"`, `class="code mojo"`, `<pre class="code-block" id="mojo…">`, `data-lang="mojo"` panes, plus the plain-`<pre>` Mojo-tutorial pages) → **671 blocks across 110 files** → static pattern audit against the project's own *Mojo Language Blue Print* (v1.1.0) and the official Mojo 1.1 manual. No local `mojo` compiler is installed, so this is a static audit; suspected-functionality items are marked "verify".

---

## Verdict

The claim in `structure.md` that the site "targets the Mojo 1.1 standard" is **partly true**. The `mojo_v1/` textbook chapters, the `praxis/` drills and `progressive/` exercises are predominantly modern Mojo: **zero occurrences** of `fn`, `alias`, `@parameter`, `let`, `inout`, `owned`, `@value`, or `@register_passable`; `comptime`, `std.*` imports, `out self`, `def`, `mut`/`var` argument conventions, t-strings, unified closure captures, and lambdas are used correctly.

However, several page generations contain code that **does not compile under Mojo 1.1** — most heavily the `ds_advanced_*` series (16 files), plus scattered real errors in the flagship `mojo_v1` chapters (`mojo_03`, `mojo_08`, `mojo_09`, `advisory`).

---

## A. Hard parse / compile errors (will not compile)

### A1. `//` used as a comment — invalid (Mojo uses `#`)
`//` is the floor-division operator in Mojo; a leading or trailing `// text` is a parse error.

- **137 leading `//` comment lines**, per file:
  - `ds_advanced_15_future` — 22
  - `ds_advanced_12_inference` — 20
  - `ds_advanced_13_benchmarking` — 18
  - `ds_advanced_10_tensors` — 15
  - `ds_ml_textbook_00_cover` — 13
  - `ds_advanced_11_training` — 12
  - `ds_advanced_09_autodiff` — 12
  - `ds_advanced_14_cicd` — 9
  - `ds_advanced_07_linear_algebra` — 8
  - `ds_advanced_08_statistics` — 6
  - `ds_advanced_00_cover` — 2
- **Trailing `//` comments** (e.g. `return e @ self.W_v(a)  // alloc 6`, `print(output.shape)  // [1,512,1024]`, `print(b)  // [2.0, 4.0, 6.0]`) — ~30 instances in the same files.
- `mojo_v1/mojo_08_metaprogramming.html` B3 — 2 further instances (`MsgType: Writable,  // trait constraint...`).

*(All other `//` hits across the site — `n // LANES`, `K // 2`, `tm // 60`, `(K + TILE - 1) // TILE` — are valid floor division.)*

### A2. f-strings `f"..."` — invalid (Mojo interpolates with t-strings `t"..."` or `print(a, b)` args)
~22 genuine occurrences across 9 files:
- `ds_textbook_02` B8 — `return f"{self.name} the {self.breed}"`
- `ds_textbook_03` B2 — `print(f"Weight type: {typeof(weight)}")`
- `ds_textbook_06` B2 — `print(f"Python error: {e}")`
- `ds_textbook_07` B2 / B4 / B8 — `print(f"Loaded {len(data['temperature'])} rows")`, `f"Result: {result}"`, `f"Batch: {bx}, Labels: {by}"`
- `ds_textbook_09` B2 — `print(f"dW = {dw}, db = {db}")`; B5 — `f"Float32({val})"`, `f"Int32({val})"`, `f"Unknown({val})"`
- `ds_textbook_11` B8 — `f"Median: …"`, `f"Mean: …"`, `f"Stddev: …"`
- `ds_textbook_12` B2 / B4 / B6 / B8 — 4+ occurrences
- `ds_textbook_13` B2 — `print(f"Processed {len(results)} records")`
- `ds_advanced_14` B4 — `msg=f"Class {label} underrepresented at {pct:.1%}")`

### A3. Missing comparison operators
`mojo_v1/mojo_09_syntax_tour.html` — B1 `if discriminant 0.0:`, B5 `if n 1:`, B6 `if n 0:` (all should be e.g. `if discriminant > 0.0:`).

### A4. `class` used instead of `struct`
`ds_advanced_14_cicd.html` — B1 `class AttentionTest(TestCase):`, B2 `class AttentionPerfTest(PerformanceTest):`, B4 `class DataValidationTest(DataTest):`. Mojo declares types with `struct`.

### A5. Undefined identifiers / wrong types (`mojo_v1` chapters)
- `mojo_03_types.html` B1 — `var inf = FloatLiteral.infinity` and `var nan = FloatLiteral.nan`. `FloatLiteral` (the literal type) has no `infinity`/`nan` member; these must be `Float64.infinity` / `Float64.nan`.
- `advisory.html` B8 — `var bd = inf` (`inf` is not defined; use `Float64.infinity`).
- `advisory.html` B10 — `fill=FloatLiteral.infinity` (same fix).

### A6. Anonymous `def():` in expression position
`ds_advanced_14` B2 — `self.benchmark(def(): attn.forward(x), …)` is not valid Mojo (anonymous functions are lambdas). Pseudo-code.

---

## B. Imports

### B1. Stdlib imports missing the `std.` prefix (≈24 genuine)
All of these resolve to nothing under Mojo 1.1 (stdlib lives under `std.`):
- `from math import …` → `from std.math import …` — `karney_krueger_equations` B3/B4/B5/B6/B9; `ds_advanced_05` B1; `ds_advanced_08` B1, B3; `ds_advanced_09` B3
- `from python import Python` → `from std.python import …` — `karney_krueger_equations` B12; `ds_advanced_03` B2
- `from collections import Dict` → `from std.collections import …` — `ds_advanced_04` B2
- `from sys.io import FileHandle` → `from std.sys.io import …` — `ds_advanced_04` B2
- `from memory import …` → `from std.memory import …` — `ds_advanced_06` B1 (`Arena`), `ds_advanced_13` B3 (`ArenaAllocator, arena_scope` — API also needs verification)
- `from random import …` → `from std.random import …` — `ds_advanced_08` B1; `ds_textbook_11` B8
- `from algorithm import ParallelFor` → `from std.algorithms import …` (and `ParallelFor` itself is legacy; use `parallelize`) — `ds_advanced_00` B1
- `from time import now` → `from std.time import …` — `ds_advanced_11` B4
- `from testing import …` → `from std.testing import …` (names used also need verification) — `ds_advanced_14` B1/B2/B4
- `from benchmark import …` → `from std.benchmark import …` — `ds_textbook_11` B8
- `import sys` → `from std.sys import …` — `ds_textbook_07` B2/B4/B8

*(`import math` in `praxis/drill_14` is **valid** — the block explicitly defines a local `math.mojo` package and uses it as `math.square(9)`.)*

### B2. `from std.gpu import …` — private module
`std.gpu` is internal; kernels/host APIs moved to `max.gpu`. Change `from std.gpu import thread_idx, block_idx, block_dim` to `from max.gpu import …`:
- `ds_textbook_10_gpu` B2, B5
- `ds_ml_textbook_08` B1

### B3. `from tensor import Tensor` — removed from the stdlib
The `tensor` module was removed from the Mojo stdlib (data structures live in `std.…`; ML tensors in `MAX` under `max.tensor`). **25 bare imports** plus **≈191 uses of bare `Tensor[…]`** (often with no import at all). Affected: `data_science.html` B4/B6, `decision_aware_ml` B3/B7, `operations_research` B3, `ds_ml_textbook_00/03/04/06`, `ds_advanced_01/06/10/11` etc., `ds_textbook_05` B2, `fine_tuning_llms`, and `mojo_v1/advisory` (unimported `Tensor[Float64]`).

### B4. Fictional modules (pseudo-code, not resolvable)
- `ds_advanced_11` B3 — `from precision import amp, autocast`
- `ds_advanced_14` B4 — `from data import Dataset`

---

## C. Removed / legacy APIs

### C1. `List[T](a, b, c, …)` positional variadic constructor (14 sites)
The variadic positional `List` constructor is gone; use bracket literals `[a, b, c]`.
- `data_science.html` B10 (`List[Float64](50.0, 52.0, …)`), B11 (`List[Int](1,2,3,4,5,6,7)`, `38,55,…`), B16 (6 confusion-matrix literals), B19 (`List[Float64](2.0, 0.5, 0.1, -0.3)`)
- `decision_aware_ml` B5 — `List[Float64](n, 0.0)`
- `ds_advanced_16` B2 (`List[Float64](1000.0, 2000.0, 3000.0, 4000.0)`), B5 (`List[Int](0, 1)`)
- `praxis/drill_22` B1 — `List[Point](Point(0.0,0.0), Point(3.0,4.0), Point(-1.0,2.0))`
- `verify:` single positional `List[Float64](n)` in `decision_aware_ml` B5 — no single-positional length ctor; use `List[Float64](length=n)`.

*(`List[T](capacity=…)` and `List[T](length=…, fill=…)` used elsewhere — e.g. `operations_research` B4, `mojo_08` B18, `mojo_12`, `advisory` — are **valid** keyword-arg constructors.)*

### C2. `SIMD[float32, …]` legacy dtype names (9 sites)
Use `SIMD[DType.float32, N]` (or contextual `.float32`). All in `ds_textbook_09_autodiff.html` B3 and B5 (`SIMD[float32, N]`, `SIMD[float64, N]`).

### C3. Legacy pointer operations — `ds_advanced_03_interop` B3
- `var buf = Pointer[Int32].alloc(5)` → prefer `alloc(Layout[Int32](count=5))`
- `buf.free()` → `dealloc(allocation^)`
- The 0.x extern-function body syntax `def c_add(…) -> Int32\n "libc_math".add` → use `@extern` / `std.ffi.external_call` (see the correct modern pattern in `mojo_11_interop` B10).

### C4. SIMD `.max()` / `.min()` methods (3 sites) — verify against free functions
- `ds_advanced_05` B1 — `data.simd_store[16](i, vals.max(zero))`
- `ds_advanced_10` B3 — `v.max(zero)`
- `ds_textbook_04` B7 — `t /= t.max()` (legacy Tensor method)
Prefer the free functions `max(a, b)` / `min(a, b)` from `std.math`.

### C5. `@differentiable` (ds_textbook_09 B3) — verify
Standard-scope availability of the autodiff decorator should be confirmed (it lives in its own module/pass); the block also uses `SIMD[float32, N]` (see C2).

### C6. Legacy parametric-closure style (valid but not 1.1-idiomatic)
`data_science.html` B3 — `def num_diff[f: def(Float64) -> Float64](x: Float64, …)`. Compiles (thin/non-capturing function parameter), but the 1.1 style is to pass the closure as a runtime first argument: `def num_diff(f: def(Float64) -> Float64, x: Float64, …)`.

---

## D. Missing `raises` (semantic; needs compiler confirmation)

- `ds_textbook_13` B2 — `def process_batch(path: String) -> List[Record]:` calls `read_file(path)` and `json.loads(content)` (both raising) without `raises`; `read_file`/`json` are also never imported.
- `ds_textbook_07` B2 — `def load_csv(path: String) -> Dict[…]` calls `open(path, "r")` + `readline()` without `raises`.
- Several `data_science`/`applications` `def main():` blocks call raising I/O without declaring `raises` (verify per site once the compiler is available).

---

## E. Comment / documentation inaccuracies (in-code comments, not syntax)

- `ds_textbook_03` B8 — comment states Mojo synthesizes `__init__(out self, *, take: Self)` for `Movable`; the actual 1.1 spelling is `__init__(out self, *, deinit move: Self)`.
- `ds_textbook_04` B8 — `data[...]` is shown **intentionally** as a compile-error illustration (fine).

---

## F. False alarms checked and cleared (not violations)

These were audited and ruled valid so future checks don't chase them:
- `**` exponentiation — valid Mojo operator (`print(2 ** 8)`)
- `raise "message"` shorthand — valid (compiler wraps it in `Error`), as long as the function still declares `raises`
- `lambda` — **supported in Mojo 1.0/1.1** (e.g. `drill_15`'s `lambda (a: Int) -> Int: a * a` and the thin-lambda comptime argument `apply_thin[lambda () -> Int: 42]()` match the official syntax)
- `with …:` context-manager statements — valid statement form in 1.1 (the fictional `with autocast(...)`, `with arena_scope():` only fail because the modules are fictional — see B4)
- `//` when used as floor division
- `comptime assert` inside a function body (`mojo_08` B9)
- `import math` for a local `math.mojo` package (`drill_14`)
- `ref x = …` bindings; `mut`/`var` argument conventions; `= length`/`fill`/`capacity` List keyword constructors
- Text mentions of `owned`, `__copyinit__`/`__moveinit__`, `borrowed` in comments only (no syntactic use)
- Bilingual tabs: Python snippets sit in `data-lang="python"` panes and are correctly labelled
- `Float64.infinity` / `-Float64.infinity`, `simd_load[8](i)`, `simd_store`, `external_call["…", …]`, `String(unsafe_from_utf8_ptr=…)`, `t"…"` string literals (`mojo_11` B10 is exemplary)

---

## G. Per-directory summary

| Area | Blocks | Status |
|---|---|---|
| `mojo_v1/` chapters + 101 + books | ~120 | **Mostly compliant**; real errors in `mojo_03` B1, `mojo_08` B3, `mojo_09` B1/B5/B6, `advisory` B8/B10 |
| `praxis/drills` + `progressive/` | ~90 | **Compliant** except `drill_22` B1 (variadic `List`) |
| `data_science/` standalone pages | ~60 | Mixed: f-strings, variadic `List`, `Tensor`, `import sys` in `data_science.html`, `ds_textbook_02/03/06/07/09/11/12/13`; `std.gpu`→`max.gpu` in `ds_textbook_10` |
| `data_science/ds_advanced_*` (16 files) | ~110 | **Worst offenders**: `//` comments (~160), `class` instead of `struct`, missing `std.` prefixes, fictional modules, removed `tensor` module, legacy pointers |
| `data_science/ds_ml_textbook_*` | ~70 | `//` comments (`00_cover`), `tensor` imports, `std.gpu` |
| `applications/` | ~40 | `karney_krueger_equations` (6 no-`std` imports), `operations_research` (`from tensor import`); others clean |

---

## Recommended next step

Install the Mojo toolchain (`pixi`/`uv` + `max` per `new-modular-project`/`serve-model` skills) and compile the extracted blocks (`/tmp/opencode/extracted3/*.txt`) block-by-block for compiler-confirmed results — in particular to confirm the missing-`raises` items (D) and the `@differentiable`/`ArenaAllocator`/`testing` API availability (C5, B1).