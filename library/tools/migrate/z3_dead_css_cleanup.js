/* Deferred cleanup: drop the now-dead Python swatch styling left behind by the migration.
 *
 * Four pages still declare --py-blue / --py-yellow and three still carry a
 * .tab[data-lang="python"] .sw rule, but no element anywhere uses data-lang="python" any
 * more. Removing the rule before confirming that would strip the swatch colour off a live
 * tab, so each page is asserted first.
 */
import { readFileSync } from "node:fs";
import { loadPage, savePage } from "../lib/edit.js";

const PAGES = [
  "public/data_science/data_science.html",
  "public/data_science/ds_textbook_00_cover.html",
  "public/data_science/ds_textbook_01_why_mojo.html",
  "public/data_science/ds_textbook_06_interop.html",
];

/* A data-lang="python" that is an actual attribute on a tab element, not a CSS selector. */
const LIVE_PYTHON_TAB = /<[a-z]+\b[^>]*class="[^"]*\btab\b[^"]*"[^>]*data-lang="python"/i;

for (const path of PAGES) {
  const page = loadPage(path);
  let h = page.text;

  if (LIVE_PYTHON_TAB.test(h)) {
    throw new Error(`${path}: still has a live data-lang="python" tab; leaving its CSS alone`);
  }

  const before = h.length;
  let n = 0;

  h = h.replace(/\.tab\[data-lang="python"\]\s*\.sw\s*\{[^}]*\}\s*/g, () => { n++; return ""; });
  h = h.replace(/--py-blue\s*:\s*[^;]+;\s*/g, () => { n++; return ""; });
  h = h.replace(/--py-yellow\s*:\s*[^;]+;\s*/g, () => { n++; return ""; });

  if (n === 0) throw new Error(`${path}: expected to remove something, removed none`);
  if (/--py-blue|--py-yellow|tab\[data-lang="python"\]/.test(h)) {
    throw new Error(`${path}: python swatch CSS still present after cleanup`);
  }
  if (/var\(--py-/.test(h)) throw new Error(`${path}: a var(--py-*) reference would be left dangling`);

  /* the emptied :root rule must still be valid CSS */
  const root = h.match(/:root\s*\{([^}]*)\}/);
  if (root && /^\s*$/.test(root[1])) throw new Error(`${path}: :root would be left empty`);

  savePage(page, h);
  console.log(`${path}  removed ${n} dead declaration(s), ${before - h.length} bytes, eol=${JSON.stringify(page.eol)}`);
}

console.log("\nre-reading from disk to confirm all four are clean:");
for (const path of PAGES) {
  const t = new TextDecoder().decode(readFileSync(path));
  const left = /--py-blue|--py-yellow|tab\[data-lang="python"\]/.test(t);
  console.log(`  ${left ? "FAIL" : "ok  "} ${path}`);
  if (left) process.exitCode = 1;
}
