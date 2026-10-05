# S14: writes the S14 section into STATION-CONTROLS.html (between its two markers, above S13's) from harness/s14.json.
import json, pathlib
HERE = pathlib.Path(__file__).resolve().parent; PAGE = HERE.parent / "STATION-CONTROLS.html"
m = json.loads((HERE / "s14.json").read_text())
S = [("1680x1050", "MacBook"), ("1920x1080", "Apple TV"), ("2560x1440", "External")]
def fig(src, cap, w=None): return f'<figure><img src="shots/{src}" alt="{cap}" loading="lazy"' + (f' style="max-width:{w}px"' if w else "") + f'><figcaption>{cap}</figcaption></figure>'
one = m["1920x1080-9"]; L = one["lists"]
o = ['<!-- S14:BEGIN -->', '<h2>S14 · The two tapes, built: LIKED and FAVORITES on the chart area only</h2>',
     '<div class="sub">S14 · 5 Oct 2026 · branch station/s14-tapes-20261005 · the real Station page in a hidden browser, real lists, real prices · nothing deployed, nothing live</div>',
     '<h3>The Station with the tapes, nine charts, at the three screens</h3><div class="pics">']
for k, n in S:
    r = m[k + "-9"]
    o.append(fig(f"s14-deck-9-{k}.png", f"{n} · {k.replace('x', ' × ')} · the two tapes start where the charts start ({r['tapes'][0]['x']} px from the left) and end at the right edge; the X / YouTube column is untouched"))
o.append('</div><h3>The cells, close</h3><div class="pics">' + "".join(fig(f"s14-tapes-close-{k}.png", f"{n} · LIKED above, FAVORITES below · ticker · price · change % · the Geiger mark") for k, n in S) + '</div>')
o.append('<h3>Six charts and four charts</h3><div class="pics">')
for k, n in S: o.append('<div class="pair">' + fig(f"s14-deck-6-{k}.png", f"{n} · six charts") + fig(f"s14-deck-4-{k}.png", f"{n} · four charts") + '</div>')
o.append('</div><h3>The measurements</h3><div style="overflow-x:auto"><table><tr><th>Screen</th><th>Charts</th><th>Charts, share of the width</th><th>Each tape</th><th>The strip (2 tapes + 2 seams)</th><th>One chart</th><th>Black</th><th>Cut</th><th>Speed</th><th>Priced</th></tr>')
for k, n in S:
    for c in (9, 6, 4):
        r = m[f"{k}-{c}"]; t = r["tapes"][0]
        o.append(f'<tr><td>{n}<br><small>{k.replace("x", " × ")}</small></td><td>{c}<br><small>{r["cols"]} × {r["rows"]}</small></td><td>{r["chartArea"]["widthSharePct"]:g}%<br><small>{r["chartArea"]["w"]} px; column {r["column"]["w"]} px</small></td>'
                 f'<td>{t["h"]:g} px tall · {t["w"]} px wide<br><small>= the chart area\'s width; {r["tapesOverColumnPx"]} px over the column</small></td><td>{r["stripPx"]} px<br><small>{r["stripPx"] / r["screen"]["h"] * 100:.1f}% of the height</small></td>'
                 f'<td>{r["chart"]["w"]} × {r["chart"]["h"]}</td><td>{r["blackPx"]} px</td><td>{len(r["cut"]) + r["cellsCut"]}</td><td>{r["speedPxS"]:g} / {r["speedFavoritesPxS"]:g} px/s</td><td>{r["priced"]["liked"]} of {r["lists"]["liked"]} · {r["priced"]["favorites"]} of {r["lists"]["favorites"]}</td></tr>')
o.append('</table></div>')
o.append('<h3>Tapes on and off (nine charts)</h3><div style="overflow-x:auto"><table><tr><th>Screen</th><th>One chart, tapes on</th><th>One chart, tapes off</th><th>The chart row gave up</th><th>Chart width changed</th><th>Column changed</th><th>Black, tapes off</th></tr>')
for k, n in S:
    r = m[k + "-9"]; s = r["switch"]
    o.append(f'<tr><td>{n}</td><td>{r["chart"]["w"]} × {r["chart"]["h"]}</td><td>{s["off"]["chart"]["w"]} × {s["off"]["chart"]["h"]}</td><td>{s["chartRowGaveUpPx"]} px of height</td><td>{s["widthChangedPx"]} px</td><td>{s["columnChangedPx"]} px</td><td>{s["off"]["blackPx"]} px</td></tr>')
o.append('</table></div>')
o.append('<h3>The switch, and a tap</h3><div class="pics">' + fig("s14-switch-1920x1080.png", "The ⋯ open: TAPES · ON sits beside AUTO-HIDE (lit = on)") +
         '<div class="pair">' + fig("s14-tap-1680x1050.png", f"MacBook · after two taps: {m['1680x1050-9']['tap']['taps'][0]['tapped']} opened in slot 1 (top left), {m['1680x1050-9']['tap']['taps'][1]['tapped']} in slot 2") + fig("s14-off-1680x1050.png", "Tapes off: the charts take the 46 px back") + '</div></div>')
tp = one["tap"]
o.append(f'<p><b>The lists today.</b> LIKED shows {L["liked"]} names, FAVORITES {L["favorites"]}; names on both tapes: {L["onBoth"]}; a name twice on one tape: {L["likedTwice"] + L["favTwice"]}. Every name carried a price on every screen.</p>'
         f'<p><b>The tap, as measured.</b> The wall was {" · ".join(tp["before"])}. A tap on {tp["taps"][0]["tapped"]} put it in slot 1; a tap on {tp["taps"][1]["tapped"]} put it in slot 2 and left slot 1 alone; SPY, already on the wall, was not loaded again ("{tp["nameAlreadyOnTheWall"]["note"]}"). With the pointer on a tape it moved {one["hover"]["movedPx"]:g} px in two seconds while the other tape kept running.</p>')
o.append('<div class="rec"><b>What could be wrong / what was not done.</b> '
         '1 · After a tap the new chart draws, but in the hidden browser its header showed the ticker without its price. The same happens when a symbol is typed into a slot with the tapes switched off, so it is older than this work and was left alone; worth a look on the real screen. '
         '2 · The switch lives in the Station\'s one ⋯ (top strip), beside AUTO-HIDE — the chart area has no ⋯ of its own. '
         '3 · While a video is in the big theatre view the tapes are covered with the charts. In CHARTS ONLY the tapes run the full width with the charts. A phone shows no tapes. '
         '4 · The tapes ask for prices every 15 seconds for all ' + str(L["liked"] + L["favorites"]) + ' names (four requests), the Geiger once a minute and the lists every five minutes — measured in a hidden browser only, not on the iMac over a day. '
         '5 · Not deployed; nothing on the live Station changed.</div>')
o.append('<details class="sc-pagespecs"><summary>PAGE SPECS · S14</summary><div>Harness: <code>harness/s14.mjs</code> → <code>harness/s14.json</code>, <code>shots/s14-*.png</code> (the real deck at 1680 × 1050 at device scale 2, 1920 × 1080 and 2560 × 1440; nine charts by hand, six = OTHER INDEXES · DAY, four = MACRO · 4H, the same walls S11 measured; every non-GET request blocked; the chart API fetched by node with the Hub\'s origin). '
         'Black = any gap that is not the Station\'s 1 px seam between two things, or any gap at the screen\'s edge. Cut = a chart or tape outside the screen, or a tape cell taller than its 22 px row. Type: cells 11 px, labels 8.5 px (the deck\'s own pane-label size). '
         'LIKED = <code>hub_favorites</code> minus the names on <code>station_lists · favorites</code>; prices <code>SC_PROVIDER.marketQuotes</code> (the read the charts\' badges ride); Geiger <code>equityGeiger</code> / the retained non-equity row, the composite lighting 1–4 rungs (cyan up, red down). '
         'Slot rule: a name on the wall is not loaded twice; else the first empty slot; else the slots in turn from the first. Switch: <code>localStorage station.tapes</code>, on unless "0". Test: <code>tests/station-s14-tapes-20261005.test.mjs</code>. This section: <code>harness/build-s14.py</code>.</div></details>')
o.append('<!-- S14:END -->')
html = PAGE.read_text(); block = "\n".join(o)
if "<!-- S14:BEGIN -->" in html: html = html[:html.index("<!-- S14:BEGIN -->")] + block + html[html.index("<!-- S14:END -->") + len("<!-- S14:END -->"):]
else: html = html.replace("<!-- S13:BEGIN -->", block + "\n<!-- S13:BEGIN -->", 1)
PAGE.write_text(html); print("S14 section written", len(block))
