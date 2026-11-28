#!/usr/bin/env node
/* 28 Nov 2026 (coordinator). Builds the phone's NEON boxes: one Home Screen web app per box under /notify/b/n-<box>/.
   Alan (relayed by the markets session, 09:25 ET): "Can you get someone on the new notification split with the new icons and stuff? We never
   did that." and "The Urth feed should be fully separate. Fully separate. Another icon on Home Screen all of it."
   The boxes and icons are the 26 Nov design (CLAUDE SET UP/daily-report/taxonomy.json "boxes", notify_icons/svg - copied here, unchanged)
   with Urth taken out of HOME into an app of its own (svg/urth.svg, same style, its own green ground). The database decides each alert's box
   (public.notify_box_n, live once public.notify_card_box calls it); notify-push sends it to that box's app. The 19 Nov five (/notify/b/<box>/,
   build-boxes.py) stay untouched until these are proven on the phone.
   Run from the repo root:  node notify/b/neon/build-neon.mjs
   Writes per box: index.html, manifest.webmanifest, icon-512.png, icon-192.png, apple-touch-icon.png (180), card.html; and preview.png here.
   The PNGs are drawn by headless Chromium (Playwright): PLAYWRIGHT_FROM=<a package.json beside a playwright install>, default below. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url)), BDIR = path.dirname(HERE), NOTIFY = path.dirname(BDIR);
const BOXES = [
  // box id, word (under the icon and on every alert), page name, neon, ground, icon, what it holds, private (never listed on its page)
  ["n-tape", "TAPE", "Tape", "#00FFA3", "#0A0A0F", "tape", "Movers and waterfalls, big candles, volume spikes, the playbook's level banners, tape readouts and market-wide moves.", false],
  ["n-ai", "AI BUILD", "AI build", "#8B5CF6", "#0A0A0F", "ai", "The AI chain: chips, memory, GPU rents, data centres, power, capex, AI demand and AI credit, and your AI names' headlines.", false],
  ["n-macro", "MACRO", "Macro", "#FF8A00", "#0A0A0F", "macro", "The Fed, rates and bonds, inflation and jobs, oil and OPEC, the dollar, tariffs and trade, the economic calendar.", false],
  ["n-earnings", "EARNINGS", "Earnings", "#FFE500", "#0A0A0F", "earnings", "Earnings prints and call transcripts, guidance, analyst ratings and price-target changes.", false],
  ["n-world", "ASIA · EU", "Asia · EU", "#00D4FF", "#0A0A0F", "world", "Overnight sessions, Asia and Europe markets, the yen, gold, silver and metals.", false],
  ["n-flash", "FLASH", "Flash", "#FF3060", "#0A0A0F", "flash", "Breaking headlines: the Situation firehose, and the news that fits no other box.", false],
  ["n-research", "RESEARCH", "Research", "#C8FF00", "#0A0A0F", "research", "Our reports and reads, the X digest, Texas power, the research desk's watches, and new videos.", false],
  ["n-press", "PRESS", "Press", "#767690", "#0A0A0F", "press", "Company press releases from the wires - the biggest stream.", false],
  ["n-home", "HOME", "Home", "#FF5500", "#0A0A0F", "home", "The lights, the Macs and Scintilla's own notices: restarts, a job that had a problem, a sign-in that is needed.", true],
  ["n-urth", "URTH", "Urth", "#8FE3A0", "#07150D", "urth", "Urth Landscaping only: crew and weather calls, client emails and the Gmail watches.", true],
];

const PAGE = fs.readFileSync(path.join(HERE, "neon.template.html"), "utf8");
const CARD = fs.readFileSync(path.join(NOTIFY, "card.html"), "utf8");
const require = createRequire(process.env.PLAYWRIGHT_FROM || "/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });

/* one PNG: the icon at 92 % on a full square of its own ground, so the phone's rounded mask never clips the neon frame */
async function png(svg, ground, size, file) {
  const s = Math.round(size * 0.92);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent('<!doctype html><html><body style="margin:0;width:' + size + "px;height:" + size + "px;background:" + ground +
    ';display:flex;align-items:center;justify-content:center;overflow:hidden">' + svg.replace("<svg ", '<svg width="' + s + '" height="' + s + '" ') + "</body></html>");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: size, height: size } });
}

const cards = [];
for (const [bid, word, name, colour, ground, icon, holds, priv] of BOXES) {
  const out = path.join(BDIR, bid), scope = "/notify/b/" + bid + "/";
  fs.mkdirSync(out, { recursive: true });
  const svg = fs.readFileSync(path.join(HERE, "svg", icon + ".svg"), "utf8");
  for (const [sz, fn] of [[512, "icon-512.png"], [192, "icon-192.png"], [180, "apple-touch-icon.png"]]) await png(svg, ground, sz, path.join(out, fn));
  fs.writeFileSync(path.join(out, "manifest.webmanifest"), JSON.stringify({
    id: scope, name: bid === "n-urth" ? "Urth" : "Scintilla " + name, short_name: word, start_url: scope, scope, display: "standalone",
    background_color: ground, theme_color: ground,
    icons: [{ src: scope + "icon-192.png", sizes: "192x192", type: "image/png" }, { src: scope + "icon-512.png", sizes: "512x512", type: "image/png" }],
  }));
  const html = PAGE.replaceAll("{{BOX}}", bid).replaceAll("{{NAME}}", name).replaceAll("{{SHORT}}", word).replaceAll("{{COLOUR}}", colour)
    .replaceAll("{{GROUND}}", ground).replaceAll("{{HOLDS}}", holds).replaceAll("{{SCOPE}}", scope).replaceAll("{{PRIVATE}}", String(priv));
  if (/\{\{[A-Z]+\}\}/.test(html)) throw new Error(bid + ": a placeholder was left unfilled");
  fs.writeFileSync(path.join(out, "index.html"), html);
  /* the tapped alert's page, the same as the all-in-one app's, but its way back is this box */
  let card = CARD.replace('href="/notify/icon-192.png"', 'href="' + scope + 'icon-192.png"').replace('href="/notify/">All alerts</a>', 'href="' + scope + '">' + word + "</a>");
  card = card.replace('history.replaceState(null, "", "/notify/")', 'history.replaceState(null, "", "' + scope + '")').replace('location.replace("/notify/")', 'location.replace("' + scope + '")');
  if (card.split(scope).length - 1 < 4) throw new Error(bid + ": card.html did not take the box's way back");
  fs.writeFileSync(path.join(out, "card.html"), card);
  cards.push('<div class="c"><img src="../' + bid + '/icon-512.png"><b style="color:' + colour + '">' + word + "</b><span>" + holds + "</span></div>");
  console.log("built", scope);
}

/* a picture of the ten, for whoever has to say yes to them (kept beside the build, never served) */
fs.writeFileSync(path.join(HERE, "preview.html"), '<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#0A0A0F;color:#E8E8F0;font-family:-apple-system,Helvetica,Arial,sans-serif;width:1500px}' +
  "h1{font-size:34px;margin:28px 36px 6px}p{font-size:19px;color:#9a9ab2;margin:0 36px 22px}.g{display:grid;grid-template-columns:repeat(5,1fr);gap:26px 18px;padding:0 36px 36px}" +
  ".c{text-align:center}.c img{width:170px;height:170px;border-radius:38px;display:block;margin:0 auto 10px}.c b{display:block;font-size:20px;letter-spacing:.06em}.c span{display:block;font-size:14px;color:#9a9ab2;line-height:1.35;margin-top:6px}</style></head><body>" +
  "<h1>Your phone's alert boxes - ten Home Screen apps</h1><p>The 26 Nov neon icons, one app per box. URTH is its own app now: nothing from the markets goes in it, and no Urth alert goes anywhere else.</p>" +
  '<div class="g">' + cards.join("") + "</div></body></html>");
await page.setViewportSize({ width: 1500, height: 900 });
await page.goto("file://" + path.join(HERE, "preview.html"));
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(HERE, "preview.png"), fullPage: true });
await browser.close();
console.log("preview", path.join(HERE, "preview.png"));
