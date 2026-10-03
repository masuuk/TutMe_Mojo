/* lang_dump.js — print per-<pre> language evidence for one page.
 * Usage: bun library/tools/lang_dump.js <html-path-substring>
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { classify } from "./lib/classify.js";
import { langOf, markupLang } from "./lib/lang.js";

const HERE = import.meta.dirname;
const ROOT = join(HERE, "..", "..");
const NEEDLE = process.argv[2];
const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => { try { return !!statSync(p); } catch { return false; } });

const TMP = join(tmpdir(), "opencode", "lang-dump");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
const PROBE = readFileSync(join(HERE, "hl_probe.js"), "utf8");

const SKIP = new Set([".git", "node_modules", "tools", "library"]);
function walk(d, out = []) {
  for (const e of require_readdir(d)) {
    if (SKIP.has(e)) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith(".html")) out.push(p);
  }
  return out;
}
function require_readdir(d) {
  return readdirSyncLocal(d);
}
import { readdirSync as readdirSyncLocal } from "node:fs";

const pages = walk(ROOT).filter((p) => relative(ROOT, p).replace(/\\/g, "/").includes(NEEDLE));

for (const page of pages) {
  const html = readFileSync(page, "utf8");
  const patched = html.replace(/<\/body>/i, `<script>${PROBE}</script></body>`);
  const tmpFile = join(TMP, relative(ROOT, page).replace(/[\\/]/g, "__"));
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
  if (!m) { console.log("no probe:", page); continue; }
  const rows = JSON.parse(m[1]);

  console.log("\n=== " + relative(ROOT, page).replace(/\\/g, "/") + " ===");
  let i = 0;
  for (const row of rows) {
    const kind = classify(row);
    if (kind !== "code") continue;
    i++;
    const v = langOf(row);
    const tag = `${v.lang}${v.source === "markup" ? " (label)" : v.source === "text" ? " (heuristic)" : ""}${v.interop ? " +interop" : ""}`;
    console.log(
      `\n[${String(i).padStart(2)}] ${tag}  chain=${(row.chain || "(none)").slice(0, 48)}\n` +
      `     langs=[${(row.langs || []).join(",")}] label="${row.label || ""}" score=${v.score ?? "n/a"}`,
    );
    console.log((row.text || "").split("\n").slice(0, 5).map((l) => "       │ " + l.slice(0, 84)).join("\n"));
  }
}
rmSync(TMP, { recursive: true, force: true });
