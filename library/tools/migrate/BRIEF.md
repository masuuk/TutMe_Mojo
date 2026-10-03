# Python-removal migration brief (Phase 6 + 7)

Goal: get the assigned pages to **0 Python code blocks** without breaking the page.
Baseline: 38 pages / 153 Python blocks site-wide (see `PYTHON_REMOVAL_PLAN.md`).

## What counts as Python (must reach 0 on your pages)

`py_census.js` counts a `<pre>` as a Python code block when either:
- it is **labelled** — the element or an ancestor carries `data-lang="python"`, or the
  tab button has `data-lang="python"`; or
- it is **guessed** — an unlabelled `<pre>` whose text scores as Python.

These are the same rules `hl_audit.js` and `py_census.js` use, so the census is the
authority. Do not argue with it; make the block stop being Python.

Legit Python that must **stay** (census ignores it, so leave it alone):
- `data-correct="false"` quiz distractors
- Python **output** blocks / stdout in `<pre class="out">` or similar
- Python in prose, inline `<code>`, comments explaining the comparison

## The two shapes you will meet

### A. Labelled blocks in a tab bar (mechanical)

```html
<div class="tabs">
  <div class="tab" data-target="py1" data-lang="python">Python</div>
  <div class="tab active" data-target="mojo1" data-lang="mojo">Mojo</div>
</div>
<div class="pane" id="py1" data-lang="python"> <pre>...</pre> </div>
<div class="pane active" id="mojo1" data-lang="mojo"> <pre>...</pre> </div>
```

Rewrite the Python `<pre>`'s content to Mojo, then:
- remove the `data-target="py1"` tab button
- remove the `id="py1"` pane
- **if the removed tab held `active`**, move `active` onto the sibling Mojo tab/pane
- rename the remaining tab label if it said "Mojo" and it is now the only tab

### B. Standalone unlabelled `<pre>` (guess-detected)

No tab bar, no `data-lang`. Just rewrite the content to Mojo. Keep the `id` if there is
one; keep the surrounding `<pre>` attributes.

## Tooling (all paths relative to repo root `tui/`)

```js
import { loadPage, savePage, counts, replacePreInner, removePre, removeTab,
         tabIsActive, paneIsActive, clearActiveOn, addActiveTo, replaceOnce,
         collapseSingleTabBar, countOf } from "../lib/edit.js";
import { MAPS, resolveMap, hiCode, buildPre } from "../lib/tok.js";
```

- `loadPage(path)` -> `{ text, eol, bom, path }` — **text is LF-normalised**.
- `savePage(page, newText, path?)` — restores the original EOL and BOM. Pass the object
  from `loadPage` and the *new* text. (`savePage(page, newText)`, not `(page, text, path)`.)
- `buildPre(code, mapName, { id, cls, lang })` -> highlighted `<pre>...</pre>` string,
  HTML-escaped. `replacePreInner(html, id, buildPre(...))` swaps contents in place.
- `MAPS` keys: `com`, `cmt`, `tok`, `long`, `shorttok`. See "Vocabularies" below.

Write a one-off script per page under `library/tools/migrate/` and run it with
`bun run library/tools/migrate/<name>.js`. Do **not** hand-edit 38 files; scripted
edits are reviewable and repeatable.

## Vocabularies — match the page you are editing

Each page's `<style>` defines its own token classes. `buildPre` must emit classes that
already exist on that page, or `hl_audit.js` will call the block "flat". Detect the
vocabulary per page before writing code:

- `.tok-kw .tok-str .tok-com .tok-fn .tok-num .tok-ty` -> `MAPS.com`
- `.tok-kw .tok-str .tok-cm .tok-fn .tok-num .tok-tp` -> `MAPS.cmt`
- `.tk .ts .tc .tf .tn` style short names -> `MAPS.tok` / `MAPS.shorttok`
- `.keyword .func .comment .string` long names -> `MAPS.long`

Sanity check after every page:
```
bun run library/tools/verify_page.js <page-slug>     # structural gate, exit 0 required
bun run library/tools/lang_dump.js <page-slug>       # no block may report lang=python
bun run library/tools/hl_audit.js                    # 0 flat blocks site-wide
```

## Non-negotiable gates

`verify_page.js` must exit 0. It checks mixed EOL, BOM, U+FFFD, unbalanced
`div/section/pre/code/span`, tab-target/pane bijection, exactly one `active` per tab
group, broken `#fragment` links, and leftover Python tab/pane controls. EOL is
per-file: **do not convert LF to CRLF or vice versa.** 32 remaining pages are CRLF,
7 are LF. `git diff --check` should stay clean.

## Mojo correctness

Read `Mojo_1_1_Compliance_Report.md` before writing Mojo. The approved interop idiom is:

```mojo
from std.python import Python
var np = Python.import_module("numpy")
```

Common errors to avoid: inventing APIs, `print` without the trailing newline format
Mojo wants, using `def` for a `fn` that returns nothing, `Tensor` ownership mistakes,
`simd_width` misuse, and Python-only stdlib calls outside `Python.import_module`.

## Editorial

- A heading or sentence that promises "here is the Python" must be rewritten when the
  Python block goes. Do not leave dangling promises.
- If a comparison is pedagogically valuable, keep it **as prose or an output block**,
  not as a live Python code block.
- Quizzes: if a correct answer referenced the removed Python, repoint it at the Mojo
  answer. `data-correct="false"` distractors can stay.
- Deks/summaries must not claim zero-copy or in-process sharing unless the text now
  supports it.

## Report back

For each page: slug, blocks before -> after, the map name used, the vocabulary you
detected, and the exact final `verify_page.js` line. Flag anything you could not
resolve instead of guessing.
