/* smoke.js — render an app page in headless Chrome and assert the live parts work.
 *
 *   bun run smoke.js <page.html>
 *
 * Injects a probe that reports, for the rendered DOM: KaTeX node count, mounted lab
 * count, per-lab readout rows and canvas pixel occupancy, quiz presence, TOC entries,
 * and any window.onerror / unhandled rejection. Prints JSON and exits non-zero on
 * failure. Visual output is checked numerically, since screenshots are not machine
 * checkable.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { statSync, existsSync } from "node:fs";

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => { try { return !!statSync(p); } catch { return false; } });
if (!CHROME) { console.error("no chrome/edge found"); process.exit(2); }

const argv = process.argv.slice(2).filter((a) => a !== "--inline");
const ALL = argv.includes("--all");
const APPS = [
  "public/data_science/data_science_mojo/index.html",
  "public/applications/finance/finance_mojo/index.html",
  "public/applications/geomatics/geomatics_mojo/index.html",
  "public/applications/operations_research/operations_research_mojo/index.html",
];
const ROOT = resolve(import.meta.dir, "..", "..");
const pages = ALL
  ? APPS.map((p) => resolve(ROOT, p)).filter((p) => existsSync(p))
  : [resolve(argv.find((a) => !a.startsWith("--")) || "")];
if (!pages.length || !existsSync(pages[0])) {
  console.error("usage: bun run smoke.js <page.html>   |   bun run smoke.js --all");
  process.exit(2);
}
const TMP = join(tmpdir(), "opencode", "app-smoke");

async function runPage(page) {
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const PROBE = `
(function () {
  var errs = window.__errs || [];
  function run() {
    var scripts = [].map.call(document.querySelectorAll("script[src]"), function (s) { return s.getAttribute("src"); });
    var links = [].map.call(document.querySelectorAll('link[rel="stylesheet"]'), function (l) { return l.getAttribute("href"); });
    var katexNodes = document.querySelectorAll(".katex").length;
    var displayMath = document.querySelectorAll(".katex-display").length;
    var labs = [].map.call(document.querySelectorAll("[data-lab]"), function (l) {
      var cv = l.querySelector("canvas");
      var rows = l.querySelectorAll(".readout-table tr").length;
      var painted = 0;
      if (cv) {
        var g = cv.getContext("2d");
        try {
          var d = g.getImageData(0, 0, cv.width, cv.height).data;
          for (var i = 3; i < d.length; i += 4) if (d[i] > 8) painted++;
        } catch (e) { painted = -1; }
      }
      return {
        name: l.dataset.lab,
        ctrls: l.querySelectorAll(".ctrls .ctrl").length,
        rows: rows,
        values: [].map.call(l.querySelectorAll(".readout-table tr"), function (r) {
          return r.children[0].textContent + "=" + r.children[1].textContent;
        }),
        canvas: cv ? { w: cv.width, h: cv.height, painted: painted } : null
      };
    });
    var out = {
      errors: errs,
      scripts: scripts,
      stylesheets: links,
      katexGlobal: typeof window.katex,
      renderGlobal: typeof window.renderMathInElement,
      katexNodes: katexNodes,
      displayMath: displayMath,
      rawDollarLeft: (document.body.innerHTML.match(/\\$\\$[^<]{0,80}/g) || []).length,
      modules: document.querySelectorAll("section.module").length,
      tocLinks: document.querySelectorAll("#toclist a").length,
      labs: labs,
      quizzes: document.querySelectorAll(".check[data-answer]").length,
      quizzesWithExplain: document.querySelectorAll(".check .explain").length,
      listings: document.querySelectorAll("figure.listing pre.code").length,
      copyBtns: document.querySelectorAll(".copy").length,
      outputPanels: document.querySelectorAll("pre.out").length,
      emptyValues: labs.length ? labs.filter(function (l) {
        return l.values.some(function (v) { return /^(NaN|undefined|Infinity|null)$/.test(v); });
      }).map(function (l) { return l.name; }) : []
    };
    var s = document.createElement("script");
    s.type = "application/json";
    s.id = "__smoke" + "probe";
    s.textContent = JSON.stringify(out);
    document.body.appendChild(s);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setTimeout);
  else setTimeout(run, 300);
  function setTimeout() { window.setTimeout(run, 300); }
})();
`;

/* The error listener must be installed in <head>, before app.js runs. A listener
 * appended at the end of <body> attaches after app.js has already thrown, so it
 * misses exactly the failure this gate exists to catch. */
const EARLY = `
<script>
window.__errs = [];
window.addEventListener("error", function (e) {
  window.__errs.push((e.target && e.target.tagName ? e.target.tagName + " " + (e.target.src || e.target.href || "") : String(e.message)) + (e.lineno ? " @" + e.lineno + ":" + e.colno : ""));
}, true);
window.addEventListener("unhandledrejection", function (e) { window.__errs.push("rejection: " + e.reason); });
</script>
`;

const html = readFileSync(page, "utf8");
const base = `<base href="${pathToFileURL(dirname(page)).href}/">`;
const withBase = /<base\s/i.test(html)
  ? html.replace(/<base\s[^>]*>/i, base)
  : html.replace(/<head([^>]*)>/i, `<head$1>${base}`);
/* Chrome reports file:// script errors as the opaque string "Script error." — a
 * cross-origin file cannot be inspected. So for --inline, replace the app's own
 * external <script src="app.js"> with the same source inlined in a try/catch, which
 * preserves execution order and timing but surfaces the real message and stack. */
const INLINE = process.argv.includes("--inline");
let body = withBase;
if (INLINE) {
  body = body.replace(/<script([^>]*)src="app\.js"([^>]*)><\/script>/i, (m, a, b) => {
    let src = m.match(/src="([^"]+)"/i);
    let file = src ? resolve(dirname(page), src[1]) : null;
    if (!file) return m;
    try {
      let code = readFileSync(file, "utf8");
      return `<script${a}${b}>\ntry {\n${code}\n} catch (err) {\n  window.__errs.push(String(err && err.stack || err));\n}\n</script>`;
    } catch {
      return m;
    }
  });
}

const patched = body
  .replace(/<\/head>/i, `${EARLY}</head>`)
  .replace(/<\/body>/i, `<script>${PROBE}</script></body>`);
const tmpFile = join(TMP, "page.html");
writeFileSync(tmpFile, patched, "utf8");

const proc = Bun.spawn(
  [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
   "--disable-extensions", "--disable-background-networking", "--hide-scrollbars",
   "--window-size=1400,1000", "--virtual-time-budget=9000", "--dump-dom",
   pathToFileURL(tmpFile).href],
  { stdout: "pipe", stderr: "ignore", cwd: dirname(page) },
);
const dom = await new Response(proc.stdout).text();
await proc.exited;

const m = /<script type="application\/json" id="__smokeprobe">([\s\S]*?)<\/script>/.exec(dom);
if (!m) { console.error(`${page}: smoke probe did not run (page may have thrown during load)`); return false; }
const r = JSON.parse(m[1]);

const fail = [];
if (r.errors.length) fail.push(`js errors: ${r.errors.join(" | ")}`);
if (r.katexNodes < 5) fail.push(`katex rendered only ${r.katexNodes} nodes`);
if (r.displayMath < 5) fail.push(`only ${r.displayMath} display equations rendered`);
if (!r.modules) fail.push("no modules found");
if (r.tocLinks !== r.modules) fail.push(`toc has ${r.tocLinks} links for ${r.modules} modules`);
if (r.quizzes !== r.modules) fail.push(`${r.quizzes} quizzes for ${r.modules} modules`);
if (r.quizzesWithExplain !== r.quizzes) fail.push(`${r.quizzes - r.quizzesWithExplain} quizzes lack an explanation`);
if (!r.labs.length) fail.push("no labs mounted");
for (const l of r.labs) {
  if (!l.ctrls) fail.push(`lab ${l.name} has no controls`);
  if (!l.rows) fail.push(`lab ${l.name} produced no readout rows`);
  if (!l.canvas) fail.push(`lab ${l.name} has no canvas`);
  else if (l.canvas.painted <= 0) fail.push(`lab ${l.name} canvas is blank`);
}
if (r.emptyValues.length) fail.push(`lab(s) showing NaN/undefined: ${r.emptyValues.join(", ")}`);

console.log(`${page.replace(ROOT + "\\", "").replaceAll("\\", "/")}: ${r.modules} modules, ${r.labs.length} labs, ${r.katexNodes} KaTeX nodes, ${r.listings} listings, ${r.outputPanels} output panels`);
if (fail.length) console.error("  FAILED\n  - " + fail.join("\n  - "));
rmSync(TMP, { recursive: true, force: true });
return fail.length === 0;
}

let ok = true;
for (const p of pages) ok = (await runPage(p)) && ok;
rmSync(TMP, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
