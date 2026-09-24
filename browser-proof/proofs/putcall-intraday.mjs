/* The put/call pane shows Cboe's print AND Scintilla's own intraday line — or says which
   silence it is, in words.
   ====================================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/putcall-intraday.mjs

   Two scenarios on the same pane, differing only in what the chart API answers for SCPCE:
     1. SCPCE is NOT SERVED (404)    -> the pane prints "waiting for the Gateway", naming why.
     2. SCPCE answers with minutes   -> the pane prints the number, coloured by direction.
   Tonight, scenario 1 is the true state of the world: the collector has never run, because
   IB Gateway's link to IBKR was broken all evening. Scenario 2 is what Monday looks like.

   Headless (never on Alan's screen). Cboe's own series is served from this proof, not from
   Cboe: this proves the PANE, not the owners' data.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

/* The rig's fixtures do not serve /universe, so ownership fails closed and EVERY pane stays
   "data delayed" -- which would hide the pane under test. This is the real payload the chart API
   served on 2026-09-24 (364 symbols, universe_sha256 ab8f7965...), read once over a plain GET and
   saved beside this proof. It carries no credential and no price: it is instrument identity, and
   the provider client refuses any universe whose digest is not the pinned accepted one, so a
   synthetic list could not stand in here. */
const UNIVERSE = JSON.parse(fs.readFileSync(new URL("../universe-20260924.json", import.meta.url)));

const { context, origin, close } = await launch();
const DAYS = 40;

/* A believable Cboe daily put/call: one number per session, around 0.9. */
const cboeSeries = () => {
  const day = 86400000, now = Date.now();
  return Array.from({ length: DAYS }, (_, i) => {
    const c = 0.9 + Math.sin(i / 5) * 0.08;
    return { t: now - i * day, o: c, h: c, l: c, c, v: 0 };
  });
};
/* Scintilla's own line: minutes, across THREE sessions, ending ABOVE the minute before it so the
   direction rule has something to colour. Three sessions also means the pane can measure itself
   against Cboe -- with one session it must refuse to, and the proof checks both sentences. */
const scintillaMinutes = () => {
  const now = Date.now(), day = 86400000;
  const out = [];
  for (let d = 0; d < 3; d++)
    for (let i = 0; i < 40; i++) {
      const c = 1.02 + d * 0.01 + (d === 0 && i === 0 ? 0.06 : Math.sin(i / 9) * 0.03);
      out.push({ t: now - d * day - i * 60000, o: c, h: c, l: c, c, v: 0 });
    }
  return out;
};

async function pane({ serveScintilla, width, height }) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  const errs = []; page.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
  await page.route("**/universe**", (r) => {
    const u = new URL(r.request().url());
    if (u.host !== "scintilla-massive-chart-api.fly.dev") return r.fallback();
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(UNIVERSE) });
  });
  await page.route("**/candles**", (r) => {
    const u = new URL(r.request().url());
    if (u.host !== "scintilla-massive-chart-api.fly.dev") return r.fallback();
    const sym = (u.searchParams.get("symbol") || "").toUpperCase();
    if (sym === "PCCE")
      return r.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ series: cboeSeries() }) });
    if (sym === "SCPCE") {
      if (!serveScintilla)   /* exactly what the live API does today: it has never heard of it */
        return r.fulfill({ status: 404, contentType: "application/json",
          body: JSON.stringify({ absence: "NOT_SERVED_BY_CHART_API" }) });
      return r.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ series: scintillaMinutes() }) });
    }
    return r.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await page.goto(origin + "/chart/?t=PCCE&range=3m", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#chartSlot .sc-nchart__cv", { timeout: 20000 });
  await page.waitForTimeout(7000);
  const read = await page.evaluate(() => {
    const host = document.querySelector("#chartSlot .sc-nchart");
    const q = (s) => (host?.querySelector(s)?.textContent || "").trim();
    const comp = host?.querySelector(".sc-nchart__live-companion");
    return {
      ticker: q(".sc-nchart__live-ticker"), change: q(".sc-nchart__live-change"),
      window: q(".sc-nchart__live-window"), companion: (comp?.textContent || "").trim(),
      companionState: comp?.dataset?.state || null, companionChange: comp?.dataset?.change || null,
      companionColor: comp ? getComputedStyle(comp).color : null,
      companionFontPx: comp ? getComputedStyle(comp).fontSize : null,
      companionTitle: comp?.title || "",
      dataState: host?.dataset?.dataState || null, absence: host?.dataset?.absence || null,
      msg: (host?.querySelector(".sc-nchart__msg")?.textContent || "").trim(),
      points: (host?._series || []).length,
    };
  });
  return { page, errs, read };
}

/* ---- 1. the true state tonight: nothing is served, and the pane says so --------------- */
const waiting = await pane({ serveScintilla: false, width: 1680, height: 950 });
console.log("WAITING  ", JSON.stringify(waiting.read, null, 1));
assert.equal(waiting.errs.length, 0, "no page errors: " + waiting.errs.join(" | "));
assert.match(waiting.read.companion, /^Scintilla · waiting for the Gateway/,
  "the pane names the silence instead of showing a dash");
assert.match(waiting.read.companion, /not being served yet/);
assert.equal(waiting.read.companionState, "waiting");
assert.match(waiting.read.change, /^0\.\d\d/, "Cboe's own number is still painted");
assert.match(waiting.read.window, /Cboe$/, "and still labelled as Cboe's session");
assert.equal(waiting.read.companionFontPx, "11px", "body text floor");
const shotWaiting = await shoot(waiting.page, "putcall-waiting-1680");
const phone = await pane({ serveScintilla: false, width: 390, height: 844 });
assert.match(phone.read.companion, /waiting for the Gateway/, "the phone says it too");
const shotPhone = await shoot(phone.page, "putcall-waiting-390");

/* ---- 2. what Monday looks like: the intraday line beside Cboe's print ----------------- */
const live = await pane({ serveScintilla: true, width: 1680, height: 950 });
console.log("SERVED   ", JSON.stringify(live.read, null, 1));
assert.equal(live.errs.length, 0, "no page errors: " + live.errs.join(" | "));
assert.match(live.read.companion, /^Scintilla {2}1\.\d\d/, "the number is on the pane");
assert.equal(live.read.companionState, "live");
assert.ok(["up", "down"].includes(live.read.companionChange),
  "direction is claimed green or red, like every other pane: " + live.read.companionChange);
assert.match(live.read.companionTitle, /Measured against Cboe on 3 sessions both printed/,
  "three overlapping sessions are measured, and counted as sessions rather than as minutes");
assert.match(live.read.companionTitle, /Cboe counts every option on its own exchanges/,
  "the tooltip states why a steady offset is expected");
assert.match(waiting.read.companionTitle, /not a ratio/,
  "the waiting tooltip still says what IBKR actually publishes");
const shotLive = await shoot(live.page, "putcall-served-1680");
const livePhone = await pane({ serveScintilla: true, width: 390, height: 844 });
const shotLivePhone = await shoot(livePhone.page, "putcall-served-390");

record(`## putcall-intraday — ${nowStamp()}

The PCCE pane, real Chromium, headless, repository served locally, the chart API answered by
this proof. Cboe's series is synthetic here; the point is the PANE.

| Scenario | What the pane printed | Shot |
|---|---|---|
| SCPCE not served (tonight's truth) | \`${waiting.read.companion}\` | ${shotWaiting} |
| the same at 390 wide | \`${phone.read.companion}\` | ${shotPhone} |
| SCPCE serving minutes (Monday) | \`${live.read.companion}\` · direction \`${live.read.companionChange}\` | ${shotLive} |
| the same at 390 wide | \`${livePhone.read.companion}\` | ${shotLivePhone} |

Cboe's own readout was unchanged in every scenario: \`${waiting.read.change}\` with window
\`${waiting.read.window}\`. Companion font-size ${waiting.read.companionFontPx}; colour when
serving ${live.read.companionColor}.

Run: PW_MODULE_DIR=<dir> node browser-proof/proofs/putcall-intraday.mjs`);

await close();
console.log("OK — shots:", shotWaiting, shotPhone, shotLive, shotLivePhone);
