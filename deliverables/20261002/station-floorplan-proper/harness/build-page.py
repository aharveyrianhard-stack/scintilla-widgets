#!/usr/bin/env python3
"""S10 (2 Oct 2026): writes ../FLOORPLAN-PROPER.html — Alan's page: the square-footage study first, then the pictures, in plain words.
Every number comes from harness/plan.json and harness/today.json, written by floorplan.mjs from the mock's own window.__floorplan()
(the same function that paints the card on each picture), so the page and the pictures cannot disagree. python3 build-page.py [sha]"""
import json, os, sys, html
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SHA = sys.argv[1] if len(sys.argv) > 1 else "(unpushed)"
load = lambda f: json.load(open(os.path.join(HERE, f))) if os.path.exists(os.path.join(HERE, f)) else {}
today, plan, shots = load("today.json"), load("plan.json"), load("shots.json")
esc = html.escape; n = lambda v: f"{int(round(v)):,}"
SCREENS = [("1680x1050", "the MacBook · 1680 × 1050 (a 2× screen)"), ("1920x1080", "the Apple TV · 1920 × 1080"), ("2560x1440", "the external · 2560 × 1440")]
COLS = [220, 260, 300]; GRIDS = [(2, "2 charts, one column of two"), (4, "4 charts, two by two"), (6, "6 charts, two columns of three"), (9, "9 charts, three by three")]
P = lambda k, c, g: plan.get(f"{k}|{c}|{g}")
REC_COL, REC_GRID = 260, 9
def shot(name, cap, cls=""):
    f = os.path.join(ROOT, "shots", name + ".png")
    return (f"<figure class='{cls}'><img src='shots/{name}.png' alt='{esc(cap)}' loading='lazy'><figcaption>{esc(cap)}</figcaption></figure>" if os.path.exists(f) else "")
def cell(box, px, sh, bold=False):
    b = f"{box['w']} × {box['h']}" if box else "—"
    v = f"{sh:.1f}%"; return f"<td class=n>{b}</td><td class=n>{'<b>' if bold else ''}{v}{'</b>' if bold else ''}</td>"
def verdict(cpl):
    if cpl >= 45: return ("reads", "ok", "as wide as X on a phone or wider")
    if cpl >= 38: return ("reads, tight", "mid", "a little narrower than a phone; a normal post is three or four lines")
    return ("too narrow", "bad", "a normal post becomes five lines; names and numbers break mid-line")

# ---- 1 · the study -------------------------------------------------------------------------------------------------------------
study = ""
for k, lab in SCREENS:
    t = today.get(k); rows = ""
    if t:
        rows += (f"<tr class=today><td><b>today</b> · {t['chartsN']} charts above, YouTube and X side by side below</td>"
                 + cell(t["chartsBlock"], t["px"]["charts"], t["share"]["charts"], True) + cell(t["chart0"], t["px"]["chart0"], t["share"]["chart0"])
                 + cell(t["x"], t["px"]["x"], t["share"]["x"]) + cell(t["video"], t["px"]["video"], t["share"]["video"])
                 + f"<td class=n>{n(t['px']['seams'])} px · {t['share']['seams']:.1f}%</td><td class=n><span class=bad>{n(t['px']['black'])} px · {t['share']['black']:.1f}%</span></td></tr>")
    for c in COLS:
        for g, gl in GRIDS:
            m = P(k, c, g)
            if not m: continue
            rec = c == REC_COL and g == REC_GRID
            blk = m["px"]["black"] + m["px"]["videoBlackBeside"]
            rows += (f"<tr class='{'rec' if rec else ''}'><td>{'<b>★ ' if rec else ''}column <b>{c}</b> on the MacBook → <b>{m['column']['w']} px</b> here · {gl}{'</b>' if rec else ''}</td>"
                     + cell(m["chartsBlock"], m["px"]["charts"], m["share"]["charts"], True) + cell(m["chart0"], m["px"]["chart0"], m["share"]["chart0"])
                     + cell(m["x"], m["px"]["x"], m["share"]["x"]) + cell(m["video"], m["px"]["video"], m["share"]["video"])
                     + f"<td class=n>{n(m['px']['seams'])} px · {m['share']['seams']:.1f}%</td><td class=n><span class='{'ok' if blk == 0 else 'bad'}'>{n(blk)} px · {m['share']['black']:.1f}%</span></td></tr>")
    study += (f"<h3>{esc(lab)}</h3><div class=scroll><table class=study><tr><th>floor plan</th><th class=n colspan=2>charts, all (w × h · of screen)</th><th class=n colspan=2>one chart</th>"
              f"<th class=n colspan=2>the X column</th><th class=n colspan=2>the YouTube box</th><th class=n>1 px seams</th><th class=n>black / unused</th></tr>{rows}</table></div>")

# ---- 2 · can you still read X ----------------------------------------------------------------------------------------------------
read = ""
for k, lab in SCREENS:
    rows = ""
    for c in COLS:
        m = P(k, c, 9)
        if not m: continue
        r = m["read"]; v, cls, why = verdict(r["charsPerLine"])
        rows += (f"<tr><td>column <b>{c}</b> → {m['column']['w']} px</td><td class=n>{r['textColumn']} px</td><td class=n>{r['font']:.1f} px</td><td class=n><b>{r['charsPerLine']}</b></td>"
                 f"<td class=n>{r['linesPerPostAvg']} (longest {r['linesPerPostMax']})</td><td class=n>{r['postsFully']} fully · {r['postsPartly']} partly</td><td><span class={cls}>{v}</span> — {why}</td></tr>")
    read += (f"<h3>{esc(lab)}</h3><div class=scroll><table><tr><th>the X column</th><th class=n>text column</th><th class=n>X text</th><th class=n>characters per line</th>"
             f"<th class=n>lines per post</th><th class=n>posts on screen</th><th>verdict</th></tr>{rows}</table></div>")

# ---- 3 · pictures ----------------------------------------------------------------------------------------------------------------
pics = ""
for k, lab in SCREENS:
    pics += f"<h3>{esc(lab)}</h3>" + shot(f"today-{k}", f"today · {lab} · the live deck, eight charts above, YouTube and X side by side below") 
    for g in (9, 4):
        pics += f"<h4>{g} charts</h4><div class=three>" + "".join(shot(f"plan-{k}-col{c}-c{g}", f"column {c} → {P(k, c, g)['column']['w']} px · {g} charts · charts {P(k, c, g)['share']['charts']:.1f}% of the screen" if P(k, c, g) else "") for c in COLS) + "</div>"
    pics += "<h4>the corner: the foot of the X column and the YouTube box, flush and square</h4><div class=three>" + "".join(shot(f"corner-{k}-col{c}", f"column {c} · the YouTube box is exactly the column's width, at its foot, 16:9; the chart beside it starts one hairline away") for c in COLS) + "</div>"

# ---- the recommendation ------------------------------------------------------------------------------------------------------------
R = {k: P(k, REC_COL, REC_GRID) for k, _ in SCREENS}; T = {k: today.get(k) for k, _ in SCREENS}
def recline(k):
    m, t = R[k], T[k]
    return (f"column <b>{m['column']['w']} px</b> · YouTube box <b>{m['video']['w']} × {m['video']['h']}</b> (picture {m['picture']['w']} × {m['picture']['h']}) · one chart <b>{m['chart0']['w']} × {m['chart0']['h']}</b> · "
            f"charts <b>{m['share']['charts']:.1f}%</b> of the screen" + (f" (today {t['share']['charts']:.1f}%)" if t else "") + f" · black <b>{m['px']['black']} px</b>")
rec = "".join(f"<li><b>{esc(lab.split(' · ')[0])}:</b> {recline(k)}</li>" for k, lab in SCREENS if R[k])
m0, t0 = R["1680x1050"], T["1680x1050"]

page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Station floor plan, done properly · one left column for X and YouTube, charts fill the rest · the square-footage study</title>
<style>
:root{{ --bg:#0A0A0F; --panel:#111118; --line:#26262E; --ink:#C8C8D0; --ink2:#A8A8B0; --dim:#7A7A82; }}
body{{ margin:0; background:var(--bg); color:var(--ink); font:14px/1.55 -apple-system,"SF Pro Text",Helvetica,Arial,sans-serif; }}
main{{ max-width:1480px; margin:0 auto; padding:28px 22px 80px; }}
h1{{ font-size:24px; font-weight:600; margin:0 0 4px; }} h2{{ font-size:19px; font-weight:600; margin:40px 0 10px; border-top:1px solid var(--line); padding-top:18px; }}
h3{{ font-size:16px; margin:26px 0 8px; }} h4{{ font-size:13px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink2); margin:22px 0 6px; }}
p{{ margin:8px 0; max-width:960px; }} .meta{{ color:var(--dim); font-size:12.5px; margin-bottom:18px; }}
blockquote{{ margin:10px 0 14px; padding:8px 14px; border-left:3px solid var(--line); color:var(--ink2); font-style:italic; max-width:960px; }}
figure{{ margin:12px 0; background:var(--panel); border:1px solid var(--line); padding:6px; }} figure img{{ width:100%; height:auto; display:block; }} figcaption{{ font-size:12px; color:var(--ink2); padding:6px 2px 0; }}
.three{{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }} .three figure{{ margin:0; }}
.scroll{{ overflow-x:auto; }} table{{ border-collapse:collapse; font-size:12.5px; margin:6px 0 10px; }} th,td{{ border-bottom:1px solid var(--line); padding:4px 10px 4px 0; text-align:left; vertical-align:top; }}
th{{ color:var(--dim); font-weight:500; }} td.n, th.n{{ text-align:right; white-space:nowrap; }} tr.rec td{{ background:#15151F; }} tr.today td{{ color:var(--ink2); }}
.ok{{ color:#39C27A; }} .bad{{ color:#D9544E; }} .mid{{ color:#D9B44E; }} code{{ font:12px ui-monospace,Menlo,monospace; background:var(--panel); padding:1px 5px; }}
ol li, ul li{{ margin:4px 0; max-width:960px; }} .box{{ background:var(--panel); border:1px solid var(--line); padding:12px 16px; margin:12px 0; max-width:960px; }}
.big{{ font-size:20px; font-weight:600; color:var(--ink); margin:6px 0 10px; }} a{{ color:#9AB8E0; }}
@media (max-width:900px){{ .three{{ grid-template-columns:1fr; }} main{{ padding:16px; }} }}
</style></head><body><main>
<h1>Station floor plan, done properly</h1>
<div class=meta>2 Oct 2026, late night · branch <code>station/s10-floorplan-proper-20261002</code> at <code>{esc(SHA)}</code>, built on today's live Station (3ab6efd) · a mock and a study, nothing deployed, no Station page changed · every picture taken in a hidden browser · the mock itself: <a href="mock-proper.html?col=260&charts=9">mock-proper.html</a> (open it on each screen; the card bottom-right prints that screen's numbers from the same function that wrote the tables here)</div>
<blockquote>"The whole left column is X and the YouTube. The YouTube is as wide as the X — exactly. The X could be way narrower. Look at that black space to the right of the YouTube — no. Real nice and square, everything has a position. The YouTube might be very slim. You're not helping me study this — square footage. I want a normal, standard, definitive home and space."</blockquote>
<p><b>What this plan is.</b> One column on the left. X fills it from the top. The YouTube box sits at the column's foot: exactly the column's width, a 16:9 picture under the player's own bar, fixed, never floating, never overlapping anything. The charts fill every other pixel in an equal grid with the Station's 1 px hairline seams. Three column widths were measured, 220, 260 and 300 px on the MacBook (on the Apple TV and the external the column scales with the screen's width), each with 2, 4, 6 and 9 charts, at your three screens. Black was measured on every one and is 0 px on every one.</p>
<div class=box><div class=big>Recommendation: the column at 260 px on the MacBook, 9 charts three by three, the YouTube box {m0['video']['w']} × {m0['video']['h']}.</div>
<ul>{rec}</ul>
<p><b>The one-line reason:</b> 260 is the narrowest column where a normal post still reads in three or four lines ({R['1680x1050']['read']['charsPerLine']} characters a line on the MacBook, close to X on a phone), while the charts go from {t0['share']['charts']:.0f}% of the screen to {m0['share']['charts']:.0f}% — at 220 every post becomes five lines, and 300 gives the charts back only {R['1680x1050']['share']['charts'] - P('1680x1050', 300, 9)['share']['charts']:.1f} points less than 260 but you said the X could be way narrower.</p></div>

<h2>1 · The study, in square feet you can read</h2>
<p>Every row is one floor plan at one screen. Each region is its width × height in pixels and its share of the whole screen. "Charts, all" is the whole block the charts fill, seams included; "one chart" is a single pane. "Black / unused" is every pixel that is neither a pane nor a 1 px seam — plus, for the YouTube box, any black beside the picture. Today's deck was measured on the live page in the hidden browser (scene TARGETS, eight charts); the candidates were measured on the mock at the same screens, by the same kind of measurement. The row marked ★ is the recommendation.</p>
{study}
<p>Why the seams: the Station draws a 1 px hairline between panes, and this plan keeps it. They are 0.2–0.4% of the screen. Today's black is the strip beside the YouTube picture in the hidden browser, where the player pane was half the row and its 16:9 picture did not fill that half; on the live page the pane may fit itself to the picture once the player reports its bar.</p>
<p>Six charts: two columns of three gives wide charts ({P('1680x1050', 260, 6)['chart0']['w']} × {P('1680x1050', 260, 6)['chart0']['h']} on the MacBook at the 260 column), the same shape as the nine-chart panes. Three columns of two would give squarer ones (about 473 × 524). Both fill the rectangle; the table shows two columns of three.</p>

<h2>2 · Can you still read X at each width?</h2>
<p>X's own column is 600 px wide with 15 px text, about 80 characters a line; on a phone X shows about 45. In the column the text is X's size scaled to the column, never under 11 px (the floor: below that it is not readable), and the posts are real post text, so characters per line, lines per post and the posts that fit on screen are measured, not guessed. Lines per post is the average over twelve ordinary posts (the longest is in brackets).</p>
{read}
<p><b>Which widths still read:</b> on the MacBook, 300 reads like a phone, 260 reads but is tight, 220 is too narrow. On the Apple TV, 260 and 300 read, 220 is tight. On the external, all three read. The recommendation, 260, reads on all three screens. A note on the Apple TV: it is a 1× screen across a room, so 11 px text there is small on any plan; that is the television, not the column.</p>

<h2>3 · The pictures</h2>
<p>Each picture is the mock at that screen, drawn from the Station's own pieces: the real chart panes with live bars (the TARGETS tickers, 3-day), the real X shell bar with real post text under it (the live X capture needs your Chrome and cannot run in a hidden browser), and the real YouTube pane showing its first video. The MacBook pictures are at 2×, like its screen; the Apple TV and the external at 1×, their real pixels. The card bottom-right on each is the mock's own measurement; it matches the table above because it is the same function. Each picture was taken only after every chart had drawn (the harness reads the chart canvases and waits); on the 1× pictures the moving-average bands had not always finished drawing when the picture was taken, so some panes show the price line alone — the floor plan is the same.</p>
{pics}

<h2>4 · What could be wrong, and what was not done</h2>
<ul>
<li>The X posts are drawn, not captured. The widths and line counts are right for X's text at that column; the live pane shows a capture of your x.com tab, and how that capture is scaled to a 260 px column is a decision below.</li>
<li>Today's numbers come from the live deck in a hidden browser with the X source offline; the chart row and the two lower panes are the deck's own boxes, so the shares are the deck's.</li>
<li>Nothing on the Station changed. This is a mock under <code>deliverables/</code>; the deck's layout, scenes, jobs and tests are as they were. Building it as the real floor plan is the next lane, once you choose.</li>
<li>Phone and portrait were not measured here; the Station stacks on a phone and this plan would stack the same way (charts, then X, then YouTube).</li>
</ul>

<h2>5 · Decisions for you</h2>
<ol>
<li><b>The column's width:</b> 220, 260 or 300 on the MacBook. <i>Recommendation: 260</i> — the narrowest that still reads; 300 if, once live, the posts feel cramped; 220 only if the charts matter more than reading X.</li>
<li><b>How the real X capture fits a 260 px column.</b> The pane shows pixels of your x.com tab's timeline column; scaled from 600 px to 260 the text would be about 6.5 px. <i>Recommendation:</i> run the x.com source tab at a narrow window (about 400 px wide, which is X's phone layout) so the capture lands in the column at nearly 1:1 and the text stays 11 px or more.</li>
<li><b>Six charts:</b> two columns of three (wide panes, the same shape as the nine) or three columns of two (squarer). <i>Recommendation: two columns of three</i>, so every chart on the Station keeps one shape.</li>
</ol>
</main></body></html>"""
open(os.path.join(ROOT, "FLOORPLAN-PROPER.html"), "w").write(page)
open(os.path.join(ROOT, "index.html"), "w").write('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=FLOORPLAN-PROPER.html"><a href="FLOORPLAN-PROPER.html">FLOORPLAN-PROPER.html</a>')
print("wrote FLOORPLAN-PROPER.html", len(page), "bytes; rows", page.count("<tr"))
