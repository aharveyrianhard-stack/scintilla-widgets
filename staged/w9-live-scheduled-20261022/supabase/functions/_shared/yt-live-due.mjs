// SCINTILLA · yt-live-due — W9 (22 Oct 2026): a scheduled stream is pulled again at its scheduled time.
//
// Alan, 22 Oct: "put them on the feed at the time they're actually scheduled. And at time that live videos are
// scheduled, do a pull … If you have to reduce the amount of queries of the other videos where we search for tickers
// to give room for this, do that."
//
// WHY. The 5-minute pass re-asks a stream only while its page is under REFRESH_DAYS (3) days old. A channel that sets
// up its stream earlier than that (Arete Trading's pre-market show, WOLF Trading's day-trading stream: five to six days
// ahead) is never asked again, so in our table it stays "upcoming" for ever: measured 23 Oct 04:00Z, 77 rows say
// upcoming or live and most of the upcoming ones are long past their hour.
//
// TWO PULLS, ONE VIDEOS CALL (1 unit per 50 ids) EACH:
//   the door   yt-rss-sweep?due=1, called by pg_cron every minute ONLY while a stream is due (the cron's own SQL checks
//              first, so a quiet minute costs nothing): every row still "upcoming" whose scheduled start is from
//              DUE_LEAD_MIN minutes ahead to DUE_TAIL_MIN minutes past. Measured 8–22 Oct: of 327 streams that started,
//              half were on air within 0.5 min of their hour, 76 % within 2, 90 % within 4.8 — so a stream costs about
//              three to five asks before YouTube calls it live and the cron stops asking.
//   the pass   the 5-minute sweep puts the streams due within SETTLE_HOURS (and, once each, every older "upcoming" row
//              last asked before its hour) at the front of the re-asks it already makes, whatever the page's age.
//              They ride calls the pass already pays for; the stale rows settle in a pass or two.
//
// WHAT IT MAY SPEND. The door counts its calls in its own row (DUE_KEY) per Pacific day and stops at DUE_UNITS_PER_DAY.
// The sweep adds them to its own videos calls before working out what the second way may spend (dayGuard), so the day
// still adds up whatever else is changed. The room comes out of the ticker searches (the app_config row
// yt_search_budget_units, which youtube-feed reads on every run): searchMaxUnits says what that row allows.
//
// Plain ESM, read by Deno (yt-rss-sweep) and Node (the tests) alike. No key is read, returned or stored here.
import { pacificClock, SEARCH_BUDGET_UNITS, COST_PER_SEARCH } from "./yt-search-plan.mjs";

export const DUE_KEY = "yt_live_due";
export const DUE_LEAD_MIN = 2;
export const DUE_TAIL_MIN = 15;
export const SETTLE_HOURS = 6;
export const SETTLE_MAX = 50;
export const DUE_MAX_IDS = 50;
export const DUE_UNITS_PER_DAY = 300;

const iso = (sec) => new Date(sec * 1000).toISOString();

/** the door's window: the streams it re-asks about this minute */
export function dueWindow(nowSec) {
  return { from: iso(nowSec - DUE_TAIL_MIN * 60), to: iso(nowSec + DUE_LEAD_MIN * 60) };
}
/** the pass's window: streams whose hour is near or came within SETTLE_HOURS, asked every pass until YouTube moves them */
export function settleWindow(nowSec) {
  return { from: iso(nowSec - SETTLE_HOURS * 3600), to: iso(nowSec + DUE_LEAD_MIN * 60) };
}
/** an older "upcoming" row is asked once after its hour, then left alone (a stream that never ran stays as YouTube says) */
export function needsSettling(row) {
  const at = Date.parse(String((row && row.live_scheduled_at) || ""));
  if (!isFinite(at)) return false;
  const asked = Number(row.live_checked_ts) || 0;
  return asked * 1000 < at;
}

/** the door's row: { day, calls } for the Pacific day, and what the last call did */
export function parseDue(raw) {
  let row = null;
  try { row = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (_) { row = null; }
  return row && typeof row === "object" && !Array.isArray(row) ? row : {};
}
/** the door's calls so far today (0 on a new Pacific day or an unreadable row) */
export function dueCallsToday(raw, nowSec) {
  const row = parseDue(raw);
  if (row.day !== pacificClock(nowSec * 1000).day) return 0;
  const n = Math.floor(Number(row.calls));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
/** may the door call YouTube now? */
export function dueRoom(raw, nowSec) {
  return Math.max(0, DUE_UNITS_PER_DAY - dueCallsToday(raw, nowSec));
}
/** the row after a door call: the day's count and the last call in words */
export function nextDue({ raw, nowSec, sent, asked, moved }) {
  const day = pacificClock(nowSec * 1000).day;
  return { day, calls: dueCallsToday(raw, nowSec) + Math.max(0, sent || 0),
    last: { at: iso(nowSec), asked: asked || 0, moved: moved || [] } };
}

/** what the ticker searches may spend today, read exactly as youtube-feed reads its row (yt_search_budget_units,
    clamped to 0–9000; no row, or one that reads as 0, is SEARCH_BUDGET_UNITS), in whole searches of COST_PER_SEARCH */
export function searchMaxUnits(raw) {
  const budget = Math.min(9000, Math.max(0, +(raw || SEARCH_BUDGET_UNITS) || SEARCH_BUDGET_UNITS));
  return Math.floor(budget / COST_PER_SEARCH) * COST_PER_SEARCH;
}
