# Implementation Plan — four standalone Mojo tutorial apps

**Status:** Phase 0 complete. Data Science Mojo drafted (10 modules) but **not yet clean** —
one uncaught exception in `app.js` blocks lab mounting past module 03 and prevents maths
rendering. See §10 build log.
**Scope:** 4 new self-contained interactive HTML apps in the TutMe🔥 corpus
**Repo:** `C:\Users\user\Desktop\tu1` (branch `master`, HEAD `a6c4218`)

---

## 1. Goal

Ship four independent, offline-first tutorial apps — **Geomatics Mojo**,
**Operations Research Mojo**, **Finance Mojo** and **Data Science Mojo** — that sit
alongside the existing static books but are *apps*: navigable curricula with live,
input-driven widgets, self-checking quizzes and progress that persists.

### Non-goals

- No rewrite or relocation of the 137 existing pages.
- No change to the Mojo language position: the corpus is **Mojo 1.x** and the apps
  must match it exactly.
- No backend, no build step required to *view* the apps. Once committed, each file
  opens and works from `file://`.

---

## 2. What already exists (the ground truth I am building on)

| Thing | Location | Relevance |
|---|---|---|
| Shared theme + class vocabulary | `public/styles.css` | Reuse the design language; do **not** link it (§4) |
| Site search overlay | `public/index.html` + `public/search.js` | Apps must be added to `window.TUTME_SEARCH_INDEX` |
| Runtime Mojo highlighter | `public/mojo-hl.js` | Not used by the apps; apps ship **baked** spans |
| Quiz interaction | `public/praxis/praxis.js` | The check/reset idiom the apps mirror |
| KaTeX (JS + base64 CSS fonts) inlined | `public/applications/geomatics/karney_krueger_equations.html` (~527 KB, 9 `@font-face` base64 blobs) | Vendored once, copied into each app folder (§6a) |
| Structural gate | `library/tools/verify_page.js` | Must exit 0 |
| Highlight gate | `library/tools/hl_audit.js` | Must report 0 flat blocks — **modified, see §8.1** |
| Language gate | `library/tools/lang_dump.js`, `library/tools/py_census.js` | No block may classify as Python |
| Live-page gate | `library/tools/hl_probe.js` (Chrome-based) | Pattern reused for the new `smoke.js` gate (§8.2) |
| Landing stats generator | `library/tools/build/landing_stats.js` | Rewrites `public/index.html` counts |
| Mojo correctness baseline | `Mojo_1_1_Compliance_Report.md`, `mojo_1_1_audit_report.md` | Read before writing any listing |

Environment verified: **bun** at `~/.bun/bin/bun.exe`, **Chrome** at
`C:\Program Files\Google\Chrome\Application\chrome.exe` (so `hl_audit.js`,
`py_census.js` and `smoke.js` can run). **`mojo` is not installed** — see Risk R1.

---

## 3. Non-negotiable house rules the apps must satisfy

These are enforced by the existing tooling. Any one of them failing is a build break.

1. **Zero Python code blocks.** `py_census.js` must report `python = 0` for all four
   apps. Every listing is Mojo 1.x. Comparisons to Python live in prose, in
   `<pre class="out">` output panels, or not at all. No `data-lang="python"`, no
   `data-target="python*"`, no `<pre class="py">`.
2. **No `id` on any `<pre>`.** `verify_page.js` treats `<pre id="...">` as a *pane*
   and then demands a matching `data-target` tab. The apps use **no code tab bars at
   all** (rule 1 makes them pointless), so any `id` on a `<pre>` is an automatic FAIL.
3. **Balanced tags**: `div`, `section`, `pre`, `code`, `span` must each be balanced.
4. **Every `href="#frag"` must resolve** to an existing element `id` on the same page.
5. **UTF-8, no BOM, no U+FFFD, single EOL convention.** New files: **LF**, written as
   real UTF-8 (proper `·`, `—`, `→`). Note several existing pages carry mojibake; do
   not copy that.
6. **Every code block must be highlighted at rest.** `hl_audit.js` renders in Chrome and
   flags any `<pre>` whose tokens all compute to the base text colour. The HTML ships
   pre-baked `<span>`s — a runtime highlighter is not enough, and the apps do not load
   `mojo-hl.js` at all.
7. **Highlight vocabulary must match CSS that actually exists in that app.** The
   reference `styles.css` paints `tok-kw tok-fn tok-num tok-str tok-com tok-dec
   tok-type`. Each app's own `app.css` defines exactly that set **plus** `.tok-op` and
   `.tok-var`, and every listing uses it. `hl_audit.js` measures computed colours, so a
   class with no matching rule is a flat block — the two extra rules are what keep the
   operator and `var` tokens alive.
8. **Approved interop idiom only:**
   ```mojo
   from std.python import Python
   var np = Python.import_module("numpy")
   ```
   Never an invented API, never a `subprocess`, never an FFI shim.
9. **Output panels are `<pre class="out">`.** `classify.js` reads `out`/`terminal`/
   `result` as `STRONG_OUT`, so those blocks are never mistaken for source. Anything
   that is a printed result, a table, or a diagram goes in one.
10. **No CDN, no runtime fetch, no outside path.** Relative paths only, and every one of
    them resolves **inside the app's own folder**, except the single `../index.html`
    back to the shelf hub. Fonts come from the system stack; maths comes from the bundle
    vendored into that folder.
11. **No uncaught exception on load.** A throw anywhere in `app.js` silently kills
    everything after it, which is how the current draft lost 7 of 10 labs and all maths
    rendering while the structural gates still passed. This is what gate 5 (§8) exists
    to catch.

---

## 4. File layout

Each app is a **self-contained folder**. Nothing is shared with the other apps, and
nothing outside the folder is required to run it.

```
public/
├── data_science/
│   └── data_science_mojo/
│       ├── index.html          the app
│       ├── app.css             its own theme + shell + widgets
│       ├── app.js              its own behaviour + widget code
│       └── vendor/katex/       its own math bundle (see §6a)
└── applications/
    ├── finance/finance_mojo/           index.html  app.css  app.js  vendor/katex/
    ├── geomatics/geomatics_mojo/       index.html  app.css  app.js  vendor/katex/
    └── operations_research/operations_research_mojo/
                                        index.html  app.css  app.js  vendor/katex/
```

### Placement and independence — settled

Each app lives in **its own folder inside its own shelf**, and that folder is complete.
The app is the primary button on its shelf hub; the existing books become the reference
row beside it.

"Independent" is taken literally and it has teeth:

- **No shared app shell.** There is no global `public/apps.css` and no
  `public/apps.js`. Each app ships its own. The four shells start from the same design
  but are separate files, and an app can be edited, restyled or broken without touching
  another.
- **No dependency on `../styles.css`.** Each app's `app.css` reproduces the TutMe theme
  tokens it needs, so the folder is portable — copy it anywhere and it still looks and
  works. (It also means the app keeps its look if the site theme changes, which is the
  right call for something meant to stand on its own.)
- **No dependency on `praxis.js`, `mojo-hl.js`, `search.js` or any other site script.**
- **Its own vendored math bundle**, inside the app's own folder.
- **Consequence, stated plainly:** the shell and the math bundle are now duplicated four
  times — roughly 4 × 465 KB of vendored maths. That is the price of independence, and
  it is the right trade for four apps meant to be independently shippable. Phase 0
  vendors one copy and copies it into each folder, so the duplication is mechanical, not
  four hand-maintained copies.
- **Still inside the site.** Independence is about the folder's contents, not about
  opting out of the corpus: the apps are linked from their shelf hubs and the landing
  page, appear in `search.js`, and are counted by `landing_stats.js`. They obey every
  house gate (§3).

---

## 5. The app contract

Every one of the four apps is structurally identical. A learner who learns one has
learned the shell.

**Shell**

- Fixed top bar: brand → app name → module count → progress readout → shelf link.
- Left sidebar (sticky, toggled under 1000 px): numbered module list built *by JS from
  the `section.module` elements*, with per-module completion ticks and a scroll-spy.
- Reading progress bar pinned to the very top of the viewport.
- `<main>` of `<section class="module" id="m01" data-title="…">` blocks, each with an
  `<h2>`, a `.dek`, then a fixed sequence of the part types below.
- Footer per module: prev/next buttons; a page footer with a reset-progress link.

**Part types**

| Part | Markup | Purpose |
|---|---|---|
| prose | `<p>` / `<ul>` / `<table class="cheat">` | Explanation, formula tables, pitfalls |
| `.eq` | `<div class="eq">` + `$$…$$` | KaTeX display maths; degrades to raw LaTeX |
| `.listing` | `<figure class="listing">` + `<figcaption>` + `<pre class="code">` | Baked-highlight Mojo, with a copy button |
| output | `<pre class="out">` sibling of a `.listing` | What the program prints |
| `.lab` | `<section class="lab" data-lab="…">` | The live widget — inputs, canvas plot, live readouts |
| `.check` | `.check[data-answer][data-q]` | One multiple-choice comprehension check + explanation |
| `.callout` | `.info` / `.warn` / `.perf` | "In practice", "Gotcha", "Performance note" |
| pager | `.pager` + `.navbtn[data-goto]` | Module chaining |

**Widgets must be honest.** Every `.lab` implements the *same algorithm as the adjacent
Mojo listing*, in JS, and the numbers it prints are the numbers the Mojo prints. A
widget that is a toy approximation is worse than no widget.

**Lab contract.** A lab is a key in the `LAB` registry in `app.js` plus a bare
`<section data-lab="key">` in the HTML. The shell builds the controls, reads them, calls
`compute(values)`, and paints `plot(ctx, w, h, result)` and `readouts(result)`. Adding a
module is therefore mostly an HTML edit. Labs must be **deterministic** — they use a
seeded xorshift RNG, not `Math.random`, so a given input always yields the same picture.

**State.** `localStorage['tutmemo-<key>-mojo-v1']` holds `{done, cur, attempts}`.
All access goes through one guarded helper that no-ops when storage is blocked, so the app
stays fully usable and merely forgets.

---

## 6. Build approach — these are all HTML

The deliverable is **HTML**: four real, hand-written apps, each a self-contained folder
under its own shelf, opened directly in a browser. No generator, no framework, no build
step.

**Withdrawn:** the earlier `library/tools/build/apps/` generator plan, and the shared
`public/apps.css` / `public/apps.js` that briefly replaced it. Content and markup are
authored straight into each app's own files.

**One-off tooling step only (Phase 0):** extract KaTeX out of the page that already
inlines it, then copy that bundle into each app folder. That copy is mechanical and
happens once; nothing regenerates the apps afterwards.

Authoring rules:

- Each app's `app.css` carries the theme tokens, the shell, the listing/lab/check styles
  and its own scoped widget visuals. Each app's `app.js` carries the TOC, scroll-spy,
  quiz, progress store and its widget code.
- The four shells begin from one shared design, then diverge freely. The Data Science app
  is written first and the other three start from a copy of it — a deliberate one-time
  fork, after which the files are independent.
- Every `<pre>` ships **baked** highlight spans (rule 6) — no runtime highlighter.
- Quiz markup mirrors the `praxis/praxis.js` contract so the idiom stays familiar.
- UTF-8 without BOM, LF throughout, real `·` / `—` / `→`.

### 6a. Math: vendored KaTeX, one copy per app folder — settled

**Decision: vendor KaTeX into each app folder.** These four fields are equation-dense —
Krüger n-series, shadow prices and reduced costs, the Black-Scholes PDE, the normal
equations. Typesetting them by hand in HTML means hand-building every fraction, sum,
matrix and sub/superscript, and the result reads worse than the maths deserves. KaTeX
renders them properly, and the corpus already proves the bundle works offline from
`file://`.

What each app folder carries (measured in Phase 0):

```
vendor/katex/
├── katex.min.css        192 KB   9 @font-face rules, woff2 as base64 data: URIs
├── katex.min.js         269 KB   the renderer
└── auto-render.min.js     3 KB   scans the DOM for $…$ / $$…$$
```

The base64 fonts are the reason the CSS is large and the reason it is kept: a real
`woff2` URL would be a network request, which rule 10 forbids. Cost is ~465 KB per app,
~1.9 MB across the four — accepted, since it buys correct typesetting on the substance
of all four subjects. Mitigations: the four copies are byte-identical (SHA-256 verified
in Phase 0, re-checked in Phase 7), and `throwOnError: false` means a broken copy
degrades to visible LaTeX instead of failing.

Rendering contract:

- Author equations as `$$…$$` (display) and `$…$` (inline) in the HTML; `app.js` calls
  `renderMathInElement(document.body, {throwOnError: false, …})` on boot, matching the
  delimiters the existing Krüger page uses.
- Because `classify.js` treats `katex` as a `STRONG_OUT` token, anything inside an
  element with that class is never mistaken for source code. The census and the
  highlight audit therefore stay clean.

If the size ever needs to come back down, dropping `auto-render` and hand-writing
equations is a per-app change that touches no other app — which is the point of the
independent folders.

---

## 7. The four apps

**Module budget: 5–10 modules per app.** The tables below list the curriculum as built
or as planned. A module that turns out thin gets merged into its neighbour rather than
padded — so an app lands anywhere in the 5–10 band. No app is padded to hit a number,
and no module is split just to add a tenth.

Shape of every app: an opening module (*Why this field suits Mojo*), then the field
modules, then a performance/capstone module. Every module ends with a `.check`.

### 7.1 `public/data_science/data_science_mojo/` — **Data Science Mojo** (10 modules, drafted)

| # | Module | Mojo used | Live widget (`.lab`) | Key maths |
|---|---|---|---|---|
| 1 | Why Mojo, and first tensors | `Tensor[DType[float64]]`, slicing, `num_elements` | **Running mean** — sample + estimator trace | $\bar x_n=\frac1n\sum x_i$ |
| 2 | Shapes, slices and reductions | `sum(axis)`, `reshape`, `rank()` | **One loop, three reductions** — shape/sum/min/max | $(m,n)\xrightarrow{\text{sum}(0)}(n,)$ |
| 3 | Descriptive statistics | `mean`, two-pass variance, `sort`, median | **Mean vs median** — outlier slider | $s^2=\frac{1}{n-1}\sum(x_i-\bar x)^2$ |
| 4 | Linear algebra: normal equations | least squares in one pass, $R^2$ | **Least squares under noise** | $\hat\beta=(A^\top A)^{-1}A^\top y$ |
| 5 | Linear regression | MSE gradient, learning rate, momentum | **The loss trace** — divergence at high η | $L=\frac1n\sum(y_i-a-bx_i)^2$ |
| 6 | Classification and logistic regression | sigmoid, cross-entropy, gradient | **Decision boundary** — overlap slider | $p=\sigma(z)$ |
| 7 | Decision trees | Gini, split gain, greedy search | **Greedy splits on a circle** | $G=1-\sum p_c^2$ |
| 8 | Clustering with k-means | assignment/update, SSE, k-means++ | **k-means iterations** | $\min_C\sum_k\sum_{i\in c_k}\|x_i-\mu_k\|^2$ |
| 9 | NumPy interop | `std.python`, `Python.import_module`, tensor↔ndarray | **Column sums across the boundary** | boundary-cost table |
| 10 | Performance and profiling | SIMD-friendly loops, `ALIGN` blocks, tail loop | **Where the time goes** | blocked vs scalar dot |

**Deliberate deviation from the original draft table:** the time-series module was dropped
and performance moved to the end. Time series in a browser widget means a forecast band
with no ground truth to check it against; the performance module is the field's actual
payoff and its widget is self-verifying. The count is still 10.

### 7.2 `public/applications/finance/finance_mojo/` — **Finance Mojo** (target 9)

| # | Module | Mojo used | Live widget |
|---|---|---|---|
| 1 | Why Mojo for finance | `Float64`, tight loops | orientation |
| 2 | Time value of money | TVM, ordinary/due/growing annuities, perpetuity | **TVM solver** — 5 inputs, 6 unknowns |
| 3 | Cash-flow appraisal | NPV, IRR (Newton **and** bisection), MIRR, payback | **Cash-flow analyser** — live NPV/IRR curve |
| 4 | Amortisation & lending | schedules, sinking funds, NPV of debt | **Loan schedule** — full table + interest/principal split |
| 5 | Bonds & yield | dirty/clean, YTM, Macaulay/modified duration, convexity | **Bond pricer** — price-yield curve |
| 6 | Risk & portfolio | log/simple returns, volatility, VaR, covariance, Sharpe, β | **Portfolio lab** — weights, frontier, VaR 95/99 |
| 7 | Options | Black-Scholes, Cox–Ross–Rubinstein, Greeks | **Option pricer** — payoff diagram + ladder |
| 8 | Monte Carlo | seeded PRNG, GBM, antithetic variates, percentiles | **Simulator** — N paths, histogram, P5/P50/P95 |
| 9 | Numerical care | overflow, cancellation, stable recurrences | one stability demo |

Capstone: a capital-budget analyser (mirrors `praxis/mini_project_03`).

### 7.3 `public/applications/geomatics/geomatics_mojo/` — **Geomatics Mojo** (target 8)

| # | Module | Mojo used | Live widget |
|---|---|---|---|
| 1 | Why Mojo for geomatics | `struct` for fixed fields, SIMD over grids | orientation |
| 2 | Coordinate frames | geodetic ↔ ECEF (WGS84), vectors, baselines | **Frame converter** — both directions, intermediates |
| 3 | Bearings & traverses | azimuth, distance, forward intersection, misclose | **Traverse calculator** — leg table, misclose, loop plot |
| 4 | Map projections | transverse Mercator, Krüger n-series, scale, convergence | **Projection check** — forward/inverse round-trip residual |
| 5 | GNSS positioning | satellite geometry, pseudoranges, least-squares point, DOP | **Point solver** — residuals, σ, DOP, sky plot |
| 6 | Least-squares adjustment | normal equations, weights, a posteriori variance | **Adjustment** — residuals map, σ₀ |
| 7 | Areas & volumes | shoelace, Simpson, prismoid, contours | **Area & volume** — three methods, their difference |
| 8 | Gridding & performance | raster loops, SIMD over cells, zero-copy | **Grid bench** — grid size × SIMD width |

Capstone: a local survey reduction — traverse → adjust → project → report.
Cross-links `karney_krueger_equations.html`, `gnss_surveying.html`, `geo_computations.html`.

### 7.4 `public/applications/operations_research/operations_research_mojo/` — **Operations Research Mojo** (target 9)

| # | Module | Mojo used | Live widget |
|---|---|---|---|
| 1 | Why Mojo for OR | combinatorial search is Mojo's home turf | orientation |
| 2 | LP formulation | objective/constraints, feasible region | **LP grapher** — live feasible polygon, corner enumeration |
| 3 | The simplex method | tableau, pivot, Bland's rule, reduced costs | **Simplex stepper** — step/auto-run through pivots |
| 4 | Duality & sensitivity | dual program, shadow prices, degeneracy | **Sensitivity** — drag a RHS, allowable ranges |
| 5 | Integer programming | branch & bound, knapsack DP, greedy vs optimal | **Knapsack** — DP table + greedy comparison |
| 6 | Networks | Dijkstra, Bellman-Ford, min-cost flow, assignment | **Graph lab** — node/edge editor, shortest-path tree |
| 7 | Queuing theory | M/M/1, M/M/c (Erlang C), Little's law | **Queue simulator** — formulas vs simulation traces |
| 8 | Nonlinear & multi-objective | gradient descent, convexity, weighted-sum scalarisation | **Descent lab** — contour + trajectory |
| 9 | Complexity & parallelism | parallel branch-and-bound, incumbent bounds | one worked parallel knapsack |

Capstone: production planning as a full LP + integer model.

---

## 8. Verification gates

Run from the repo root. Gates 1–4 are the repo's existing tooling; gate 5 is new (§8.2).

```powershell
# 1. Structural gate — must exit 0
bun run library/tools/verify_page.js --all

# 2. Language gate — no block may report lang=python
bun run library/tools/lang_dump.js --all

# 3. Highlight gate — 0 flat blocks (needs Chrome; ~1 min)
bun run library/tools/hl_audit.js --verbose

# 4. Python census — python must stay 0 (needs Chrome; ~1 min)
bun run library/tools/py_census.js --csv-all

# 5. Live-page gate — no JS errors, every lab mounted and painting, maths rendered
bun run library/tools/smoke.js public/data_science/data_science_mojo/index.html   # per app

# 6. Syntax-check the app script before spending a Chrome render on it
bun build --target=browser --outfile=$env:TEMP\app.check.js <app>/app.js
```

All four gates accept a `--page <substr>` filter, which is much faster than `--all` while
iterating on a single app:

```powershell
bun run library/tools/hl_audit.js --page data_science_mojo
bun run library/tools/py_census.js --page data_science_mojo
```

### 8.1 `hl_audit.js` was modified — and why

The highlight gate renders a **copy** of each page from a temp directory
(`hl_audit.js:62`). Any page whose CSS is an external stylesheet — which is every app in
this project, by rule 10 — had its `<link href="app.css">` resolve against the temp
directory, 404, and fall back to no styling at all. Every token then computed to the
same base colour and all 15 listings were reported "flat" despite carrying correct baked
spans. No existing page had ever hit this, because every page in the corpus with a
`<pre>` inlines its CSS in a `<style>` block.

The fix injects a `<base href>` pointing at the page's real directory into the temp
copy, so it loads its assets exactly as a reader would. Verified: `data_science_mojo`
went from 15 flat blocks to 0, and `karney_krueger_equations.html` and
`linear_regression.html` still report clean.

**This is the one existing tool changed by this project.** It changes no classification
logic and no page's verdict — it only stops the audit from measuring a page that was
never loaded.

### 8.2 New gate: `library/tools/smoke.js`

The structural gates read HTML statically, so they are blind to the parts of an app that
only exist once JavaScript runs. That blind spot is exactly how the current draft passes
all four gates while 7 of its 10 labs are missing and no equation renders.

`smoke.js` follows the `hl_probe.js` pattern — inject a probe, render in headless Chrome,
read the result back — and asserts:

- zero `window.onerror` / unhandled rejections / failed asset loads;
- KaTeX actually rendered (`.katex` and `.katex-display` node counts);
- sidebar entry count equals module count;
- one quiz per module, each with an explanation;
- every `data-lab` section has controls, ≥1 readout row, a canvas, and **at least one
  painted pixel**;
- no readout shows `NaN`, `undefined`, `Infinity` or `null`.

The error listener must be installed in `<head>`, not appended at the end of `<body>` —
an exception thrown by `app.js` happens before a late listener attaches, which is
precisely how the current bug stayed invisible. (That lesson is not yet encoded in the
script; see §10.)

### 8.3 Checklist

- [ ] Gate 1 exits 0; the app lines report balanced tags and `panes=0 tabs=0`.
- [ ] Gate 2: zero `python` rows attributable to the four app folders.
- [ ] Gate 3: `0 page(s) with flat code`.
- [ ] Gate 4: total `python` count still `0`.
- [ ] Gate 5: `smoke: ok` for each app — no JS errors, all labs mounted and painting.
- [ ] No U+FFFD, no BOM, no mixed EOL in any new file.
- [ ] Every `href="#…"` on every app resolves.
- [ ] Every widget's output matches its adjacent Mojo listing.
- [ ] Each app opened from `file://` with the network disabled — fully functional.
- [ ] Keyboard: tab order sane, sidebar reachable, quiz operable without a mouse.
- [ ] 360 px / 768 px / 1440 px screenshots per app.

---

## 9. Integration (do last, in one commit)

| File | Change |
|---|---|
| `public/applications/finance/index.html` | Primary `.btn` becomes the app; the three book buttons stay as a secondary row |
| `public/applications/geomatics/index.html` | Same — app first, the three books as reference |
| `public/applications/operations_research/index.html` | Same |
| `public/data_science/index.html` | Primary `.btn` becomes the app; existing shelf sections unchanged |
| `public/index.html` | Rename each *Application Domains* domain card to name the app, then run `landing_stats.js` |
| `public/search.js` | Append 4 entries (`t`/`u`/`s`) — one per app, section names `Apps · <Shelf>` |
| `structure.md` | Record the four `<shelf>_mojo/` folders under `applications/` and `data_science/` |

The shelf hubs link **into** the app folders (`href="finance_mojo/index.html"`). That is
the only direction of travel between app and shelf — the app links back with a plain
`../index.html`, so no app depends on a sibling app.

---

## 10. Build log

### Phase 0 — vendored KaTeX ✅

A one-off script carved the bundle out of `karney_krueger_equations.html` by locating
the `<style>`/`<script>` elements that contain the KaTeX markers rather than by
position, then asserted: 9 `@font-face`, 9 base64 blobs, fonts are `data:` URIs, and both
scripts parse via `new Function`. All passed, and the same three files were written to
all four folders.

SHA-256 verified identical across the four copies:

| File | SHA-256 (first 12) | Size |
|---|---|---|
| `katex.min.css` | `D3AA789B58F3` | 192 KB |
| `katex.min.js` | `DD3C360CDC5C` | 269 KB |
| `auto-render.min.js` | `FF3201124864` | 3 KB |

### Phase 1 — Data Science Mojo, drafted, **not clean**

Written: `index.html` (10 modules, 15 listings, 13 output panels, 10 quizzes, 10 labs),
`app.css`, `app.js`.

Gate results:

| Gate | Result |
|---|---|
| 1 `verify_page.js` | **ok** — `eol=LF panes=0 tabs=0` |
| 2 `lang_dump.js` | **ok** — 15 blocks, all `mojo`; 2 also flagged `+interop` |
| 3 `hl_audit.js` | **0 flat** (only after the §8.1 fix) |
| 4 `py_census.js` | **ok** — `0 Python code block(s)`, 15 mojo, 2 interop |
| 6 `bun build` | initially **failed** — unbalanced parens, fixed |
| 5 `smoke.js` | **FAILS** |

**The bug gate 5 caught.** `smoke.js` reports 0 KaTeX nodes, and only labs 1–2 mount with
readouts; lab 3 gets its controls but no readouts and a blank canvas, and labs 4–10 never
mount at all. That is the signature of an uncaught exception partway through the
`mountLabs` loop: labs 1 and 2 committed, lab 3 threw during its first `run()`, and the
exception aborted the rest of the IIFE — which also means `boot()` never ran, which is
why `renderMathInElement` never fired.

The structural gates cannot see any of this, because the HTML is fine; the markup is
complete and correct. The content is there. It is one line of JavaScript.

**Likely fault:** `LAB.stats` is the first lab to fail, and its `compute` is the first to
call the module-level helpers `mean(d)`, `median(d)`, `variance(d)` declared near the
bottom of the IIFE. Those are function declarations and should hoist, so the more probable
cause is a runtime fault inside `compute`/`plot` for that specific lab — but this is a
hypothesis, not a diagnosis. The `smoke.js` error listener did not catch it because it is
installed at the end of `<body>`, after `app.js` has already thrown.

**Immediate next action:** move the `smoke.js` error listener into `<head>` so the first
throw is captured, re-run, and fix the real cause. Do not guess further.

Already fixed along the way, for the record:

- `buildTree` — an unbalanced `)` in the gain expression, caught by `bun build`.
- `drawSplits` — called a stub `pad20()` that ignored its scaler argument and always
  returned a hard-coded 14, so vertical split lines were drawn to the wrong y. Rewritten
  to take a depth and stop at depth 5.
- `inputEl` — reassigned a `var` declared for an `<input>` to a `<textarea>`; split into
  a clean branch.
- `run()` — had a no-op `vals[k].value = vals[k].value` self-assignment left in the
  value-normalisation pass; removed while fixing the above.

### Remaining work

| Phase | Work | Exit condition |
|---|---|---|
| **0** | ✅ Vendor KaTeX into all four folders | Done — 9 blobs, JS parses, hashes match |
| **1** | Fix the `app.js` exception; Data Science Mojo clean end-to-end | **All 5 gates pass**; reference app for the other three |
| **2** | `data_science_mojo/` content pass — verify every widget against its listing | Gate 5 clean; widget↔listing table verified |
| **3** | `finance_mojo/` (target 9, floor 5) | Shell forked from the reference app; gates pass |
| **4** | `geomatics_mojo/` (target 8, floor 5) | Gates pass; most math-dense app |
| **5** | `operations_research_mojo/` (target 9, floor 5) | Gates pass; hardest widget (simplex stepper) |
| **6** | Integration (§9) in one commit | `landing_stats.js` clean; search finds all four |
| **7** | Full gate sweep + responsive/keyboard/`file://` pass | Checklist in §8.3 fully ticked |

Total ≈ **20–36 modules, ~90 Mojo listings, ~40 live widgets, one quiz per module.**

Ordering rationale: Data Science first because it exercises the widest slice of the
shell (tables, plots, statistics, sliders) and its maths is the most forgiving; Geomatics
next because it is the most math-dense; OR last because its widget (the simplex stepper)
is the hardest single piece of front-end work in the set.

Trimming rule: if an app must come in under its target, drop from the bottom of its
table and fold anything still worth teaching into the neighbouring module's prose and
widget. Never cut the module another module's widget depends on.

---

## 11. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | **`mojo` is not installed**, so listings cannot be compile-checked. | Every listing is short and idiomatic and is written against `Mojo_1_1_Compliance_Report.md`. Prose must not claim "verified output" — output panels are labelled as the expected result. If a Mojo toolchain appears later, run `mojo build` over the extracted listings as a follow-up task. |
| R2 | ~40 hand-written JS widgets accumulate formula bugs, and a bug contradicts the Mojo beside it. | Each widget is authored immediately after the listing it mirrors, so they are written together; the Phase-7 comparison table forces a deliberate check; widgets reuse the shared primitives at the foot of `app.js` (seeded RNG, `mean`/`median`/`variance`, canvas helpers) rather than re-implementing them. |
| R10 | **A silent JS exception breaks most of an app while every structural gate passes.** | The Data Science draft is the live example: 8 of 10 labs dead, no maths, all four original gates green. Hence rule 11 and gate 5. `smoke.js` must therefore install its error listener in `<head>` — a late listener misses exactly the failure it was added to catch. |
| R3 | Four hand-written pages make a very large diff in one change. | One app per commit, each independently gate-clean; integration is a separate final commit. |
| R4 | KaTeX extraction produces a subtly broken bundle (fonts missing → silent metric fallback). | **Retired as a live risk** — Phase 0 asserted all 9 base64 blobs and both scripts parse, and `smoke.js` now asserts that equations actually render. |
| R5 | Four forked shells drift apart over time, and a shell fix lands in one app only. | Accepted as the cost of independence, and mitigated in practice: Data Science is written first and the other three fork from it, so the shells start identical. When a shared fix appears later it is applied per app deliberately — there is no mechanism keeping them in step, and that is intentional. |
| R9 | The math bundle is vendored four times (~1.9 MB of the repo) and a copy can drift or be corrupted. | Phase 0 vendors one and copies it mechanically; the four SHA-256 hashes already match, and re-checking them is a Phase 7 gate; `throwOnError: false` means a bad copy degrades to visible LaTeX rather than breaking the app. Dropping the bundle later is a per-app change. |
| R6 | `localStorage` unavailable on some `file://` origins. | All state reads/writes go through one guarded helper that no-ops on failure. |
| R7 | The census's guess-detector flags a prose/output panel as Python. | Output panels always carry `class="out"` (a `STRONG_OUT` token); re-run `py_census.js` per app, not just at the end. |
| R8 | Page weight. | Measured, not guessed: each app is ~180 KB of HTML/CSS/JS plus 465 KB of maths. Under the 250 KB hand-authored target excluding the vendored bundle. |

---

## 12. Definition of done

- [ ] Four self-contained folders exist, each inside its own shelf, each holding
      `index.html`, `app.css`, `app.js` and `vendor/katex/`:
      `public/data_science/data_science_mojo/`,
      `public/applications/finance/finance_mojo/`,
      `public/applications/geomatics/geomatics_mojo/`,
      `public/applications/operations_research/operations_research_mojo/`.
- [ ] **No app references anything outside its own folder** except the shelf hub it links
      back to — verified by grepping each app for `href=`/`src=` targets.
- [ ] Each app is linked from the top of its shelf hub, and links back to that hub.
- [ ] All five gates (§8) pass across the whole repo, not just the new pages.
- [ ] `landing_stats.js` re-run and committed; `search.js` returns all four apps.
- [ ] Zero new warnings from `verify_page.js` on the new files.
- [ ] Each app is fully usable from `file://` with no network, with no console errors.
- [ ] Each app folder works when copied to a scratch location on its own (proves
      independence).
- [ ] The four `vendor/katex/` copies are byte-identical (hash check).
- [ ] A deliberately malformed equation renders as visible LaTeX and breaks nothing.
- [ ] Each app has between **5 and 10 modules**, no module left as a stub.
- [ ] `structure.md` updated.
- [ ] The `hl_audit.js` change (§8.1) is called out in the commit message, since it
      touches shared tooling.

---

## 13. Settled decisions

1. ~~**Placement**~~ — settled: **each app independent, in its own folder inside its own
   shelf.** No shared `apps.css`/`apps.js`; nothing outside the folder is required to run
   it.
2. ~~**Math**~~ — settled: **vendored KaTeX, one copy per app folder** (see §6a).
3. ~~**Depth per module**~~ — settled: **5–10 modules per app.** The curriculum is listed
   in §7; a thin module merges into its neighbour rather than being padded, and the app
   lands anywhere in the band.
4. ~~**Gate tooling**~~ — settled: gates 1–4 unchanged in verdict, with one rendering fix
   to `hl_audit.js` (§8.1), plus one new gate for the part the old ones cannot see (§8.2).
