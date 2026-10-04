"""Guard rails for the Mojo sources in `tutorial/libs`.

Two jobs:

1. **Forbidden syntax.** Refuse to ship a snippet that uses syntax the Mojo
   v1 manual does not document. This is the whole point of the exercise, and
   it is far too easy to reintroduce `fn` or `.size` from memory.

2. **Structural smells.** Catch the mistakes that actually happened while
   writing this tutorial: a `raise` in a function whose signature lacks
   `raises`, mutation of a parameter that was not declared `mut`, and
   imports of names the module does not define.

Run:  python lint.py        (exit 0 = clean)
"""

from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIBS = ROOT / "libs"
APPS = ROOT / "apps"

# --------------------------------------------------------------------------
# 1. forbidden syntax
# --------------------------------------------------------------------------

FORBIDDEN = [
    (r"\bfn\s+[A-Za-z_]", "`fn` is not a Mojo 1.x keyword - use `def`"),
    (r"^\s*let\s+[A-Za-z_]", "`let` is not a Mojo 1.x keyword - use `var`"),
    (r"^\s*alias\s+[A-Za-z_][\w]*\s*=", "`alias X = ...` is not Mojo 1.x - use `comptime X = ...`"),
    (r"\.\s*size\b", "`List` has no `.size` - use `len(x)`"),
    (r"\bborrowed\s+[A-Za-z_]\w*\s*:", "`borrowed x: T` is not an argument convention in Mojo 1.x - omit the convention for an immutable read"),
    (r"\binout\s+[A-Za-z_]\w*\s*:", "`inout` is not an argument convention in Mojo 1.x - use `mut` for a mutable reference"),
    (r"\bowned\s+[A-Za-z_]\w*\s*:", "`owned` is not an argument convention in Mojo 1.x - use `var` to take ownership"),
    (r"\bmojo\s+test\b", "`mojo test` is not a documented Mojo command - tests run via `mojo run test.mojo`"),
    (r"\bmojo\s+init\b", "`mojo init` is not a documented Mojo command"),
    (r"\bmojo\s+package\b", "`mojo package` is not a Mojo 1.x command - use `mojo precompile`"),
    (r"\bmagic\s+mojo\b", "the CLI is `mojo`, not `magic mojo`"),
    (r"MOJO_PATH", "MOJO_PATH is not a supported search path - precompile the package with `mojo precompile` or keep it beside your app"),
    (r"mojoproject", "`mojoproject.🔥toml` is not part of this manual's packaging story"),
    (r"__mojo__", "`__mojo__` manifests are not documented in the Mojo 1.x manual"),
    (r"\.mojopkg", "`.mojopkg` is not the current precompiled extension - use `.mojoc`"),
    (r"from\s+(collections|algorithm|math)\s+import", "the standard library is `std.`-prefixed"),
    (r"\bclass\s+[A-Z]", "Mojo uses `struct`, not `class`"),
]

# Warnings: legal, but usually a mistake in this context.
SUSPECT = [
    (r"\bFloat64\s*/\s*(?![\w.]*\s*\.)[a-z_][\w.]*\b(?!\s*[.\w])", "possible Float64/Int division - Mojo will not widen implicitly"),
]

MOJO_FILES = sorted(LIBS.rglob("*.mojo")) + sorted(APPS.rglob("*.mojo"))


def scan_forbidden() -> list[str]:
    problems: list[str] = []
    for f in MOJO_FILES:
        rel = f.relative_to(ROOT)
        in_doc = False
        for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            # Skip triple-quoted docstrings: prose may legitimately mention a
            # forbidden word in order to explain that it is not used.
            stripped = line.strip()
            if stripped.startswith('"""') or stripped.startswith("'''"):
                q = stripped[:3]
                in_doc = not in_doc if stripped.count(q) == 1 else False
                if not in_doc and stripped.endswith(q) and len(stripped) > 3:
                    in_doc = False
                continue
            if in_doc:
                continue
            # Comments are prose. They legitimately name a forbidden command
            # or construct in order to say it is not used, so they are not
            # scanned. This also keeps the tutorials own commentary from
            # tripping the very rule it is teaching.
            if stripped.startswith("#"):
                continue
            code = line.split("#", 1)[0] if "#" in line else line
            for pat, msg in FORBIDDEN:
                if re.search(pat, code, re.M):
                    problems.append(f"{rel}:{n}: {msg}\n      | {code.strip()[:90]}")
    return problems


# --------------------------------------------------------------------------
# 2. structural checks
# --------------------------------------------------------------------------

DEF_RE = re.compile(
    r"^(?P<indent>[ ]*)def\s+(?P<name>\w+)\s*"
    r"(?P<gen>\[[^\]]*\])?\s*"
    r"\((?P<params>.*?)\)\s*"
    r"(?P<raises>\s*raises\s*)?"
    r"(?:->\s*(?P<ret>[^:]+?))?\s*:",
    re.M | re.S,
)


def strip_docstrings(src: str) -> str:
    """Remove triple-quoted blocks so pattern matching only sees code."""
    return re.sub(r'"""[\s\S]*?"""', '""', src)


def scan_raises() -> list[str]:
    """Every `raise` must live in a function whose signature says `raises`."""
    problems: list[str] = []
    for f in MOJO_FILES:
        rel = f.relative_to(ROOT)
        src = strip_docstrings(f.read_text(encoding="utf-8"))
        lines = src.split("\n")

        # Map each `def` header to the body indentation it owns.
        headers: list[tuple[int, int, str, str, str]] = []  # lineno, indent, raises, params, name
        for m in DEF_RE.finditer(src):
            line_no = src[: m.start()].count("\n")
            header_indent = len(m.group("indent"))
            body_indent = None
            for k in range(line_no + 1, len(lines)):
                if lines[k].strip() == "":
                    continue
                ind = len(lines[k]) - len(lines[k].lstrip(" "))
                if ind <= header_indent:
                    break
                body_indent = ind
                break
            if body_indent:
                headers.append((line_no, body_indent, m.group("raises") or "", m.group("params") or "", m.group("name")))

        for n, line in enumerate(lines):
            if not re.match(r"^\s*raise\b", line):
                continue
            ind = len(line) - len(line.lstrip(" "))
            owner = None
            for line_no, body_indent, raises_kw, params, name in headers:
                if line_no < n and ind >= body_indent:
                    owner = (line_no, raises_kw, params, name)
            if owner is None:
                continue
            line_no, raises_kw, params, name = owner
            if not raises_kw.strip():
                problems.append(
                    f"{rel}:{n + 1}: `raise` inside `{name}()` whose signature lacks `raises`"
                )
    return problems


def scan_mut_params() -> list[str]:
    """A parameter must be `mut` (or `out`) if its body assigns to it."""
    problems: list[str] = []
    for f in MOJO_FILES:
        rel = f.relative_to(ROOT)
        src = strip_docstrings(f.read_text(encoding="utf-8"))
        lines = src.split("\n")
        for m in DEF_RE.finditer(src):
            line_no = src[: m.start()].count("\n")
            params = m.group("params") or ""
            body: list[str] = []
            base = None
            for k in range(line_no + 1, len(lines)):
                if not lines[k].strip():
                    continue
                ind = len(lines[k]) - len(lines[k].lstrip(" "))
                if base is None:
                    base = ind
                if ind < base:
                    break
                body.append(lines[k])
            text = "\n".join(body)
            # Candidate mutable targets: bare `name = ` or `name[i] = ` or `name.f = `
            for pm in re.finditer(r"(?:^|,)\s*(?:mut\s+|out\s+|deinit\s+)?(\w+)\s*:", params):
                pname = pm.group(1)
                if pname in ("self",):
                    continue
                declared_mut = bool(re.search(rf"(?:^|,)\s*(?:mut|out)\s+{pname}\s*:", params))
                assigned = re.search(rf"(?<![\w.]){pname}\s*(?:\[[^\]]*\])?\s*(?:\.\w+\s*)?=(?!=)", text)
                if assigned and not declared_mut:
                    problems.append(
                        f"{rel}:{line_no + 1}: assigns to parameter `{pname}` but it is not declared `mut`"
                    )
    return problems


def parse_imports(src: str) -> list[tuple[int, str, list[str]]]:
    """Yield `(lineno, module, [names])` for every `from ... import ...`.

    Handles the three shapes that occur in real code:
        from std.math import sin, cos
        from mojo_core import Rng
        from mojo_core import (
            Vec2,
            Vec3,
        )
    """
    out: list[tuple[int, int, str, list[str]]] = []
    lines = src.split("\n")
    i = 0
    while i < len(lines):
        m = re.match(r"^\s*from\s+([\w.]+)\s+import\s+(.*)$", lines[i])
        if not m:
            i += 1
            continue
        module, rest = m.group(1), m.group(2)
        start = i
        if rest.strip().startswith("("):
            rest = rest[rest.index("(") + 1 :]
            while ")" not in rest and i + 1 < len(lines):
                i += 1
                rest += "\n" + lines[i]
            rest = rest[: rest.index(")")] if ")" in rest else rest
        names = [n.strip() for n in rest.replace("\n", " ").split(",")]
        out.append((start + 1, i + 1, module, [n for n in names if n]))
        i += 1
    return out


def scan_imports() -> list[str]:
    """A `from .mod import X` must name something that module defines."""
    problems: list[str] = []
    cache: dict[Path, set[str]] = {}

    def defined_names(p: Path) -> set[str]:
        if p in cache:
            return cache[p]
        src = strip_docstrings(p.read_text(encoding="utf-8"))
        names: set[str] = set()
        for m in re.finditer(r"^\s*(?:def|struct|trait)\s+(\w+)", src, re.M):
            names.add(m.group(1))
        for m in re.finditer(r"^\s*(\w+)\s*:\s*[^=\n]+$", src, re.M):
            names.add(m.group(1))          # field / attribute declarations
        for m in re.finditer(r"^\s*comptime\s+(\w+)", src, re.M):
            names.add(m.group(1))
        # A name a module imports is part of that module's namespace, so it is
        # legitimately importable from here. Re-exporting is valid Mojo.
        for _s, _e, _mod, imported in parse_imports(src):
            names.update(imported)
        cache[p] = names
        return names

    for f in MOJO_FILES:
        rel = f.relative_to(ROOT)
        for lineno, _end, module, names in parse_imports(f.read_text(encoding="utf-8")):
            if not module.startswith("."):
                continue                     # std.* imports are external
            mod = module.lstrip(".")
            target = f.parent / f"{mod}.mojo"
            if not target.is_file():
                problems.append(f"{rel}:{lineno}: imports from {module} but {mod}.mojo does not exist")
                continue
            defined = defined_names(target)
            for name in names:
                if name != "*" and name not in defined:
                    problems.append(f"{rel}:{lineno}: `{mod}` does not define `{name}`")
    return problems


def scan_unused_imports() -> list[str]:
    """Report imported names that never appear in the body.

    `__init__.mojo` is exempt: a re-export file's entire job is to import
    names it does not itself call.
    """
    problems: list[str] = []
    for f in MOJO_FILES:
        if f.name == "__init__.mojo":
            continue
        rel = f.relative_to(ROOT)
        body = strip_docstrings(f.read_text(encoding="utf-8"))
        lines = body.split("\n")

        # The body is everything after the final import statement.
        last_import = 0
        for _start, end, _m, _n in parse_imports(body):
            last_import = max(last_import, end)
        for n, l in enumerate(lines):
            if re.match(r"^\s*import\s+[\w.]+", l):
                last_import = max(last_import, n)
        rest = "\n".join(lines[last_import:])

        for lineno, _end, _module, names in parse_imports(body):
            for name in names:
                if name == "*":
                    continue
                if not re.search(rf"(?<![\w.]){re.escape(name)}\b", rest):
                    problems.append(f"{rel}:{lineno}: imports `{name}` but never uses it")
    return problems


# --------------------------------------------------------------------------

# --------------------------------------------------------------------------
# 3. prose guard: no version-history narration
# --------------------------------------------------------------------------

# The tutorial teaches Mojo 1.x as it stands. It does not spend the reader's
# time on how the language got here. These patterns catch the phrasing that
# creeps back in when someone explains a correction by contrasting it with
# what came before.

HISTORY_PATTERNS = [
    (r"\bno longer\b", "drop the before/after narration; state the current rule instead"),
    (r"\bused to\b", "drop the before/after narration; state the current rule instead"),
    (r"\b(?:formerly|previously|earlier versions?|older versions?|legacy)\b",
     "drop the before/after narration; state the current rule instead"),
    (r"\bearly Mojo\b|\bMojo preview\b|\bpreview build\b",
     "drop the before/after narration; state the current rule instead"),
    (r"\bis not a keyword\b|\bwas not\b|\bare not keywords\b",
     "state the current rule directly instead of denying a former one"),
    (r"\bmigrat(?:e|ed|ion)\b", "drop migration framing; teach the current syntax"),
    (r"\bdeprecated\b|\blegacy\b", "drop migration framing; teach the current syntax"),
    (r"\bback ?wards[- ]compat", "drop compatibility framing"),
    (r"\bcorrections?\s+table\b|\bas originally written\b|\bwas originally\b",
     "remove the old-versus-new correction table"),
    (r"\b(?:formerly called|renamed from|changed from|used to be called)\b",
     "drop the before/after narration"),
    (r"\bMojo\s*(?:1\.0|0\.[0-9]|nightly|preview)\b", "reference the current release only"),
    (r"\bfn\s+vs\b|\bdef\s+vs\b", "no version comparison tables"),
]


def scan_history() -> list[str]:
    """Flag version-history narration in the tutorial prose."""
    problems: list[str] = []
    content = ROOT / "content"
    files = sorted(content.glob("*.html")) if content.is_dir() else []
    for f in files:
        rel = f.relative_to(ROOT.parent)
        text = f.read_text(encoding="utf-8")
        # Only prose: drop code figures and directives, since a code sample
        # may legitimately mention an API that does not exist.
        text = re.sub(r"\{\{code:.*?\}\}", "", text)
        for n, line in enumerate(text.split("\n"), 1):
            plain = re.sub(r"<[^>]+>", " ", line)
            for pat, msg in HISTORY_PATTERNS:
                if re.search(pat, plain, re.I):
                    problems.append(f"{rel}:{n}: {msg}\n      | {plain.strip()[:88]}")
    return problems


# --------------------------------------------------------------------------

# --------------------------------------------------------------------------
# 6. context managers used in call position
# --------------------------------------------------------------------------

# `assert_raises` is a context manager, not a function. Calling it as
# `assert_raises(Error, call())` type-checks in a way that looks plausible
# and silently asserts nothing. Every such helper in the std library is
# `with`-only, so this catches the whole class.

WITH_ONLY = ("assert_raises",)


def scan_with_only() -> list[str]:
    """Flag std context managers invoked without `with`."""
    problems: list[str] = []
    for f in MOJO_FILES:
        rel = f.relative_to(ROOT)
        for n, line in enumerate(f.read_text(encoding="utf-8").split("\n"), 1):
            stripped = line.strip()
            if stripped.startswith("#"):
                continue
            if stripped.startswith("with "):
                continue
            for name in WITH_ONLY:
                if re.search(rf"(?<![\w.]){name}\s*\(", line):
                    problems.append(
                        f"{rel}:{n}: `{name}` is a context manager; use `with {name}(...):`"
                    )
    return problems


# --------------------------------------------------------------------------
# 8. propagated raises
# --------------------------------------------------------------------------

# A call anywhere in a line, not only at the start. Most real call sites are
# `total = some_function(...)`, and a start-anchored pattern misses every one
# of them -- which is how `roots_of` calling a raising `divide_by_root` on the
# far right of an assignment slipped through.
CALL_RE = re.compile(r"(?<![.\w])([a-z_]\w*)\s*\(")

# Words that look like calls to a crude pattern but are not function calls.
NOT_CALLS = {
    "if", "elif", "else", "for", "while", "return", "raise", "assert", "with",
    "except", "finally", "and", "or", "not", "in", "is", "pass", "fn", "def",
    "struct", "var", "let", "comptime", "alias", "import", "from", "try",
    "out", "mut", "ref", "deinit", "raises", "yield", "match", "case",
}


def _signature(lines, start):
    """The whole `def` header, which may wrap across several physical lines.

    A signature that wraps is common once parameters are named and typed, and
    a checker that reads only the first physical line silently treats a
    wrapped `raises ->` as absent -- reporting a false problem, or missing a
    real one on the other side.
    """
    parts = []
    for i in range(start, min(start + 12, len(lines))):
        parts.append(lines[i])
        joined = " ".join(x.strip() for x in parts)
        if joined.rstrip().endswith(":") and (
            "->" in joined
            or joined.count("(") <= joined.count(")")
        ):
            return joined
    return " ".join(x.strip() for x in parts)


def _mojo_files():
    """Every Mojo file under the tutorial, libraries first.

    Libraries first matters only for the name collision rule in
    `_free_functions`; the sort keeps the report in a stable, readable order.
    """
    return sorted(LIBS.rglob("*.mojo")) + sorted(APPS.rglob("*.mojo"))


def _free_functions():
    """Every module-level `def` in every library and application module.

    Methods are excluded on purpose. A method calling a raising function is a
    separate and much noisier concern; the free functions are where this
    mistake actually occurred.

    Library definitions win a name collision, because a name defined in both
    places is a bug in the application and the library signature is the one
    worth checking against.
    """
    table = {}
    for f in _mojo_files():
        lines = f.read_text(encoding="utf-8").splitlines()
        in_doc = False
        for n, line in enumerate(lines):
            s = line.strip()
            if s.startswith('"""') or s.startswith("'''"):
                if len(s) < 6 or s[-3:] != s[:3]:
                    in_doc = not in_doc
                continue
            if in_doc or not s.startswith("def "):
                continue
            sig = _signature(lines, n)
            header = sig.strip()[4:]
            name = header.split("(")[0].strip()
            if "(" in header and header.split("(")[1].lstrip().startswith("self"):
                continue                      # a method, not a free function
            table[name] = (f, "raises" in sig)
    return table


def scan_propagated_raises() -> list[str]:
    """A function calling a raising sibling must declare `raises` itself.

    Check 2 only sees a literal `raise` statement, so it misses the far more
    common case: a function whose body calls another function that raises.
    The compiler catches this, but only once the code builds, and the entire
    purpose of this lint pass is that nothing here is ever compiled.

    Applications are scanned too, with one exemption: a call inside the body
    of a `with` statement does not propagate, because the handler catches
    it. That is exactly what `with assert_raises(Error):` is for, and it is
    why a test of a precondition can stay non-raising while its neighbours
    must not.
    """
    table = _free_functions()
    problems = []
    for f in _mojo_files():
        rel = f.relative_to(ROOT)
        lines = f.read_text(encoding="utf-8").splitlines()
        in_doc = False
        current_name = None
        current_raises = False
        saw_try = False
        with_indent = None
        for n, line in enumerate(lines):
            s = line.strip()
            indent = len(line) - len(line.lstrip())
            if s.startswith('"""') or s.startswith("'''"):
                if len(s) < 6 or s[-3:] != s[:3]:
                    in_doc = not in_doc
                continue
            if in_doc:
                continue
            if s.startswith("def ") and not line.startswith(" "):
                sig = _signature(lines, n)
                current_name = sig.strip()[4:].split("(")[0].strip()
                current_raises = "raises" in sig
                saw_try = False
                continue
            if s.startswith("struct ") and not line.startswith(" "):
                current_name = None
                continue
            if not s:
                continue                       # blank: block state unchanged

            if with_indent is not None and indent <= with_indent:
                with_indent = None             # dedented back out of the block
            if s.startswith("with ") and s.endswith(":"):
                with_indent = indent
            if with_indent is not None and indent > with_indent:
                continue                       # handled by the `with`

            if current_name is None or current_raises or saw_try:
                continue
            if s.startswith("try:"):
                # A function with a `try` block is handling errors by
                # construction, so a raising call inside it is deliberate.
                # That is the whole purpose of `is_positive_definite`, which
                # asks Cholesky whether a matrix is positive definite and
                # converts the failure into a `False`.
                saw_try = True
                continue
            # A trailing comment may name a raising function while
            # explaining something else, so it is stripped before the line is
            # scanned for calls. Check 1 does the same, for the same reason.
            code = line.split("#", 1)[0]
            for m in CALL_RE.finditer(code):
                callee = m.group(1)
                if callee in NOT_CALLS or callee == current_name:
                    continue
                info = table.get(callee)
                if info is None or not info[1]:
                    continue
                problems.append(
                    f"{rel}:{n + 1}: `{current_name}()` calls `{callee}()`, "
                    f"which is `raises` - add `raises` to its own signature"
                )
                break
    return problems



CHECKS = [
    ("forbidden syntax", scan_forbidden),
    ("raise / raises mismatch", scan_raises),
    ("mutation of non-mut parameter", scan_mut_params),
    ("broken intra-package import", scan_imports),
    ("unused import", scan_unused_imports),
    ("version-history narration in prose", scan_history),
    ("context manager called without `with`", scan_with_only),
    ("propagated raises", scan_propagated_raises),
]


def main() -> int:
    print(f"linting {len(MOJO_FILES)} Mojo files under tutorial/\n")
    total = 0
    for label, fn in CHECKS:
        found = fn()
        status = "ok  " if not found else "FAIL"
        print(f"  [{status}] {label}" + (f"  ({len(found)})" if found else ""))
        for p in found:
            print(f"        {p}")
        total += len(found)
    print()
    if total:
        print(f"{total} problem(s) found.")
        return 1
    print("clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main())