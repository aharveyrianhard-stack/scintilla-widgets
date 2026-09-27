import { open } from "./rig.mjs";
const r = await open({ root: process.argv[2], replayOnly: true });
await r.page.goto(r.origin + "/tokens.css");
console.log(await r.page.evaluate(() => {
  const pts = []; let d = Date.parse("2020-10-01T20:00:00Z");
  for (let i = 0; i < 1500; i++) { pts.push({ d: new Date(d).toISOString(), p: +(100 + Math.random() * 900).toFixed(2) }); d += 86400000; }
  const body = JSON.stringify({ ts: Date.now(), pts, asked: 1500 });
  let n = 0; try { for (; n < 500; n++) localStorage.setItem("sc_clouds_T" + n, body); } catch (e) {}
  return { entryChars: body.length, fit: n };
}));
await r.close();
