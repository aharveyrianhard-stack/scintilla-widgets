import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BREADTH_DISCOVERY,
  MAX_CALLS_PER_MINUTE,
  SESSIONS,
  SYMBOLS,
  SlidingWindowLimiter,
  classifyResponse,
  parseEnvFile,
  runValidation,
  serializeReport,
  validateAggregateRows,
} from "../tools/massive-free-tier/lib.mjs";
import { main } from "../tools/massive-free-tier/validate.mjs";

const fixtures = JSON.parse(await readFile(new URL("./fixtures/massive-http-responses.json", import.meta.url), "utf8"));

function response(status, payload) {
  return { status, async json() { return payload; } };
}

function barsFor(session) {
  const start = Date.parse(session.rthStartUtc);
  return Array.from({ length: session.expectedRthMinutes }, (_, index) => ({
    t: start + index * 60_000,
    o: 100 + index / 100,
    h: 101 + index / 100,
    l: 99 + index / 100,
    c: 100.5 + index / 100,
    v: 1_000 + index,
  }));
}

test("env parser accepts export/quotes and does not need process environment", () => {
  const parsed = parseEnvFile("# local only\nexport MASSIVE_API_KEY='fixture-secret'\nIGNORED=x\n");
  assert.equal(parsed.get("MASSIVE_API_KEY"), "fixture-secret");
});

test("CLI refuses before fetch when the agreed env file/key is absent", async () => {
  let fetchCalls = 0;
  let output = "";
  const code = await main({
    envFile: "/definitely/absent/massive.env",
    stdout: { write(chunk) { output += chunk; } },
    fetchImpl: async () => { fetchCalls += 1; throw new Error("must not run"); },
  });
  assert.equal(code, 2);
  assert.equal(fetchCalls, 0);
  assert.deepEqual(JSON.parse(output), {
    schemaVersion: "massive-free-tier-validation/v1",
    status: "refused",
    reason: "env_file_not_found",
    environmentFile: "~/.config/massive.env",
    liveRequestsMade: 0,
  });
});

test("rolling limiter delays the sixth request beyond the first 60-second window", async () => {
  let clock = 0;
  const sleeps = [];
  const limiter = new SlidingWindowLimiter({
    now: () => clock,
    sleep: async (milliseconds) => { sleeps.push(milliseconds); clock += milliseconds; },
  });
  const timestamps = [];
  for (let index = 0; index < MAX_CALLS_PER_MINUTE + 1; index += 1) timestamps.push(await limiter.take());
  assert.deepEqual(timestamps.slice(0, 5), [0, 0, 0, 0, 0]);
  assert.equal(timestamps[5], 60_001);
  assert.deepEqual(sleeps, [60_001]);
});

test("HTTP 200, 403, 404, and empty 200 remain separate", () => {
  assert.equal(classifyResponse(fixtures.http200.status, fixtures.http200.payload), "http_200");
  assert.equal(classifyResponse(fixtures.http403.status, fixtures.http403.payload), "http_403");
  assert.equal(classifyResponse(fixtures.http404.status, fixtures.http404.payload), "http_404");
  assert.equal(classifyResponse(fixtures.empty.status, fixtures.empty.payload), "empty");
});

test("complete regular and early-close fixtures pass exact minute/OHLCV coverage", () => {
  for (const session of SESSIONS) {
    const result = validateAggregateRows(barsFor(session), session);
    assert.equal(result.rthMinuteCount, session.expectedRthMinutes);
    assert.equal(result.missingRthMinuteCount, 0);
    assert.equal(result.coveragePass, true);
    assert.equal(result.timestampsPass, true);
    assert.equal(result.ohlcvPass, true);
    assert.equal(result.volumePass, true);
  }
});

test("timestamp, duplicate, OHLC, null volume, and negative volume failures are explicit", () => {
  const session = SESSIONS[0];
  const start = Date.parse(session.rthStartUtc);
  const result = validateAggregateRows([
    { t: start + 1, o: 10, h: 9, l: 11, c: 10, v: null },
    { t: start + 1, o: 10, h: 11, l: 9, c: 10, v: -1 },
  ], session);
  assert.equal(result.timestampsPass, false);
  assert.equal(result.ohlcvPass, false);
  assert.equal(result.volumePass, false);
  assert.equal(result.duplicateTimestamps.length, 1);
  assert.ok(result.issues.some((issue) => issue.reason === "not_minute_aligned"));
  assert.ok(result.issues.some((issue) => issue.reason === "not_finite_number" && issue.field === "v"));
  assert.ok(result.issues.some((issue) => issue.reason === "negative" && issue.field === "v"));
  assert.ok(result.issues.some((issue) => issue.reason === "low_above_high"));
});

test("mocked full run covers all 14 symbols, both sessions, and six breadth searches in 48 paced GETs", async () => {
  const secret = "never-print-this-key";
  let clock = Date.parse("2026-08-14T12:00:00.000Z");
  const calls = [];
  const fetchImpl = async (input, options) => {
    const url = new URL(input);
    calls.push({ at: clock, method: options.method, url });
    assert.equal(url.searchParams.get("apiKey"), secret);
    if (url.pathname.startsWith("/v3/reference/tickers/") && url.pathname.split("/").length === 5) {
      return response(200, { results: { ticker: decodeURIComponent(url.pathname.split("/").at(-1)) } });
    }
    if (url.pathname.includes("/range/1/minute/")) {
      const date = url.pathname.split("/").at(-1);
      const session = SESSIONS.find((candidate) => candidate.date === date);
      return response(200, { results: barsFor(session) });
    }
    if (url.pathname === "/v3/reference/tickers") {
      return response(200, { results: [{ ticker: `I:${url.searchParams.get("search").split(" ")[0]}`, name: url.searchParams.get("search"), market: "indices", active: true, type: "I" }] });
    }
    return response(404, {});
  };

  const report = await runValidation({
    apiKey: secret,
    fetchImpl,
    now: () => clock,
    sleep: async (milliseconds) => { clock += milliseconds; },
  });

  assert.equal(calls.length, 48);
  assert.equal(report.summary.expectedRequestCount, 48);
  assert.equal(report.summary.actualRequestCount, 48);
  assert.equal(report.stockResults.length, SYMBOLS.length);
  assert.deepEqual(report.stockResults.map(({ symbol }) => symbol), SYMBOLS);
  assert.ok(report.stockResults.every(({ sessions }) => sessions.length === SESSIONS.length));
  assert.deepEqual(report.breadthResults.map(({ id }) => id), BREADTH_DISCOVERY.map(({ id }) => id));
  assert.equal(report.summary.allReferenceIdentitiesPass, true);
  assert.equal(report.summary.allCoveragePass, true);
  assert.equal(report.summary.allDataQualityPass, true);
  assert.ok(calls.every(({ method }) => method === "GET"));
  for (let index = MAX_CALLS_PER_MINUTE; index < calls.length; index += 1) {
    assert.ok(calls[index].at - calls[index - MAX_CALLS_PER_MINUTE].at > 60_000);
  }
  const serialized = serializeReport(report, secret);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes("apiKey"), false);
});
