/* lib/edit.js - surgical, EOL-preserving edits for the tutorial pages.
 *
 * Every helper returns a new string and never touches the filesystem, so a page can
 * be stepped through many edits and written once. load/save is the only place that
 * knows about bytes: files are read and written as UTF-8 without BOM, and the
 * dominant line ending is detected on load and re-applied on save, because `edit`
 * and most tools silently write LF into a CRLF file.
 */

import { readFileSync, writeFileSync } from "node:fs";

const UTF8 = new TextEncoder();

/* The returned text is always LF-normalised so that every edit string in every
 * migration script can be written with \n regardless of the file's own convention;
 * savePage puts the original ending back. */
export function loadPage(path) {
  const bytes = readFileSync(path);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const crlf = (text.match(/\r\n/g) || []).length;
  const bare = (text.match(/(?<!\r)\n/g) || []).length;
  const eol = crlf > 0 && bare === 0 ? "\r\n" : crlf === 0 && bare > 0 ? "\n" : "MIXED";
  if (eol === "MIXED") throw new Error(`${path}: mixed line endings (${crlf} CRLF / ${bare} LF) - fix before editing`);
  const bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  return { text: text.replace(/\r\n/g, "\n"), eol, bom, path };
}

export function savePage(page, text, path = page.path) {
  const eol = page.eol;
  const body = eol === "\r\n" ? text.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n") : text;
  writeFileSync(path, Buffer.concat([page.bom ? Buffer.from([0xef, 0xbb, 0xbf]) : Buffer.alloc(0), UTF8.encode(body)]));
  return path;
}

/* Structural counts, so a caller can prove it did not unbalance the page. */
export function counts(html) {
  const c = (re) => (html.match(re) || []).length;
  return {
    div: [c(/<div[ >]/g), c(/<\/div>/g)],
    section: [c(/<section[ >]/g), c(/<\/section>/g)],
    pre: [c(/<pre[ >]/g), c(/<\/pre>/g)],
    span: c(/<span[ >]/g),
    tabBtn: c(/class="(?:tab|tab-btn)[^"]*"/g),
    panes: c(/class="(?:pane|tab-content)[^"]*"/g),
  };
}

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

/* Replace the inner HTML of the <pre> whose id is `id`, keeping the tag and attributes. */
export function replacePreInner(html, id, inner) {
  const re = new RegExp(`(<pre\\b[^>]*\\bid="${id}"[^>]*>)([\\s\\S]*?)(</pre>)`);
  must(re.test(html), `replacePreInner: no <pre id="${id}">`);
  return html.replace(re, (_m, open, _old, close) => open + inner + close);
}

/* Remove a whole <pre id="...">...</pre>. */
export function removePre(html, id) {
  const re = new RegExp(`[ \\t]*<pre\\b[^>]*\\bid="${id}"[^>]*>[\\s\\S]*?</pre>\\r?\\n?`);
  must(re.test(html), `removePre: no <pre id="${id}">`);
  return html.replace(re, "");
}

/* Remove the tab control that targets `target` (data-target= or data-tab=). */
export function removeTab(html, target) {
  const re = new RegExp(`[ \\t]*<div\\b[^>]*class="[^"]*\\b(?:tab|tab-btn)\\b[^"]*"[^>]*\\bdata-(?:target|tab)="${target}"[^>]*>[\\s\\S]*?</div>\\r?\\n?`);
  must(re.test(html), `removeTab: no tab targeting "${target}"`);
  return html.replace(re, "");
}

/* Was the tab for `target` the active one? Read before removing it. */
export function tabIsActive(html, target) {
  const re = new RegExp(`<div\\b[^>]*class="[^"]*\\b(?:tab|tab-btn)\\b[^"]*\\bactive\\b[^"]*"[^>]*\\bdata-(?:target|tab)="${target}"[^>]*>`);
  return re.test(html);
}

export function paneIsActive(html, id) {
  const re = new RegExp(`<(?:div|pre)\\b[^>]*\\bid="${id}"[^>]*\\bclass="[^"]*\\bactive\\b`);
  const re2 = new RegExp(`<(?:div|pre)\\b[^>]*\\bclass="[^"]*\\bactive\\b[^"]*"[^>]*\\bid="${id}"`);
  return re.test(html) || re2.test(html);
}

/* Drop the `active` class from every element carrying `id`. */
export function clearActiveOn(html, id) {
  const re = new RegExp(`(<(?:div|pre)\\b[^>]*\\bid="${id}"[^>]*\\bclass=")([^"]*)(")`, "g");
  must(re.test(html), `clearActiveOn: no element with id="${id}"`);
  return html.replace(re, (_m, a, cls, c) => a + cls.split(/\s+/).filter((x) => x && x !== "active").join(" ") + c);
}

export function addActiveTo(html, id) {
  const re = new RegExp(`(<(?:div|pre)\\b[^>]*\\bid="${id}"[^>]*\\bclass=")([^"]*)(")`, "g");
  must(re.test(html), `addActiveTo: no element with id="${id}"`);
  return html.replace(re, (_m, a, cls, c) => {
    const parts = cls.split(/\s+/).filter(Boolean);
    if (!parts.includes("active")) parts.push("active");
    return a + parts.join(" ") + c;
  });
}

/* Remove a tab bar that has been reduced to a single control, together with the
 * wrapper that only existed to hold it. Returns html unchanged when the tab bar
 * still has more than one control, so callers can apply it unconditionally. */
export function collapseSingleTabBar(html, barClass, paneId) {
  const barRe = new RegExp(`<div\\b[^>]*class="${barClass}"[^>]*>([\\s\\S]*?)</div>`, "g");
  let out = html;
  let m;
  while ((m = barRe.exec(html)) !== null) {
    const inner = m[1];
    const n = (inner.match(/class="[^"]*\b(?:tab|tab-btn)\b[^"]*"/g) || []).length;
    if (n <= 1) {
      out = out.replace(m[0], "");
      if (paneId) {
        out = out.replace(
          new RegExp(`([ \\t]*)<div\\b[^>]*class="panes"[^>]*>\\r?\\n?`, "g"),
          (mm, ind) => (out.includes(`${ind}</div>`) ? mm : `${ind}<div class="panes">\n`)
        );
      }
    }
  }
  return out;
}

/* Literal, single-occurrence text substitution - the common case for prose edits. */
export function replaceOnce(html, find, repl) {
  const n = html.split(find).length - 1;
  must(n === 1, `replaceOnce: expected 1 occurrence, found ${n} of: ${JSON.stringify(find.slice(0, 70))}`);
  return html.replace(find, repl);
}

export function countOf(html, find) {
  return html.split(find).length - 1;
}
