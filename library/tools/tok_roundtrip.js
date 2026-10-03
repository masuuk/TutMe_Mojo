/* Round-trip check: strip spans from real hand-authored blocks, re-tokenize with
 * lib/tok.js, and report how close the regenerated markup is. */
import { readFileSync } from "node:fs";
import { hiCode, MAPS } from "./lib/tok.js";

const cases = [
  ["public/data_science/ds_advanced_07_linear_algebra.html", "com"],
  ["public/data_science/ds_ml_textbook_02_getting_started.html", "cmt"],
  ["public/data_science/ds_textbook_06_interop.html", "tok"],
  ["public/mojo_v1/mojo_11_interop.html", "cmt"],
  ["public/data_science/linear_regression_detailed.html", "long"],
];

const unescape = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

const vis = (s) => JSON.stringify(s).replace(/\\r/g, "\\r").replace(/\\n/g, "\\n");

for (const [file, mapName] of cases) {
  const html = readFileSync(file, "utf8");
  const blocks = [...html.matchAll(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/g)];
  let checked = 0, exact = 0, near = 0;
  const samples = [];
  for (const b of blocks) {
    const inner = b[2];
    if (!/<span/.test(inner)) continue;
    const plain = unescape(inner.replace(/<[^>]+>/g, ""));
    if (!/\b(fn|def|var|struct)\b/.test(plain)) continue;
    const regen = hiCode(plain, MAPS[mapName]);
    checked++;
    if (regen === inner) { exact++; continue; }
    let i = 0;
    while (i < regen.length && i < inner.length && regen[i] === inner[i]) i++;
    const rest = inner.slice(i).replace(/<span[^>]*>|<\/span>/g, "");
    if (rest === regen.slice(i).replace(/<span[^>]*>|<\/span>/g, "")) near++;
    if (samples.length < 2) samples.push({ i, o: vis(inner.slice(Math.max(0, i - 30), i + 40)), r: vis(regen.slice(Math.max(0, i - 30), i + 40)) });
  }
  console.log(`\n${file}  [${mapName}]  spanned=${checked} exact=${exact} sameTextDifferentSpans=${near}`);
  for (const s of samples) {
    console.log(`   @${s.i}\n     orig: ${s.o}\n     regen: ${s.r}`);
  }
}
