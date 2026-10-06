// Builds data/market-signal-simulated.json from YouTube's PUBLIC channel feed for Market Signal: the rows the
// Station's feed would serve once the channel is back on the SCINTILLA list. Read-only; no key; writes one file.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHANNEL = "UCLSjYYwAX9cJKSxbUChPNKQ";
const un = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const xml = await (await fetch("https://www.youtube.com/feeds/videos.xml?channel_id=" + CHANNEL)).text();
const rows = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => {
  const e = m[1], id = (e.match(/<yt:videoId>([^<]+)/) || [])[1], at = (e.match(/<published>([^<]+)/) || [])[1];
  return { video_id: id, title: un((e.match(/<title>([^<]*)/) || [])[1]), channel: "Market Signal", channel_id: CHANNEL, tickers: null, duration: null,
    is_short: false, thumb_url: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg", published_at: at, subscription_accounts: ["scintilla"],
    feed_at: at, live_state: "none", starts_at: null };
});
const out = { note: "SIMULATED: these rows are built from YouTube's public channel feed for Market Signal (read " + new Date().toISOString() +
  ") in the shape the Station's feed serves. They are NOT in the table until the staged list change is applied. A video's length is unknown until the collector asks YouTube, so these tiles carry no length.",
  inject: { youtube_feed: rows } };
fs.writeFileSync(path.join(HERE, "../data/market-signal-simulated.json"), JSON.stringify(out, null, 1));
console.log(rows.length + " rows · newest: " + rows[0].title + " · " + rows[0].published_at);
