# S13: writes the S13 section into STATION-CONTROLS.html (between its two markers, above S12's sections) from harness/s13.json.
import json, re, pathlib
HERE = pathlib.Path(__file__).resolve().parent; PAGE = HERE.parent / "STATION-CONTROLS.html"; ROOT = HERE.parents[3]
m = json.loads((HERE / "s13.json").read_text()); shell = (ROOT / "station-shells/personal-video-v1/index.html").read_text(); xsh = (ROOT / "station-shells/x-v2/index.html").read_text()
S = [("1680x1050", "MacBook", 403), ("1920x1080", "Apple TV", 461), ("2560x1440", "External", 614)]
def fig(src, cap, w=640): return f'<figure><img src="shots/{src}" alt="{cap}" loading="lazy" style="max-width:{w}px"><figcaption>{cap}</figcaption></figure>'
def svg(src, ident):
    t = re.search(r'id="' + ident + r'"[^>]*>\s*(<svg[\s\S]*?</svg>)', src).group(1)
    return t.replace("<svg ", '<svg width="16" height="16" style="vertical-align:-3px;fill:none;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round" ', 1).replace('class="f"', 'style="fill:currentColor;stroke:none"')
o = ['<!-- S13:BEGIN -->', '<h2>S13 · The tweaks after seeing it live — NEXT, GRID, + WATCH LATER, icons, and X refreshing as "a page up"</h2>',
     '<div class="sub">S13 · 5 Oct 2026 · same branch · the real Station page in a hidden browser · nothing deployed, nothing live</div>',
     '<h3>The YouTube bar at the three widths</h3><div class="pics">']
for k, n, c in S:
    o.append('<div class="pair">' + fig(f"s13-ytbar-{k}-grid.png", f"{n} · {c} px · on the thumbnails: NEXT · GRID (lit: you are here) · + WATCH LATER · REFRESH … ⛶ · ⋯") + fig(f"s13-ytbar-{k}-playing.png", f"{n} · {c} px · while a video plays: the same four, then PREVIOUS and the place in the queue … float · ⛶ · ⋯") + '</div>')
o.append('</div><div class="pics">' + fig("s13-ytmenu-1680x1050-grid.png", "MacBook · the ⋯ on the thumbnails: the channel switch and the filters (the + is orange: the thumbnail pointed at is already saved)") + fig("s13-ytmenu-1680x1050-playing.png", "MacBook · the ⋯ over a playing video: the channel, then that video's other actions") + fig("s13-yt-1680x1050-watch-grid.png", "MacBook · + WATCH LATER from the thumbnails: point at one (orange outline), tap + — it turns orange with a tick and says what it added") + '</div>')
o.append('<h3>The X bar and the refresh setting</h3><div class="pics">')
for k, n, c in S: o.append('<div class="pair">' + fig(f"s13-xbar-{k}.png", f"{n} · {c} px · the X bar: live · list · notifications · refresh, with its cadence beside it · ⋯ · ⛶") + fig(f"s13-xmore-{k}.png", f"{n} · the ⋯ open: A PAGE UP EVERY 30S · 60S · 90S (60 is lit), then −30s, iPad link and the source's name") + '</div>')
o.append('</div><h3>One page up, as the pane shows it (a stand-in for x.com — see the note)</h3><div class="pics">' +
         fig("s13-x-1680x1050-1-reading.png", "1 · reading. A minute of the slow scroll has passed; the refresh is due but the pointer is on the feed, so it waits", 300) +
         fig("s13-x-1680x1050-2-turning.png", "2 · the pointer left, the page-up was asked. X's own page is EMPTY at this moment — the pane keeps the last picture", 300) +
         fig("s13-x-1680x1050-3-landed.png", "3 · landed: the two NEW posts on top, and the post that was being read (Desk Notes) still on screen under them", 300) + '</div>')
pu = m["pageUp"]; rd = pu["reading"]
o.append(f'<p><b>What happens on each refresh.</b> The source does X\'s own refresh (the "See new posts" pill, else a re-tap of the tab already selected — exactly what ↻ does), then scrolls its own page to the top. In the run pictured: the post being read was <b>{rd["who"]}</b> at the top of the pane; after the page-up the two new posts are on top and {rd["who"]} is {pu["readingMovedDownPx"]} px lower, still on screen. The whole turn took {pu["run"]["ms"]} ms, during which the stand-in\'s timeline was empty ({pu["run"]["emptiestMomentPosts"]} posts at its emptiest) — the pane\'s picture did not change by one pixel until the new page was painted. If no post is painted within 3.5 s the source goes back to where it was and nothing changes.</p>')
o.append('<table><tr><th>Screen</th><th>Column</th><th>YouTube bar, thumbnails</th><th>YouTube bar, playing</th><th>X bar</th><th>Cadence</th></tr>')
for k, n, c in S:
    r = m[k]; y = r["youtube"]; x = r["x"]
    st = lambda b: f'{len(b["items"])} items · one line · {len(b["cut"])} cut · {len(b["squeezed"])} squeezed · {b["spare"]} px to spare'
    o.append(f'<tr><td>{n}<br><small>{k}</small></td><td>{c} px</td><td>{st(y["grid"])}</td><td>{st(y["playing"])}</td><td>{len(x["bar"]["items"])} items · one line · {len(x["bar"]["cut"])} cut · {len(x["bar"]["overlaps"])} overlapping</td><td>{x["every"]["seconds"]} s by default · chose 90 → shows {x["chose90"]["text"]}, kept</td></tr>')
o.append('</table>')
I = lambda i: svg(shell, i); J = lambda i: svg(xsh, i)
add = re.search(r'(<svg class="add"[\s\S]*?</svg>)(<svg class="saved"[\s\S]*?</svg>)', shell)
fx = lambda t: t.replace("<svg ", '<svg width="16" height="16" style="vertical-align:-3px;fill:none;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round" ', 1)
o.append('<h3>The icon legend</h3><table><tr><th>Icon</th><th>Name</th><th>What it does</th><th>Where</th></tr>' + "".join(f"<tr><td>{a}</td><td><b>{b}</b></td><td>{c}</td><td>{d}</td></tr>" for a, b, c, d in [
  (I("bNext"), "NEXT", "the next video. On the thumbnails it starts the queue: the video after the last one watched, else the first", "YouTube, always"),
  (I("bBack"), "GRID", "back to the thumbnails — from a playing video, and from the big theatre view too. Lit blue when you are already there (a tap then goes to the top of the list)", "YouTube, always"),
  (fx(add.group(1)), "+ WATCH LATER", "adds the video that is playing — so after NEXT it is for the next one — or, on the thumbnails, the one the pointer is on (outlined orange)", "YouTube, always"),
  ('<span style="color:#FF8A00">' + fx(add.group(2)) + '</span>', "IN WATCH LATER", "the same button once saved: orange, with a tick. A tap removes it", "YouTube"),
  (I("bRefresh"), "REFRESH", "YouTube: read the list again now. X: refresh now, newest posts to the top", "both bars"),
  (I("bPrev"), "PREVIOUS", "the video before this one; the numbers beside it are the place in the queue (2 / 200)", "YouTube, while playing"),
  (I("bPipBar"), "FLOAT", "lift the playing video into its own small window", "YouTube, while playing"),
  ("⛶", "EXPAND", "the video over the charts (and back)", "both bars"),
  (I("bMenu"), "MORE", "YouTube: the channel switch (PERSONAL / SCINTILLA …), the filters (grid · videos · shorts · the lists), and a playing video's other actions. X: how often it refreshes, −30s, iPad link, the source", "both bars"),
  (J("bXList"), "LIST", "the trading list", "X"), (J("bXNotify"), "NOTIFICATIONS", "posts from the accounts with the bell on", "X"),
  ('<small>60s</small>', "CADENCE", "how often X refreshes by itself; change it behind ⋯ (30 / 60 / 90 seconds)", "X, beside refresh"),
]) + '</table><p><small>Hold the pointer on any icon and it says its name in one line. Words were kept only where a picture would be a guess: TAP TO CONTINUE, the channel\'s name, the filter names, and the items inside the ⋯ (there is room for words there).</small></p>')
o.append('<div class="rec"><b>After the deploy, the one thing Alan does</b> (once per browser that feeds X — Chrome, and Brave if it is used): <b>on chrome://extensions press ↻ on "X Bridge", then click the x.com source tab and press ⌥⇧S.</b><br><small>That loads bridge 0.7.23 — the uncropped column from S12 and the page-up from S13 arrive together. The health page (/x-health) now expects 0.7.23 and marks any browser still on an older bridge "needs ↻ + ⌥⇧S". Until then the pane still works: the cadence asks an older bridge for its ordinary refresh, which also goes to the top.</small></div>')
tb = m["1680x1050"]
o.append(f'''<h3>Notes</h3><ul>
<li><b>There was no 30-second timer to slow down.</b> Before this, the X feed refreshed only when ↻ was pressed; between presses it drifts down slowly (3 px a second) and the only "30" on the pane was the −30s rewind. So the cadence is new: by itself every 60 s unless 30 or 90 is chosen. If what felt "too fast" was the drift itself, that is a different dial (the scroll speed) and was not touched.</li>
<li><b>The rules the timer lives with</b> (tested together): it waits while the pointer is on the feed and runs when the pointer leaves; it waits while the ⋯ panel is open; a hidden pane asks for nothing; with two Station windows on one source only one asks (and the bridge drops a second ask inside 20 s); the iPad never asks; ↻ by hand and a change of list start the count again.</li>
<li><b>Stand-ins, said plainly.</b> The hidden browser cannot run the bridge and may not open a visible window, so x.com is played by the same stand-in page as S12, and "X refreshed" is played by that page going empty for 0.6 s and returning with two new posts. The code that turns the page is the bridge's own <code>pageUpRefresh()</code>, lifted from its source. It has <b>not</b> been run against the real x.com: how fast X repaints, and whether a re-tap of the selected tab still refreshes, are only known once 0.7.23 is loaded. The watch-later write was answered locally ({tb["stubbedWatchLaterWrites"]} per screen), so nothing was added to Alan's real list; every other write was blocked ({tb["blockedWrites"]} per screen).</li>
<li><b>Choices made where the brief was silent:</b> PREVIOUS and the queue place stay on the bar while a video plays (there is room: {tb["youtube"]["playing"]["spare"]} px to spare at 403 px); the channel's name stays on the bar as a small label now that its switch is tucked away; on a touch screen a tap on a thumbnail plays it, so + from the thumbnails is a mouse gesture — on the iPad, play then +.</li>
<li><b>Older tests changed, three lines:</b> one that pinned the words "‹ grid", S12's own test of the chip on the bar, and S12's bridge version (0.7.22 → 0.7.23). Station tests 957 → 964, the same 18 known failures. The bridge draft's own folder: 75 tests, the same 9 failures before and after.</li></ul>
<details class="sc-pagespecs"><summary>PAGE SPECS · S13</summary><div>Harness: <code>harness/s13.mjs</code> → <code>harness/s13.json</code>, <code>shots/s13-*.png</code> (deck at 1680 / 1920 / 2560, device scale 2). Test: <code>tests/station-s13-tweaks-20261005.test.mjs</code>. This section: <code>harness/build-s13.py</code>.</div></details>''')
o.append('<!-- S13:END -->')
html = PAGE.read_text(); block = "\n".join(o) + "\n\n"
if "<!-- S13:BEGIN -->" in html: html = re.sub(r"<!-- S13:BEGIN -->[\s\S]*?<!-- S13:END -->\n\n", lambda _: block, html)
else: html = html.replace("<h2>A1 ·", block + "<h2>A1 ·", 1)
PAGE.write_text(html); print("ok", len(block))
