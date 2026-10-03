/* Removes three Python panes that the census never counted.
 *
 * The census missed them because the pages reused id="python" for more than one pane,
 * so the rendered-DOM probe collapsed the duplicates. The verifier caught them.
 * Each is a Python-vs-Mojo tab pair; the Python half is kept as prose instead.
 */
import { loadPage, savePage, counts } from "../lib/edit.js";

const EDITS = [
  {
    path: "public/data_science/ds_advanced_13_benchmarking.html",
    expect: 2,
    prose: [
      [
        `(<div class="info-box">\\s*<strong>Interactive Reports</strong>)`,
        `<p>If you are coming from Python, the equivalent workflow is <code>cProfile.run(..., "train.prof")</code> followed by <code>snakeviz train.prof</code>. That path needs an extra tool and a manual conversion step, whereas Mojo emits the flame graph directly.</p>\n$1`,
      ],
      [
        `(<h2>Memory Traces</h2>)`,
        `<p>The Python-side equivalent is <code>tracemalloc</code>, which snapshots allocations and ranks them by source line. It tracks Python object lifetimes only, so it cannot see allocations made inside Mojo's own runtime.</p>\n$1`,
      ],
    ],
  },
  {
    path: "public/data_science/ds_advanced_15_future.html",
    expect: 1,
    prose: [
      [
        `(<div class="tip-box info-box">\\s*<strong>Tip: Start Contributing</strong>)`,
        `<p>Python packages remain reachable from Mojo through the built-in interop layer, so an existing <code>my_ml_utils</code> written in Python can still be called from a Mojo program. The ecosystem you contribute to is Mojo's own.</p>\n$1`,
      ],
    ],
  },
];

for (const { path, expect, prose } of EDITS) {
  const page = loadPage(path);
  let h = page.text;

  const panes = h.match(/<pre class="code-block" id="python">[\s\S]*?<\/pre>/g) || [];
  const tabs = h.match(/<div class="tab" data-target="python">[^<]*<\/div>/g) || [];
  if (panes.length !== expect) throw new Error(`${path}: expected ${expect} python panes, found ${panes.length}`);
  if (tabs.length !== expect) throw new Error(`${path}: expected ${expect} python tabs, found ${tabs.length}`);

  for (const p of panes) h = h.replace(p, "");
  for (const t of tabs) h = h.replace(t, "");
  for (const [find, repl] of prose) {
    const re = new RegExp(find);
    if (!re.test(h)) throw new Error(`prose anchor not found in ${path}: ${find}`);
    h = h.replace(re, repl);
  }
  if (/id="python"|data-target="python"/.test(h)) throw new Error(`${path}: python tab/pane remnants remain`);

  const b = counts(h);
  const a = counts(page.text);
  savePage(page, h);
  console.log(`${path}  pre ${a.pre}->${b.pre}  div ${a.div[0]}/${a.div[1]}->${b.div[0]}/${b.div[1]}  eol=${JSON.stringify(page.eol)}`);
}
