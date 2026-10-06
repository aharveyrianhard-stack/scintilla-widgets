# S15: writes the S15 section into STATION-CONTROLS.html (between its two markers, above S14's) from harness/s15.json.
import json, pathlib
HERE = pathlib.Path(__file__).resolve().parent; PAGE = HERE.parent / "STATION-CONTROLS.html"
m = json.loads((HERE / "s15.json").read_text())
S = [("1680x1050", "MacBook"), ("1920x1080", "Apple TV"), ("2560x1440", "External")]
def fig(src, cap, w=None): return f'<figure><img src="shots/{src}" alt="{cap}" loading="lazy"' + (f' style="max-width:{w}px"' if w else "") + f'><figcaption>{cap}</figcaption></figure>'
def whole(v): return f"{round(v)}%"
def one(v): return f"{v:.1f}%"
o = ['<!-- S15:BEGIN -->', '<h2>S15 · The two tapes at the bottom of the chart area, and the charts\' share of the screen</h2>',
     '<div class="sub">S15 · 5 Oct 2026, night · branch station/s15-tapes-bottom-20261005 · the real Station page in a hidden browser, real lists, real prices · nothing deployed, nothing live</div>',
     '<h3>The Station with the tapes at the bottom, nine charts, at the three screens</h3><div class="pics">']
for k, n in S:
    r = m[k + "-9"]
    o.append(fig(f"s15-deck-9-{k}.png", f"{n} · {k.replace('x', ' × ')} · FAVORITES directly under the charts, LIKED along the bottom edge; both start where the charts start ({r['tapes'][0]['x']} px from the left); the X / YouTube column keeps its full height"))
o.append('</div><h3>The cells, close</h3><div class="pics">' + "".join(fig(f"s15-tapes-close-{k}.png", f"{n} · FAVORITES above, LIKED below · ticker · price · change % · the Geiger mark") for k, n in S) + '</div>')
o.append('<h3>How much of the screen is charts</h3><p>Nine charts. "Width" is how far across the screen; "area" is how much of the whole screen\'s surface.</p>'
         '<div style="overflow-x:auto"><table><tr><th>Screen</th><th>Charts, share of the width<br><small>tapes on or off — the same</small></th><th>Charts, share of the area<br><small>tapes off</small></th><th>Charts, share of the area<br><small>tapes on</small></th><th>The two tapes<br><small>share of the area</small></th><th>X / YouTube column<br><small>share of the width and of the area</small></th></tr>')
for k, n in S:
    r = m[k + "-9"]; s = r["share"]; f = r["switch"]["off"]["share"]
    o.append(f'<tr><td>{n}<br><small>{k.replace("x", " × ")}</small></td><td>{whole(s["chartsWidthPct"])}<br><small>{r["chartArea"]["w"]} px of {r["screen"]["w"]}</small></td><td>{one(f["chartsAreaPct"])}</td><td>{one(s["chartsAreaPct"])}</td>'
             f'<td>{one(s["tapesAreaPct"])}<br><small>46 px of the height ({one(s["tapesHeightPct"])}), under the charts only</small></td><td>{whole(s["columnWidthPct"])} · {one(s["columnAreaPct"])}<br><small>{r["column"]["w"]} px wide, full height</small></td></tr>')
o.append('</table></div><p>In plain words: the charts are <b>76% of the screen across</b>, and the tapes do not change that. By surface the charts go from <b>76% to about 73%</b> when the tapes are on — the tapes take about 3 points, not the 10 Alan guessed. The X / YouTube column is 24% either way. (The few hundredths missing from 100 are the 1 px seam between the column and the charts.)</p>')
o.append('<h3>Picture only, not built: the tapes across the whole screen, under the X / YouTube column too</h3><div class="pics">')
for k, n in S:
    r = m[k + "-9"]; f = r["fullWidth"]
    o.append(fig(f"s15-fullwidth-9-{k}.png", f"{n} · {k.replace('x', ' × ')} · the same two tapes, {f['tapes'][0]['w']} px wide; the X pane is {r['columnPanes'][1]['h'] - f['columnPanes'][1]['h']} px shorter"))
o.append('</div><div style="overflow-x:auto"><table><tr><th>Screen</th><th>Charts, share of the area<br><small>built: tapes under the charts</small></th><th>Charts, share of the area<br><small>picture: tapes full width</small></th><th>The two tapes<br><small>built → picture</small></th><th>X / YouTube column, share of the area<br><small>built → picture</small></th><th>The X pane\'s height<br><small>built → picture</small></th><th>Black · cut<br><small>picture</small></th></tr>')
for k, n in S:
    r = m[k + "-9"]; s = r["share"]; f = r["fullWidth"]
    o.append(f'<tr><td>{n}</td><td>{one(s["chartsAreaPct"])}</td><td>{one(f["share"]["chartsAreaPct"])}</td><td>{one(s["tapesAreaPct"])} → {one(f["share"]["tapesAreaPct"])}</td><td>{one(s["columnAreaPct"])} → {one(f["share"]["columnAreaPct"])}</td>'
             f'<td>{r["columnPanes"][1]["h"]} → {f["columnPanes"][1]["h"]} px</td><td>{f["blackPx"]} px · {len(f["cut"]) + f["cellsCut"]}</td></tr>')
o.append('</table></div><p>In plain words: full width gives the charts <b>nothing</b> — they are the same size in both. It makes each tape a third longer (more names on screen at once) and pays for it with 46 px of X posts.</p>')
o.append('<h3>Six charts and four charts, tapes at the bottom</h3><div class="pics">')
for k, n in S: o.append('<div class="pair">' + fig(f"s15-deck-6-{k}.png", f"{n} · six charts") + fig(f"s15-deck-4-{k}.png", f"{n} · four charts") + '</div>')
o.append('</div><h3>The measurements</h3><div style="overflow-x:auto"><table><tr><th>Screen</th><th>Charts</th><th>Each tape</th><th>The strip</th><th>One chart</th><th>Black</th><th>Cut</th><th>Speed</th><th>Priced</th></tr>')
for k, n in S:
    for c in (9, 6, 4):
        r = m[f"{k}-{c}"]; t = r["tapes"][0]
        o.append(f'<tr><td>{n}<br><small>{k.replace("x", " × ")}</small></td><td>{c}<br><small>{r["cols"]} × {r["rows"]}</small></td>'
                 f'<td>{t["h"]:g} px tall · {t["w"]} px wide<br><small>{r["tapesOverColumnPx"]} px over the column</small></td><td>{r["stripPx"]} px, at the bottom</td>'
                 f'<td>{r["chart"]["w"]} × {r["chart"]["h"]}</td><td>{r["blackPx"]} px</td><td>{len(r["cut"]) + r["cellsCut"]}</td><td>{r["speedPxS"]:g} / {r["speedFavoritesPxS"]:g} px/s</td><td>{r["priced"]["liked"]} of {r["lists"]["liked"]} · {r["priced"]["favorites"]} of {r["lists"]["favorites"]}</td></tr>')
o.append('</table></div>')
r9 = m["1920x1080-9"]; tp = r9["tap"]
o.append('<div class="pics"><div class="pair">' + fig("s15-tap-1680x1050.png", f"MacBook · after two taps: {m['1680x1050-9']['tap']['taps'][0]['tapped']} opened in slot 1 (top left), {m['1680x1050-9']['tap']['taps'][1]['tapped']} in slot 2") + fig("s15-off-1680x1050.png", "Tapes off: the charts take the 46 px back") + '</div></div>')
o.append(f'<p><b>Same behaviour as S14, measured again.</b> Chart sizes are the same as S14 to the pixel. Both tapes run at 45 px a second; the pointer on LIKED moved it {r9["hover"]["movedPx"]:g} px in two seconds while FAVORITES kept running. A tap on {tp["taps"][0]["tapped"]} opened it in slot 1, a tap on {tp["taps"][1]["tapped"]} in slot 2; SPY, already on the wall, was not loaded again. The switch in the top-strip ⋯ gives the charts their 46 px back and is remembered.</p>')
o.append('<div class="rec"><b>What could be wrong / what was not done.</b> '
         '1 · The order: FAVORITES is the row nearest the charts and LIKED runs along the screen\'s edge, because FAVORITES is the shorter, hand-kept list and belongs nearest the eye. S14 had LIKED first. One line to swap back. '
         '2 · In these pictures the X pane reads "X SOURCE IS OFFLINE": a hidden browser has no X capture. The pane\'s box is the real size. '
         '3 · The shares are of the Station page itself. A browser\'s own tab bar and address bar, if showing, sit above it and are not counted. '
         '4 · The full-width variant is a picture: two lines of styling added by the measuring script, not in the Station\'s code. '
         '5 · Theatre view, CHARTS ONLY and the phone follow the same rules as S14 (covered with the charts · full width with the charts · no tapes) and were not pictured again. '
         '6 · Not deployed; nothing on the live Station changed.</div>')
o.append('<details class="sc-pagespecs"><summary>PAGE SPECS · S15</summary><div>Harness: <code>harness/s15.mjs</code> → <code>harness/s15.json</code>, <code>shots/s15-*.png</code> (the real deck at 1680 × 1050 at device scale 2, 1920 × 1080 and 2560 × 1440; nine charts by hand, six = OTHER INDEXES · DAY, four = MACRO · 4H; every non-GET request blocked; the chart API fetched by node with the Hub\'s origin). '
         'Shares: charts = the chart grid\'s rectangle ÷ the screen; tapes = their width × 46 px (two 22 px rows + two 1 px seams) ÷ the screen; column = its rectangle ÷ the screen. '
         'Black = any gap that is not the Station\'s 1 px seam between two things, or any gap at the screen\'s edge. Cut = a chart, a tape or a column pane outside its box, or a tape cell taller than its 22 px row. '
         'The deck change: <code>#tapes{ bottom:0 }</code>, <code>#rowTop{ margin-bottom:46px }</code>, the timeframe tag back at 6 px from the top, the two rows swapped. '
         'The full-width picture: <code>#tapes{ left:0 }</code> and <code>#rowBot{ margin-bottom:46px }</code>, injected by the harness only. Test: <code>tests/station-s14-tapes-20261005.test.mjs</code> (S14\'s four, moved to the bottom, + one S15). This section: <code>harness/build-s15.py</code>.</div></details>')
o.append('<!-- S15:END -->')
html = PAGE.read_text(); block = "\n".join(o)
if "<!-- S15:BEGIN -->" in html: html = html[:html.index("<!-- S15:BEGIN -->")] + block + html[html.index("<!-- S15:END -->") + len("<!-- S15:END -->"):]
else: html = html.replace("<!-- S14:BEGIN -->", block + "\n<!-- S14:BEGIN -->", 1)
PAGE.write_text(html); print("S15 section written", len(block))
