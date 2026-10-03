/* py_census.js — how much Python is left in the tutorials, and where.
 *
 * Reuses hl_probe.js so every <pre> is classified with the same code/output
 * rules as hl_audit.js, then adds a language verdict per code block:
 *
 *   mojo     Mojo source
 *   python   Python source shown as a tutorial snippet
 *   mixed    a block that is Mojo calling Python (interop) — the target state
 *   unknown  no reliable signal; needs a human look
 *
 * Usage: bun library/tools/py_census.js [--verbose] [--page <substr>] [--dir <substr>]
 * Exit:  0 = no Python snippets, 1 = Python remains.
 */
import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = join(HERE, "..", "..");
const VERBOSE = process.argv.includes("--verbose");
const arg = (n) => { const i = process.argv.indexOf(n); return i !== -1 ? process.argv[i + 1] : null; };
const ONLY_PAGE = arg("--page");
const ONLY_DIR = arg("--dir");

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => { try { return !!statSync(p); } catch { return false; } });
if (!CHROME) { console.error("no chrome/edge found"); process.exit(2); }

const TMP = join(tmpdir(), "opencode", "py-census");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
const PROBE = readFileSync(join(HERE, "hl_probe.js"), "utf8");

/* ---- classification comes from the shared module so this tool and
 *      hl_audit.js can never disagree about what counts as a code block. ---- */
import { classify } from "./lib/classify.js";
import { langOf, markupLang, scoreBlock } from "./lib/lang.js";

/* ---- run ----------------------------------------------------------------- */
const SKIP_DIR = new Set([".git", "node_modules", "tools", "library"]);
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP_DIR.has(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith(".html")) out.push(p);
  }
  return out;
}

let pages = walk(ROOT);
if (ONLY_PAGE) pages = pages.filter((p) => relative(ROOT, p).replace(/\\/g, "/").includes(ONLY_PAGE));
if (ONLY_DIR) pages = pages.filter((p) => relative(ROOT, p).replace(/\\/g, "/").includes(ONLY_DIR));

async function probe(pageAbs) {
  const html = readFileSync(pageAbs, "utf8");
  const patched = html.replace(/<\/body>/i, `<script>${PROBE}</script></body>`);
  const tmpFile = join(TMP, relative(ROOT, pageAbs).replace(/[\\/]/g, "__"));
  writeFileSync(tmpFile, patched, "utf8");
  const p = Bun.spawn(
    [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
     "--disable-extensions", "--disable-background-networking", "--hide-scrollbars",
     "--window-size=1400,1000", "--virtual-time-budget=6000", "--dump-dom",
     pathToFileURL(tmpFile).href],
    { stdout: "pipe", stderr: "ignore" },
  );
  const dom = await new Response(p.stdout).text();
  await p.exited;
  const m = /<script type="application\/json" id="__hlprobe">([\s\S]*?)<\/script>/.exec(dom);
  if (!m) return [];
  try { return JSON.parse(m[1]); } catch { return []; }
}

const results = [];
/* Self-check: for every block the page labels, the text heuristic is scored
 * against the label. A low agreement rate means the "unknown" bucket is the
 * honest one and the Python counts need human review before acting. */
const check = { agree: 0, disagree: 0, abstained: 0, mismatches: [] };
const queue = [...pages];
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let page; (page = queue.shift()); ) {
    const rows = await probe(page);
    const tally = { mojo: 0, python: 0, interop: 0, unknown: 0, c: 0, unlabelled: 0, pyLabelled: 0, pyGuess: 0 };
    const pyLines = [];
    for (const row of rows) {
      if (classify(row) !== "code") continue;
      const v = langOf(row);
      if (v.lang === "mojo") tally.mojo++;
      else if (v.lang === "python") tally.python++;
      else if (v.lang === "c") tally.c++;
      else tally.unknown++;
      if (v.interop) tally.interop++;
      if (v.source !== "markup") tally.unlabelled++;
      if (v.lang === "python") {
        /* page-labelled Python is certain; heuristic-only Python is a guess. */
        if (v.source === "markup") tally.pyLabelled++;
        else tally.pyGuess++;
      }

      const truth = markupLang(row);
      if (truth) {
        const { s } = scoreBlock(row.text || "");
        const guess = s >= 2 ? "mojo" : s <= -2 ? "python" : null;
        if (!guess) check.abstained++;
        else if (guess === truth) check.agree++;
        else {
          check.disagree++;
          if (check.mismatches.length < 25) {
            check.mismatches.push({
              rel: relative(ROOT, page).replace(/\\/g, "/"),
              truth, guess, s,
              head: (row.text || "").trim().split("\n").slice(0, 2).join(" / ").slice(0, 70),
            });
          }
        }
      }

      if (v.lang === "python") {
        const n = (row.text || "").split("\n").filter((x) => x.trim()).length;
        pyLines.push({ n, head: (row.text || "").trim().split("\n").slice(0, 2).join(" / ").slice(0, 84) });
      }
    }
    const tot = tally.mojo + tally.python + tally.unknown + tally.c;
    results.push({
      rel: relative(ROOT, page).replace(/\\/g, "/"),
      ...tally, tot,
      pyLines: pyLines.sort((a, b) => b.n - a.n),
    });
  }
}));

/* ---- report -------------------------------------------------------------- */
const withPy = results.filter((r) => r.python > 0).sort(
  (a, b) => b.python - a.python || b.pyLines.reduce((s, x) => s + x.n, 0) - a.pyLines.reduce((s, x) => s + x.n, 0),
);
const dirTally = new Map();
for (const r of results) {
  const d = r.rel.split("/").slice(0, 2).join("/");
  const e = dirTally.get(d) || { mojo: 0, python: 0, interop: 0, unknown: 0, c: 0, pages: 0, pyLabelled: 0, pyGuess: 0 };
  e.mojo += r.mojo; e.python += r.python; e.interop += r.interop; e.unknown += r.unknown; e.c += r.c;
  e.pyLabelled += r.pyLabelled; e.pyGuess += r.pyGuess;
  if (r.python) e.pages++;
  dirTally.set(d, e);
}
const sum = (k) => results.reduce((s, r) => s + r[k], 0);

console.log(`\n  Python census  ·  ${results.length} page(s), rendered in Chrome\n`);
console.log("  " + "AREA".padEnd(30) + "MOJO".padStart(6) + "INTEROP".padStart(8) + "PYTHON".padStart(8) + "C".padStart(4) + "UNKNOWN".padStart(8) + " PG W/ PY");
console.log("  " + "-".repeat(82));
for (const [d, e] of [...dirTally].sort((a, b) => b[1].python - a[1].python)) {
  console.log("  " + d.padEnd(30) + String(e.mojo).padStart(6) + String(e.interop).padStart(8) + String(e.python).padStart(8) + String(e.c).padStart(4) + String(e.unknown).padStart(8) + String(e.pages).padStart(11));
}
console.log("  " + "-".repeat(82));
console.log("  " + "TOTAL".padEnd(30) + String(sum("mojo")).padStart(6) + String(sum("interop")).padStart(8) + String(sum("python")).padStart(8) + String(sum("c")).padStart(4) + String(sum("unknown")).padStart(8) + String(withPy.length).padStart(11));

/* Detector accuracy, measured against blocks the pages label themselves. */
const total = check.agree + check.disagree + check.abstained;
const pct = total ? ((check.agree / total) * 100).toFixed(1) : "n/a";
const dec = check.agree + check.disagree;
console.log(`\n  Detector self-check vs page labels: ${check.agree}/${total} correct (${pct}%), ` +
  `${check.disagree} wrong, ${check.abstained} abstained` +
  (dec ? `  — of decided blocks ${((check.agree / dec) * 100).toFixed(1)}%` : "") + ".");
console.log(`  Python evidence: ${sum("pyLabelled")} block(s) the page itself labels Python (certain), ` +
  `${sum("pyGuess")} inferred by heuristic (review before acting).`);
console.log(`  ${sum("unlabelled")} block(s) carry no language label at all and rely on the heuristic.`);
if (VERBOSE && check.mismatches.length) {
  console.log("\n  MISMATCHES (heuristic vs label)");
  for (const m of check.mismatches) {
    console.log(`   ${m.rel}\n     label=${m.truth} guess=${m.guess} score=${m.s > 0 ? "+" : ""}${m.s} │ ${m.head}`);
  }
}

console.log(`\n  ${sum("python")} Python code block(s) across ${withPy.length} page(s).\n`);
if (process.argv.includes("--csv") || process.argv.includes("--csv-all")) {
  /* --csv ranks the pages that still have Python, so it goes empty once the migration
     finishes. --csv-all is the full inventory, which is what a "137 pages / 702 Mojo
     blocks" style summary needs. */
  const all = process.argv.includes("--csv-all");
  console.log("page,py,py_labelled,py_guess,mojo,interop,c,unknown,unlabelled,py_lines");
  for (const r of all ? results : results.filter((x) => x.python > 0)) {
    const lines = r.pyLines.reduce((s, x) => s + x.n, 0);
    console.log([r.rel, r.python, r.pyLabelled, r.pyGuess, r.mojo, r.interop, r.c, r.unknown, r.unlabelled, lines].join(","));
  }
  console.log();
  rmSync(TMP, { recursive: true, force: true });
  process.exit(0);
}
console.log("  PAGES RANKED BY PYTHON VOLUME");
console.log("  " + "PAGE".padEnd(52) + "PY".padStart(4) + "MOJO".padStart(6) + "LINES".padStart(7));
console.log("  " + "-".repeat(70));
for (const r of withPy) {
  const lines = r.pyLines.reduce((s, x) => s + x.n, 0);
  console.log("  " + r.rel.padEnd(52) + String(r.python).padStart(4) + String(r.mojo).padStart(6) + String(lines).padStart(7));
  if (VERBOSE) for (const p of r.pyLines.slice(0, 3)) console.log("       · " + String(p.n).padStart(3) + " lines │ " + p.head);
}
console.log();
rmSync(TMP, { recursive: true, force: true });
process.exit(sum("python") ? 1 : 0);
