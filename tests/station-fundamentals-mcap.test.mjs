// 27 Sep: the MARKET CAP card showed FMP's fiscal-quarter-end value (META 1.43T at 30 Jun) under a "read <date>" label
// while the Hub board showed today's 1.9T. The card must read company_profile first and label any fallback as period-end.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../station-shells/fundamentals-v1/index.html", import.meta.url), "utf8");
test("fundamentals shell: MARKET CAP prefers company_profile, fallback labelled as fiscal period end", () => {
  const i = src.indexOf('card("MARKET CAP"');
  assert.ok(i > 0, "the MARKET CAP card exists");
  const block = src.slice(Math.max(0, i - 400), i + 700);
  assert.match(block, /capProf\s*=\s*prof\s*&&/, "reads company_profile.market_cap");
  assert.match(block, /money\(capProf != null \? capProf : fund && fund\.market_cap\)/, "profile first, fundamentals only as fallback");
  assert.match(block, /fiscal period end/, "the fallback says it is a period-end value");
  assert.doesNotMatch(block, /money\(fund && fund\.market_cap\),/, "the old fundamentals-only read is gone");
});
