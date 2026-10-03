/* verify_page.js - the structural gate for one migrated page.
 *
 * Usage: bun library/tools/verify_page.js <page-slug-or-path> [...]
 *
 * This is deliberately static-only: tag balance, line endings, encoding, the
 * tab/pane bijection, the active-tab invariant, fragment targets, and leftover
 * Python controls. It does NOT adjudicate language - that needs the Chrome-rendered
 * classifier, so run lang_dump.js or py_census.js for that. The `py?` column here is
 * a cheap sniff (a <pre> whose text starts like Python) to catch an obvious miss.
 */
import { readFileSync, readdirSync } from "node:fs";

const argv = process.argv.slice(2);
const ALL = argv.includes("--all");
const args = argv.filter((a) => a !== "--all");
if (!ALL && !args.length) {
  console.error("usage: bun library/tools/verify_page.js [--all] <page> [...]");
  process.exit(2);
}

function allPages() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".html")) out.push(full);
    }
  };
  walk("public");
  return out;
}

function resolvePage(a) {
  if (a.includes("/") || a.endsWith(".html")) return a;
  const { execSync } = require("node:child_process");
  const out = execSync(`dir /s /b public\\${a}.html`, { encoding: "utf8", shell: "cmd.exe" });
  const first = out.split(/\r?\n/).filter(Boolean)[0];
  return first ? first.replace(/\\/g, "/") : null;
}

const unescapeHtml = (s) =>
  s.replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

let failures = 0;

for (const arg of ALL ? allPages() : args) {
  const p = resolvePage(arg);
  if (!p) {
    console.log(`  FAIL ${arg}: NOT FOUND`);
    failures++;
    continue;
  }
  const bytes = readFileSync(p);
  const raw = new TextDecoder("utf-8").decode(bytes);
  const problems = [];
  const warnings = [];

  /* Structural counts must run on the document, not on inline JS. A syntax highlighter
     that builds '<span class="kw">' in a script string is not a real span, and an SPA that
     assembles markup in a template literal is not a real unbalanced div. */
  const text = raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) problems.push("has BOM");
  const crlf = (raw.match(/\r\n/g) || []).length;
  const bare = (raw.match(/(?<!\r)\n/g) || []).length;
  if (crlf > 0 && bare > 0) problems.push(`MIXED EOL (${crlf} CRLF / ${bare} LF)`);
  if (text.includes("\uFFFD")) problems.push("contains U+FFFD");

  const cnt = (re) => (text.match(re) || []).length;
  for (const [tag, re] of [["div", /<div[ >]/g], ["section", /<section[ >]/g], ["pre", /<pre[ >]/g], ["code", /<code[ >]/g], ["span", /<span[ >]/g]]) {
    const o = cnt(re);
    const c = cnt(new RegExp(`</${tag}>`, "g"));
    if (o !== c) problems.push(`${tag} unbalanced ${o}/${c}`);
  }

  const targets = [...text.matchAll(/data-(?:target|tab)="([^"]+)"/g)].map((m) => m[1]);
  /* Only real code panes: a <pre> with an id, or a div explicitly classed pane/tab-content. */
  const paneIds = [
    ...[...text.matchAll(/<pre\b[^>]*id="([^"]+)"/g)].map((m) => m[1]),
    ...[...text.matchAll(/<div\b[^>]*\bclass="[^"]*\b(?:code-tab-content|tab-content|pane)\b[^"]*"[^>]*id="([^"]+)"/g)].map((m) => m[1]),
  ];
  for (const t of targets) if (!paneIds.includes(t)) problems.push(`tab target with no pane: ${t}`);
  const targeted = new Set(targets);
  for (const id of paneIds) if (!targeted.has(id)) problems.push(`pane with no tab: ${id}`);

  for (const g of text.matchAll(/<div class="tabs">([\s\S]*?)<\/div>/g)) {
    const n = (g[1].match(/class="tab(?: active)?"/g) || []).length;
    const a = (g[1].match(/class="tab active"/g) || []).length;
    if (n > 0 && a !== 1) problems.push(`tab group has ${a} active of ${n}`);
  }
  /* A "block" is any element whose class attr contains one of the pane-ish classes.
     Match anywhere in the attribute, not just at the start: pages variously use
     code-block, code-tab-content, tab-content, pane. */
  const BLOCK_CLASS = /\b(?:code-block|code-tab-content|tab-content|pane)\b/;
  let blocks = 0;
  let activeBlocks = 0;
  for (const m of text.matchAll(/<[a-z]+\b[^>]*\bclass="([^"]*)"[^>]*>/g)) {
    if (!BLOCK_CLASS.test(m[1])) continue;
    blocks++;
    if (/\bactive\b/.test(m[1])) activeBlocks++;
  }
  /* Only pages that actually have tab bars need exactly one active pane.
     A page that shows every block expanded has no tabs and legitimately has none active. */
  if (targets.length > 0 && activeBlocks === 0) problems.push("tab bar present but no active code block");

  const ids = new Set([...text.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  /* Only plain-name fragments are element ids. Anything else (#/route, or JS concatenation
     like #/ch/'+(i)+') is a hash route or a build-time expression, not a broken anchor. */
  for (const m of text.matchAll(/href="#([^"]+)"/g)) {
    if (/^[A-Za-z][\w-]*$/.test(m[1]) && !ids.has(m[1])) problems.push(`broken fragment #${m[1]}`);
  }

  if (/data-(?:target|tab)="python/.test(text)) problems.push("leftover Python tab control");
  if (/<(?:div|pre)\b[^>]*\bclass="[^"]*\b(?:pane|tab-content|code-block)\b[^"]*"[^>]*data-lang="python"/.test(text)) problems.push("leftover Python pane element");
  if (/<pre class="py"/.test(text)) problems.push('leftover <pre class="py">');
  if (/--py-blue/.test(raw)) warnings.push("dead --py-blue CSS (harmless, cleanup pass)");

  const ok = problems.length === 0;
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${p.replace(/^.*?public\//, "public/")}  eol=${crlf ? "CRLF" : "LF"} panes=${blocks} tabs=${targets.length}${ok ? "" : "\n       - " + problems.join("\n       - ")}${warnings.length ? "\n       ~ " + warnings.join("\n       ~ ") : ""}`);
}

process.exit(failures ? 1 : 0);
