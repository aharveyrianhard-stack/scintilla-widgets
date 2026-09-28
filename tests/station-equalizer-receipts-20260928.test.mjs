/* 28 Sep: both of Alan's saved equalizers are accepted; anything else still fails closed. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
const src = fs.readFileSync(new URL("../_provider/provider.js", import.meta.url), "utf8");
const pick = (re) => { const m = src.match(re); assert.ok(m, String(re)); return m[0]; };
const code = [pick(/var ACCEPTED_EQUALIZER_SHA256 =\s*'[0-9a-f]{64}';/), pick(/var ACCEPTED_EQUALIZER_SHA256S = \[[\s\S]*?\];/),
  pick(/function equalizerAccepted \(receipt\) \{[\s\S]*?\n  \}/), "({ equalizerAccepted })"].join("\n");
const { equalizerAccepted } = runInNewContext(code, {});
test("the 27 Sep equalizer (2h weight 0) and the earlier one are accepted; others are refused", () => {
  assert.equal(equalizerAccepted("d0da9a466c8f51dd48c0f7c45c9e731afc255e91c60c398c356d76af53d91728"), true);
  assert.equal(equalizerAccepted("F6CF97B57CF26A37AEB8393DEC676F1776B02DA282DFFCCE95786E5762697AD1"), true);
  assert.equal(equalizerAccepted("0".repeat(64)), false);
  assert.equal(equalizerAccepted(undefined), false);
});
