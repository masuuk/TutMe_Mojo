/* lib/lang.js — is a code block Mojo or Python?
 *
 * Mojo is a Python superset, so the two share def / import / for / if / print /
 * block colons. Scoring on individual "Python" keywords is what produced false
 * positives, so evidence is weighted by how *exclusive* it is:
 *
 *   +5  from std.X / from collection import / from python import   (namespace)
 *   +5  `from python import`  — interop: Mojo calling a Python library
 *   +4  t"..." t-strings                                        (Mojo-only)
 *   +4  comptime alias raises trait struct inout owned @parameter (Mojo-only)
 *   +3  var/mut/out/fn declarations                             (Mojo-only)
 *   +3  Float64 Int32 StringRef SIMD DType                      (Mojo-only)
 *   -5  f"..." f-strings, %-format, .format(                    (Python-only)
 *   -5  import numpy/pandas/matplotlib/sklearn/torch, dataclasses, typing
 *   -4  self / __init__ / super() / None
 *   -4  try:/except: as a statement                             (Mojo uses raises)
 *   -2  lowercase PEP-585 generics (list[int], dict[str, int])
 *   -2  if __name__ == "__main__", async/await, nonlocal, @property
 *
 * Explicit markup (class tokens, data-lang, the controlling tab button) always
 * wins over the text heuristic, so the heuristic only has to handle unlabelled
 * blocks. A third category, C/C++, covers listings that are neither — see
 * C_EXCLUSIVE. "c" is never a Python verdict.
 */

const MOJO_EXCLUSIVE = [
  [/\bfrom\s+(?:std|collection)\b/, 5],
  [/\bfrom\s+python\s+import\b|\bimport\s+python\b/, 5],
  [/(?:^|[^A-Za-z0-9_])t"/, 4],
  [/\b(?:comptime|alias|raises|trait|struct|inout|owned|borrowed|comptr|parameterize)\b/, 4],
  /* std.ffi vocabulary: the FFI API is Mojo-only and unmistakable. */
  [/\b(?:RegisterPassable|RegisterAbi|AnyReg|AnyType|AnyLifetime|OptionalReg|StaticString|MutUntrackedOrigin|TrackedOrigin)\b/, 4],
  [/@parameter\b|__copyinit__|__moveinit__/, 4],
  [/\b(?:var|mut|out|fn)\s+[A-Za-z_]\w*/, 3],
  [/\b(?:Float64|Float32|Float16|Int8|Int16|Int32|Int64|UInt8|UInt16|UInt32|UInt64|StringRef|SIMD|DType)\b/, 3],
  [/\b(?:SIMD|DType|Pointer|Tensor)\[/, 2],
  [/\braise(?:s)?\s+Error\b/, 2],
  [/\bmojo\s+(?:run|build|package|test|doc|repl)\b/, 2],
  [/\.mojo\b/, 1],
  [/->\s*[A-Z]\w*/, 1],
  [/\bInt\b|\bPointer\b|\bDType\b/, 1],
];

const PY_EXCLUSIVE = [
  [/(?:^|[^A-Za-z0-9_])f"|(?:^|[^A-Za-z0-9_])f'/, 5],
  /* %-formatting only counts directly after a string literal — bare "a % b" is
   * modulo, which Mojo shares with Python. */
  [/["'][^"']*["']\s*%\s*[\w(]/, 5],
  [/\.format\(/, 5],
  [/\b(?:import|from)\s+(?:numpy|pandas|matplotlib|sklearn|torch|tensorflow|scipy|seaborn|dataclasses|typing|collections|argparse|json|datetime|pathlib|csv|re|itertools|functools|unittest|pytest)\b/, 5],
  /* Mojo also has math/os/time-ish modules, so this is weak evidence at best. */
  [/\b(?:import|from)\s+(?:math|os|sys|time|random|statistics)\b/, 1],
  [/\bself\b|\b__init__\b|\bsuper\s*\(/, 4],
  [/\btry\s*:[\s\S]*?\bexcept\b/, 4],
  [/\blist\[|\bdict\[|\btuple\[|\bset\[/, 2],
  [/if\s+__name__\s*==/, 3],
  [/\basync\s+def\b|\bawait\b|\bnonlocal\b|@(?:property|staticmethod|classmethod)\b/, 2],
  /* "// comment" is a Python-ism mistake, but "//" mid-expression is Mojo
   * floor division. Only a line-leading // counts. */
  [/^\s*\/\/\s*\S/m, 1],
  [/\*\*?\w+\s*[,)]/, 1],
  [/\.py\b/, 1],
];

/** Score a block. Positive → Mojo, negative → Python. */
export function scoreBlock(t) {
  let s = 0;
  const hits = [];
  for (const [re, w] of MOJO_EXCLUSIVE) if (re.test(t)) { s += w; hits.push(`+${w} ${re}`); }
  for (const [re, w] of PY_EXCLUSIVE) if (re.test(t)) { s -= w; hits.push(`${-w} ${re}`); }
  /* `None` reads as Python, except as an Optional default: `= None` is a Mojo
   * idiom (an `Optional[...]` parameter), so a block that spells it that way is
   * not penalised. Scored here rather than in PY_EXCLUSIVE because "the block
   * contains `= None` somewhere" is a whole-text condition — a negative
   * lookahead inside the pattern is evaluated per position and lets the later
   * positions through anyway. */
  if (/\bNone\b/.test(t) && !/=\s*None\b/.test(t)) { s -= 3; hits.push("-3 None (not an `= None` default)"); }
  return { s, hits };
}

/** Score a block as C/C++. Threshold is deliberately high — see C_EXCLUSIVE. */
export function scoreC(t) {
  let s = 0;
  const hits = [];
  for (const [re, w] of C_EXCLUSIVE) if (re.test(t)) { s += w; hits.push(`+${w} ${re}`); }
  return { s, hits };
}

const PY_MARK = /^(?:py|python|python2|python3|ipython)$/;
const MOJO_MARK = /^(?:mojo|mj|mojo1x|mojo1|mojo-1)$/;
const C_MARK = /^(?:c|cpp|cxx|c\+\+|objective-c|objc|c-abi|cabi|chead)$/;
/* A tab labelled "C (shared lib)", "C++", "Objective-C"… but not "Copy"/"Cache". */
const C_LABEL = /(?:^|[\s(\[-])c(?:[\s)\].,:;-]|$)|c\+\+|\bcpp\b|objective-c|\bobjc\b/i;

/* Some listings are neither Mojo nor Python. A C-ABI tutorial legitimately
 * shows the .c file that a Mojo `extern` declaration binds to, and scoring that
 * as Python (braces read as "not Mojo", leading // reads as "not Mojo") inflates
 * the very count this tool exists to drive to zero. C is easy to spot: Python has
 * no braces, so a brace-style function definition is decisive. */
const C_EXCLUSIVE = [
  [/^\s*#\s*(?:include|define|ifndef|ifdef|ifndef|pragma|undef|elif)\b/m, 4],
  [/\b(?:int|void|char|float|double|long|short|unsigned|signed|size_t|FILE|bool|uint\d+_t|int\d+_t)\s+\*?\w+\s*\([^)\n;]*\)\s*\{/, 4],
  [/\bint\s+main\s*\(/, 4],
  [/\/\*[\s\S]*?\*\//, 3],
  [/^\s*#\s*!/m, 3],
  [/\bstruct\s+\w+\s*\{/, 2],
];

/* Markers arrive as bare tokens ("py") or prefixed ("lang-py", "language-python"). */
function normaliseMark(m) {
  return String(m).toLowerCase().replace(/^(?:lang|language)[-_]/, "");
}

/** Verdict from markup alone, or null when the page does not label the block.
 *  This is ground truth for the self-check: labelled blocks let us measure how
 *  often the text heuristic is right without a human reading every block. */
export function markupLang(row) {
  const marks = (row.langs || []).map(normaliseMark);
  const label = (row.label || "").toLowerCase();
  let saidPy = false, saidMojo = false;
  for (const m of marks) {
    if (PY_MARK.test(m)) saidPy = true;
    if (MOJO_MARK.test(m)) saidMojo = true;
  }
  /* A tab label claims a language when the word stands alone ("Python", "py")
   * or is a file extension ("main.py", "mod.mojo"). It does NOT claim one when
   * the word is only part of an API reference: a tab reading "Python.dict()"
   * names the Mojo API being called, while the block beside it is Mojo.
   * Substring matching here produced false positives that looked like Python
   * tutorials on pages that had none. */
  if (/\.py\b/.test(label) || /(?:^|[\s(\[/])(?:py|python|python2|python3|pypy)(?![\w.])/.test(label)) saidPy = true;
  if (/\.mojo\b/.test(label) || /(?:^|[\s(\[/])(?:mojo|mj|mojo1|mojo1x)(?![\w.])/.test(label)) saidMojo = true;
  if (saidPy === saidMojo) return null;      // unlabelled, or self-contradictory
  return saidPy ? "python" : "mojo";
}

/** Language verdict for one classified-as-code block.
 *  "mojo" | "python" | "c" | "unknown"  (interop is a separate flag)
 *
 *  Precedence: an explicit Mojo/Python label is ground truth and wins outright.
 *  Otherwise C is tested before the Mojo/Python score, because a C listing
 *  scores negative (it is not Mojo) and would otherwise be filed as Python. */
export function langOf(row) {
  const t = row.text || "";
  const marked = markupLang(row);

  /* Interop is the target state and is detectable from the text alone:
   * Mojo code that reaches into a Python library. Both the legacy
   * `from python import` and the Mojo 1.x `from std.python import` spellings
   * count, and `Python.import_module` is the commonest call of all. */
  const isInterop = /\bfrom\s+(?:std\.)?python\s+import\b|\bimport\s+(?:std\.)?python\b|\bPython\s*\.\s*(?:import_module|attach)\b|\bPython\s*\(\s*\)|\bpython\.attach|\bmojo\.builtins\b/.test(t);

  if (marked) return { lang: marked, source: "markup", interop: isInterop };

  const marks = (row.langs || []).map(normaliseMark);
  if (marks.some((m) => C_MARK.test(m)) || C_LABEL.test(String(row.label || ""))) {
    return { lang: "c", source: "markup", interop: isInterop };
  }

  const c = scoreC(t);
  if (c.s >= 4) return { lang: "c", source: "text", score: c.s, hits: c.hits, interop: isInterop };

  const { s, hits } = scoreBlock(t);
  if (s >= 2) return { lang: "mojo", source: "text", score: s, hits, interop: isInterop };
  if (s <= -2) return { lang: "python", source: "text", score: s, hits, interop: isInterop };
  return { lang: "unknown", source: "none", score: s, hits, interop: isInterop };
}
