/* lib/classify.js — shared <pre> block classification.
 *
 * Extracted so hl_audit.js (does highlighting work?) and py_census.js
 * (is it Python?) can never disagree about what counts as a code block.
 *
 * A block is "code" only on positive evidence. Output panels, terminal
 * sessions, math/LaTeX panels, ASCII diagrams and aligned reference tables all
 * sit inside the same markup as real code, so the default is "not code".
 */

/* Container semantics, keyed by *whole* class-name tokens. The chain string is
 * tokenised on whitespace and on -/_ so "output-panel" yields {output, panel}
 * and "code-panels" yields {code, panels} — substring matching gets this wrong. */
export const STRONG_OUT = new Set([
  "out", "outs", "output", "outputs", "result", "results", "terminal", "console",
  "expected", "actual", "answer", "ans", "stdout", "stderr", "traceback",
  "log", "logs", "print", "printed", "run", "runs", "execution",
  "math", "eq", "equation", "equations", "latex", "katex", "formula", "formulas",
]);
export const WEAK_OUT = new Set([
  "shell", "bash", "sh", "zsh", "session", "cmd", "cli",
  "err", "error", "errors", "panel", "panels",
]);
export const SRC = new Set([
  "code", "codes", "codeblock", "codeblocks", "source", "src", "snippet", "snippets",
  "ide", "hl", "highlight", "highlighting", "program", "sample", "example",
  "mojo", "python", "py", "lang", "language",
]);

/* Split an ancestor chain into whole class-name tokens. */
export function tokensOf(chain) {
  const out = new Set();
  for (const cls of (chain || "").split("|")) {
    for (const t of cls.split(/\s+/)) {
      if (!t) continue;
      for (const part of t.split(/[-_]+/)) if (part) out.add(part.toLowerCase());
    }
  }
  return out;
}

export function textSaysCode(t) {
  if (/\b(def|fn|struct|trait|class|import|from|var|mut|let|return|for|while|if|elif|else|with|try|except|raise|raises|comptime|alias|out|yield|lambda|pass|assert)\b/.test(t)) return true;
  if (/\b(Float64|Float32|Float16|Int32|Int64|UInt8|String|StringRef|Bool|Tensor|SIMD|DType|List|Dict)\b/.test(t)) return true;
  if (/^[ \t]*[A-Za-z_$][\w$.]*\s*(?::[^=\n]+)?(?:=|\+=|-=|\*=|\/=)/m.test(t)) return true;
  return false;
}

export function textSaysOutput(t) {
  if (/^(?:\$|>|#|PS[ >]|C:)/m.test(t) && !/\b(def|fn|struct|import)\b/.test(t)) return true;
  if (/\b(error:|Traceback \(most recent call last\)|Unhandled exception)/.test(t) && !/\b(def|fn|struct|import)\b/.test(t)) return true;
  if (/^\s*\w+[\w ]*:/.test(t) && !/[=]{1,2}\s*\S/.test(t.split("\n")[0] ?? "")) return true;
  return false;
}

/* Aligned columns of words — reference tables, GPU matrices, training logs.
 * Lines carry 2+ internal double-spaces (column gutters) and no code operators. */
export function looksLikeColumnarText(t) {
  const lines = t.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
  if (lines.length < 2) return false;
  let cols = 0;
  for (const l of lines) {
    if (!/[^ ] {2,}\S/.test(l)) continue;           // no column gutter
    if (/[=+*<>]|::|\bdef\b|\bvar\b|\bimport\b|\breturn\b/.test(l)) continue;
    cols++;
  }
  return cols / lines.length >= 0.6;
}

/* Box-drawing diagrams and plots: mostly rule characters, no real tokens. */
export function looksLikeAsciiArt(t) {
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3) return false;
  let art = 0;
  for (const l of lines) {
    if (!/[A-Za-z0-9]/.test(l)) { art++; continue; }
    if (/^[-+|v^<>/\\=*#.\s]+$/.test(l)) { art++; continue; }
    if (/[|+\-]{3,}/.test(l)) { art++; continue; }
  }
  return art / lines.length >= 0.35;
}

/* Positive evidence that a block really is source code. Output panels often
 * contain "a = 7" or "x: 1", so an assignment alone is not enough on its own. */
export function looksLikeCode(t) {
  if (looksLikeColumnarText(t) || looksLikeAsciiArt(t)) return false;
  if (textSaysCode(t)) return true;
  if (/^[ \t]*(?:@\w+|def |fn |class |struct |trait |alias |import |from \S+ import|var |let |mut |out |for |while |if |elif |else|return |raise |yield |with |try |print\(|\.\w+\()/m.test(t)) return true;
  if (/[A-Za-z_]\w*\([^)]*\)/.test(t)) return true;
  return false;
}

export function classify(row) {
  const toks = tokensOf(row.chain);
  const has = (set) => { for (const t of toks) if (set.has(t)) return true; return false; };
  const t = row.text || "";

  /* 1. Diagrams, plots and aligned reference tables are never source. */
  if (looksLikeAsciiArt(t) || looksLikeColumnarText(t)) return "out";
  /* 2. Output wins on its own text evidence. */
  if (textSaysOutput(t) && !looksLikeCode(t)) return "out";
  /* 3. A tokenless sibling of highlighted code in the same widget is output. */
  if (!row.cls?.length && row.sibHi > 0) return "out";
  /* 4. A dedicated output/math container beats a generic wrapper further up. */
  if (has(STRONG_OUT)) return "out";
  /* 5. Positive code evidence, then the container chain as a tiebreaker. */
  if (looksLikeCode(t)) return "code";
  if (has(SRC)) return "code";
  if (has(WEAK_OUT)) return "out";
  return "prose";
}
