// Can a same-origin child frame open the TOP window's Document PiP with its own click (or key)? And from a deck key?
import http from "node:http"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const PANE = `<!doctype html><body style="margin:0"><button id=b style="width:200px;height:80px">float</button><script>
window.L = [];
async function go(how) { try { const w = await window.top.documentPictureInPicture.requestWindow({ width: 480, height: 270 });
  L.push(how + ": ok " + w.innerWidth + "x" + w.innerHeight + " · top.dpip.window===w " + (window.top.documentPictureInPicture.window === w)); w.close(); }
  catch (e) { L.push(how + ": ERR " + e.name + " · " + e.message); } }
document.getElementById("b").onclick = () => go("pane click");
addEventListener("keydown", (e) => { if (e.key === "p") go("pane key"); });
addEventListener("message", (e) => { if (e.data === "toggle") go("deck key -> pane"); });
</script>`;
const TOP = `<!doctype html><body style="margin:0"><iframe id=f src="/pane" style="width:400px;height:200px;border:0"></iframe><div id=x tabindex=0 style="width:200px;height:100px">deck</div><script>
addEventListener("keydown", (e) => { if (e.key === "p") document.getElementById("f").contentWindow.postMessage("toggle", location.origin); });
</script>`;
const OUT = process.argv[2] || ""; const RESULTS = [];
const s = http.createServer((q, r) => { r.writeHead(200, { "content-type": "text/html" }); r.end(q.url.startsWith("/pane") ? PANE : TOP); });
await new Promise((r) => s.listen(0, "127.0.0.1", r));
for (const [label, exe] of [["chrome155", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"], ["brave154", "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"]]) {
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"], timeout: 30000 });
  const page = await (await browser.newContext()).newPage();
  await page.goto("http://127.0.0.1:" + s.address().port + "/"); await page.waitForTimeout(500);
  const pane = page.frames().find((f) => f.url().endsWith("/pane"));
  await pane.click("#b"); await page.waitForTimeout(800);
  await pane.focus("#b"); await page.keyboard.press("p"); await page.waitForTimeout(800);
  await page.focus("#x"); await page.keyboard.press("p"); await page.waitForTimeout(800);
  // without a gesture: a plain call must be refused
  await pane.evaluate(() => { window.top.documentPictureInPicture.requestWindow({ width: 480, height: 270 }).then(() => L.push("no gesture: ok?!"), (e) => L.push("no gesture: ERR " + e.name)); });
  await page.waitForTimeout(500);
  const row = { label, version: browser.version(), log: await pane.evaluate(() => L), note: "the no-gesture line is not a test: Playwright evaluate() carries a user gesture" };
  RESULTS.push(row); console.log(JSON.stringify(row));
  await browser.close();
}
s.close();
if (OUT) (await import("node:fs")).writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), rows: RESULTS }, null, 1));
process.exit(0);
