/* render_dump.js — headless-Chrome render + DOM dump for the highlight audit.
 * Usage: bun library/tools/render_dump.js <html-file> [out-file]
 */
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const { writeFileSync } = await import("node:fs");
const { join, resolve } = await import("node:path");
const { pathToFileURL } = await import("node:url");

const page = resolve(process.argv[2]);
const out = process.argv[3] || join(process.env.TEMP, "opencode", "dom.html");
if (!process.argv[2]) { console.error("usage: render_dump.js <html> [out]"); process.exit(2); }

const url = pathToFileURL(page).href;
const args = [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
  "--disable-extensions", "--disable-background-networking",
  "--virtual-time-budget=8000", "--run-all-compositor-stages-before-draw",
  "--dump-dom", url,
];

const p = Bun.spawn([CHROME, ...args], { stdout: "pipe", stderr: "ignore" });
const dom = await new Response(p.stdout).text();
await p.exited;
writeFileSync(out, dom, "utf8");
console.log(`${out}  ${dom.length} bytes`);
