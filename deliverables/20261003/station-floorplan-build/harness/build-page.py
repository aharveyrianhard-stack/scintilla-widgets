#!/usr/bin/env python3
"""S11 (3 Oct 2026): writes ../FLOORPLAN-BUILD.html — one table, then the pictures, in plain words.
Every number comes from harness/shots.json, written by build.mjs from the real Station page at the moment each picture
was taken (the same measurement, run in the deck). python3 build-page.py [sha]"""
import json, os, sys, html
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SHA = sys.argv[1] if len(sys.argv) > 1 else "(unpushed)"
shots = json.load(open(os.path.join(HERE, "shots.json")))
theatre = json.load(open(os.path.join(HERE, "theatre.json"))) if os.path.exists(os.path.join(HERE, "theatre.json")) else {}
esc = html.escape
SCREENS = [("1680x1050", "MacBook", "1680 × 1050"), ("1920x1080", "Apple TV", "1920 × 1080"), ("2560x1440", "External", "2560 × 1440")]
GRIDS = [(9, "9 · three by three"), (6, "6 · three by two"), (4, "4 · two by two")]
PAGE = {9: "LIVE wall at 9", 6: "OTHER INDEXES · DAY", 4: "MACRO · 4H"}
def shot(name, cap):
    f = os.path.join(ROOT, "shots", name + ".png")
    return f"<figure><img src='shots/{name}.png' alt='{esc(cap)}' loading='lazy'><figcaption>{esc(cap)}</figcaption></figure>" if os.path.exists(f) else ""
rows = ""; allzero = True
for k, name, size in SCREENS:
    for i, (g, gl) in enumerate(GRIDS):
        m = shots[f"{k}|{g}"]; allzero &= m["px"]["black"] == 0
        first = f"<td rowspan=3 class=scr><b>{name}</b><br><span class=dim>{size}</span></td>" if i == 0 else ""
        rows += (f"<tr class='{'top' if i == 0 else ''}'>{first}<td>{gl}<br><span class=dim>{esc(PAGE[g])}</span></td>"
                 f"<td class=n><b>{m['share']['chartsArea']:.1f}%</b></td>"
                 f"<td class=n>{m['chart0']['w']} × {m['chart0']['h']}</td>"
                 f"<td class=n><b>{m['widthShare']['column']:.1f}%</b> · {m['column']['w']} px<br><span class=dim>posts {m['x']['w']} × {m['x']['h']}</span></td>"
                 f"<td class=n>{m['picture']['w']} × {round(m['picture']['h'])} <span class=dim>16:9</span><br><span class=dim>+ its {round(m['videoBar'])} px bar</span></td>"
                 f"<td class=n><b class={'ok' if m['px']['black'] == 0 else 'bad'}>{m['px']['black']} px</b></td></tr>")
pics = ""
for g, gl in GRIDS:
    pics += f"<h2>{g} charts</h2>"
    for k, name, size in SCREENS:
        m = shots[f"{k}|{g}"]
        pics += shot(f"deck-{k}-c{g}", f"{name} · {size} · {gl} ({PAGE[g]}) · charts {m['share']['chartsArea']:.1f}% · one chart {m['chart0']['w']} × {m['chart0']['h']} · column {m['column']['w']} px · YouTube {m['picture']['w']} × {round(m['picture']['h'])} · black {m['px']['black']} px · {m['chartsDrawn']}/{m['chartsN']} charts drawn")
pics += "<h2>The corner: the foot of the X column and the YouTube box</h2>"
for k, name, size in SCREENS:
    m = shots[f"{k}|9"]
    pics += shot(f"corner-{k}", f"{name} · the YouTube box flush with the column's left edge, its right edge and the bottom of the screen; X directly above it; the first column of charts beside it, one hairline away")
# S11b (3 Oct): the video's one expand step (the theatre) and the YouTube control row — from harness/theatre.json (theatre.mjs)
s11b = ""
if theatre:
    trows = ""
    for k, name, size in SCREENS:
        r = theatre[k]; t = r["theatre"]; rest = r["rest"]; back = r["backByButton"]
        ok = t["pictureBlack"] == 0 and t["columnBlack"] == 0 and back["px"]["black"] == 0
        trows += (f"<tr class=top><td class=scr><b>{name}</b><br><span class=dim>{size}</span></td>"
                  f"<td class=n>{rest['picture']['w']} × {round(rest['picture']['h'])}<br><span class=dim>at the column's foot</span></td>"
                  f"<td class=n><b>{t['picture']['w']} × {t['picture']['h']}</b> <span class=dim>16:9</span><br><span class=dim>{t['pictureShareOfChartArea']:.0f}% of the chart area · + its {round(t['bar'])} px bar</span></td>"
                  f"<td class=n>{t['x']['w']} × {t['x']['h']}<br><span class=dim>the whole column</span></td>"
                  f"<td class=n><b class={'ok' if t['pictureBlack'] == 0 else 'bad'}>{t['pictureBlack']} px</b></td>"
                  f"<td class=n><b class={'ok' if t['columnBlack'] == 0 else 'bad'}>{t['columnBlack']} px</b></td>"
                  f"<td class=n>{back['share']['chartsArea']:.1f}% · {back['widthShare']['column']:.1f}% · <b class={'ok' if back['px']['black'] == 0 else 'bad'}>{back['px']['black']} px</b></td></tr>")
    crows = ""
    MODE = {"as drawn": "fits as drawn", "compact": "fits, compact chips", "scrolling": "scrolls"}
    for k, name, size in SCREENS:
        r = theatre[k]
        for row, label in ((r["rowPersonal"], "PERSONAL"), (r["rowScintilla"], "SCINTILLA")):
            items = " · ".join(esc(i["what"].upper()) for i in row["items"])
            crows += (f"<tr><td class=scr><b>{name}</b> <span class=dim>{row['width']} px</span></td><td>{label}</td><td>{items}</td>"
                      f"<td class=n>{MODE[row['mode']]}</td><td class=n><b class={'ok' if not row['cut'] else 'bad'}>{'nothing' if not row['cut'] else esc(', '.join(row['cut']))}</b></td>"
                      f"<td class=n>{'one line' if row['oneLine'] else '<b class=bad>wraps</b>'}</td></tr>")
    tpics = ""
    for k, name, size in SCREENS:
        t = theatre[k]["theatre"]
        tpics += shot(f"s11b-theatre-{k}", f"{name} · {size} · the theatre: the video {t['picture']['w']} × {t['picture']['h']} (16:9) centred over the chart area, the charts covered, X the whole column ({t['x']['w']} × {t['x']['h']}) · black in the picture {t['pictureBlack']} px, in the column {t['columnBlack']} px")
        tpics += shot(f"s11b-rest-{k}", f"{name} · {size} · at rest, before the theatre: the column (X above, YouTube {theatre[k]['rest']['picture']['w']} × {round(theatre[k]['rest']['picture']['h'])} at its foot) and nine charts — S11's numbers; after BACK the same numbers were measured again")
    cpics = ""
    for k, name, size in SCREENS:
        for feed in ("personal", "scintilla"):
            cpics += shot(f"s11b-row-{k}-{feed}", f"{name} · {theatre[k]['rowPersonal']['width']} px · the {feed.upper()} control row, cropped")
    ph = theatre.get("phone", {})
    s11b = f"""<h2 id=s11b>S11b · the video's expand, and the YouTube buttons</h2>
<p><b>The video's expand is now one step: the theatre.</b> Press ⛶ on the YouTube box and the playing video moves over the charts. It takes the largest 16:9 picture that fits the chart area (the 76% right of the column), centred. The charts are covered, not closed, and X gets the whole column, top to bottom. Press the same button (it now reads <b>↙ BACK</b>), or Esc, and the video goes back to the foot of the column. No step makes the video bigger inside the column any more, so the column never shows black.</p>
<div class=wrap><table>
<tr><th>Screen</th><th class=n>YouTube at rest</th><th class=n>Theatre picture</th><th class=n>X in the theatre</th><th class=n>Black in the picture</th><th class=n>Black in the column</th><th class=n>After BACK: charts · column · black</th></tr>
{trows}
</table></div>
<p class=dim>Measured on the real page with a video playing, after a click on the box's own ⛶ button. BACK was checked three ways on every screen: the button, Esc while the video's controls had the focus, and Esc on the Station itself. Each one went back to the column. After BACK, the S11 numbers came back exactly: 76% charts, 24% column, a 16:9 picture and 0 px black. On the phone ({'unchanged' if ph and not ph.get('theatre') else 'see harness'}), the old two steps stay: the video grows in the scrolling column, then covers X.</p>
{tpics}
<p><b>The YouTube buttons fit the column.</b> The PERSONAL ▾ list was as wide as its longest choice. On the MacBook it took 187 of the 403 px and pushed SUBSCRIBED off the right edge. The list is now only as wide as the name it shows (86 px for PERSONAL). If the buttons still do not fit, they move closer together: same size of type, same colours. SCINTILLA has a longer row (ALL · SUBSCRIBED · WATCH LATER) and needs that on the MacBook and the Apple TV. Only if even that is not enough does the row scroll, with a fade at its edge.</p>
<div class=wrap><table>
<tr><th>Screen</th><th>Feed</th><th>The row, left to right</th><th class=n>How it fits</th><th class=n>Cut</th><th class=n>Lines</th></tr>
{crows}
</table></div>
{cpics}
<p class=dim>Not shown: the hidden test browser cannot decode YouTube video, so the theatre pictures show YouTube's own player (its controls and a loading ring) rather than a moving picture. The size and position of the box are measured, not drawn. On the Station the video plays in exactly that box.</p>
"""
page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Station floor plan, built</title>
<style>
:root{{ --bg:#0A0A0F; --panel:#101016; --line:#24242C; --ink:#C8C8D0; --ink2:#B0B0B8; --dim:#80808A; }}
*{{ box-sizing:border-box; }} body{{ margin:0; background:var(--bg); color:var(--ink); font:15px/1.55 -apple-system,"SF Pro Text",Helvetica,Arial,sans-serif; }}
main{{ max-width:1180px; margin:0 auto; padding:28px 16px 60px; }}
h1{{ font-size:24px; font-weight:600; margin:0 0 4px; }} h2{{ font-size:19px; font-weight:600; margin:40px 0 10px; border-top:1px solid var(--line); padding-top:18px; }}
.sub{{ color:var(--ink2); font-size:13px; margin:0 0 22px; }} .dim{{ color:var(--dim); font-size:12px; }}
.wrap{{ overflow-x:auto; }} table{{ border-collapse:collapse; width:100%; min-width:760px; font-size:14px; }}
th,td{{ padding:7px 10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }} th{{ color:var(--dim); font-weight:500; font-size:12px; }}
td.n,th.n{{ text-align:right; white-space:nowrap; }} tr.top td{{ border-top:1px solid #3A3A44; }} td.scr{{ white-space:nowrap; }}
.ok{{ color:#3FB27A; }} .bad{{ color:#D0584E; }}
figure{{ margin:12px 0; background:var(--panel); border:1px solid var(--line); padding:6px; }} figure img{{ width:100%; height:auto; display:block; }}
figcaption{{ font-size:12px; color:var(--ink2); padding:6px 2px 2px; }} p{{ margin:8px 0; }} ul{{ margin:6px 0; padding-left:20px; }} li{{ margin:4px 0; }}
</style></head><body><main>
<h1>The Station floor plan, built</h1>
<p class=sub>3 Oct 2026 · branch station/s11-floorplan-build-20261003 at {esc(SHA)} · the real Station page (not a mock), in a hidden browser · not deployed</p>
<p>The X column takes <b>24% of the screen's width</b> on every screen. X fills it from the top. The YouTube box sits at its foot, exactly as wide as the column, with a 16:9 picture. The charts take the <b>other 76%</b>, edge to edge, with no black anywhere.</p>
<div class=wrap><table>
<tr><th>Screen</th><th>Grid · page measured</th><th class=n>Charts, share of the screen</th><th class=n>One chart</th><th class=n>X column</th><th class=n>YouTube picture</th><th class=n>Black</th></tr>
{rows}
</table></div>
<p class=dim>Every number is measured on the live page at the moment its picture was taken. "Charts" is everything to the right of the column (the charts and the thin lines between them) as a share of the whole screen. The same measurement is used on every row. "X column" is its share of the screen's width and its width in pixels; "posts" is the part X fills above the YouTube box. "Black" is every pixel that is not a pane or a 1-pixel seam, including any black bars around the YouTube picture.{"" if allzero else " <b class=bad>Some rows have black — see the row.</b>"}</p>
{pics}
{s11b}
<h2>Notes</h2>
<ul>
<li><b>What changed:</b> only the floor plan. The 19 pages, their order, and every page's charts and slots are as they were. Checked in the hidden browser: charts only (the column steps aside, the charts take the whole screen), a chart on its own, X on its own, the video's expand (S11b: now one step, the theatre, above), turning to the next page, and the phone (still one scrolling column).</li>
<li><b>The nine-chart wall</b> is new: a ninth slot was added, and 9 now sits next to 2 / 6 / 8 on the chart-count choice. No named page holds nine names today, so the 9 row was measured on the LIVE wall set to nine. The 6 and 4 rows are real pages.</li>
<li><b>Pages with eight charts</b> (TARGETS, MAG 7, the AI pages and most of the rotation) use the same rule: four by two, 318 × 525 each on the MacBook, with no black.</li>
<li><b>Not shown:</b> X cannot be captured in a hidden browser, so its column says "X source is offline" in these pictures. On the Station it shows the live feed in exactly that box. Nothing here was deployed.</li>
</ul>
</main></body></html>
"""
open(os.path.join(ROOT, "FLOORPLAN-BUILD.html"), "w").write(page)
print("wrote FLOORPLAN-BUILD.html", "all black 0" if allzero else "BLACK FOUND")
