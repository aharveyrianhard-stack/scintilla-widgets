/* M58 · the Context Lens, mounted in the chart pane — real browser, headless only.
   ===========================================================================
   Four pictures (1680 and 390, each zoomed out and zoomed in), what the pane says it
   is showing at the moment of each one, and two measurements taken while the main
   chart pans: the frame cost of the lens, and the number of geometry reads per tick.

   Run:
     PW_MODULE_DIR="/Users/alanharvey/SCINTILLA 0.5/visual-supervisor" \
     PLAYWRIGHT_CHROMIUM="<chrome-for-testing binary>" \
     node browser-proof/proofs/lens-mount.mjs

   The browser is headless (playwright's default; never a visible window on Alan's
   screen). Prices come from browser-proof/fixtures.mjs, not from the live provider,
   so these prove PANE BEHAVIOUR under controlled bars. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, record, nowStamp } from "../rig.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SHOTS = path.join(ROOT, "deliverables", "20260924", "lens-mount", "screens");
fs.mkdirSync(SHOTS, { recursive: true });

/* count every layout read the page makes, from before the first line of page script */
const COUNTER = `
  window.__geo = { rect: 0, w: 0, h: 0 };
  const rect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () { window.__geo.rect++; return rect.apply(this, arguments); };
  for (const [prop, key] of [["clientWidth", "w"], ["clientHeight", "h"]]) {
    const d = Object.getOwnPropertyDescriptor(Element.prototype, prop);
    Object.defineProperty(Element.prototype, prop, {
      configurable: true,
      get() { window.__geo[key]++; return d.get.call(this); },
    });
  }`;

const ready = async (page) => page.waitForFunction(() => {
  const h = document.querySelector("#chartSlot .sc-nchart");
  return !!(h && h._series && h._series.length > 30 && h._plot);
}, null, { timeout: 20000 });

const lensState = (page) => page.evaluate(() => {
  const h = document.querySelector("#chartSlot .sc-nchart");
  const area = h.querySelector(".sc-nchart__area");
  return { lens: h._lens, plot: h._plot, view: h._view, bars: h._series.length,
    pane: { w: area.clientWidth, h: area.clientHeight },
    place: null };
});

const setView = (page, mode) => page.evaluate((m) => {
  const h = document.querySelector("#chartSlot .sc-nchart");
  const last = h._series.length - 1;
  if (m === "out") window.resetChartView(h);                    // the whole loaded history
  else window.setChartView(h, last - 39, last, true);           // 40 bars: zoomed in
  return true;
}, mode);

async function shot(page, name, note) {
  const file = path.join(SHOTS, name + ".png");
  await page.screenshot({ path: file, fullPage: false });
  const state = await lensState(page);
  console.log("\n· " + name + " — " + note);
  console.log("  pane " + state.pane.w + "x" + state.pane.h + ", main window " +
    (state.view.end - state.view.start + 1) + " of " + state.bars + " bars");
  console.log("  lens: " + (state.lens
    ? state.lens.label + " · " + state.lens.mode + " · band " + state.lens.band + "px" +
      " · strip " + Math.round(state.lens.rect.w) + "x" + Math.round(state.lens.rect.h) +
      " at " + Math.round(state.lens.rect.x) + "," + Math.round(state.lens.rect.y) +
      "\n        ends with the main chart: " + (state.lens.end === state.view.end) +
      "\n        the price plot ends at y=" + Math.round(state.plot.padT + state.plot.ih) +
      ", the lens starts at y=" + Math.round(state.lens.rect.y) +
      "\n        span: " + state.lens.span + "\n        why: " + state.lens.why
    : "NOT DRAWN"));
  return { name, note, state, file: path.relative(ROOT, file) };
}

/* The pane refuses to draw anything until it has verified who owns the symbol, so the
   proof answers /universe with the canonical 364-symbol payload the other chart proofs
   use. Without it every chart pane sits on "data delayed - retrying", which is the
   ownership gate working, not a chart fault. */
const UNIVERSE = JSON.parse(fs.readFileSync(new URL("../universe-20260924.json", import.meta.url)));

const run = async () => {
  const { context, origin, close, unmatched } = await launch();
  await context.route("**/universe**", (route) =>
    new URL(route.request().url()).host === "scintilla-massive-chart-api.fly.dev"
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(UNIVERSE) })
      : route.fallback());
  await context.addInitScript(COUNTER);
  const page = await context.newPage();
  const shots = [];
  const url = origin + "/chart/?t=MU&range=1D";

  /* ---- 1680: the wall ---- */
  await page.setViewportSize({ width: 1680, height: 950 });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await ready(page);
  await setView(page, "out");
  await page.waitForTimeout(150);
  shots.push(await shot(page, "1680-zoomed-out", "main chart zoomed out → the lens zooms IN"));
  await setView(page, "in");
  await page.waitForTimeout(150);
  shots.push(await shot(page, "1680-zoomed-in", "main chart zoomed in → the lens pulls BACK"));

  /* ---- what it costs, measured on this same page while it pans ---- */
  const cost = await page.evaluate(async () => {
    const h = document.querySelector("#chartSlot .sc-nchart");
    const runDraws = (n) => {
      const t = [];
      for (let i = 0; i < n; i++) {
        const a = performance.now();
        window.scChartDraw(h);
        t.push(performance.now() - a);
      }
      t.sort((x, y) => x - y);
      return { median: t[Math.floor(t.length / 2)], p95: t[Math.floor(t.length * 0.95)], n };
    };
    runDraws(40);                                   // warm up, not recorded
    window.setLens(true); const on = runDraws(200);
    window.setLens(false); const off = runDraws(200);
    window.setLens(true);
    return { on, off };
  });

  /* geometry reads per pan tick: wheel the chart the way a hand does */
  const geo = await page.evaluate(async (which) => {
    const h = document.querySelector("#chartSlot .sc-nchart");
    const cv = h.querySelector(".sc-nchart__cv");
    const r = cv.getBoundingClientRect();
    const pan = async (ticks) => {
      window.__geo = { rect: 0, w: 0, h: 0 };
      for (let i = 0; i < ticks; i++) {
        cv.dispatchEvent(new WheelEvent("wheel", { deltaX: 24, deltaY: 0, bubbles: true, cancelable: true,
          clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
        await new Promise((res) => requestAnimationFrame(res));
      }
      const g = window.__geo;
      return { ticks, rect: g.rect, clientWidth: g.w, clientHeight: g.h,
        perTick: +((g.rect + g.w + g.h) / ticks).toFixed(2) };
    };
    window.setLens(true); const on = await pan(30);
    window.setLens(false); const off = await pan(30);
    window.setLens(true);
    return { on, off, which };
  }, "pan");

  /* the chip: off, then on again, and what it costs in requests */
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  const chip = await page.evaluate(async () => {
    const host = document.querySelector("#chartSlot .sc-nchart");
    const before = host._series.length;
    document.querySelector('[data-act="lens"]').click();
    const offState = host._lens;
    document.querySelector('[data-act="lens"]').click();
    const onState = host._lens;
    return { before, off: offState, on: !!onState,
      after: host._series.length,
      remembered: (function () { try { return localStorage.getItem("station.lens.MU"); } catch (e) { return "blocked"; } })() };
  });

  /* ---- 390: the phone ---- */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await ready(page);
  await setView(page, "out");
  await page.waitForTimeout(150);
  shots.push(await shot(page, "390-zoomed-out", "phone, main chart zoomed out → the lens zooms IN"));
  await setView(page, "in");
  await page.waitForTimeout(150);
  shots.push(await shot(page, "390-zoomed-in", "phone, main chart zoomed in → the lens pulls BACK"));

  console.log("\n--- frame cost (median of 200 draws, same pane, same bars) ---");
  console.log("  lens ON : " + cost.on.median.toFixed(2) + " ms  (p95 " + cost.on.p95.toFixed(2) + ")");
  console.log("  lens OFF: " + cost.off.median.toFixed(2) + " ms  (p95 " + cost.off.p95.toFixed(2) + ")");
  console.log("  the lens costs " + (cost.on.median - cost.off.median).toFixed(2) + " ms a frame");
  console.log("\n--- geometry reads over 30 pan ticks ---");
  console.log("  lens ON : " + JSON.stringify(geo.on));
  console.log("  lens OFF: " + JSON.stringify(geo.off));
  console.log("\n--- the chip ---");
  console.log("  " + JSON.stringify(chip));
  console.log("\n--- requests made after the chart was drawn (chip toggles included) ---");
  console.log("  " + (requests.length ? requests.join("\n  ") : "none"));
  console.log("  refused external calls: " + (unmatched.length ? unmatched.join(", ") : "none"));

  const out = { stamp: nowStamp(), shots: shots.map((s) => ({ name: s.name, note: s.note,
    file: s.file, lens: s.state.lens, pane: s.state.pane,
    mainBars: s.state.view.end - s.state.view.start + 1, place: s.state.place })),
    cost, geo, chip, requestsAfterDraw: requests, unmatched };
  fs.writeFileSync(path.join(SHOTS, "..", "proof.json"), JSON.stringify(out, null, 1));
  record("## M58 lens mount — " + nowStamp() + "\n\n" +
    "`node browser-proof/proofs/lens-mount.mjs` · headless Chromium · fixtures for prices.\n\n" +
    shots.map((s) => "- `" + s.file + "` — " + s.note + ": " +
      (s.state.lens ? s.state.lens.label + " in a " + s.state.lens.band + "px band" : "no lens")).join("\n") +
    "\n\n- frame cost with the lens " + cost.on.median.toFixed(2) + " ms vs " + cost.off.median.toFixed(2) +
    " ms without it; geometry reads per pan tick " + geo.on.perTick + " with it, " + geo.off.perTick + " without.\n");
  await close();
};

run().catch((e) => { console.error("PROOF FAILED:", e); process.exit(1); });
