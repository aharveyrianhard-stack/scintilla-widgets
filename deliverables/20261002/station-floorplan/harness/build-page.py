#!/usr/bin/env python3
"""S8 (2 Oct 2026): writes STATION-OVAL-FLOORPLAN.html — Alan's page, pictures first, plain words — from the measured JSON
beside it: shots/before-lens.json, shots/after-lens.json (the lens before/after per pane), harness/measure-today.json
(today's deck at the three screens) and harness/mock-plan.json (the X-strip mock at the same screens and the phone).
Run from anywhere: python3 build-page.py [branch-sha]."""
import json, math, os, sys, html

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SHA = sys.argv[1] if len(sys.argv) > 1 else "(unpushed)"
load = lambda p: json.load(open(os.path.join(ROOT, p))) if os.path.exists(os.path.join(ROOT, p)) else None
before = {s["name"]: s for s in (load("shots/before-lens.json") or [])}
after = {s["name"]: s for s in (load("shots/after-lens.json") or [])}
today = load("harness/measure-today.json") or {}
plan = load("harness/mock-plan.json") or {}
n = lambda v: f"{int(round(v)):,}"
pct = lambda a, b: f"{(a / b * 100):.1f}%" if b else "—"
esc = html.escape
def _chg(was, now):
    if not was or now is None: return "—"
    d = int(round((now / was - 1) * 100))
    return f"<span class='{'up' if d <= 0 else 'down'}'>{'+' if d > 0 else ''}{d}%</span>"

def covered(h):
    L = h.get("lens")
    if not L: return None
    if L.get("covered") is not None: return L["covered"]
    s = L.get("spot")
    return s[2] * s[3] - 32 if s else None

# ---- Part 1 · the lens, pane by pane ------------------------------------------------------------------------
lens_rows, lens_totals = [], {}
for name, label in [("targets3D-1680", "TARGETS · 3-day · 1680 wide"), ("intraday1h-1680", "INTRADAY · 1H · 1680 wide"),
                    ("targets3D-390", "TARGETS · 3-day · phone 390"), ("intraday1h-390", "INTRADAY · 1H · phone 390")]:
    b, a = before.get(name), after.get(name)
    if not b or not a: continue
    bh = {h["t"]: h for h in b["hosts"]}; ah = {h["t"]: h for h in a["hosts"]}
    tb = ta = tp = 0; rows = []
    for t in [h["t"] for h in b["hosts"]]:
        hb, ha = bh.get(t), ah.get(t)
        if not hb or not ha: continue
        cb, ca = covered(hb), covered(ha)
        pane = hb["area"][2] * hb["area"][3]
        ov = (ha.get("lens") or {}).get("oval") or {}
        rows.append((t, hb["area"][2], hb["area"][3], cb, ca, ov.get("long"), ov.get("short"), ov.get("theta"), (ha.get("lens") or {}).get("shape"), (ha.get("lens") or {}).get("why")))
        if cb and ca: tb += cb; ta += ca; tp += pane
    lens_totals[name] = (label, tb, ta, tp, len(rows))
    cells = "".join(f"<tr><td><b>{esc(t)}</b></td><td class=n>{w}×{h}</td><td class=n>{n(cb) if cb else '—'}</td><td class=n>{n(ca) if ca else '—'}</td>"
                    f"<td class=n>{_chg(cb, ca)}</td>"
                    f"<td class=n>{(str(int(round(lg))) + ' × ' + str(int(round(sh))) + ' px, ' + ('%+.0f°' % (-th * 180 / math.pi))) if lg else ('box: ' + esc(str(shape)))}</td><td class=why>{esc(str(why or ''))}</td></tr>"
                    for (t, w, h, cb, ca, lg, sh, th, shape, why) in rows)
    lens_rows.append(f"<h4>{esc(label)}</h4><table><tr><th>pane</th><th class=n>pane size</th><th class=n>covered before (card)</th><th class=n>covered after (oval)</th><th class=n>change</th><th class=n>the oval: long × short, tilt</th><th>where the rule put it</th></tr>{cells}</table>")

def shot(name, caption):
    p = os.path.join(ROOT, "shots", name)
    return f"<figure><img src='shots/{name}' alt='{esc(caption)}' loading='lazy'><figcaption>{esc(caption)}</figcaption></figure>" if os.path.exists(p) else ""

pairs = ""
for name, cap in [("targets3D-1680", "TARGETS · 3-day · 1680 wide"), ("intraday1h-1680", "INTRADAY · 1H · 1680 wide"), ("targets3D-390", "TARGETS · 3-day · phone 390"), ("intraday1h-390", "INTRADAY · 1H · phone 390")]:
    pb, pa = before.get(name, {}).get("pickedPane"), after.get(name, {}).get("pickedPane")
    pairs += f"<div class=pair>{shot(f'before-{name}-pane.png', f'BEFORE · {cap} · the {pb} pane with the card')}{shot(f'after-{name}-pane.png', f'AFTER · {cap} · the {pa} pane with the oval')}</div>"
    pairs += f"<div class=pair>{shot(f'before-{name}-lens.png', f'BEFORE · {cap} · the card, close')}{shot(f'after-{name}-lens.png', f'AFTER · {cap} · the oval, close')}</div>"
walls = "".join(f"<div class=pair>{shot(f'before-{name}.png', f'BEFORE · the whole wall · {cap}')}{shot(f'after-{name}.png', f'AFTER · the whole wall · {cap}')}</div>"
                for name, cap in [("targets3D-1680", "TARGETS · 3-day · 1680×1000"), ("intraday1h-1680", "INTRADAY · 1H · 1680×1000")])
tot = "".join(f"<tr><td>{esc(lab)}</td><td class=n>{k} panes</td><td class=n>{n(tb)}</td><td class=n>{n(ta)}</td><td class=n>{_chg(tb, ta)}</td><td class=n>{pct(tb, tp)} → {pct(ta, tp)}</td></tr>"
              for lab, tb, ta, tp, k in lens_totals.values())

# ---- Part 2 · the floor plan --------------------------------------------------------------------------------
floor_rows = ""
for key, lab in [("1680x1000", "MacBook · 1680 × 1000"), ("2560x1440", "the MacBook's external · 2560 × 1440"), ("2240x1260", "the iMac · 2240 × 1260")]:
    t, p = today.get(key), plan.get(key)
    if not t: continue
    f = t["floor"]; scr = f["screen"]
    def row(name, was, now):
        d = f"<span class='{'up' if now >= was else 'down'}'>{'+' if now >= was else ''}{int(round((now / was - 1) * 100))}%</span>" if was and now is not None else "—"
        return f"<tr><td>{name}</td><td class=n>{n(was)} px² · {pct(was, scr)}</td><td class=n>{(n(now) + ' px² · ' + pct(now, scr)) if now is not None else '—'}</td><td class=n>{d}</td></tr>"
    c0 = t["floor"]["chart0"]; pc0 = p and p.get("chart0")
    floor_rows += (f"<h4>{esc(lab)} · {n(scr)} px² in all</h4><table><tr><th></th><th class=n>today (measured)</th><th class=n>the X-strip plan (measured on the mock)</th><th class=n>change</th></tr>"
        + row("charts, the whole wall", f["charts"], p and p["px"]["charts"]) + row(f"one chart ({c0['w']}×{c0['h']} today" + (f" → {pc0['w']}×{pc0['h']}" if pc0 else "") + ")", c0["w"] * c0["h"], pc0 and pc0["w"] * pc0["h"])
        + row("X", f["x"], p and p["px"]["x"]) + row("YouTube", f["video"], p and p["px"]["video"]) + row("chrome (gaps, bars)", f["chrome"], p and p["px"]["chrome"]) + "</table>"
        + (f"<p class=small>Strip <b>{p['strip']['w']} px</b> wide · X text <b>{p['xFont']:.1f} px</b> ({int(round(p['xScale'] * 100))}% of X's own 15 px) · <b>{p['postsFully']}</b> posts fully visible, {p['postsPartly']} partly · "
           f"video picture <b>{p['picture']['w']} × {p['picture']['h']}</b> (today {t['video']['box']['w']} × {t['video']['box']['h'] - 28}) · {p['charts']} charts in {p['cols']} columns.</p>" if p else "<p class=small>the mock was not photographed at this size</p>"))
phone = plan.get("390x844")
floor_pics = "".join(f"<div class=pair>{shot(f'today-{k}.png', f'TODAY · {lab}')}{shot(f'plan-{k}.png', f'THE X-STRIP PLAN (mock) · {lab}')}</div>"
                     for k, lab in [("1680x1000", "1680 × 1000"), ("2560x1440", "2560 × 1440"), ("2240x1260", "2240 × 1260")])
floor_pics += f"<div class=pair>{shot('plan-390x844.png', 'THE X-STRIP PLAN on a phone (390 wide): the charts first, the strip under them, the video last')}</div>"


def _gain(today, plan):
    out=[]
    for k,l in [("1680x1000","1680"),("2560x1440","2560"),("2240x1260","2240")]:
        t,p=today.get(k),plan.get(k)
        if t and p: out.append(f"{int(round((p['px']['charts']/t['floor']['charts']-1)*100))}% at {l}")
    return ", ".join(out) or "—"
def _posts(plan,k): return plan.get(k,{}).get("postsFully","—")
def _pic(plan,k):
    p=plan.get(k); return f"{p['picture']['w']} × {p['picture']['h']}" if p else "—"

page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Station · the oval lens and the X-strip floor plan · 2 Oct 2026</title>
<style>
:root{{ --bg:#0A0A0F; --panel:#111118; --line:#26262E; --ink:#C8C8D0; --ink2:#A8A8B0; --dim:#7A7A82; }}
body{{ margin:0; background:var(--bg); color:var(--ink); font:14px/1.55 -apple-system,"SF Pro Text",Helvetica,Arial,sans-serif; }}
main{{ max-width:1380px; margin:0 auto; padding:28px 22px 80px; }}
h1{{ font-size:24px; font-weight:600; margin:0 0 4px; }} h2{{ font-size:19px; font-weight:600; margin:40px 0 10px; border-top:1px solid var(--line); padding-top:18px; }}
h3{{ font-size:16px; margin:26px 0 8px; }} h4{{ font-size:13px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink2); margin:22px 0 6px; }}
p{{ margin:8px 0; max-width:900px; }} .small{{ font-size:12.5px; color:var(--ink2); }} .meta{{ color:var(--dim); font-size:12.5px; margin-bottom:18px; }}
blockquote{{ margin:10px 0 14px; padding:8px 14px; border-left:3px solid var(--line); color:var(--ink2); font-style:italic; }}
.pair{{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:12px 0; }} figure{{ margin:0; background:var(--panel); border:1px solid var(--line); padding:6px; }}
figure img{{ width:100%; height:auto; display:block; }} figcaption{{ font-size:12px; color:var(--ink2); padding:6px 2px 0; }}
table{{ border-collapse:collapse; font-size:12.5px; margin:6px 0 10px; }} th,td{{ border-bottom:1px solid var(--line); padding:4px 10px 4px 0; text-align:left; vertical-align:top; }}
th{{ color:var(--dim); font-weight:500; }} td.n, th.n{{ text-align:right; white-space:nowrap; }} td.why{{ color:var(--dim); max-width:360px; }}
.up{{ color:#39C27A; }} .down{{ color:#D9544E; }} code{{ font:12px ui-monospace,Menlo,monospace; background:var(--panel); padding:1px 5px; }}
ol li, ul li{{ margin:4px 0; max-width:900px; }} .box{{ background:var(--panel); border:1px solid var(--line); padding:12px 16px; margin:12px 0; max-width:900px; }}
a{{ color:#9AB8E0; }} @media (max-width:800px){{ .pair{{ grid-template-columns:1fr; }} main{{ padding:16px; }} }}
</style></head><body><main>
<h1>Station · the context lens as an oval, and the X-strip floor plan</h1>
<div class=meta>2 Oct 2026 · branch <code>station/s8-oval-lens-floorplan-20261002</code> at <code>{esc(SHA)}</code>, built on today's live Station (fa37455) · nothing deployed, nothing on your screen · every picture here was taken in a hidden browser</div>

<div class=box><b>In one minute.</b>
<p>1 · The context lens (the small zoomed-out candle chart that sits in the empty part of each pane) is now an <b>oval</b> instead of a card. Its long side runs from the first candle to the last, so it tilts with the series; its short side is only as tall as the candles need. It covers about half of what the card covered. The deck's ⋯ menu has a switch: <b>lens: oval · box</b> (oval by default; box is the old card). Tests: 944, the 18 known failures only.</p>
<p>2 · The floor plan you asked for — X on the left as a strip with YouTube at its foot, the charts taking the rest — is built as a mock page on the Station's own chart, video and X panes, measured at 1680 × 1000, 2560 × 1440 (the MacBook's external) and 2240 × 1260 (the iMac). The charts gain {_gain(today, plan)} of floor; the video becomes a strip-wide 16:9 picture. The live deck is unchanged; the mock is the proposal.</p></div>

<h2>1 · The lens: before → after</h2>
<blockquote>"Context lens oval-like shaped, from starting point to ending point, to save as much screen real estate as possible."</blockquote>
{pairs}
<h3>What the pictures show</h3>
<p>Before: a card with a cut corner, 93 × 62 px on an 8-up pane, with the timeframe in its head. After: the same candles inside an oval whose long axis is 28% of the pane's width (32% on a phone — the first build used 40%, which covered as much as the card there; 0.32 was set after that measurement) and runs from the first candle to the last — a rising series tilts the oval up to the right, a falling one down. The short axis is the least that keeps every candle inside, plus 3 px of air, in 4 px steps so a tick does not resize it. No card, no head: the timeframe (and STALE when the bars are old) sits in a small row above the oval. The forming (dashed) candle stays. The oval goes exactly where the card's rule put the card: the emptiest dark space, never over the newest fifth of the line, never on the ticker badge, the Geiger chip, the crosshair readout or the deck's arrows; bottom-left when that is as empty as anywhere; it holds its place until somewhere is clearly emptier.</p>
<h3>Pixels covered, pane by pane (measured on the pictures above)</h3>
<table><tr><th>wall</th><th class=n>panes</th><th class=n>covered before (card)</th><th class=n>covered after (oval)</th><th class=n>change</th><th class=n>share of the pane, before → after</th></tr>{tot}</table>
{''.join(lens_rows)}
<h3>The whole wall</h3>{walls}
<h3>The switch</h3>
<p>Deck → the ⋯ button (bottom of the dock's "more" drawer) → <b>lens</b>: <b>oval</b> or <b>box</b>. It is remembered in that browser and every chart on the wall follows at once; a second Station window follows too. A single pane can be forced with <code>?lens=box</code> on its own address.</p>
<h3>What could be wrong</h3>
<ul><li>On a series whose first or last candle has a long wick, the oval has to grow taller to keep that wick inside (the tips of an oval are thin). It never grows taller than it is long.</li>
<li>The oval's box is what the placement rule sees, so the rule is slightly more careful than it needs to be at the oval's corners (the corners of the box are empty).</li>
<li>The phone test used the hidden browser's 390 px window; Alan's phone may give the pane a different width, and the long axis follows the pane. At the first build's 40% phone share the oval covered 4–6% MORE than the card on the phone; at the shipped 32% it covers 17–19% less (the tables above).</li></ul>
<h3>What I did not do</h3>
<ul><li>Not deployed; not opened on your screen. The live Station still draws the card until this branch is merged and deployed.</li>
<li>The lens-placement workshop pages under deliverables/20260924 still draw the card (they are records, not the Station).</li></ul>

<h2>2 · The X-strip floor plan</h2>
<blockquote>"Station re-org proposal: X on the left in a strip, and at the bottom of the strip YouTube, perhaps a bit smaller than now — that makes the charts have more real estate. Analyzed at pixel level, like a floor plan in square feet."</blockquote>
{floor_pics}
<h3>The floor, in square pixels</h3>
<p>Today was measured on the live deck (scene TARGETS, eight charts, the dock tucked away as it is when the pointer is off it). The plan was measured on the mock page <a href="mock-x-strip.html">mock-x-strip.html</a>, which mounts the Station's real chart, video and X shells in the new arrangement and prints its own numbers bottom-right. The X capture needs your Chrome, so in the hidden browser the strip shows frames drawn at X's real post sizes (a text post ≈ 215 px, a post with a picture ≈ 560 px, in X's 600 px column), scaled to the strip.</p>
{floor_rows}
<h3>The rules the plan follows</h3>
<ul><li><b>The strip's width</b> keeps an X post readable: X's natural column is 600 px with 15 px text; the floor for text is 11 px, so the narrowest readable strip is 600 × 11⁄15 + 16 px of padding = <b>456 px</b>. The rule is clamp(456 px, 27% of the screen, 616 px) — 456 at 1680, 605 on the iMac, 616 (X at its own size) on the external.</li>
<li><b>YouTube at the strip's foot</b>: as wide as the strip, a true 16:9 picture under the player's 28 px bar, no black bars. At 1680 that is a 456 × 257 picture against today's 840 × 443 — smaller, as you said, and the thumbnail grid above it keeps two columns.</li>
<li><b>The charts</b> take everything right of the strip. Nine slots in three columns keep a chart's shape (the eight TARGETS and SPY in the ninth); four columns would make each chart tall and narrow (305 × 499 at 1680).</li>
<li><b>Phone</b>: one column that scrolls, as the Station already does — the charts first, then the strip as a block, then the video.</li></ul>
<h3>What I did not do</h3>
<ul><li>The live deck layout is untouched. The mock is a proposal page, not a Station page.</li>
<li>The X strip's posts are frames; the real capture was not run (it needs your Chrome and the X bridge, which I did not touch).</li></ul>

<h2>3 · Decisions for you (three)</h2>
<ol><li><b>The strip's width.</b> 456 px at 1680 (text at the 11 px floor, {_posts(plan, '1680x1000')} posts fully visible), growing to X's own size on the big screens. <i>Recommendation: yes, this rule</i> — narrower and the posts stop being readable; wider costs the charts their gain.</li>
<li><b>The YouTube size.</b> As wide as the strip (a 16:9 picture {_pic(plan, '1680x1000')} at 1680) or smaller still (say 70% of the strip, leaving room for more posts). <i>Recommendation: strip-wide</i> — a smaller player stops being watchable, and the strip already shows several posts above it.</li>
<li><b>Phones.</b> Whether the strip collapses on a phone (the mock stacks it under the charts, as the Station does) or stays beside them as a thin rail. <i>Recommendation: stack it</i> — a 390 px screen cannot hold a readable post beside a chart.</li></ol>
</main></body></html>
"""
open(os.path.join(ROOT, "STATION-OVAL-FLOORPLAN.html"), "w").write(page)
print("wrote STATION-OVAL-FLOORPLAN.html", len(page), "bytes")
