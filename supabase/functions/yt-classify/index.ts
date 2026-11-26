// 25 Nov 2026 (coordinator). NO SHORTS AND NO MEMBERS-ONLY VIDEOS ON THE STATION.
// Alan: "the station, can we get the YouTube shorts off of it? No more shorts. And then there's videos that are members only
// content. Let's avoid that because then it stops playing because it's members only content, you know?"
//
// MEASURED 25 Nov 23:15 ET: the collectors' Shorts test (a HEAD of youtube.com/shorts/<id> from the cloud) has missed about
// 1 Short in 6 since 2 Nov - of 60 sampled "not short" rows of 1-3 minutes, 23 were Shorts by YouTube's own answer to the Mac -
// and nothing marked members-only videos at all. YouTube's embedded player raises NO error on a members-only video; it sits at
// "not started" (checked headless), so the Station's skip-unavailable never fired and playback stopped.
//
// HOW THIS KNOWS. YouTube keeps official per-channel lists, read with the same Data API key at 1 unit a page:
//   UUSH + channel id without its "UC" = that channel's Shorts
//   UUMO + channel id without its "UC" = its members-only videos (404 = the channel has none)
// Checked 25 Nov: TrendSpider's and Barchart's Shorts lists held exactly the Shorts our flag had missed; four videos from the
// members-only lists were UNPLAYABLE with the members-only badge on YouTube's own watch page, two ordinary videos were OK.
//
// WHAT IT WRITES, youtube_videos only, nothing deleted:
//   is_short = true            the row is in its channel's Shorts list (a flag the collectors missed; never turned off here)
//   members_only = true        the row is in the channel's members-only list
//   members_only = false       a members-first video that went public (it left the list)
//   class_tries, class_checked_at   how often a row was looked at: 0 not yet, 1-4 looked at and in neither list, 9 found
// Every flag it changes is written to yt_class_log (the undo list, and how long after landing it was found).
//
// WHEN. cron yt-classify-1m calls it every minute. A followed channel's new row is looked at as soon as it lands, then 5, 20
// and 60 minutes later unless found sooner (a brand-new upload can reach the lists after the video itself). The view's
// station_ok holds a brand-new upload of 3 minutes or less until its first look, for at most 15 minutes.
// cron yt-classify-members-daily calls ?members=1: the members-only lists of channels with members-only rows are read again,
// so a members-first video that went public comes back.
// ?backfill_days=N looks at every followed row of the last N days not looked at yet, reading the lists as deep as that.
//
// COST. 2 units for each channel with something to look at; app_config yt_class_settings caps a run and a day
// (default {"on":1,"per_run":40,"per_day":3000}; {"on":0} stops the minute job without a deploy). Status: app_config
// yt_class_result. The daily quota is 10,000 units; the collectors use about 600 a day (yt_rss_result).

const SB = Deno.env.get("SUPABASE_URL") || "", SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const H = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "content-type": "application/json" };
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const CHANNEL = /^UC[\w-]{22}$/;
const DUE_AFTER_S = [0, 300, 1200, 3600];   // look k (0-3) is due this long after the row landed
const FOUND = 9, DONE = 4;
const DEFAULTS = { on: 1, per_run: 40, per_day: 3000 };

async function pg(path: string, init: RequestInit = {}) {
  const r = await fetch(SB + "/rest/v1/" + path, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(path.split("?")[0] + " -> " + r.status + " " + t.slice(0, 200));
  return t ? JSON.parse(t) : null;
}
const rpc = (fn: string, a: Record<string, unknown> = {}) => pg("rpc/" + fn, { method: "POST", body: JSON.stringify(a) });
async function authorized(req: Request) {
  const b = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!b) return false;
  if (b === SERVICE) return true;
  try { return (await rpc("push_cron_key_ok", { k: b })) === true; } catch (_) { return false; }
}
const nyDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const inList = (ids: string[]) => "in.(" + ids.map((id) => '"' + id.replace(/"/g, "") + '"').join(",") + ")";

type Row = { video_id: string; channel_id: string; is_short: boolean | null; members_only: boolean | null; class_tries: number; updated_ts: number | null; published_at: string | null };
type ListRead = { ok: boolean; ids: Set<string>; oldest: number | null; truncated: boolean; units: number; error?: string };

/** one official list of one channel, newest first, as deep as untilMs (or maxPages) */
async function readList(key: string, prefix: "UUSH" | "UUMO", channelId: string, untilMs: number, maxPages: number): Promise<ListRead> {
  const out: ListRead = { ok: false, ids: new Set(), oldest: null, truncated: false, units: 0 };
  let token = "";
  for (let page = 0; page < maxPages; page++) {
    const u = "https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=" + prefix +
      channelId.slice(2) + (token ? "&pageToken=" + encodeURIComponent(token) : "") + "&key=" + encodeURIComponent(key);
    let r: Response;
    try { r = await fetch(u, { signal: AbortSignal.timeout(10000) }); }
    catch (e) { out.error = prefix + " " + String(e).slice(0, 100); return out; }
    out.units++;
    if (r.status === 404) { await r.text(); out.ok = true; return out; }   // the channel has no such list
    if (!r.ok) { out.error = prefix + " " + r.status + " " + (await r.text()).slice(0, 100); return out; }
    const b = await r.json();
    for (const it of b.items || []) {
      const id = it?.contentDetails?.videoId; if (id) out.ids.add(String(id));
      const t = Date.parse(it?.contentDetails?.videoPublishedAt || "");
      if (Number.isFinite(t)) out.oldest = out.oldest == null ? t : Math.min(out.oldest, t);
    }
    token = String(b.nextPageToken || "");
    if (!token) { out.ok = true; return out; }
    if (out.oldest != null && out.oldest < untilMs) { out.ok = true; out.truncated = true; return out; }
  }
  out.ok = true; out.truncated = !!token; return out;
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

/** rows by pages of 1000 (the API's own cap) */
async function rowsPaged(q: string, max: number): Promise<Row[]> {
  const out: Row[] = [];
  for (let off = 0; off < max; off += 1000) {
    const page = await pg(q + "&limit=1000&offset=" + off);
    out.push(...(page || []));
    if (!page || page.length < 1000) break;
  }
  return out;
}

async function run(opts: { backfillDays: number; members: boolean; cap: number }) {
  const t0 = Date.now(), now = Math.floor(t0 / 1000);
  const cfg = await pg("app_config?select=key,value&key=in.(YT_API_KEY,yt_class_settings,yt_class_result)");
  const C: Record<string, string> = {}; for (const r of cfg || []) C[r.key] = String(r.value || "");
  let settings = { ...DEFAULTS }; try { settings = { ...DEFAULTS, ...JSON.parse(C.yt_class_settings || "{}") }; } catch (_) { /* defaults */ }
  let last: Record<string, unknown> = {}; try { last = JSON.parse(C.yt_class_result || "{}") || {}; } catch (_) { /* fresh */ }
  const key = String(C.YT_API_KEY || "").replace(/"/g, "").trim();
  if (!key) return { error: "no YT_API_KEY" };
  const minute = !opts.backfillDays && !opts.members;
  if (minute && !Number(settings.on)) return { off: true };
  const day = nyDay(), perDay = Number(settings.per_day) || DEFAULTS.per_day;
  let unitsToday = last.day === day ? Number(last.units_today || 0) : 0;
  if (unitsToday >= perDay) return { capped: true, units_today: unitsToday };

  const sel = "video_id,channel_id,is_short,members_only,class_tries,updated_ts,published_at";
  const followed = "&subscription_accounts=neq.%7B%7D";
  // what the members-only lists may give back: rows marked members-only within 60 days
  const membersRows: Row[] = await rowsPaged("youtube_videos?select=" + sel + "&members_only=is.true&published_at=gt." +
    new Date(t0 - 60 * 86400e3).toISOString(), 5000);
  const membersBy = new Map<string, Row[]>();
  for (const m of membersRows) { if (!membersBy.has(m.channel_id)) membersBy.set(m.channel_id, []); membersBy.get(m.channel_id)!.push(m); }

  let due: Row[] = [];
  if (opts.backfillDays) {
    due = await rowsPaged("youtube_videos?select=" + sel + "&class_tries=lt." + DONE + followed + "&published_at=gt." +
      new Date(t0 - opts.backfillDays * 86400e3).toISOString() + "&order=published_at.desc", 40000);
  } else if (!opts.members) {
    const rows = await rowsPaged("youtube_videos?select=" + sel + "&class_tries=lt." + DONE + followed + "&updated_ts=gt." +
      (now - 172800) + "&order=updated_ts.desc", 10000);
    due = rows.filter((r) => r.class_tries >= 0 && r.class_tries < DONE && now - Number(r.updated_ts || 0) >= DUE_AFTER_S[r.class_tries]);
  }
  const bad = due.filter((r) => !CHANNEL.test(String(r.channel_id || ""))).map((r) => r.video_id);
  const byChannel = new Map<string, Row[]>();
  for (const r of due) {
    if (!CHANNEL.test(String(r.channel_id || ""))) continue;
    if (!byChannel.has(r.channel_id)) byChannel.set(r.channel_id, []);
    byChannel.get(r.channel_id)!.push(r);
  }
  // the daily members pass: every channel with members-only rows of the last 14 days, its members-only list only
  const membersOnly = opts.members
    ? [...membersBy.entries()].filter(([, rs]) => rs.some((m) => Date.parse(m.published_at || "") > t0 - 14 * 86400e3)).map(([ch]) => ch)
    : [];
  const cap = opts.cap || (opts.backfillDays ? 60 : Number(settings.per_run) || DEFAULTS.per_run);
  const channels = (opts.members ? membersOnly : [...byChannel.keys()]).slice(0, cap);
  const left = (opts.members ? membersOnly.length : byChannel.size) - channels.length;
  const untilMs = opts.backfillDays ? t0 - opts.backfillDays * 86400e3 : t0 - 3 * 86400e3;
  const maxPages = opts.backfillDays ? 8 : 1;

  let units = 0;
  const errors: string[] = [];
  const shortIds = new Set<string>(), membersIds = new Set<string>(), publicIds = new Set<string>(), foundIds = new Set<string>();
  const triesBy = new Map<number, string[]>();
  const log: { video_id: string; channel_id: string; change: string; age_s: number | null }[] = [];
  const age = (r: Row) => (r.updated_ts ? now - Number(r.updated_ts) : null);

  await pool(channels, 8, async (ch) => {
    if (unitsToday + units + 2 > perDay) return;
    const sh = opts.members ? null : await readList(key, "UUSH", ch, untilMs, maxPages);
    const mo = await readList(key, "UUMO", ch, opts.members ? t0 - 60 * 86400e3 : untilMs, opts.members ? 4 : maxPages);
    units += (sh ? sh.units : 0) + mo.units;
    if (sh && !sh.ok && sh.error) errors.push(sh.error);
    if (!mo.ok && mo.error) errors.push(mo.error);
    for (const r of byChannel.get(ch) || []) {
      if (opts.members) break;
      const isS = !!(sh && sh.ok && sh.ids.has(r.video_id)), isM = mo.ok && mo.ids.has(r.video_id);
      if (isS) { foundIds.add(r.video_id); if (r.is_short !== true) { shortIds.add(r.video_id); log.push({ video_id: r.video_id, channel_id: ch, change: "short", age_s: age(r) }); } }
      if (isM) { foundIds.add(r.video_id); if (r.members_only !== true) { membersIds.add(r.video_id); log.push({ video_id: r.video_id, channel_id: ch, change: "members", age_s: age(r) }); } }
      if (isS || isM) continue;
      if (!(sh && sh.ok) || !mo.ok) continue;   // a list did not answer: looked at again next minute
      // in neither list: one more look on the schedule; in a backfill, a row that landed over two hours ago is done
      const next = opts.backfillDays && age(r) != null && Number(age(r)) > 7200 ? DONE : Math.min(DONE, r.class_tries + 1);
      if (!triesBy.has(next)) triesBy.set(next, []);
      triesBy.get(next)!.push(r.video_id);
    }
    if (mo.ok) for (const m of membersBy.get(ch) || []) {   // a members-first video that went public left the list
      if (mo.ids.has(m.video_id)) continue;
      const pub = Date.parse(m.published_at || "");
      if (mo.truncated && mo.oldest != null && Number.isFinite(pub) && pub < mo.oldest) continue;   // older than what was read
      publicIds.add(m.video_id); log.push({ video_id: m.video_id, channel_id: ch, change: "members_public", age_s: null });
    }
  });

  const at = new Date().toISOString();
  const patch = async (ids: string[], body: Record<string, unknown>) => {
    for (let i = 0; i < ids.length; i += 150) {
      await pg("youtube_videos?video_id=" + inList(ids.slice(i, i + 150)), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body) });
    }
  };
  let writeError = "";
  try {
    const both = [...shortIds].filter((id) => membersIds.has(id));
    await patch([...shortIds].filter((id) => !membersIds.has(id)), { is_short: true, class_tries: FOUND, class_checked_at: at });
    await patch([...membersIds].filter((id) => !shortIds.has(id)), { members_only: true, class_tries: FOUND, class_checked_at: at });
    await patch(both, { is_short: true, members_only: true, class_tries: FOUND, class_checked_at: at });
    await patch([...foundIds].filter((id) => !shortIds.has(id) && !membersIds.has(id)), { class_tries: FOUND, class_checked_at: at });
    for (const [tries, ids] of triesBy) await patch(ids, { class_tries: tries, class_checked_at: at });
    await patch([...publicIds].filter((id) => !membersIds.has(id)), { members_only: false, class_checked_at: at });
    await patch(bad, { class_tries: DONE, class_checked_at: at });
    for (let i = 0; i < log.length; i += 500) {
      await pg("yt_class_log", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(log.slice(i, i + 500)) });
    }
  } catch (e) { writeError = String(e).slice(0, 200); }

  unitsToday += units;
  const summary = {
    mode: opts.backfillDays ? "backfill " + opts.backfillDays + "d" : opts.members ? "members" : "minute",
    due: due.length, channels: channels.length, channels_left: left, units,
    shorts: shortIds.size, members: membersIds.size, members_public: publicIds.size,
    looked_not_found: [...triesBy.values()].reduce((n, ids) => n + ids.length, 0),
    errors: errors.length, first_error: errors[0] || null, write_error: writeError || null, ms: Date.now() - t0,
  };
  const result = { at, day, units_today: unitsToday, last_run: summary,
    last_found: shortIds.size || membersIds.size ? at : (last.last_found || null) };
  await pg("app_config?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ key: "yt_class_result", value: JSON.stringify(result) }]) }).catch(() => {});
  return summary;
}

Deno.serve(async (req) => {
  try {
    if (!(await authorized(req))) return J({ error: "unauthorized" }, 401);
    const q = new URL(req.url).searchParams;
    const backfillDays = Math.max(0, Math.min(60, Number(q.get("backfill_days") || 0) || 0));
    const cap = Math.max(0, Math.min(400, Number(q.get("cap") || 0) || 0));
    return J(await run({ backfillDays, members: q.get("members") === "1", cap }));
  } catch (e) { return J({ error: String(e).slice(0, 300) }, 500); }
});
