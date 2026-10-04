"""Build-time syntax highlighter for the Mojo library tutorial.

Emits HTML ``<span class="tk-...">`` markup at build time rather than at
runtime, so every code sample in the finished document is highlighted even
with JavaScript disabled.

Supported languages: mojo, bash, toml, yaml, text.
"""

from __future__ import annotations

import html
import re
from typing import Iterator

# --------------------------------------------------------------------------
# Mojo
# --------------------------------------------------------------------------

MOJO_BUILTIN = {
    "abs", "all", "any", "bool", "bytes", "debug", "denorm",
    "divmod", "enumerate", "error", "hex", "input",
    "int", "len", "list", "max", "min", "open", "ord", "pow", "print",
    "range", "round", "sorted", "str", "sum", "tuple", "zip",
}

MOJO_LITERAL = {"True", "False", "None", "Self", "simdwidth"}

MOJO_ANNOTATION = {
    "AnyType", "AnyLifetime", "Comparable", "Copyable", "DType",
    "Deinitable", "Equatable", "ExplicitlyCopyable", "Float16", "Float32",
    "Float64", "ImplicitlyCopyable", "Int", "Int8", "Int16", "Int32",
    "Int64", "KeyElement", "Lifetime", "Movable", "Origin", "Pointer",
    "SIMD", "String", "StringLiteral", "StringRef", "UInt", "UInt8",
    "UInt16", "UInt32", "UInt64", "UnsafePointer",
}

MOJO_TRAIT = {
    "Bool", "Error", "IO", "IntLike", "Registrable", "Stringable",
    "Writer", "Writable",
}

MOJO_KEYWORD_RE = re.compile(
    r"\b(?:and|as|assert|break|class|comptime|continue|def|del|elif|else"
    r"|except|finally|for|from|if|import|in|is|not|or|pass|raise|raises"
    r"|return|struct|trait|try|var|while|with|yield)\b"
)
MOJO_NAME_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
MOJO_NUMBER_RE = re.compile(
    r"0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+"
    r"|(?:\d[\d_]*)?\.\d[\d_]*(?:[eE][+-]?\d+)?"
    r"|\d[\d_]*\.(?![.\w])(?:[eE][+-]?\d+)?"
    r"|\d[\d_]*(?:[eE][+-]?\d+)?"
)
MOJO_STRING_RE = re.compile(
    r'"""[\s\S]*?"""'
    r"|'''[\s\S]*?'''"
    r'|"(?:\\.|[^"\\\n])*"'
    r"|'(?:\\.|[^'\\\n])*'"
)

# Operators, longest first. Note that `//` is a comment in Python but a
# floor-division operator in Mojo, so it is treated as an operator here.
MOJO_OP_RE = re.compile(
    r"\.\.\.|->|<=|>=|==|!=|\+=|-=|\*=|/=|%=|//|\*\*|<<|>>|\|=|&=|\^=|"
    r"[-+*/%=<>!&|^~?:@$.,;()\[\]{}]"
)


def _classify_mojo_word(word: str) -> str:
    if word in MOJO_LITERAL:
        return "tk-boolean"
    if word in MOJO_ANNOTATION:
        return "tk-builtin"
    if word in MOJO_TRAIT:
        return "tk-class-name"
    if word in MOJO_BUILTIN:
        return "tk-builtin"
    return ""


def _highlight_mojo_line(line: str) -> str:
    """Tokenise a single line of Mojo, preserving leading indentation."""
    out: list[str] = []
    i = 0
    n = len(line)
    indent = len(line) - len(line.lstrip(" \t"))
    out.append(html.escape(line[:indent], quote=False))
    i = indent
    seen_call_next = False

    while i < n:
        ch = line[i]

        # Triple-quoted string that starts on this line.
        if line.startswith('"""', i) or line.startswith("'''", i):
            delim = line[i : i + 3]
            end = line.find(delim, i + 3)
            end = n if end == -1 else end + 3
            out.append(f'<span class="tk-string">{html.escape(line[i:end])}</span>')
            i = end
            continue

        # Comment: '#' that is not inside a string (strings handled above).
        if ch == "#":
            out.append(f'<span class="tk-comment">{html.escape(line[i:])}</span>')
            break

        # String literal.
        if ch in "\"'":
            m = MOJO_STRING_RE.match(line, i)
            if m:
                out.append(f'<span class="tk-string">{html.escape(m.group(0))}</span>')
                i = m.end()
                continue

        # Decorators / attributes: @name
        if ch == "@":
            m = MOJO_NAME_RE.match(line, i + 1)
            if m:
                out.append(
                    f'<span class="tk-atrule">@</span>'
                    f'<span class="tk-property">{html.escape(m.group(0))}</span>'
                )
                i = m.end()
                seen_call_next = False
                continue

        # Number.
        if ch.isdigit() or (ch == "." and i + 1 < n and line[i + 1].isdigit()):
            m = MOJO_NUMBER_RE.match(line, i)
            if m:
                out.append(f'<span class="tk-number">{html.escape(m.group(0))}</span>')
                i = m.end()
                seen_call_next = False
                continue

        # Identifier or keyword.
        if ch.isalpha() or ch == "_":
            m = MOJO_NAME_RE.match(line, i)
            if m:
                word = m.group(0)
                # Look ahead past spaces for a '(' to classify as a call.
                j = m.end()
                while j < n and line[j] in " \t":
                    j += 1
                is_call = j < n and line[j] == "("
                is_attr = seen_call_next and is_call is False and i > 0 and line[i - 1] == "."

                if seen_call_next and line[i - 1] == ".":
                    cls = "tk-property"
                else:
                    kw = MOJO_KEYWORD_RE.fullmatch(word)
                    if kw:
                        cls = "tk-keyword"
                    elif word in ("raises",):
                        cls = "tk-keyword"
                    else:
                        cls = _classify_mojo_word(word)
                        if not cls:
                            cls = "tk-function" if is_call else ""

                text = html.escape(word)
                out.append(f'<span class="{cls}">{text}</span>' if cls else text)
                i = m.end()
                seen_call_next = False
                continue

        # Operators / punctuation. Longest-match first so that `->`, `//`
        # and `...` are one token rather than three. Whitespace is emitted
        # plainly: wrapping every space in a span inflates the file for
        # nothing and makes the markup unreadable.
        m = MOJO_OP_RE.match(line, i)
        if m:
            op = m.group(0)
            cls = "tk-punctuation" if op in "()[]{},:." else "tk-operator"
            out.append(f'<span class="{cls}">{html.escape(op)}</span>')
            i = m.end()
            seen_call_next = False
            continue

        out.append(html.escape(ch, quote=False))
        i += 1

    return "".join(out)


def highlight_mojo(src: str) -> str:
    return "\n".join(_highlight_mojo_line(line) for line in src.split("\n"))


# --------------------------------------------------------------------------
# Shell
# --------------------------------------------------------------------------

BASH_KEYWORDS = {
    "if", "then", "else", "elif", "fi", "for", "while", "do", "done",
    "case", "esac", "in", "function", "return", "export", "local",
    "source", "cd", "echo", "cat", "ls", "mkdir", "rm", "cp", "mv",
    "python", "git", "pip", "uv", "pixi", "make", "chmod",
}
BASH_ASSIGN_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")


def highlight_bash(src: str) -> str:
    out = []
    for raw in src.split("\n"):
        if raw.lstrip().startswith("#") or raw.lstrip().startswith("$ ") and "#" in raw:
            out.append(f'<span class="tk-comment">{html.escape(raw)}</span>')
            continue
        line = html.escape(raw, quote=False)
        if BASH_ASSIGN_RE.match(raw):
            name, _, rest = line.partition("=")
            line = (
                f'<span class="tk-property">{name}</span>'
                f'<span class="tk-operator">=</span>{rest}'
            )
        else:
            parts = []
            for tok in re.split(r"(\s+)", line):
                if not tok:
                    continue
                stripped = tok.strip("'\"|&;()<>")
                if stripped in BASH_KEYWORDS:
                    parts.append(f'<span class="tk-keyword">{tok}</span>')
                elif stripped.startswith("-") and len(stripped) > 1 and stripped[1].isalpha():
                    parts.append(f'<span class="tk-property">{tok}</span>')
                elif tok.strip("'\"").startswith("mojo"):
                    parts.append(f'<span class="tk-builtin">{tok}</span>')
                else:
                    parts.append(tok)
            line = "".join(parts)
        out.append(line)
    return "\n".join(out)


# --------------------------------------------------------------------------
# TOML / YAML  (light-touch: keys, strings, numbers, comments)
# --------------------------------------------------------------------------

def highlight_toml(src: str) -> str:
    out = []
    for raw in src.split("\n"):
        line = html.escape(raw, quote=False)
        line = re.sub(
            r'(?m)^(\s*\[[^\]]+\])',
            r'<span class="tk-keyword">\1</span>',
            line,
        )
        line = re.sub(
            r'(?m)^(\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*=)',
            r'\1<span class="tk-property">\2</span><span class="tk-operator">\3</span>',
            line,
        )
        line = re.sub(r'"[^"]*"', lambda m: f'<span class="tk-string">{m.group(0)}</span>', line)
        line = re.sub(
            r"(?<![\w.])\b\d[\d_]*(?:\.\d+)?\b",
            r'<span class="tk-number">\g<0></span>',
            line,
        )
        line = re.sub(r"#[^\n]*", lambda m: f'<span class="tk-comment">{m.group(0)}</span>', line)
        out.append(line)
    return "\n".join(out)


def highlight_yaml(src: str) -> str:
    out = []
    for raw in src.split("\n"):
        line = html.escape(raw, quote=False)
        line = re.sub(
            r"^(\s*)(-\s+)?([A-Za-z_][A-Za-z0-9_-]*)(:)",
            lambda m: (
                m.group(1)
                + (m.group(2) or "")
                + f'<span class="tk-property">{m.group(3)}</span>'
                + f'<span class="tk-punctuation">{m.group(4)}</span>'
            ),
            line,
        )
        line = re.sub(r'"[^"]*"', lambda m: f'<span class="tk-string">{m.group(0)}</span>', line)
        out.append(line)
    return "\n".join(out)


# --------------------------------------------------------------------------
# Dispatch
# --------------------------------------------------------------------------

HIGHLIGHTERS = {
    "mojo": highlight_mojo,
    "bash": highlight_bash,
    "sh": highlight_bash,
    "shell": highlight_bash,
    "toml": highlight_toml,
    "yaml": highlight_yaml,
    "yml": highlight_yaml,
    "text": lambda s: html.escape(s, quote=False),
}

LANG_LABELS = {
    "mojo": "Mojo",
    "bash": "Shell",
    "sh": "Shell",
    "shell": "Shell",
    "toml": "TOML",
    "yaml": "YAML",
    "yml": "YAML",
    "text": "Text",
    "output": "Output",
    "python": "Python",
}


def highlight(source: str, lang: str = "mojo") -> str:
    fn = HIGHLIGHTERS.get(lang, HIGHLIGHTERS["text"])
    return fn(source.rstrip("\n"))