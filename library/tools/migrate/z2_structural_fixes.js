/* Three pre-existing structural defects the site-wide verifier surfaced, unrelated to
 * the Python migration but real rendering bugs:
 *   1. ds_ml_textbook_01_intro.html  "</code keyword" - missing ">", so the <code> never
 *      closes and the rest of the paragraph is mis-parsed.
 *   2. neural_network.html            seven "#top" back-links with no id="top", and a
 *      "full program" toc link to a non-existent #full.
 *   3. the_annuity_codex.html        one bare LF in an otherwise CRLF file.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadPage, savePage } from "../lib/edit.js";

/* ---- 1. missing ">" on a closing code tag ---- */
{
  const path = "public/data_science/ds_ml_textbook_01_intro.html";
  const page = loadPage(path);
  const bad = `<code class="inline">fn</code keyword is gone`;
  if (!page.text.includes(bad)) throw new Error(`${path}: typo anchor not found`);
  let h = page.text.replace(bad, `<code class="inline">fn</code> keyword is gone`);
  const o = (h.match(/<code[\s>]/g) || []).length;
  const c = (h.match(/<\/code\s*>/g) || []).length;
  if (o !== c) throw new Error(`${path}: still unbalanced ${o}/${c}`);
  savePage(page, h);
  console.log(`${path}  code tags ${o}/${c} balanced`);
}

/* ---- 2. missing fragment targets ---- */
{
  const path = "public/data_science/neural_network.html";
  const page = loadPage(path);
  let h = page.text;

  if (!/id="top"/.test(h)) {
    if (!h.includes("<body>")) throw new Error(`${path}: no bare <body> to anchor`);
    h = h.replace("<body>", `<body id="top">`);
  }
  /* #full is the same code as section s6, so alias it with a zero-width anchor rather
     than restructuring the table of contents. */
  if (!/id="full"/.test(h)) {
    const s6 = /(<h2 id="s6">)/;
    if (!s6.test(h)) throw new Error(`${path}: no s6 heading to alias #full onto`);
    h = h.replace(s6, `<a id="full"></a>\n$1`);
  }

  const ids = new Set([...h.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const broken = [...h.matchAll(/href="#([A-Za-z][\w-]*)"/g)]
    .map((m) => m[1])
    .filter((f) => !ids.has(f));
  if (broken.length) throw new Error(`${path}: still broken: ${[...new Set(broken)].join(", ")}`);
  savePage(page, h);
  console.log(`${path}  all ${ids.size} fragment targets resolve`);
}

/* ---- 3. normalise the stray LF, keeping the file CRLF ----
 * Done at byte level on purpose: loadPage() refuses a mixed-EOL file, which is the right
 * default but means the repair cannot go through it. */
{
  const path = "public/applications/finance/the_annuity_codex.html";
  const bytes = readFileSync(path);
  const crlf = (bytes.toString("latin1").match(/\r\n/g) || []).length;
  const bare = (bytes.toString("latin1").match(/(?<!\r)\n/g) || []).length;
  if (!crlf) throw new Error(`${path}: expected CRLF content, found none`);
  if (!bare) throw new Error(`${path}: nothing to normalise`);
  const fixed = Buffer.from(bytes.toString("latin1").replace(/(?<!\r)\n/g, "\r\n"), "latin1");
  writeFileSync(path, fixed);
  const after = (fixed.toString("latin1").match(/\r\n/g) || []).length;
  const afterBare = (fixed.toString("latin1").match(/(?<!\r)\n/g) || []).length;
  if (afterBare !== 0) throw new Error(`${path}: still ${afterBare} bare LF`);
  console.log(`${path}  ${crlf} CRLF + ${bare} bare LF -> ${after} CRLF, 0 bare LF`);
}
