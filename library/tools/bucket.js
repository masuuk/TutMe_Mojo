/* bucket.js — group the py_census CSV by migration strategy.
 * Usage: bun library/tools/bucket.js <csv-path>
 */
import { readFileSync } from "node:fs";

const raw = readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, "");
const csv = raw.trim().split(/\r?\n/);
/* The census prints a human report first; the CSV block starts at its header. */
const at = csv.findIndex((l) => l.startsWith("page,py"));
if (at === -1) { console.error("no CSV header found in " + process.argv[2]); process.exit(2); }
const head = csv[at].split(",");
const rows = csv.slice(at + 1).filter((l) => l.startsWith("public/")).map((l) => {
  const c = l.split(",");
  return Object.fromEntries(head.map((h, i) => [h, i === 0 ? c[0] : Number(c[i])]));
});

/* Strategy buckets, decided per page by what the Python there is *for*. */
const BUCKETS = [
  ["syntax_tour", "Syntax tour — side-by-side Mojo vs Python",
    (p) => /syntax_tour/.test(p)],
  ["interop", "Interop — Python reachable from Mojo",
    (p) => /interop/.test(p)],
  ["vs_mojo", "Head-to-head — Mojo vs Python by title",
    (p) => /_vs_mojo|advisory|pytorch|fine_tuning|decision_aware/.test(p)],
  ["cover", "Cover page — previews the book",
    (p) => /_00_cover|01_intro|01_why_mojo/.test(p)],
];

function bucketOf(p) {
  for (const [id, , test] of BUCKETS) if (test(p)) return id;
  return "tutorial";
}

const groups = new Map();
for (const r of rows) {
  const b = bucketOf(r.page);
  const g = groups.get(b) || { pages: 0, py: 0, certain: 0, guess: 0, interop: 0, lines: 0, list: [] };
  g.pages++; g.py += r.py; g.certain += r.py_labelled; g.guess += r.py_guess;
  g.interop += r.interop; g.lines += r.py_lines;
  g.list.push(r);
  groups.set(b, g);
}

const order = ["tutorial", "syntax_tour", "vs_mojo", "interop", "cover"];
const label = Object.fromEntries(BUCKETS.map(([id, l]) => [id, l]));
label.tutorial = "Straight tutorial — Python is incidental";
label.cover = "Cover page — previews the book";

console.log("\n  PYTHON BY MIGRATION BUCKET\n");
console.log("  " + "BUCKET".padEnd(44) + "PG".padStart(4) + "PY".padStart(5) + "LABEL".padStart(6) + "GUESS".padStart(6) + "PY-LINES".padStart(9));
console.log("  " + "-".repeat(76));
for (const id of order) {
  const g = groups.get(id);
  if (!g) continue;
  console.log("  " + label[id].padEnd(44) + String(g.pages).padStart(4) + String(g.py).padStart(5) +
    String(g.certain).padStart(6) + String(g.guess).padStart(6) + String(g.lines).padStart(9));
}
console.log("  " + "-".repeat(76));
const T = (k) => [...groups.values()].reduce((s, g) => s + g[k], 0);
console.log("  " + "TOTAL".padEnd(44) + String(rows.length).padStart(4) + String(T("py")).padStart(5) +
  String(T("certain")).padStart(6) + String(T("guess")).padStart(6) + String(T("lines")).padStart(9));

for (const id of order) {
  const g = groups.get(id);
  if (!g) continue;
  console.log(`\n  ${label[id].toUpperCase()}  (${g.pages} pages, ${g.py} Python blocks)`);
  for (const r of g.list.sort((a, b) => b.py - a.py)) {
    console.log(`    ${String(r.py).padStart(3)} py  ${String(r.mojo).padStart(3)} mj  ${String(r.py_lines).padStart(4)} ln  ` +
      `${r.page}${r.py_guess ? `   (${r.py_guess} heuristic-only)` : ""}`);
  }
}
console.log();
