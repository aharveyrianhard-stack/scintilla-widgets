/* Sector-rotation's price spine: LIVE is a whole-spine claim, made only by the authority.
   ======================================================================================
   Two claims this page could make that it could not back:

   LIVE OFF THE DAILY ALONE. loadDataDB treats weekly/5m/1m failures as non-fatal (the page
   is still useful on daily bars), but the spine badge and the boot status then said
   "LIVE · price spine (D/W/5/1)" off the daily benchmark alone — a spine with a silent
   hole in it, presented whole. Coverage is now counted per view per ticker; LIVE is
   claimed only when every view answered for every ticker, PARTIAL names the short views,
   and nothing is substituted for them.

   AUTHORITY WITHOUT THE AUTHORITY. The page reads compatibility URLs through
   /_provider/provider.js. If that shim is absent it now refuses before issuing any read;
   a raw legacy table can never stand in for the provider contract.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const sector = fs.readFileSync(new URL("../templates/sector-rotation.html", import.meta.url), "utf8");
const provider = fs.readFileSync(new URL("../_provider/provider.js", import.meta.url), "utf8");

function fnFrom(source, name, bindings = {}) {
  let start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const asyncPrefix = "async ";
  if (source.slice(start - asyncPrefix.length, start) === asyncPrefix) start -= asyncPrefix.length;
  let depth = 0, end = -1;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) { end = i + 1; break; }
  }
  return vm.runInNewContext(`(${source.slice(start, end)})`, bindings);
}

const viewsStart = sector.indexOf("const OHLCV_VIEWS=") + "const OHLCV_VIEWS=".length;
const viewsLiteral = sector.slice(viewsStart, sector.indexOf(";", viewsStart));

function spineHarness({ shim, fail } = {}) {
  const spine = {};
  const bindings = {
    SECTORS: [{ t: "XLK" }],
    BENCH: "SPY",
    DS: {},
    PRICE_SOURCE: "pending",
    PRICE_COVERAGE: null,
    OHLCV_VIEWS: vm.runInNewContext("(" + viewsLiteral + ")"),
    providerShimActive: () => !!shim,
    spineSet: (k, ts, mode, note) => { spine[k] = { ts, mode, note }; },
    fetchOHLCV: async (tk, tf) => {
      if (fail && fail(tk, tf)) throw new Error("ohlcv " + tk + " " + tf + " 500");
      const t = Math.floor(Date.now() / 1000) - 3600;
      return { times: [t], closes: [1], opens: [1], highs: [1], lows: [1], vols: [1] };
    },
  };
  bindings.spineAge = fnFrom(sector, "spineAge", bindings);
  bindings.priceCoverageParts = fnFrom(sector, "priceCoverageParts", bindings);
  bindings.priceCoverageFull = fnFrom(sector, "priceCoverageFull", bindings);
  bindings.loadDataDB = fnFrom(sector, "loadDataDB", bindings);
  return { bindings, spine };
}

test("a complete spine through the shim is LIVE, with every view's count on the badge", async () => {
  const { bindings, spine } = spineHarness({ shim: true });
  await bindings.loadDataDB();
  assert.equal(bindings.PRICE_SOURCE, "provider");
  assert.equal(bindings.priceCoverageFull(), true);
  assert.equal(spine["provider /candles"].mode, "LIVE");
  assert.match(spine["provider /candles"].note, /D 2\/2 · W 2\/2 · 5m 2\/2 · 1m 2\/2/);
});

test("a failed 5m view forfeits LIVE — PARTIAL names the short view and substitutes nothing", async () => {
  const { bindings, spine } = spineHarness({ shim: true, fail: (tk, tf) => tf === "5m" && tk === "XLK" });
  await bindings.loadDataDB();
  assert.equal(bindings.PRICE_SOURCE, "provider");
  assert.equal(bindings.priceCoverageFull(), false);
  assert.equal(spine["provider /candles"].mode, "PARTIAL");
  assert.match(spine["provider /candles"].note, /5m 1\/2/);
  assert.match(spine["provider /candles"].note, /missing, not substituted/);
  /* The same is true when the whole weekly and 1m lanes die. */
  const worse = spineHarness({ shim: true, fail: (tk, tf) => tf === "W" || tf === "1m" });
  await worse.bindings.loadDataDB();
  assert.equal(worse.spine["provider /candles"].mode, "PARTIAL");
  assert.match(worse.spine["provider /candles"].note, /W 0\/2 · 5m 2\/2 · 1m 0\/2/);
});

test("no shim means no read — raw tables are never used as an alternate", async () => {
  const { bindings, spine } = spineHarness({ shim: false });
  await assert.rejects(() => bindings.loadDataDB(), /provider authority shim unavailable/);
  assert.equal(bindings.PRICE_SOURCE, "pending");
  assert.deepEqual(spine, {});
});

test("the boot status line distinguishes complete, partial and unavailable", () => {
  assert.match(sector, /● LIVE<\/b> provider \/candles \(authority=provider, completed bars\) \$\{priceCoverageParts\(\)\}/);
  assert.match(sector, /● PARTIAL<\/b> provider \/candles — \$\{priceCoverageParts\(\)\}; LIVE is not claimed while any view is short/);
  assert.match(sector, /● PRICE SPINE UNAVAILABLE<\/b> the provider contract did not answer · no raw table or relay is substituted/);
  assert.match(sector, /PARTIAL:'#ffb454'/, "PARTIAL renders as its own badge mode");
});

test("the spine asks with the contract's exact 5m/1m tokens, and the shim maps both spellings", () => {
  assert.match(sector, /\{view:'intra',tf:'5m',lim:400\},\{view:'intra1',tf:'1m',lim:390\}/);
  /* The shim's timeframe map resolves the exact tokens and the legacy '5'/'1' pair. */
  assert.match(provider, /var TF = \{ '1':'1m','5':'5m',/);
  assert.match(provider, /'1m':'1m','2m':'2m','3m':'3m','5m':'5m'/);
});

test("a dead chart library is a said panel state, never a mid-render throw", () => {
  const page = fs.readFileSync(new URL("../templates/sector-rotation.html", import.meta.url), "utf8");
  /* lightweight-charts is VENDORED same-origin with npm-verified bytes (the unhashed unpkg
     tag is gone). Unguarded, createChart threw a ReferenceError when the script was absent
     and took the timeframe-following panels with it. */
  assert.match(page, /if\(typeof LightweightCharts==='undefined'\)\{/);
  assert.match(page, /lightweight-charts \(vendored same-origin\) did not load — the LINES panel is unavailable, not empty; every other panel is unaffected · reload to retry/);
  assert.match(page, /src="\/_vendor\/lightweight-charts-4\.1\.3\.standalone\.production\.js" integrity="sha384-JZigAjwiaZtkUbA44CWkPaT3iBb\/mU5pO6QOANp\+OqHd4q\+1\+7MG1kzp2OOP9ZfP"/);
  assert.ok(!page.includes("unpkg.com/lightweight-charts"), "the third-party tag is gone from the current page");
  assert.match(page, /if\(!chart\)\{ setRange\(currentRange\); return; \}/, "no series without the library, but the range still applies");
  assert.match(page, /if\(chart\) chart\.applyOptions/);
  assert.match(page, /if\(chart\) chart\.timeScale\(\)\.setVisibleLogicalRange/);
  /* The rollback copy is exempt by ruling and stays untouched. */
  const older = fs.readFileSync(new URL("../templates/sector-rotation-older.html", import.meta.url), "utf8");
  assert.ok(!older.includes("libDead"), "sector-rotation-older is the retained rollback, left as-is");
});
