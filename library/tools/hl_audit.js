/* hl_audit.js — authoritative syntax-highlight audit for the TutMe Mojo corpus.
 *
 * Every page is copied to a temp file with hl_probe.js injected, rendered in
 * headless Chrome, and the probe's JSON is read back. That gives us, per <pre>:
 *   · the ancestor class chain   → is this source code, or an output panel?
 *   · the token classes present  → did a highlighter run?
 *   · each token's computed color→ does the page's CSS actually paint it?
 *
 * FLAT    = code block whose tokens all compute to the base text colour
 *           (or that has no token markup at all) — i.e. it renders monochrome.
 * DEAD    = token markup present but every token resolves to one colour.
 * Usage: bun library/tools/hl_audit.js [--verbose] [--page <substr>]
 * Exit:  0 = clean, 1 = gaps found.
 */
import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync, rmSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { classify, looksLikeCode } from "./lib/classify.js";

const HERE = import.meta.dirname;
const ROOT = join(HERE, "..", "..");
const VERBOSE = process.argv.includes("--verbose");
const ONLY = (() => { const i = process.argv.indexOf("--page"); return i !== -1 ? process.argv[i + 1] : null; })();

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => { try { return !!statSync(p); } catch { return false; } });
if (!CHROME) { console.error("no chrome/edge found"); process.exit(2); }

const TMP = join(tmpdir(), "opencode", "hl-audit");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
const PROBE = readFileSync(join(HERE, "hl_probe.js"), "utf8");

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

/* A block renders monochrome when no token colour differs from the base. */
function isFlat(row, kind) {
  if (kind !== "code") return false;
  if (!row.cls.length) return true;
  const base = (row.base || "").replace(/\s/g, "");
  const seen = new Set(row.colors.map((c) => (c || "").replace(/\s/g, "")));
  if (base) seen.delete(base);
  return seen.size === 0;
}

async function probe(pageAbs) {
  const html = readFileSync(pageAbs, "utf8");
  /* The probe renders a copy in a temp dir, so a page's own relative
   * href/src (stylesheets, vendored bundles) would resolve against TMP and 404 —
   * which silently reports every token as the base colour, i.e. "flat". A <base>
   * pointing at the real directory makes the copy load assets exactly as the page
   * does. Rewrites a page's own <base>, if it has one. */
  const base = `<base href="${pathToFileURL(dirname(pageAbs)).href}/">`;
  const withBase = /<base\s/i.test(html)
    ? html.replace(/<base\s[^>]*>/i, base)
    : html.replace(/<head([^>]*)>/i, `<head$1>${base}`);
  const patched = withBase.replace(/<\/body>/i, `<script>${PROBE}</script></body>`);
  const tmpFile = join(TMP, relative(ROOT, pageAbs).replace(/[\\/]/g, "__"));
  writeFileSync(tmpFile, patched, "utf8");

  const p = Bun.spawn(
    [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
     "--disable-extensions", "--disable-background-networking", "--hide-scrollbars",
     "--window-size=1400,1000", "--virtual-time-budget=6000", "--dump-dom",
     pathToFileURL(tmpFile).href],
    { stdout: "pipe", stderr: "ignore", cwd: dirname(pageAbs) },
  );
  const dom = await new Response(p.stdout).text();
  await p.exited;
  const m = /<script type="application\/json" id="__hlprobe">([\s\S]*?)<\/script>/.exec(dom);
  if (!m) return { rows: [], dom };
  try { return { rows: JSON.parse(m[1]), dom }; } catch { return { rows: [], dom }; }
}

const pages = walk(ROOT).filter((p) => !ONLY || relative(ROOT, p).replace(/\\/g, "/").includes(ONLY));
const results = [];
const queue = [...pages];

await Promise.all(Array.from({ length: 6 }, async () => {
  for (let page; (page = queue.shift()); ) {
    const src = readFileSync(page, "utf8");
    const { rows } = await probe(page);
    let code = 0, hi = 0, flat = 0, out = 0;
    const samples = [];
    for (const row of rows) {
      const kind = classify(row);
      if (kind === "code") {
        code++;
        if (!isFlat(row, kind)) hi++;
        else { flat++; samples.push(row); }
      } else out++;
    }
    const engines = ["mojo-hl.js", "__tutmeHL", "MOJO_RE", "tok-cmt"]
      .filter((k) => src.includes(k));
    results.push({
      rel: relative(ROOT, page).replace(/\\/g, "/"),
      engine: engines.length ? engines.join("+") : "none",
      pre: rows.length, code, hi, flat, out, samples,
    });
  }
}));

const gaps = results.filter((r) => r.flat).sort((a, b) => b.flat - a.flat || a.rel.localeCompare(b.rel));
let total = 0, pagesFlat = 0;

console.log(`\n  Mojo syntax-highlight audit  ·  ${results.length} page(s), rendered in Chrome\n`);
console.log("  " + "PAGE".padEnd(52) + "ENGINE".padEnd(22) + "PRE".padStart(4) + "CODE".padStart(5) + "HI".padStart(4) + "FLAT".padStart(5));
console.log("  " + "-".repeat(100));
for (const r of gaps) {
  total += r.flat; pagesFlat++;
  console.log("  " + r.rel.padEnd(52) + r.engine.padEnd(22) + String(r.pre).padStart(4) + String(r.code).padStart(5) + String(r.hi).padStart(4) + String(r.flat).padStart(5));
  if (VERBOSE) for (const s of r.samples.slice(0, 4)) {
    console.log("       chain: " + (s.chain || "(none)").slice(0, 90));
    console.log("       " + s.text.trim().split("\n").slice(0, 2).map((l) => "│ " + l.slice(0, 74)).join("\n       "));
  }
}
const clean = results.filter((r) => !r.flat);
console.log("  " + "-".repeat(100));
console.log(`  ${pagesFlat} page(s) with flat code · ${total} flat block(s) · ${clean.length} page(s) clean`);
console.log();
rmSync(TMP, { recursive: true, force: true });
process.exit(total ? 1 : 0);
