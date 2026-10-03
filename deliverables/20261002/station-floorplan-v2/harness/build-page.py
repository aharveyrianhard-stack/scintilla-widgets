#!/usr/bin/env python3
"""S9 (2 Oct 2026): writes FLOORPLAN-V2.html — Alan's page, pictures first, plain words — from the measured JSON beside it:
harness/measure-today.json (today's deck at the three screens), harness/mock-plan-v2.json (every strip × PIP × chart-count
combination, geometry) and harness/mock-shots-v2.json (the photographed ones). Run from anywhere: python3 build-page.py [sha]."""
import json, math, os, sys, html
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SHA = sys.argv[1] if len(sys.argv) > 1 else "(unpushed)"
load = lambda p: json.load(open(os.path.join(ROOT, p))) if os.path.exists(os.path.join(ROOT, p)) else {}
today, plan, shots = load("harness/measure-today.json"), load("harness/mock-plan-v2.json"), load("harness/mock-shots-v2.json")
esc = html.escape; n = lambda v: f"{int(round(v)):,}"
SCREENS = [("1680x1050", "the MacBook · 1680 × 1050"), ("1920x1080", "the Apple TV · 1920 × 1080"), ("2560x1440", "the external · 2560 × 1440")]
STRIPS = [("today", "today's strip (S8)"), ("-30", "30% slimmer"), ("-50", "50% slimmer")]
P = lambda k, s, p, c, extra="": plan.get(f"{k}|{s}|{p}|{c}" + (f"|{extra}" if extra else ""))
pc = lambda m: int(round(m["share"]["charts"] * 100))
tpc = lambda k: int(round(today[k]["floor"]["share"]["charts"] * 100))
def shot(name, cap):
    return (f"<figure><img src='shots/{name}.png' alt='{esc(cap)}' loading='lazy'><figcaption>{esc(cap)}</figcaption></figure>"
            if os.path.exists(os.path.join(ROOT, "shots", name + ".png")) else "")
def pair(a, b): return f"<div class=pair>{a}{b}</div>"
def pts(a, b): d = b - a; return f"<span class='{'up' if d >= 0 else 'down'}'>{'+' if d >= 0 else ''}{d} pts</span>"

# ---- 1 · the one number ------------------------------------------------------------------------------------------
one = ""
for k, lab in SCREENS:
    t = today.get(k)
    if not t: continue
    c0 = t["floor"]["chart0"]; tp = tpc(k)
    rows = f"<tr><td><b>today</b> (8 charts, X and YouTube in the lower half)</td><td class=n>{tp}%</td><td class=n>—</td><td class=n>{c0['w']} × {c0['h']}</td></tr>"
    for s, sl in STRIPS:
        m = P(k, s, "L", 9)
        if not m: continue
        rows += f"<tr><td>X strip <b>{sl}</b> ({m['strip']['w']} px), YouTube as a PIP, 9 charts</td><td class=n><b>{pc(m)}%</b></td><td class=n>{pts(tp, pc(m))}</td><td class=n>{m['chart0']['w']} × {m['chart0']['h']}</td></tr>"
    one += f"<h4>{esc(lab)}</h4><table><tr><th>floor plan</th><th class=n>chart area, share of the screen</th><th class=n>vs today</th><th class=n>one chart, px</th></tr>{rows}</table>"

# ---- 2 · the strip at three widths ----------------------------------------------------------------------------------
strip_rows = ""
for k, lab in SCREENS:
    rows = ""
    for s, sl in STRIPS:
        mL, mS = P(k, s, "L", 9), P(k, s, "S", 9)
        if not mL: continue
        rows += (f"<tr><td><b>{sl}</b></td><td class=n>{mL['strip']['w']} px</td><td class=n>{mL['xFont']:.1f} px</td><td class=n><b>{mL['charsPerLine']}</b></td>"
                 f"<td class=n>{mL['postsFully']} fully · {mL['postsPartly']} partly</td><td class=n>{mS['postsFully']} fully · {mS['postsPartly']} partly</td><td class=n>{pc(mL)}%</td></tr>")
    strip_rows += f"<h4>{esc(lab)}</h4><table><tr><th>strip</th><th class=n>width</th><th class=n>X text</th><th class=n>characters per line</th><th class=n>posts on screen, large PIP</th><th class=n>posts, small PIP</th><th class=n>charts</th></tr>{rows}</table>"
strip_pics = "".join(shot(f"plan-1680x1050-strip{s.replace('-', 'm')}-pipL-c9", f"{sl} · 1680 × 1050 · 9 charts · the large PIP") for s, sl in STRIPS)

# ---- 3 · the PIP ---------------------------------------------------------------------------------------------------
pip_rows = ""
for k, lab in SCREENS:
    t = today.get(k); tv = t["video"]["box"] if t else None
    rows = f"<tr><td>today's YouTube pane</td><td class=n>{tv['w']} × {tv['h'] - 28}</td><td class=n>{int(round(t['floor']['share']['video'] * 100))}%</td><td class=n>—</td></tr>" if tv else ""
    for p, pl in [("L", "large PIP (20% of the screen's width)"), ("S", "small PIP (14%)")]:
        for s, sl in STRIPS:
            m = P(k, s, p, 9)
            if not m: continue
            capped = " — capped at the strip's width" if m["picture"]["w"] >= m["strip"]["w"] else ""
            rows += f"<tr><td>{pl} · strip {sl}</td><td class=n>{m['picture']['w']} × {m['picture']['h']}{capped}</td><td class=n>{int(round(m['share']['video'] * 100))}%</td><td class=n>{m['postsFully']} fully · {m['postsPartly']} partly</td></tr>"
    pip_rows += f"<h4>{esc(lab)}</h4><table><tr><th>YouTube</th><th class=n>picture, px (16:9)</th><th class=n>share of the screen</th><th class=n>posts left above it</th></tr>{rows}</table>"
pip_pics = pair(shot("plan-1680x1050-stripm30-pipL-c9", "the large PIP · strip 30% slimmer · 1680 × 1050"), shot("plan-1680x1050-stripm30-pipS-c9", "the small PIP · strip 30% slimmer · 1680 × 1050"))

# ---- 4 · the grids, drawn to scale -------------------------------------------------------------------------------------
def svg_plan(m, k, title, W=400):
    vw, vh = m["vw"], m["vh"]; sc = W / vw; H = vh * sc
    g = lambda b: (b["x"] * sc, b["y"] * sc, b["w"] * sc, b["h"] * sc)
    out = [f"<svg viewBox='0 0 {W} {H + 18:.0f}' width='{W}' class=plan><rect x=0 y=0 width={W} height={H:.1f} fill='#0A0A0F' stroke='#36363E'/>"]
    x, y, w, h = g(m["x"]); out.append(f"<rect x={x:.1f} y={y:.1f} width={w:.1f} height={h:.1f} fill='#15151F' stroke='#2A2A36'/><text x={x + w / 2:.1f} y={y + h / 2:.1f} fill='#8E8E96' font-size=10 text-anchor=middle>X</text>")
    if m["video"]["w"]:
        x, y, w, h = g(m["video"]); out.append(f"<rect x={x:.1f} y={y:.1f} width={w:.1f} height={h:.1f} fill='#1A1A26' stroke='#36363E'/><text x={x + w / 2:.1f} y={y + h / 2 + 3:.1f} fill='#8E8E96' font-size=8 text-anchor=middle>YouTube</text>")
    c0, cols, N = m["chart0"], m["cols"], m["charts"]; cb = m["chartsBlock"]
    for i in range(N):
        cx = cb["x"] + (i % cols) * (c0["w"] + 1); cy = cb["y"] + (i // cols) * (c0["h"] + 1)
        x, y, w, h = g({"x": cx, "y": cy, "w": c0["w"], "h": c0["h"]})
        out.append(f"<rect x={x:.1f} y={y:.1f} width={w:.1f} height={h:.1f} fill='#0F0F1A' stroke='#3A3A4A'/>")
        out.append(f"<path d='M{x + w * .08:.1f},{y + h * .7:.1f} L{x + w * .3:.1f},{y + h * .45:.1f} L{x + w * .5:.1f},{y + h * .6:.1f} L{x + w * .72:.1f},{y + h * .3:.1f} L{x + w * .92:.1f},{y + h * .4:.1f}' fill='none' stroke='#39C27A' stroke-width='1'/>")
    out.append(f"<text x=0 y={H + 13:.1f} fill='#B4B4BC' font-size=10>{esc(title)} · charts {pc(m)}% · one chart {c0['w']} × {c0['h']} px</text></svg>")
    return "".join(out)
def svg_today(k, title, W=400):
    t = today[k]; vw, vh = t["vw"], t["vh"]; sc = W / vw; H = vh * sc
    out = [f"<svg viewBox='0 0 {W} {H + 18:.0f}' width='{W}' class=plan><rect x=0 y=0 width={W} height={H:.1f} fill='#0A0A0F' stroke='#36363E'/>"]
    for c in t["charts"]:
        b = c["box"]; out.append(f"<rect x={b['x'] * sc:.1f} y={b['y'] * sc:.1f} width={b['w'] * sc:.1f} height={b['h'] * sc:.1f} fill='#0F0F1A' stroke='#3A3A4A'/>")
    for lab, b in [("YouTube", t["video"]["box"]), ("X", t["x"]["box"])]:
        out.append(f"<rect x={b['x'] * sc:.1f} y={b['y'] * sc:.1f} width={b['w'] * sc:.1f} height={b['h'] * sc:.1f} fill='#15151F' stroke='#2A2A36'/><text x={(b['x'] + b['w'] / 2) * sc:.1f} y={(b['y'] + b['h'] / 2) * sc:.1f} fill='#8E8E96' font-size=10 text-anchor=middle>{lab}</text>")
    c0 = t["floor"]["chart0"]
    out.append(f"<text x=0 y={H + 13:.1f} fill='#B4B4BC' font-size=10>{esc(title)} · charts {tpc(k)}% · one chart {c0['w']} × {c0['h']} px</text></svg>")
    return "".join(out)
grids = ""
for k, lab in SCREENS:
    if k not in today: continue
    cells = [svg_today(k, "today · 8 charts")]
    for c in [2, 4, 6, 9]:
        m = P(k, "-30", "L", c)
        if m: cells.append(svg_plan(m, k, f"{c} charts · strip 30% slimmer"))
    m6 = P(k, "-30", "L", 6, "cols3"); m2 = P(k, "-30", "L", 2, "cols2")
    if m6: cells.append(svg_plan(m6, k, "6 charts in 3 columns (the weird one)"))
    if m2: cells.append(svg_plan(m2, k, "2 charts side by side (the other way)"))
    grids += f"<h4>{esc(lab)}</h4><div class=plans>{''.join(cells)}</div>"
def shape(m): c = m["chart0"]; return f"{c['w']} × {c['h']} px, {c['w'] / c['h']:.2f} wide-to-tall"
k0 = "1680x1050"; t0 = today.get(k0, {}).get("floor", {}).get("chart0", {"w": 419, "h": 277})
grid_rows = ""
for c, note in [(2, "two charts stacked, each as wide as the floor"), (4, "two by two"), (6, "two columns of three"), (9, "three by three")]:
    m = P(k0, "-30", "L", c)
    if m: grid_rows += f"<tr><td><b>{c} charts</b> — {note}</td><td class=n>{pc(m)}%</td><td class=n>{shape(m)}</td></tr>"
m6, m2 = P(k0, "-30", "L", 6, "cols3"), P(k0, "-30", "L", 2, "cols2")
if m6: grid_rows += f"<tr><td>6 charts — three columns of two (the weird one)</td><td class=n>{pc(m6)}%</td><td class=n>{shape(m6)}</td></tr>"
if m2: grid_rows += f"<tr><td>2 charts — side by side</td><td class=n>{pc(m2)}%</td><td class=n>{shape(m2)}</td></tr>"
grid_pics = "".join(shot(f"plan-1680x1050-stripm30-pipL-c{c}", f"{c} charts · strip 30% slimmer · 1680 × 1050") for c in [2, 4, 6, 9])
grid_pics += pair(shot("plan-1680x1050-stripm30-pipL-c6-_cols_3", "6 charts in THREE columns — tall and narrow, the weird one"), shot("plan-1680x1050-stripm30-pipL-c2-_cols_2", "2 charts side by side — tall and narrow too"))
big_pics = "".join(shot(f"plan-{k}-stripm30-pipL-c9", f"the recommendation · {lab}") for k, lab in SCREENS if k != k0)
big_pics += pair(shot("plan-2560x1440-stripm30-pipL-c4", "4 charts · the external"), shot("plan-1920x1080-stripm30-pipL-c4", "4 charts · the Apple TV"))

m30 = {k: P(k, "-30", "L", 9) for k, _ in SCREENS}
rec = " · ".join(f"{lab.split(' · ')[0]}: strip {m['strip']['w']} px, PIP {m['picture']['w']} × {m['picture']['h']}, one chart {m['chart0']['w']} × {m['chart0']['h']}, charts <b>{pc(m)}%</b>" for (k, lab), m in zip(SCREENS, m30.values()) if m)
one_line = " · ".join(f"{lab.split(' · ')[0]} {tpc(k)}% → {pc(P(k, '-30', 'L', 9))}%" for k, lab in SCREENS if today.get(k) and P(k, "-30", "L", 9))
page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Station floor plan v2 · a slimmer X strip, YouTube as a PIP, the chart area in percent · 2 Oct 2026</title>
<style>
:root{{ --bg:#0A0A0F; --panel:#111118; --line:#26262E; --ink:#C8C8D0; --ink2:#A8A8B0; --dim:#7A7A82; }}
body{{ margin:0; background:var(--bg); color:var(--ink); font:14px/1.55 -apple-system,"SF Pro Text",Helvetica,Arial,sans-serif; }}
main{{ max-width:1380px; margin:0 auto; padding:28px 22px 80px; }}
h1{{ font-size:24px; font-weight:600; margin:0 0 4px; }} h2{{ font-size:19px; font-weight:600; margin:40px 0 10px; border-top:1px solid var(--line); padding-top:18px; }}
h3{{ font-size:16px; margin:26px 0 8px; }} h4{{ font-size:13px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink2); margin:22px 0 6px; }}
p{{ margin:8px 0; max-width:900px; }} .small{{ font-size:12.5px; color:var(--ink2); }} .meta{{ color:var(--dim); font-size:12.5px; margin-bottom:18px; }}
blockquote{{ margin:10px 0 14px; padding:8px 14px; border-left:3px solid var(--line); color:var(--ink2); font-style:italic; }}
.pair{{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:12px 0; }} figure{{ margin:12px 0; background:var(--panel); border:1px solid var(--line); padding:6px; }}
.pair figure{{ margin:0; }} figure img{{ width:100%; height:auto; display:block; }} figcaption{{ font-size:12px; color:var(--ink2); padding:6px 2px 0; }}
table{{ border-collapse:collapse; font-size:12.5px; margin:6px 0 10px; }} th,td{{ border-bottom:1px solid var(--line); padding:4px 10px 4px 0; text-align:left; vertical-align:top; }}
th{{ color:var(--dim); font-weight:500; }} td.n, th.n{{ text-align:right; white-space:nowrap; }}
.up{{ color:#39C27A; }} .down{{ color:#D9544E; }} code{{ font:12px ui-monospace,Menlo,monospace; background:var(--panel); padding:1px 5px; }}
ol li, ul li{{ margin:4px 0; max-width:900px; }} .box{{ background:var(--panel); border:1px solid var(--line); padding:12px 16px; margin:12px 0; max-width:900px; }}
.big{{ font-size:22px; font-weight:600; color:var(--ink); margin:6px 0 10px; }} .plans{{ display:flex; flex-wrap:wrap; gap:14px; }} svg.plan{{ background:var(--panel); border:1px solid var(--line); padding:6px; }}
a{{ color:#9AB8E0; }} @media (max-width:800px){{ .pair{{ grid-template-columns:1fr; }} main{{ padding:16px; }} svg.plan{{ width:100%; height:auto; }} }}
</style></head><body><main>
<h1>Station floor plan v2 · a slimmer X strip, YouTube as a picture-in-picture</h1>
<div class=meta>2 Oct 2026, night · branch <code>station/s9-floorplan-v2-20261002</code> at <code>{esc(SHA)}</code>, built on today's live Station (6069a35) · a mock, nothing deployed, no Station page changed · every picture here was taken in a hidden browser · the mock itself: <a href="mock-v2.html?strip=-30&pip=L&charts=9">mock-v2.html</a> (open it on each screen; the card bottom-right prints the numbers for that screen)</div>

<div class=box><b>The one number.</b>
<div class=big>today: charts 53% · S8's plan: 73% · the strip 30% slimmer: 81% · 50% slimmer: 86%</div>
<p>Those are the chart area as a share of the whole screen at 1680 × 1050 (the MacBook). The same on each screen you use: {one_line}. S8's plan already had the charts at 73% — the page did not say so, which is why it looked like less. The YouTube size does not change the chart area at all: the strip's width does. The PIP only trades against how many X posts you see above it.</p>
<p><b>Recommendation:</b> 9 charts in three columns · the strip 30% slimmer than S8's · YouTube as the large PIP, which at that strip is simply as wide as the strip. {rec}.</p></div>

<h2>1 · The chart area, in plain percent</h2>
<blockquote>"It doesn't tell me if I have more chart space or less … proportionally it looks like less. Charts from 53 to 73%."</blockquote>
<p>Today was measured on the live deck (scene TARGETS, eight charts, the dock tucked away) at the three screens: the MacBook at 1680 × 1050, the Apple TV at 1920 × 1080 and the external at 2560 × 1440. Each proposal was measured on the mock at the same screens. "Chart area" is the whole block the charts fill, pane borders included; today's 53% is the upper half of the screen (the lower half is X and YouTube side by side).</p>
{one}
<p class=small>S8 measured at 1680 × 1000 and 2240 × 1260 (the iMac); S9 uses the sizes in the S9 brief. The deck's chart row takes 52.8% at every size because its layout is proportional.</p>

<h2>2 · The X strip at three widths</h2>
<blockquote>"The solution is simple: make the X thing more narrow."</blockquote>
{strip_pics}
<h3>Can you still read it?</h3>
<p>X's own column is 600 px wide with 15 px text, about 80 characters per line. In the strip the text shrinks with the strip down to 11 px (the floor; below that it is not readable) and then the strip wraps more. A useful yardstick: <b>X on a phone shows about 45 characters per line</b>. The strip 30% slimmer gives 53 at 1680 — a little better than a phone. The strip 50% slimmer gives 35 — narrower than a phone; a normal post becomes five or six short lines. The posts on screen hardly change between the widths, because narrower posts are taller.</p>
{strip_rows}
<p class=small>Posts here are drawn with real text at the measured size (the live X capture needs your Chrome and does not run in a hidden browser). "Fully" = the whole post is on screen; "partly" counts the one cut off at the bottom too.</p>

<h2>3 · YouTube as a picture-in-picture</h2>
<blockquote>"YouTube more narrow too, more like PIP size … YouTube could drop more — the charts are more important."</blockquote>
{pip_pics}
<p>The PIP sits at the strip's foot, a 16:9 picture under the player's 28 px bar. Two sizes: <b>large</b> = 20% of the screen's width, <b>small</b> = 14%; neither is ever wider than the strip, so at the slim strips the large one is simply strip-wide. Today's YouTube pane is 24% of the screen; the large PIP at the slim strip is 4%, the small one 2%. What a smaller PIP buys is one more post above it, not more chart.</p>
{pip_rows}

<h2>4 · The chart grids: 2, 4, 6 and 9</h2>
<blockquote>"A nine-chart layout will look better with X more slim … six and three charts will be weird, four and two good."</blockquote>
<h3>Drawn to scale (the strip 30% slimmer, the large PIP)</h3>
{grids}
<h3>What looks right</h3>
<table><tr><th>grid at 1680 × 1050</th><th class=n>chart area</th><th class=n>one chart</th></tr>{grid_rows}</table>
<p>Today's chart is {t0['w']} × {t0['h']} px, {t0['w'] / t0['h']:.2f} times wider than tall. A chart reads well between about 1.2 and 2 wide-to-tall. <b>9</b> (three by three) and <b>4</b> (two by two) land at 1.3 — the right shape, and the chart is bigger than today's in every case. <b>2</b> works stacked (each chart the full width of the floor, very wide) — side by side they are taller than wide, which is why two "looks weird" when drawn the obvious way. <b>6</b> in three columns is the problem you named: 453 × 525, taller than wide. <b>The fix for 6: two columns of three</b> — 680 × 349, a wide chart, the same height as the 9-grid's and half again as wide. The mock does this by default; 3 and 5 would follow the same rule (two columns, the last row half empty), or better, the deck simply offers 2 · 4 · 6 · 9.</p>
{grid_pics}
<h3>On the other screens</h3>
{big_pics}

<h2>5 · Decisions for you (three)</h2>
<ol><li><b>How slim.</b> 30% slimmer (319 px at 1680 — 53 characters per line, charts 81%) or 50% slimmer (228 px — 35 characters, charts 86%). <i>Recommendation: 30%</i> — it reads like X on a phone; at 50% every post is a tall sliver and the five extra points of chart are not worth it.</li>
<li><b>The PIP size.</b> Large (strip-wide at the slim strip: 319 × 179 at 1680) or small (235 × 132). <i>Recommendation: large</i> — it costs no chart area, it is already a sixth of today's picture, and the small one is hard to watch; the small one buys one more post.</li>
<li><b>The 6-chart grid.</b> Two columns of three (wide charts, recommended) or drop 6 from the choices and offer 2 · 4 · 9 only. <i>Recommendation: two columns of three</i>, and let the deck choose the columns by count (2 → 1, 4 and 6 → 2, 9 → 3).</li></ol>
<h3>What I did not do</h3>
<ul><li>The live deck is untouched: this is a mock page beside S8's, not a Station page. Making it the deck is the next lane.</li>
<li>The X strip's posts are drawn, not captured (the capture needs your Chrome). Their sizes follow X's real column and text size.</li>
<li>Not deployed; not opened on your screen.</li></ul>
</main></body></html>
"""
open(os.path.join(ROOT, "FLOORPLAN-V2.html"), "w").write(page)
open(os.path.join(ROOT, "index.html"), "w").write('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=FLOORPLAN-V2.html"><a href="FLOORPLAN-V2.html">FLOORPLAN-V2.html</a>')
print("wrote FLOORPLAN-V2.html", len(page), "bytes")
