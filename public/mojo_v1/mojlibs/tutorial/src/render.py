"""Renderer: assembles the Mojo libraries tutorial into one self-contained HTML file.

Content files live in ``tutorial/content`` and are mostly literal HTML with a few
directives that get expanded at build time:

    {{code:libs/mstats/descriptive.mojo}}        -> highlighted code figure
    {{code:libs/mstats/descriptive.mojo|4,40}}  -> same, but only lines 4..40
    {{code:inline|mojo}}...{{/code}}             -> inline code block
    {{libtree:libs/mstats}}                     -> generated directory tree
    {{stats}}                                   -> build statistics
"""

from __future__ import annotations

import datetime as _dt
import html as _html
import re
from pathlib import Path

import highlight as hl

ROOT = Path(__file__).resolve().parent.parent      # tutorial/
LIBS = ROOT / "libs"
# Directive paths are written relative to `tutorial/`, e.g. `libs/mstats/mean.mojo`.
FILES = ROOT
CONTENT = ROOT / "content"
SRC = ROOT / "src"

LANG_BY_SUFFIX = {
    ".mojo": "mojo",
    ".py": "python",
    ".sh": "bash",
    ".bash": "bash",
    ".toml": "toml",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".json": "text",
    ".md": "text",
    ".txt": "text",
}

DOMAINS = {
    "mojo_core": "shared numeric kernel",
    "geomatics": "land & engineering surveying / geomatics",
    "mstats": "statistics",
    "mopt": "operations research",
    "mfin": "financial management & risk",
    "mdat": "data analytics",
    "mmath": "mathematics",
    "mphysics": "physics",
}

# --------------------------------------------------------------------------
# site cross-navigation
# --------------------------------------------------------------------------
# Both generated editions land in `public/mojo_v1/mojlibs/`, i.e. two levels below
# the served root, so every site-relative href climbs two levels to reach the hub.
# This lives here as data rather than as markup in the f-strings so the print and
# interactive shells cannot drift apart, and so `mojlibs/index.html` stays the
# single front door for the tutorial.
SITE_SHELVES = (
    ("../../index.html", "Hub"),
    ("../index.html", "Fundamentals"),
    ("../../data_science/index.html", "Data Science"),
    ("../../applications/index.html", "Applications"),
    ("../../praxis/index.html", "Praxis"),
)

# Prerequisites and follow-on reading elsewhere on the site. `href` is relative to
# the generated file, so `../` addresses the Fundamentals shelf that owns this one.
RELATED_TUTORIALS = (
    ("../mojo_12_modules.html", "Ch 12 · Modules &amp; Packages",
     "The package model, __init__.mojo re-exports and toolchain flags this book builds on."),
    ("../mojo_08_metaprogramming.html", "Ch 08 · Metaprogramming",
     "Parameters, where clauses and comptime — the advanced-patterns chapter leans on these."),
    ("../mojo_11_interop.html", "Ch 11 · Python &amp; C Interop",
     "The std.python boundary behind the interop and trust-boundary chapter."),
    ("../mojo_15_docstrings.html", "Ch 15 · Docstrings",
     "Labelled, compiler-validated docs for the public surface you are about to design."),
    ("../index.html", "Fundamentals shelf",
     "The full fifteen-chapter Mojo 1.x textbook this tutorial is a companion to."),
    ("../../praxis/index.html", "Praxis drills",
     "Twenty-eight hands-on drills and three mini-projects to turn the patterns into muscle memory."),
)


def _sitenav() -> str:
    """Site-level shelf navigation for the header of both editions."""
    links = "".join(
        f'\n    <a href="{href}">{label}</a>' for href, label in SITE_SHELVES
    )
    return (
        '<nav class="sitenav" aria-label="TutMe shelves">'
        f'{links}\n  </nav>'
    )


def _related_grid() -> str:
    """Cross-links out to the rest of the tutorial, rendered as .next-grid cards.

    Indentation assumes it is interpolated at six spaces, which is where both
    footers emit the call.
    """
    cards = "".join(
        f'\n        <a href="{href}"><b>{title}</b><span>{blurb}</span></a>'
        for href, title, blurb in RELATED_TUTORIALS
    )
    return (
        '<nav class="next-grid" aria-label="Related tutorials on this site">'
        f'{cards}\n      </nav>'
    )


# --------------------------------------------------------------------------
# code figures
# --------------------------------------------------------------------------

def _line_spans(code: str, lang: str = "mojo") -> str:
    """Wrap each source line in a .cl span carrying its line number."""
    lines = code.split("\n")
    out = []
    for i, line in enumerate(lines, start=1):
        out.append(f'<span class="cl" data-line="{i}">{hl.highlight(line, lang)}</span>')
    return "\n".join(out)


def code_figure(
    source: str,
    lang: str = "mojo",
    label: str = "",
    filename: str = "",
    *,
    start: int = 1,
    end: int | None = None,
    plain: bool = False,
    variant: str = "",
) -> str:
    """Render one highlighted code block."""
    lines = source.rstrip("\n").split("\n")

    if filename:
        lines, source = lines, source
        first = lines[0]
        if start == 1 and first.strip() != "":
            base = Path(filename).name
            stem = base[:-5] if base.endswith(".mojo") else base
            if first.startswith("# ") and stem not in first:
                lines = [f"# {stem}"] + lines
                source = f"# {stem}\n" + source

    if start > 1 or end is not None:
        last = len(lines) if end is None else min(end, len(lines))
        lines = lines[start - 1 : last]
        if lines and lines[0].lstrip().startswith("#"):
            lines[0] = _dedent_strip(lines[0])
        body = "\n".join(lines)
    else:
        body = source.rstrip("\n")

    if plain:
        rendered = "\n".join(body.split("\n"))
    else:
        rendered = _line_spans(body, lang)

    lang_label = hl.LANG_LABELS.get(lang, lang.title())
    classes = "cb" + (f" cb--{variant}" if variant else "")

    file_part = ""
    if filename:
        file_part = f'<span class="cb__file">{_html.escape(filename)}</span>'
    elif label:
        file_part = f'<span class="cb__file">{_html.escape(label)}</span>'

    return f"""<figure class="{classes}">
<div class="cb__bar"><span class="cb__dots" aria-hidden="true"><i></i><i></i><i></i></span>{file_part}<span class="cb__lang">{_html.escape(lang_label)}</span><button type="button" class="cb__copy" data-copy aria-label="Copy code to clipboard">Copy</button></div>
<div class="cb__scroll"><pre class="cb__pre"><code class="cb__code">{rendered}</code></pre></div>
</figure>"""


def _dedent_strip(comment: str) -> str:
    return comment


# --------------------------------------------------------------------------
# directory trees
# --------------------------------------------------------------------------

TREE_SKIP = {"__init__.mojo", "__pycache__", ".git", "__mojocache__"}


def libtree(pkg: str, *, max_depth: int = 3) -> str:
    """Generate a directory tree for a package, straight from the real files."""
    root = LIBS / pkg
    if not root.is_dir():
        return f"<div class='callout callout--danger'><p>Missing package: {pkg}</p></div>"

    entries: list[tuple[str, int]] = []

    def walk(d: Path, depth: int, prefix: str) -> None:
        if depth > max_depth:
            return
        items = sorted(
            (p for p in d.iterdir() if p.name not in TREE_SKIP and not p.name.startswith(".")),
            key=lambda p: (p.is_file(), p.name.lower()),
        )
        for i, p in enumerate(items):
            last = i == len(items) - 1
            connector = "`-- " if last else "|-- "
            if p.is_dir():
                entries.append((f"{prefix}{connector}<span class='dir'>{p.name}/</span>", depth))
                walk(p, depth + 1, prefix + ("    " if last else "|   "))
            else:
                entries.append((f"{prefix}{connector}<span class='file'>{p.name}</span>", depth))

    lines = [f"<span class='dir'>{pkg}/</span>"]
    entries = []
    walk(root, 1, "")
    lines.extend(e[0] for e in entries)

    body = "\n".join(lines)
    return f"<div class='tree'>{body}</div>"


def count_mojo(pkg: str) -> tuple[int, int]:
    """Return (module count, total lines) for a package, excluding tests/examples."""
    root = LIBS / pkg
    if not root.is_dir():
        return (0, 0)
    mods, lines = 0, 0
    for p in root.rglob("*.mojo"):
        rel = p.relative_to(root).parts
        if rel[0] in ("tests", "examples"):
            continue
        mods += 1
        lines += len(p.read_text(encoding="utf-8").splitlines())
    return (mods, lines)


# --------------------------------------------------------------------------
# directive expansion
# --------------------------------------------------------------------------

CODE_DIRECTIVE = re.compile(r"\{\{code:([^|}]+)(?:\|([\d,\-]*))?\}\}")
INLINE_CODE = re.compile(r"\{\{code:([^|}]+)\|([a-z]+)\}\}([\s\S]*?)\{\{/code\}\}")
LIBTREE_DIRECTIVE = re.compile(r"\{\{libtree:([^}]+)\}\}")
STATS_DIRECTIVE = re.compile(r"\{\{stats\}\}")

_missing: list[str] = []


def expand(text: str) -> str:
    def code_sub(m: re.Match) -> str:
        path, span = m.group(1).strip(), m.group(2)
        f = FILES / path
        if not f.is_file():
            _missing.append(path)
            return (
                f'<div class="callout callout--danger"><p class="callout__label">'
                f'Missing source</p><div class="callout__body"><p><code>{path}</code> not found.'
                f"</p></div></div>"
            )
        lang = LANG_BY_SUFFIX.get(f.suffix, "text")
        start, end = 1, None
        if span:
            bits = [b for b in span.split(",") if b]
            start = int(bits[0])
            end = int(bits[1]) if len(bits) > 1 else None
        return code_figure(f.read_text(encoding="utf-8"), lang, filename=path, start=start, end=end)

    text = CODE_DIRECTIVE.sub(code_sub, text)
    text = INLINE_CODE.sub(
        lambda m: code_figure(m.group(3).strip("\n"), m.group(2).strip()), text
    )
    text = LIBTREE_DIRECTIVE.sub(lambda m: libtree(m.group(1).strip()), text)
    text = STATS_DIRECTIVE.sub(_stats_block, text)
    return text


def _stats_block() -> str:
    total_mods = total_lines = 0
    rows = []
    for pkg, dom in DOMAINS.items():
        mods, lines = count_mojo(pkg)
        if not mods:
            continue
        total_mods += mods
        total_lines += lines
        rows.append(f"<li><code>{pkg}</code> — {mods} modules, {lines} lines</li>")
    body = "\n".join(rows)
    return (
        f"<div class='card'><p><strong>{total_mods} modules</strong>, "
        f"<strong>{total_lines:,} lines</strong> of Mojo across "
        f"{len(rows)} packages.</p><ul>{body}</ul></div>"
    )


# --------------------------------------------------------------------------
# page assembly
# --------------------------------------------------------------------------

def build(out_path: Path) -> int:
    parts = sorted(CONTENT.glob("*.html"))
    if not parts:
        raise SystemExit(f"No content files in {CONTENT}")

    body_parts = []
    toc_parts = []
    for p in parts:
        raw = p.read_text(encoding="utf-8")
        raw = _rewrite_libnav(raw)
        body_parts.append(expand(raw))
        toc_parts.append(_extract_toc(p.read_text(encoding="utf-8")))

    body = "\n".join(body_parts)
    toc = "\n".join(t for t in toc_parts if t)

    css = (SRC / "theme.css").read_text(encoding="utf-8")
    js = (SRC / "app.js").read_text(encoding="utf-8")

    stamp = _dt.datetime.now().strftime("%d %B %Y")

    doc = f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Writing Mojo Libraries — a practitioner's guide to packages in Mojo 1.1</title>
<meta name="description" content="A complete, hands-on guide to building, testing, documenting and packaging production Mojo 1.1 libraries — built around seven complete domain packages: geomatics, statistics, operations research, finance, data analytics, mathematics and physics.">
<meta name="color-scheme" content="dark light">
<style>
{css}
</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

<header class="site-header">
  <button class="icon-btn rail-toggle" id="railToggle" aria-label="Collapse contents" aria-expanded="true">&#9776;</button>
  <a class="brand" href="#top"><span class="brand__mark">MOJO</span><span>Writing Mojo Libraries</span><span class="brand__sub">1.1</span></a>
  <span class="header-spacer"></span>
  {_sitenav()}
  <button class="icon-btn theme-toggle" id="themeToggle" aria-label="Toggle colour theme">
    <span class="moon" aria-hidden="true">&#9789;</span><span class="sun" aria-hidden="true">&#9788;</span>
  </button>
  <div class="progress" id="progress"></div>
</header>

<div class="shell">
  <nav class="rail" id="rail" aria-label="Contents">
    <p class="rail__title">Contents</p>
    <ol>
{toc}
    </ol>
  </nav>

  <main class="main" id="main">
    <article class="doc" id="top">
{body}
    </article>

    <footer class="site-footer">
      <p><strong>About this document.</strong> Every Mojo snippet was written against the
      Mojo v1 language manual (<code>single source of truth mojo/</code>, 38 chapters) and uses
      the syntax and command-line surface that manual documents. No Mojo toolchain was available
      on the machine this was written on, so treat the printed outputs as arithmetic you can
      check rather than as captured transcripts. Where a design decision is genuinely arguable —
      sample versus population defaults, how strict an API should be about empty input — the
      argument is given rather than hidden, because that is the part you will need to have
      opinions about.</p>
      <p><strong>Corrections.</strong> If you find a snippet that does not compile against your
      Mojo build, that is a real defect in this document. Check the manual for that release, fix
      it here, and treat the disagreement as information about the version you are on.</p>
      <h3 class="footer-h">Where to go next</h3>
      {_related_grid()}
      <p style="color:var(--dim);font-family:var(--mono);font-size:.78rem">
        Generated {stamp} · single self-contained file · no network requests
      </p>
    </footer>
  </main>
</div>

<script>
{js}
</script>
</body>
</html>
"""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(doc, encoding="utf-8")

    if _missing:
        print(f"!! {len(_missing)} missing source file(s):")
        for m in sorted(set(_missing)):
            print(f"   - {m}")
        return 2
    return 0


def build_interactive(out_path: Path) -> int:
    parts = sorted(CONTENT.glob("*.html"))
    if not parts:
        raise SystemExit(f"No content files in {CONTENT}")

    body_parts = []
    toc_parts = []
    for p in parts:
        raw = p.read_text(encoding="utf-8")
        raw = _rewrite_libnav(raw)
        body_parts.append(expand(raw))
        toc_parts.append(_extract_toc(p.read_text(encoding="utf-8")))

    body = "\n".join(body_parts)
    toc = "\n".join(t for t in toc_parts if t)
    css = (SRC / "theme_interactive.css").read_text(encoding="utf-8")
    js = (SRC / "app.js").read_text(encoding="utf-8")
    stamp = _dt.datetime.now().strftime("%d %B %Y")

    doc = f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mojo Library Lab — an interactive tutorial</title>
<meta name="description" content="A web-friendly interactive Mojo 1.1 tutorial that introduces library design through hands-on examples, quick wins and step-by-step sections.">
<meta name="color-scheme" content="dark light">
<style>
{css}
</style>
</head>
<body class="tutorial-interactive">
<a class="skip" href="#main">Skip to content</a>

<header class="site-header interactive-header">
  <button class="icon-btn rail-toggle" id="railToggle" aria-label="Collapse contents" aria-expanded="true">&#9776;</button>
  <a class="brand brand--interactive" href="#top"><span class="brand__mark">MOJO</span><span>Library Lab</span><span class="brand__sub">interactive</span></a>
  {_sitenav()}
  <nav class="topnav" aria-label="Tutorial sections">
    <a href="#front">Start</a>
    <a href="#intro">Foundations</a>
    <a href="#workflow">Workflow</a>
    <a href="#lib-geomatics">Libraries</a>
    <a href="#backmatter">Wrap-up</a>
  </nav>
  <button class="icon-btn theme-toggle" id="themeToggle" aria-label="Toggle colour theme">
    <span class="moon" aria-hidden="true">&#9789;</span><span class="sun" aria-hidden="true">&#9788;</span>
  </button>
  <div class="progress" id="progress"></div>
</header>

<main class="interactive-shell" id="main">
  <aside class="interactive-rail">
    <div class="rail-panel">
      <p class="rail-label">Learning path</p>
      <ol class="rail-list">
{toc}
      </ol>
    </div>
  </aside>

  <section class="interactive-main">
    <header class="interactive-hero">
      <p class="eyebrow">Interactive tutorial</p>
      <h1>Build libraries in Mojo with small, testable steps.</h1>
      <p class="lede">This version is designed for the web: short sections, guided progression, approachable examples, and more direct navigation than a traditional book.</p>
      <div class="hero-pills">
        <span>Mojo 1.1</span>
        <span>Seven domains</span>
        <span>Hands-on patterns</span>
      </div>
    </header>

    <article class="doc doc--interactive" id="top">
{body}
    </article>

    <footer class="site-footer interactive-footer">
      <p><strong>Practical focus.</strong> The point is not to memorize every API detail. It is to understand how a library becomes reliable, readable, and easy to evolve.</p>
      <h3 class="footer-h">Where to go next</h3>
      {_related_grid()}
      <p style="color:var(--dim);font-family:var(--mono);font-size:.78rem">Generated {stamp} · interactive edition · web-focused</p>
    </footer>
  </section>
</main>

<script>
{js}
</script>
</body>
</html>
"""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(doc, encoding="utf-8")

    if _missing:
        print(f"!! {len(_missing)} missing source file(s):")
        for m in sorted(set(_missing)):
            print(f"   - {m}")
        return 2
    return 0


HEADING_RE = re.compile(
    r'^\s*<h2 id="(?P<id>[^"]+)"[^>]*>(?:\s*<span class="num">[^<]*</span>)?\s*(?P<title>.*?)</h2>',
    re.M,
)
H3_RE = re.compile(r'^\s*<h3 id="(?P<id>[^"]+)"[^>]*>(?P<title>.*?)</h3>', re.M)


def _strip_tags(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s)
    return _html.unescape(s).strip()


def _extract_toc(raw: str) -> str:
    out = []
    h2s = list(HEADING_RE.finditer(raw))
    for i, m in enumerate(h2s):
        end = h2s[i + 1].start() if i + 1 < len(h2s) else len(raw)
        chunk = raw[m.end() : end]
        out.append(
            f'      <li><a href="#{m.group("id")}">{_strip_tags(m.group("title"))}</a>'
        )
        subs = list(H3_RE.finditer(chunk))
        if subs:
            out.append("<ul>")
            for s in subs:
                out.append(
                    f'        <li class="lvl3"><a href="#{s.group("id")}">'
                    f'{_strip_tags(s.group("title"))}</a></li>'
                )
            out.append("</ul>")
        out.append("</li>")
    return "\n".join(out)


LIBNAV_LINKS = "".join(
    f'\n      <a href="#lib-{pkg}"><span class="idx">{i}</span>'
    f'<span>{pkg}</span><span class="dom">{dom}</span></a>'
    for i, (pkg, dom) in enumerate(DOMAINS.items(), start=1)
    if pkg != "mojo_core" and (LIBS / pkg).is_dir()
)


def _rewrite_libnav(raw: str) -> str:
    return raw.replace("<!--LIBNAV-->", f'<nav class="libnav" aria-label="The seven libraries">{LIBNAV_LINKS}\n    </nav>')


if __name__ == "__main__":
    import sys

    target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "mojo_libs.html"
    rc = build(target)
    size = target.stat().st_size if target.exists() else 0
    print(f"wrote {target}  ({size:,} bytes)")
    raise SystemExit(rc)