/* landing_stats.js - regenerate the corpus numbers on the landing page.
 *
 *   bun library/tools/build/landing_stats.js [--census <csv>]
 *
 * The stats are rendered, not fetched: the site is offline-first and served from
 * file:// in places, so a runtime fetch would break. Instead they are baked in here and
 * this tool keeps them honest, so the page can never quietly drift from the corpus.
 *
 * Note --csv-all, not --csv: the plain census CSV ranks only the pages that still have
 * Python, so it is empty by design now that the migration is done.
 *
 * Every figure is derived, never typed in by hand:
 *   pages / mojo / interop / python  <- py_census.js --csv-all --dir public/
 *   drills / projects                 <- counted from the filesystem
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const INDEX = join(ROOT, "public", "index.html");
const START = "<!-- landing-stats:start";
const END = "<!-- landing-stats:end -->";

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i !== -1 ? process.argv[i + 1] : null;
};

function countFiles(dir, re) {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) n += countFiles(full, re);
    else if (re.test(e.name)) n++;
  }
  return n;
}

function census() {
  const given = arg("--census");
  let raw;
  if (given) {
    raw = readFileSync(given, "utf8");
  } else {
    process.stderr.write("rendering census in headless Chrome, this takes a minute...\n");
    /* --dir public/ scopes the census to the tutorial. py_census.js otherwise walks
     * the whole repo root, which sweeps in the vendored Mojo manual (78 pages under
     * "single_source_of_truth mojo/") and the root index.html redirect stub. Neither is
     * tutorial content, and the manual carries its own code blocks, so an unscoped run
     * inflates pages, mojo and interop alike. */
    raw = execFileSync(
      "bun",
      ["run", "library/tools/py_census.js", "--csv-all", "--dir", "public/"],
      {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
      },
    );
  }

  /* CSV header is: page,py,py_labelled,py_guess,mojo,interop,c,unknown,unlabelled,py_lines */
  const rows = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[A-Za-z0-9_./\\-]+\.html,/.test(l))
    .map((l) => l.split(","));

  if (!rows.length) throw new Error("no census rows parsed - did the census emit its CSV?");

  const sum = (i) => rows.reduce((a, r) => a + (Number(r[i]) || 0), 0);
  return {
    pages: rows.length,
    python: sum(1),
    mojo: sum(4),
    interop: sum(5),
  };
}

const c = census();
const stats = {
  pages: c.pages,
  mojo: c.mojo,
  interop: c.interop,
  python: c.python,
  drills: countFiles(join(ROOT, "public", "praxis"), /^drill_\d+\.html$/),
  projects: countFiles(join(ROOT, "public", "praxis"), /^mini_project_\d+\.html$/),
};

const html = readFileSync(INDEX, "utf8");
const s = html.indexOf(START);
const e = html.indexOf(END);
if (s === -1 || e === -1) throw new Error(`${INDEX}: landing-stats markers not found`);
if (e < s) throw new Error(`${INDEX}: landing-stats markers are out of order`);

const region = html.slice(s, e);
let changed = 0;
const next = region.replace(/data-stat="([a-z]+)"[^>]*>[\d,]*</g, (m, key) => {
  if (!(key in stats)) throw new Error(`page declares data-stat="${key}" but this tool cannot compute it`);
  const before = m;
  const after = m.replace(/>[\d,]*</, `>${stats[key]}<`);
  if (before !== after) changed++;
  return after;
});

if (next === region) {
  console.log("landing stats already current: " + JSON.stringify(stats));
} else {
  const out = html.slice(0, s) + next + html.slice(e);
  const crlf = (html.match(/\r\n/g) || []).length > 0;
  writeFileSync(INDEX, crlf ? out.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n") : out);
  console.log(`updated ${changed} figure(s) in public/index.html: ` + JSON.stringify(stats));
}

/* The stats band is the single source of truth for these numbers: keep the prose free of
   counts so adding a listing to this page cannot invalidate a sentence about the corpus. */
const idx = readFileSync(INDEX, "utf8");
const stale = [...idx.matchAll(/(\d[\d,]*)\s+of them/g)].map((m) => m[0]);
if (stale.length) {
  console.error(
    `\nWARNING: landing prose hardcodes a corpus count (${stale.join("; ")}).\n` +
      `         Leave the numbers to the stats band - this page's own code block changes them.`,
  );
  process.exitCode = 1;
}
