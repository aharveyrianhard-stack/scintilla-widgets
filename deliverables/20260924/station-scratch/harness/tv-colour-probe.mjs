/* M69 · DOES THE TRADINGVIEW EMBED DRAW THE DAY IN GREEN AND RED? Measured, not assumed.
 *
 * The chart shell draws the four TO-DO internals with TradingView's symbol-overview widget and
 * passes it an explicit grey lineColor. The file's own note says chartType "line" returns
 * TradingView's own red/green. This opens the real widget, headless, in four configurations and
 * reads the pixels it actually painted:
 *   A  shipped      area + our grey lineColor/topColor
 *   B  area, no ink area, with lineColor/topColor/bottomColor removed
 *   C  line, our ink line, with our grey lineColor
 *   D  line, no ink  line, with the colour keys removed
 * Each is loaded as the TOP-LEVEL document, so the page's own canvases are same-origin and can be
 * read back. Nothing is written anywhere; this only looks. */
import playwright from "/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/node_modules/playwright-core/index.js";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";

const OUT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../shots");
fs.mkdirSync(OUT, { recursive: true });
const SYM = process.argv[2] || "USI:TICK";
const BASE = {
  symbols: [[SYM + "|1D"]], chartOnly: true, autosize: true, width: "100%", height: "100%",
  colorTheme: "dark", chartType: "area", lineWidth: 2,
  lineColor: "#9A9AB6", topColor: "rgba(154,154,182,0.18)", bottomColor: "rgba(154,154,182,0.00)",
  gridLineColor: "#1A1A2A", fontColor: "#868AAA", widgetFontColor: "#868AAA",
  backgroundColor: "#0F0F1A", scalePosition: "right", scaleMode: "Normal",
  fontSize: "9", noTimeScale: false, valuesTracking: "0",
  showVolume: false, showMA: false, hideDateRanges: true, hideMarketStatus: true, hideSymbolLogo: true
};
const url = (cfg) => "https://s.tradingview.com/embed-widget/symbol-overview/?locale=en#" + encodeURIComponent(JSON.stringify(cfg));
const strip = (cfg) => { const c = { ...cfg }; delete c.lineColor; delete c.topColor; delete c.bottomColor; return c; };
const CASES = [
  ["A-shipped-area-our-ink", BASE],
  ["B-area-no-ink", strip(BASE)],
  ["C-line-our-ink", { ...BASE, chartType: "line" }],
  ["D-line-no-ink", strip({ ...BASE, chartType: "line" })]
];

const browser = await playwright.chromium.launch({ headless: true });
const report = [];
for (const [name, cfg] of CASES) {
  const ctx = await browser.newContext({ viewport: { width: 560, height: 320 } });
  const page = await ctx.newPage();
  let loaded = true;
  try { await page.goto(url(cfg), { waitUntil: "load", timeout: 45000 }); }
  catch (e) { loaded = false; report.push({ name, error: String(e.message).slice(0, 120) }); }
  if (loaded) {
    await page.waitForTimeout(9000);
    await page.screenshot({ path: path.join(OUT, `tv-colour-${name}.png`) });
    /* Read every canvas the widget painted and count strongly coloured pixels. A "green" pixel is
       one where g clearly leads r and b; "red" is the mirror. Greys are ignored by construction. */
    const tally = await page.evaluate(() => {
      const out = { canvases: 0, sampled: 0, green: 0, red: 0, topGreen: null, topRed: null, err: null };
      try {
        for (const c of document.querySelectorAll("canvas")) {
          if (!c.width || !c.height) continue;
          out.canvases += 1;
          const g = c.getContext("2d"); if (!g) continue;
          const d = g.getImageData(0, 0, c.width, c.height).data;
          const seen = new Map();
          for (let i = 0; i < d.length; i += 4) {
            const [r, gr, b, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
            if (a < 200) continue;
            out.sampled += 1;
            const key = `${r},${gr},${b}`;
            if (gr - r > 40 && gr - b > 25) { out.green += 1; seen.set("g:" + key, (seen.get("g:" + key) || 0) + 1); }
            else if (r - gr > 40 && r - b > 25) { out.red += 1; seen.set("r:" + key, (seen.get("r:" + key) || 0) + 1); }
          }
          const top = [...seen.entries()].sort((a, b) => b[1] - a[1]);
          for (const [k, n] of top) {
            if (k.startsWith("g:") && !out.topGreen) out.topGreen = { rgb: k.slice(2), px: n };
            if (k.startsWith("r:") && !out.topRed) out.topRed = { rgb: k.slice(2), px: n };
          }
        }
      } catch (e) { out.err = String(e.message).slice(0, 120); }
      return out;
    });
    const text = (await page.evaluate(() => document.body.innerText.trim().slice(0, 160))) || "";
    report.push({ name, ...tally, text });
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, "tv-colour-probe.json"), JSON.stringify({ symbol: SYM, at: new Date().toISOString(), report }, null, 1));
for (const r of report) console.log(JSON.stringify(r));
