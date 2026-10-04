# Implementation Plan — "Writing Mojo Libraries" (Mojo 1.x)

Rebuild `mojo_libs.html` as **one** well-organised, self-contained HTML tutorial on
building production Mojo **1.x** libraries, covering the seven required domains.

## Facts locked in by verification (not assumed)

Every claim below was checked against `single_source_of_truth mojo/` (Mojo v1 manual, 38 pages):

| Claim | Evidence |
|---|---|
| `def` is the only function keyword; `fn` does not exist | grep `\bfn\s+\w+` across `pages/` → **0 hits** |
| `let` / `alias` do not exist | use `var` (mutable), `comptime` (compile-time) — p30 L94-97 |
| Argument conventions are **default / `mut` / `var` / `ref` / `out` / `deinit`** | p20 L84-120 |
| `borrowed` / `inout` are **not** conventions | grep → **0 hits**; `owned` appears only in prose about ownership semantics |
| Standard library is `std.`-prefixed | p34 L181-184 (`algorithm/__init__.mojo`) |
| `List` has no `.size`; use `len()` | p11 L267 (`std/builtin/range`) |
| No implicit numeric widening — cast explicitly | p38 L95-96 "Sharp edges" |
| Package = directory + `__init__.mojo`; re-export via `from .mod import X` | p34 L100-171 |
| CLI is `mojo build` / `mojo run` / `mojo precompile <pkg> -o <n>.mojoc` / `mojo doc` / `mojo build --emit shared-lib` | 23 grep hits; **0** for `mojo test`, `mojo init`, `mojo package`, `magic` |
| Tests run via `mojo run test.mojo` + `std.testing` | p35 L136; p04 L428-436 |
| `assert_raises` is a **context manager** | p12 L769 (listed among std context managers) |
| Typable errors need `Writable` + `write_to` | p12 L218-225 |
| Packaging = `conda.recipe/recipe.yaml`, output to `$PREFIX/lib/mojo/` | p35 L92-191 |

**No Mojo toolchain is installed on this machine.** Therefore: no invented std APIs,
no "verified output" claims, and an explicit honesty note in the document.

## Problems in the base file being fixed

1. **Four documents concatenated inside one `<main>`** — "Part 2" appears twice; 7,077 lines of narrative duplication. → one document, one narrative.
2. **~75% of code samples lose all highlighting with JS off** (runtime tokenizer + `data-painted="hand"` escape hatch). → highlighting done at **build time**.
3. **Stale syntax in prose**: `borrowed`, `inout self`, `fn(Float64) -> Float64` in a live API table (line 3720) — contradicts the page's own rules.
4. **Bug at line 2699**: `lp.mojo</xo` corrupts a directory tree.
5. **Empty section** at 1618-1621; numbering jumps 1 → 3.
6. **Three webfonts named, never loaded** (no `@font-face`, no `<link>`) — silent fallback.
7. `.filehost` / `.filebox` used but have **zero CSS rules**.
8. No light theme; no sidebar; TOC integrity was the only healthy part (kept).

## Architecture

The deliverable stays a **single self-contained HTML file**, but is now *generated* from
real sources, so the code in the tutorial is literally the code that would compile.

```
tutorial/
  libs/                     # real Mojo packages — 8 packages, ~31 modules + tests + examples
    mojo_core/              # 0 · shared kernel
    geomatics/ mstats/ mopt/ mfin/ mdat/ mmath/ mphysics/
  src/
    highlight.py            # build-time tokenizer: mojo, bash, toml, yaml, text
    render.py               # assembles content + code figures -> one HTML file
  content/
    00-front.html  01-intro.html  02-model.html  03-syntax.html
    04-anatomy.html  05-api.html  06-workflow.html
    07-lib-geomatics.html ... 13-lib-physics.html
    14-interop.html  15-packaging.html  16-advanced.html
    17-principles.html 18-exercises.html 19-backmatter.html
  build.py                  # one command
mojo_libs.html              # OUTPUT (rewritten; original preserved as mojo_libs.legacy.html)
```

- `{{code:libs/mstats/descriptive.mojo}}` → figure with filename, language badge,
  line numbers, copy button, build-time highlighting.
- `{{lib:libs/mstats}}` → auto-generated package-layout tree from the real directory.

## Document structure

1. Introduction — what a library is in Mojo 1.x, library design
2. The three-layer model — application → package → module
3. The conventions we build on — argument conventions, comptime, traits, error contract
4. Anatomy of a Mojo package — layout, `__init__.mojo`, re-export strategy, naming
5. Designing the public API — facade pattern, generics, `Some[Trait]`, typed errors
6. Build, run, test workflow — `mojo build/run/precompile/doc`
7. **The seven libraries** — motivation, layout, API table, full source, runnable app, output, tests
   1. `geomatics` · 2. `mstats` · 3. `mopt` · 4. `mfin` · 5. `mdat` · 6. `mmath` · 7. `mphysics`
8. Python interop — exposing a library to Python
9. Packaging & publishing — `recipe.yaml`, `$PREFIX/lib/mojo/`
10. Advanced patterns — comptime metaprogramming, traits, context managers
11. Professor's rules of thumb · Exercises · Where to go next

## Phases

| Phase | Work | Done when |
|---|---|---|
| **P0** | Scaffold `tutorial/src`, build-time highlighter, renderer, theme; smoke-test | generator emits a valid single-file page |
| **P1** | `mojo_core` kernel — sets code conventions for everything after | 3 modules render highlighted |
| **P2** | The 7 domain libraries + tests + examples | ~31 modules, all in 1.x syntax |
| **P3** | Content: intro → the 7 library chapters | every `{{code}}` resolves |
| **P4** | Shell/JS polish — sticky header, scroll-spy TOC, theme toggle, copy, progress | |
| **P5** | Verify: forbidden-syntax lint, anchor integrity, no-JS rendering, self-containment | checks pass |

## Guard rails (enforced by P5 lint)
## No references to old or deleted files

Refuse to ship if any of these appear: `fn <name>`, `.size`, `alias X =`,
`let x =`, `borrowed `/`inout `/`owned ` as an argument convention,
`mojo test`/`mojo init`/`mojo package`/`magic mojo`, `mojoproject`, `MOJO_PATH`,
`--mojopkg`, external `src=`/`href=` to a remote URL in the doc.