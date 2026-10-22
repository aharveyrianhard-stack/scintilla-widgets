// Does a cross-site iframe survive being moved into a Document Picture-in-Picture window (and back)?
// Headless, isolated temp profile. Two local origins: 127.0.0.1 (the "Station") and localhost (the "YouTube" stand-in,
// a different site, so the child is an out-of-process frame as YouTube's is). The child keeps a token, its time origin
// and a tick counter; a reload changes the token and resets the ticks, and the child server counts its own fetches.
import http from "node:http"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.argv[2], LABEL = process.argv[3] || "chrome", OUT = process.argv[4] || "", CHILD_HOST = process.argv[5] || "localhost";
let childFetches = 0;
const CHILD = `<!doctype html><title>child</title><body style="margin:0;background:#123;color:#fff;font:14px monospace">
<div id=t></div><script>
const token = Math.random().toString(36).slice(2, 10); let ticks = 0; setInterval(() => { ticks++; document.getElementById("t").textContent = token + " · " + ticks; }, 100);
addEventListener("message", (e) => { if (e.data === "ping") e.source.postMessage({ token, ticks, timeOrigin: performance.timeOrigin }, "*"); });
</script>`;
const TOP = (childOrigin) => `<!doctype html><title>top</title><body style="margin:0;background:#000">
<div id=a style="width:480px;height:270px"><iframe id=f src="${childOrigin}/child.html" style="width:480px;height:270px;border:0" allow="autoplay"></iframe></div>
<div id=b></div><button id=go style="position:fixed;right:0;bottom:0;width:80px;height:40px">go</button>
<script>
window.ping = (frame) => new Promise((res) => { const h = (e) => { if (e.source === frame.contentWindow) { removeEventListener("message", h); res(e.data); } };
  addEventListener("message", h); try { frame.contentWindow.postMessage("ping", "*"); } catch (e) { res({ err: String(e) }); } setTimeout(() => res({ timeout: true }), 3000); });
window.STRAT = "append"; window.LOG = [];
document.getElementById("go").addEventListener("click", async () => {
  const f = document.getElementById("f");
  try {
    if (STRAT === "same-append") { document.getElementById("b").append(f); LOG.push("moved same-doc append"); return; }
    if (STRAT === "same-moveBefore") { document.getElementById("b").moveBefore(f, null); LOG.push("moved same-doc moveBefore"); return; }
    const w = await documentPictureInPicture.requestWindow({ width: 480, height: 270 });
    window.PIPW = w; LOG.push("pip " + w.innerWidth + "x" + w.innerHeight);
    if (STRAT === "append") w.document.body.append(f);
    else if (STRAT === "adopt") { const n = w.document.adoptNode(f); w.document.body.append(n); }
    else if (STRAT === "moveBefore") w.document.body.moveBefore(f, null);
    LOG.push("moved " + STRAT + " · frame doc now " + (f.ownerDocument === w.document ? "pip" : "opener") + " · connected " + f.isConnected);
  } catch (e) { LOG.push("ERR " + e.name + ": " + e.message); }
});
</script>`;
function serve(handler) { return new Promise((r) => { const s = http.createServer(handler); s.listen(0, "127.0.0.1", () => r(s)); }); }
const childServer = await serve((req, res) => { if (req.url.startsWith("/child.html")) { childFetches++; res.writeHead(200, { "content-type": "text/html" }); res.end(CHILD); } else { res.writeHead(404); res.end(); } });
const childOrigin = "http://" + CHILD_HOST + ":" + childServer.address().port;   /* Brave asks before a page reaches localhost: give it 127.0.0.1 (another port, still another origin) */
const topServer = await serve((req, res) => { res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" }); res.end(TOP(childOrigin)); });
const topOrigin = "http://127.0.0.1:" + topServer.address().port;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
console.log(LABEL, "version", browser.version());
const out = [];
const version = browser.version();
for (const strat of ["same-append", "same-moveBefore", "append", "adopt", "moveBefore"]) {
  const ctx = await browser.newContext({ viewport: { width: 1062, height: 685 } });
  const page = await ctx.newPage();
  childFetches = 0;
  await page.goto(topOrigin + "/"); await page.waitForTimeout(1200);
  const hasApi = await page.evaluate(() => typeof window.documentPictureInPicture);
  const before = await page.evaluate(() => ping(document.getElementById("f")));
  await page.evaluate((s) => { window.STRAT = s; }, strat);
  await page.click("#go"); await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ping(document.getElementById("f") || (window.PIPW && window.PIPW.document.getElementById("f"))));
  const log1 = await page.evaluate(() => LOG.slice());
  // the way back: close the PiP window; on its pagehide the frame goes home (same strategy)
  let back = null, log2 = [];
  if (!strat.startsWith("same")) {
    await page.evaluate((s) => { const w = window.PIPW; if (!w) return;
      w.addEventListener("pagehide", () => { const f = w.document.getElementById("f"); if (!f) { LOG.push("pagehide: no frame"); return; }
        try { if (s === "moveBefore") document.getElementById("a").moveBefore(f, null); else if (s === "adopt") document.getElementById("a").append(document.adoptNode(f)); else document.getElementById("a").append(f);
          LOG.push("pagehide: home · connected " + f.isConnected); } catch (e) { LOG.push("pagehide ERR " + e.name + ": " + e.message); } });
      w.close(); }, strat);
    await page.waitForTimeout(1500);
    back = await page.evaluate(() => ping(document.getElementById("f")));
    log2 = await page.evaluate(() => LOG.slice());
  }
  const row = { strat, hasApi, before, after, back, childFetches, log: back ? log2 : log1,
    survivedMove: !!(before.token && after.token === before.token), survivedReturn: back ? !!(back.token && back.token === before.token) : null };
  out.push(row); console.log(JSON.stringify(row));
  await ctx.close();
}
await browser.close();
const RESULT = { label: LABEL, version, childOrigin, at: new Date().toISOString(), rows: out };
console.log("RESULT", JSON.stringify(RESULT));
if (OUT) (await import("node:fs")).writeFileSync(OUT, JSON.stringify(RESULT, null, 1));
process.exit(0);
