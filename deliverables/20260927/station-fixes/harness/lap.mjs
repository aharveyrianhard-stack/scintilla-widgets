// One browser, the wall's pages in lap order, twice. Counts the ribbon's daily reads on the second pass
// (a cached ribbon under 30 minutes old is not re-read) and the store size at the end.
import { open } from "./rig.mjs";
const [root, label] = process.argv.slice(2);
const pages = ["targets3D","sectors3D","mainIndexes3D","mag7","ai1","ai2","ai3","other3D","blueChip3D",
  "spyQqq1D","otherIndexes1D","macro1D","targets1D","wkIndexes","wkMacro"];
const r = await open({ root, width: 1680, height: 1050, replayOnly: false });
let pass = 0; const reads = [0, 0];
r.page.on("request", (q) => { if (/fly\.dev\/candles\?.*tf=D&/.test(q.url()) && +(/limit=(\d+)/.exec(q.url()) || [0, 0])[1] > 300) reads[pass]++; });
for (pass = 0; pass < 2; pass++) for (const id of pages) { await r.page.goto(r.origin + "/deck/?scene=" + id); await r.page.waitForTimeout(6000); }
pass = 1;
const store = await r.page.evaluate(() => { const k = Object.keys(localStorage); const c = k.filter((x) => x.startsWith("sc_clouds_"));
  return { keys: k.length, ribbons: c.length, ribbonChars: c.reduce((a, x) => a + localStorage.getItem(x).length, 0), allChars: k.reduce((a, x) => a + (localStorage.getItem(x) || "").length, 0) }; });
console.log(JSON.stringify({ label, ribbonReadsPass1: reads[0], ribbonReadsPass2: reads[1], store }));
await r.close();
