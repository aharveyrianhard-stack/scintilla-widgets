import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const ENV_FILE = path.join(os.homedir(), ".config", "massive.env");
export const API_BASE = "https://api.massive.com";
export const MAX_CALLS_PER_MINUTE = 5;
export const RATE_WINDOW_MS = 60_000;

export const SYMBOLS = Object.freeze([
  "AAPL", "AMZN", "DIA", "GOOGL", "IWM", "MAGS", "META",
  "MSFT", "MU", "QQQ", "SMH", "SNDK", "SPY", "TSLA",
]);

export const SESSIONS = Object.freeze([
  Object.freeze({
    id: "full_session",
    date: "2026-08-11",
    independentlyVerifiedAs: "regular NYSE session",
    rthStartUtc: "2026-08-11T13:30:00.000Z",
    rthEndUtcExclusive: "2026-08-11T20:00:00.000Z",
    expectedRthMinutes: 390,
  }),
  Object.freeze({
    id: "early_close_session",
    date: "2025-07-03",
    independentlyVerifiedAs: "NYSE 1:00 p.m. ET early close",
    rthStartUtc: "2025-07-03T13:30:00.000Z",
    rthEndUtcExclusive: "2025-07-03T17:00:00.000Z",
    expectedRthMinutes: 210,
  }),
]);

export const BREADTH_DISCOVERY = Object.freeze([
  Object.freeze({ id: "VIX", search: "CBOE Volatility Index" }),
  Object.freeze({ id: "TICK", search: "NYSE Tick" }),
  Object.freeze({ id: "TRIN", search: "Arms Index" }),
  Object.freeze({ id: "ADD", search: "Advance Decline" }),
  Object.freeze({ id: "CUMTICK", search: "Cumulative Tick" }),
  Object.freeze({ id: "PCC", search: "Put Call Ratio" }),
]);

export function parseEnvFile(text) {
  const values = new Map();
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values.set(match[1], value);
  }
  return values;
}

export async function readApiKey(envFile = ENV_FILE, reader = readFile) {
  let text;
  try {
    text = await reader(envFile, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { ok: false, reason: "env_file_not_found" };
    }
    return { ok: false, reason: "env_file_unreadable" };
  }
  const apiKey = parseEnvFile(text).get("MASSIVE_API_KEY")?.trim();
  if (!apiKey || /^(?:YOUR_|REPLACE_|CHANGEME|TODO)/iu.test(apiKey)) {
    return { ok: false, reason: "missing_api_key" };
  }
  return { ok: true, apiKey };
}

export class SlidingWindowLimiter {
  constructor({
    maxCalls = MAX_CALLS_PER_MINUTE,
    windowMs = RATE_WINDOW_MS,
    now = () => Date.now(),
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  } = {}) {
    if (!Number.isInteger(maxCalls) || maxCalls < 1) throw new TypeError("maxCalls must be a positive integer");
    if (!Number.isFinite(windowMs) || windowMs <= 0) throw new TypeError("windowMs must be positive");
    this.maxCalls = maxCalls;
    this.windowMs = windowMs;
    this.now = now;
    this.sleep = sleep;
    this.calls = [];
  }

  async take() {
    while (true) {
      const current = this.now();
      this.calls = this.calls.filter((calledAt) => calledAt > current - this.windowMs);
      if (this.calls.length < this.maxCalls) {
        this.calls.push(current);
        return current;
      }
      const waitMs = Math.max(1, this.calls[0] + this.windowMs - current + 1);
      await this.sleep(waitMs);
    }
  }
}

function scrubSecret(value, apiKey) {
  if (!apiKey) return String(value ?? "unknown_error");
  return String(value ?? "unknown_error").split(apiKey).join("[REDACTED]");
}

export function serializeReport(report, apiKey = "") {
  return scrubSecret(JSON.stringify(report, null, 2), apiKey);
}

export async function requestJson(publicUrl, apiKey, fetchImpl = globalThis.fetch) {
  const authenticatedUrl = new URL(publicUrl);
  authenticatedUrl.searchParams.set("apiKey", apiKey);
  try {
    const response = await fetchImpl(authenticatedUrl, {
      method: "GET",
      headers: { accept: "application/json" },
      redirect: "error",
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    return { status: response.status, payload };
  } catch (error) {
    return { status: 0, payload: null, error: scrubSecret(error?.message, apiKey) };
  }
}

function hasResults(payload, resultShape) {
  if (resultShape === "object") {
    return Boolean(payload?.results && typeof payload.results === "object" && !Array.isArray(payload.results));
  }
  return Array.isArray(payload?.results) && payload.results.length > 0;
}

export function classifyResponse(status, payload, resultShape = "array") {
  if (status === 403) return "http_403";
  if (status === 404) return "http_404";
  if (status === 200 && !hasResults(payload, resultShape)) return "empty";
  if (status === 200) return "http_200";
  if (status === 0) return "network_error";
  return "http_other";
}

export function buildReferenceUrl(symbol) {
  return `${API_BASE}/v3/reference/tickers/${encodeURIComponent(symbol)}`;
}

export function buildAggregateUrl(symbol, session) {
  const url = new URL(`${API_BASE}/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/minute/${session.date}/${session.date}`);
  url.searchParams.set("adjusted", "false");
  url.searchParams.set("sort", "asc");
  url.searchParams.set("limit", "50000");
  return url.toString();
}

export function buildBreadthUrl(item) {
  const url = new URL(`${API_BASE}/v3/reference/tickers`);
  url.searchParams.set("market", "indices");
  url.searchParams.set("active", "true");
  url.searchParams.set("search", item.search);
  url.searchParams.set("limit", "100");
  return url.toString();
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateAggregateRows(rows, session) {
  const start = Date.parse(session.rthStartUtc);
  const end = Date.parse(session.rthEndUtcExclusive);
  const timestampCounts = new Map();
  const issues = [];
  let previousTimestamp = -Infinity;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? {};
    const timestamp = row.t;
    if (!Number.isInteger(timestamp)) {
      issues.push({ index, field: "t", reason: "not_integer_milliseconds" });
    } else {
      timestampCounts.set(timestamp, (timestampCounts.get(timestamp) ?? 0) + 1);
      if (timestamp % 60_000 !== 0) issues.push({ index, field: "t", reason: "not_minute_aligned" });
      if (timestamp < previousTimestamp) issues.push({ index, field: "t", reason: "not_ascending" });
      previousTimestamp = timestamp;
    }

    for (const field of ["o", "h", "l", "c", "v"]) {
      if (!finiteNumber(row[field])) issues.push({ index, field, reason: "not_finite_number" });
    }
    if (finiteNumber(row.v) && row.v < 0) issues.push({ index, field: "v", reason: "negative" });
    if ([row.o, row.h, row.l, row.c].every(finiteNumber)) {
      if (row.l > row.h) issues.push({ index, field: "ohlc", reason: "low_above_high" });
      if (row.h < Math.max(row.o, row.c)) issues.push({ index, field: "h", reason: "below_open_or_close" });
      if (row.l > Math.min(row.o, row.c)) issues.push({ index, field: "l", reason: "above_open_or_close" });
    }
  }

  const duplicateTimestamps = [...timestampCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([timestamp, count]) => ({ timestamp, count }));
  const rthTimestamps = new Set([...timestampCounts.keys()].filter((timestamp) => timestamp >= start && timestamp < end));
  const missingRthTimestamps = [];
  for (let timestamp = start; timestamp < end; timestamp += 60_000) {
    if (!rthTimestamps.has(timestamp)) missingRthTimestamps.push(timestamp);
  }

  return {
    rowCount: rows.length,
    rthMinuteCount: rthTimestamps.size,
    expectedRthMinutes: session.expectedRthMinutes,
    missingRthMinuteCount: missingRthTimestamps.length,
    missingRthTimestamps,
    duplicateTimestamps,
    issues,
    timestampsPass: !issues.some((issue) => issue.field === "t") && duplicateTimestamps.length === 0,
    ohlcvPass: !issues.some((issue) => issue.field !== "t"),
    volumePass: !issues.some((issue) => issue.field === "v"),
    coveragePass: rthTimestamps.size === session.expectedRthMinutes && missingRthTimestamps.length === 0,
  };
}

function publicRequestMetadata(url) {
  const parsed = new URL(url);
  return { path: parsed.pathname, query: Object.fromEntries(parsed.searchParams) };
}

function summarizeClassifications(items) {
  const counts = {};
  for (const item of items) counts[item.classification] = (counts[item.classification] ?? 0) + 1;
  return counts;
}

export async function runValidation({
  apiKey,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  sleep,
} = {}) {
  if (!apiKey) throw new TypeError("apiKey is required");
  const limiter = new SlidingWindowLimiter({ now, sleep });
  const startedAt = new Date(now()).toISOString();
  const stockResults = [];
  const breadthResults = [];
  let requestCount = 0;

  const call = async (url) => {
    await limiter.take();
    requestCount += 1;
    return requestJson(url, apiKey, fetchImpl);
  };

  for (const symbol of SYMBOLS) {
    const referenceUrl = buildReferenceUrl(symbol);
    const referenceResponse = await call(referenceUrl);
    const referenceClassification = classifyResponse(referenceResponse.status, referenceResponse.payload, "object");
    const reference = {
      request: publicRequestMetadata(referenceUrl),
      httpStatus: referenceResponse.status,
      classification: referenceClassification,
      identityPass: referenceClassification === "http_200" && referenceResponse.payload?.results?.ticker === symbol,
    };
    if (referenceResponse.error) reference.error = referenceResponse.error;

    const sessions = [];
    for (const session of SESSIONS) {
      const aggregateUrl = buildAggregateUrl(symbol, session);
      const response = await call(aggregateUrl);
      const classification = classifyResponse(response.status, response.payload, "array");
      const result = {
        sessionId: session.id,
        date: session.date,
        request: publicRequestMetadata(aggregateUrl),
        httpStatus: response.status,
        classification,
      };
      if (classification === "http_200") {
        result.validation = validateAggregateRows(response.payload.results, session);
      }
      if (response.error) result.error = response.error;
      sessions.push(result);
    }
    stockResults.push({ symbol, reference, sessions });
  }

  for (const item of BREADTH_DISCOVERY) {
    const breadthUrl = buildBreadthUrl(item);
    const response = await call(breadthUrl);
    const classification = classifyResponse(response.status, response.payload, "array");
    breadthResults.push({
      id: item.id,
      search: item.search,
      request: publicRequestMetadata(breadthUrl),
      httpStatus: response.status,
      classification,
      matches: classification === "http_200"
        ? response.payload.results.map(({ ticker, name, market, active, type }) => ({ ticker, name, market, active, type }))
        : [],
      ...(response.error ? { error: response.error } : {}),
    });
  }

  const aggregateResults = stockResults.flatMap((item) => item.sessions);
  const referenceResults = stockResults.map((item) => item.reference);
  const allCoveragePass = aggregateResults.every((item) => item.validation?.coveragePass === true);
  const allDataQualityPass = aggregateResults.every((item) =>
    item.validation?.timestampsPass === true && item.validation?.ohlcvPass === true && item.validation?.volumePass === true);

  return {
    schemaVersion: "massive-free-tier-validation/v1",
    status: "completed",
    startedAt,
    finishedAt: new Date(now()).toISOString(),
    constraints: {
      environmentFile: "~/.config/massive.env",
      maxCallsPerRollingMinute: MAX_CALLS_PER_MINUTE,
      liveRequestCount: requestCount,
      mutationsPermitted: false,
    },
    scope: {
      symbols: SYMBOLS,
      sessions: SESSIONS,
      breadthQueries: BREADTH_DISCOVERY,
    },
    summary: {
      expectedRequestCount: SYMBOLS.length * (1 + SESSIONS.length) + BREADTH_DISCOVERY.length,
      actualRequestCount: requestCount,
      referencesByClassification: summarizeClassifications(referenceResults),
      aggregatesByClassification: summarizeClassifications(aggregateResults),
      breadthByClassification: summarizeClassifications(breadthResults),
      allReferenceIdentitiesPass: referenceResults.every((item) => item.identityPass),
      allCoveragePass,
      allDataQualityPass,
    },
    stockResults,
    breadthResults,
  };
}
