/* D2 (27 Sep) — every Station reader of market cap takes TODAY's value.
   c8deb69 fixed the fundamentals card: fundamentals.market_cap is FMP's value at the last fiscal
   quarter end (in the filing currency for foreign filers); company_profile.market_cap is today's,
   the Hub board's number. The remaining readers now take the profile first and keep the
   period-end value only as a fallback. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

test("analytics: the market-cap column reads company_profile first", () => {
  const s = read("../analytics/index.html");
  assert.match(s, /prof:'company_profile\?select=[^']*market_cap/);
  assert.match(s, /mcap:\(m\.p&&\+m\.p\.market_cap>0\)\?\+m\.p\.market_cap:\(m\.f\?m\.f\.market_cap:null\)/);
});

test("fundamentals template: comps, the peer ranking and the WACC weight read company_profile first", () => {
  const s = read("../templates/fundamentals.html");
  assert.match(s, /company_profile\?select=ticker,beta,market_cap,updated_ts/);
  assert.match(s, /cap=profCap!=null\?profCap:\(f\?f\.market_cap:null\)/);
  assert.match(s, /capProf\.forEach\(c=>\{ if\(\+c\.market_cap>0\) capByT\[c\.ticker\]=\+c\.market_cap; \}\)/);
  assert.match(s, /const cap = \(cpArr\[0\]&&\+cpArr\[0\]\.market_cap>0 \? \+cpArr\[0\]\.market_cap : f\.market_cap\)\|\|0/);
  assert.doesNotMatch(s, /cap=f\?f\.market_cap:null/, "the fundamentals-only read is gone");
});

test("DCF template: shares-from-cap uses today's company_profile market cap", () => {
  const s = read("../templates/dcf.html");
  assert.match(s, /company_profile\?select=beta,shares_out,market_cap/);
  assert.match(s, /TICKERS\[s\]\._mcap=\+r\[0\]\.market_cap; TICKERS\[s\]\._mcapProf=true;/);
  assert.match(s, /if\(r\[0\]&&r\[0\]\.market_cap&&!TICKERS\[s\]\._mcapProf\) TICKERS\[s\]\._mcap=/, "period-end value never overwrites the profile's");
});
