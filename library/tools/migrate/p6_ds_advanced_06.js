/* Migrate ds_advanced_06_zero_copy.html : drop the single Python pane, keep the
 * NumPy copy-vs-view lesson in prose. Mojo tab is already active, so no active move. */
import { loadPage, savePage, removeTab, removePre, replaceOnce, counts } from "../lib/edit.js";

const P = "public/data_science/ds_advanced_06_zero_copy.html";
const page = loadPage(P);
let h = page.text;

const before = counts(h);
const tabsBefore = (h.match(/class="tab[ "]/g) || []).length;
const presBefore = (h.match(/<pre[ >]/g) || []).length;

h = removeTab(h, "python-zc");
h = removePre(h, "python-zc");

const note = `      </div>
    </div>

    <div class="info-box">
      <strong>What the Python version looked like</strong>
      <p>The same three stages written with NumPy are a useful baseline, because NumPy is
      explicit about copying in a way Mojo is not. <code>np.array(data - np.mean(data))</code>
      materialises a new buffer, while the bare expression <code>data - np.mean(data)</code>
      returns a view onto a fresh temporary. Slicing (<code>data[10:20]</code>),
      transposing (<code>data.T</code>) and <code>reshape</code> are all views too - they
      change how the buffer is interpreted without moving it. So a NumPy pipeline is cheap
      exactly as long as you keep the views, and quietly expensive the moment a view is
      wrapped in <code>np.array</code>. Mojo's <code>View</code> type makes that distinction
      part of the signature instead of something you have to remember.</p>
    </div>
  </section>`;

h = replaceOnce(h, "      </div>\n    </div>\n  </section>", note);

const after = counts(h);
savePage(page, h, P);

console.log(`tabs  ${tabsBefore} -> ${(h.match(/class="tab[ "]/g) || []).length}`);
console.log(`pre   ${presBefore} -> ${(h.match(/<pre[ >]/g) || []).length}`);
console.log(`div   ${before.div} -> ${after.div}  ${after.div[0] === after.div[1] ? "balanced" : "UNBALANCED"}`);
console.log(`sect  ${before.section} -> ${after.section}  ${after.section[0] === after.section[1] ? "balanced" : "UNBALANCED"}`);
console.log(`span  ${before.span} -> ${after.span}`);
console.log(`eol   ${JSON.stringify(page.eol)}  bom=${page.bom}`);