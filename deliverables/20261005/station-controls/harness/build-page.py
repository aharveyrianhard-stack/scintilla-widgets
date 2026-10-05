#!/usr/bin/env python3
"""S12: writes STATION-CONTROLS.html from the measured JSON (s12-before.json, s12-after.json, tapes.json). Plain words, pictures first."""
import json, os, subprocess, datetime
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
B = json.load(open(os.path.join(HERE, "s12-before.json"))); A = json.load(open(os.path.join(HERE, "s12-after.json"))); T = json.load(open(os.path.join(HERE, "tapes.json")))
sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, cwd=ROOT).stdout.strip()
SCREENS = [("1680x1050", "MacBook"), ("1920x1080", "Apple TV"), ("2560x1440", "External"), ("1167x662", "iMac window (as the health row reports it today)")]
def st(w): return ' style="max-width:%dpx"' % w if w else ""
def img(src, cap, w=None):
    return '<figure><img src="%s" alt="%s" loading="lazy"%s><figcaption>%s</figcaption></figure>' % (src, cap, st(w), cap)
def pair(before, after, cap, w=None):
    return '<div class="pair">' + img(before, "before — " + cap, w) + img(after, "after — " + cap, w) + '</div>'
def px(n): return f"{n:g} px"
rows_x = ""
for k, name in SCREENS:
    b, a = B[k], A[k]; bx, ax = b["x"], a["x"]
    rows_x += f"""<tr><td>{name}<br><small>{k}</small></td><td>{b['rest']['column']['w']} px</td><td>{bx['shown']['sourceCssWidth']} of {bx['post']['column']['width']} px<br><small>avatar rail {bx['post']['cut']['avatarRail']} px off the left · {bx['post']['column']['right'] - bx['shown']['sourceCssRight']} px off the right (the ··· menu)</small></td><td>{ax['shown']['sourceCssWidth']} of {ax['post']['column']['width']} px<br><small>0 px off either side</small></td><td>{bx['textPx']} → {ax['textPx']} px</td><td>{len(b['xBar'].get('squeezed', []))} squeezed · {len(b['xBar']['cut'])} cut → {len(a['xBar'].get('squeezed', []))} · {len(a['xBar']['cut'])}</td></tr>"""
rows_y = ""
for k, name in SCREENS:
    b, a = B[k], A[k]
    def row(r): return " · ".join(i["what"] for i in r["items"])
    def state(r): return ("one line" if r["oneLine"] else "wraps") + (", nothing cut" if not r["cut"] else ", cut: " + ", ".join(r["cut"])) + (" · compact" if "bar-tight" in r["body"] else "") + (" · scrolling" if "bar-scroll" in r["body"] else "")
    rows_y += f"""<tr><td rowspan="2">{name}<br><small>{k}</small></td><td>PERSONAL</td><td>{row(b['rowPersonal'])}<br><small>{state(b['rowPersonal'])}</small></td><td>{row(a['rowPersonal'])}<br><small>{state(a['rowPersonal'])}</small></td></tr>
<tr><td>SCINTILLA</td><td>{row(b['rowScintilla'])}<br><small>{state(b['rowScintilla'])}</small></td><td>{row(a['rowScintilla'])}<br><small>{state(a['rowScintilla'])}{' · the row opens inside the pane: ' + ' · '.join(a['menuOpen']['items']) if a.get('menuOpen') else ''}</small></td></tr>"""
rows_t = ""
for v, title in [("top", "A · at the top of the chart area"), ("between", "B · between the chart rows"), ("foot", "C · a strip under the charts")]:
    for k, name in [("1920x1080", "Apple TV"), ("1680x1050", "MacBook")]:
        m = T[f"{k}-{v}"]
        rows_t += f"""<tr><td>{title}</td><td>{name}<br><small>{k}</small></td><td>{m['chartsWidthShare']}%</td><td>{m['tapeHeightPx']} px · {m['tapeShareOfScreenHeight']}% of the height</td><td>{m['chart']['w']} × {m['chart']['h']}<br><small>{m['chartWithoutTapes']['h']} tall without the tapes</small></td><td>{m['counts']}</td><td>{m['quoted']:g} of {m['cells']:g} priced</td></tr>"""
x_pics = "".join(pair(f"shots/before-x-{k}.png", f"shots/after-x-{k}.png", f"{name} · the X pane, {B[k]['rest']['column']['w']} px wide, on the stand-in capture", 420) for k, name in SCREENS[:3])
xbar_pics = "".join(pair(f"shots/before-xbar-{k}.png", f"shots/after-xbar-{k}.png", f"{name} · the X bar", 640) for k, name in SCREENS[:3])
y_pics = "".join(pair(f"shots/before-ytbar-{k}-personal.png", f"shots/after-ytbar-{k}-personal.png", f"{name} · the PERSONAL row", 640) + pair(f"shots/before-ytbar-{k}-scintilla.png", f"shots/after-ytbar-{k}-scintilla.png", f"{name} · the SCINTILLA row", 640) for k, name in SCREENS[:3])
menu_pics = "".join(img(f"shots/after-ytmenu-{k}.png", f"{name} · the filter row, opened by the chip, under the bar and over the thumbnails", 640) for k, name in SCREENS[:3] if os.path.exists(os.path.join(ROOT, f"shots/after-ytmenu-{k}.png")))
t_pics = "".join(img(f"shots/tapes-{v}-{k}.png", f"{title} · {name} {k}") + img(f"shots/tapes-{v}-{k}-close.png", f"{title} · {name} · the cells, close", 900) for v, title in [("top", "A · top"), ("between", "B · between"), ("foot", "C · foot")] for k, name in [("1920x1080", "Apple TV"), ("1680x1050", "MacBook")])
html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>S12 · Station controls, the X edge and the tapes</title>
<style>:root{{--bg:#0A0A0F;--panel2:#0F0F1A;--line:#1A1A2A;--ink:#F2F2F8;--ink2:#C6C8DE;--ink3:#9A9AB6;--mute:#3A3A52;--crk:#00D4FF;--bull:#00FFA3;--bear:#FF2D55;--mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace}}
body{{margin:0;background:var(--bg);color:var(--ink2);font-family:var(--mono);font-size:12px;line-height:1.6;padding:18px 22px 60px}} h1{{color:var(--ink);font-size:17px;letter-spacing:.06em;margin:0 0 4px}} h2{{color:var(--crk);font-size:12px;letter-spacing:.18em;text-transform:uppercase;margin:34px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}} h3{{color:var(--ink);font-size:12px;margin:18px 0 6px}}
.sub{{color:var(--ink3);font-size:11px}} b{{color:var(--ink);font-weight:600}} small{{color:var(--ink3);font-size:10.5px}} p{{max-width:980px}}
figure{{margin:0;display:inline-block;vertical-align:top}} figure img{{display:block;max-width:100%;border:1px solid var(--line);background:#000}} figcaption{{color:var(--ink3);font-size:10.5px;margin:4px 0 12px;max-width:640px}}
.pair{{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:8px}} .pics{{display:flex;gap:14px;flex-wrap:wrap}}
table{{border-collapse:collapse;margin:8px 0 14px;font-size:11.5px}} th,td{{border:1px solid var(--line);padding:5px 9px;text-align:left;vertical-align:top}} th{{color:var(--crk);font-weight:500;letter-spacing:.08em;font-size:10px;text-transform:uppercase;background:var(--panel2)}}
.rec{{border:1px solid rgba(0,212,255,.34);background:var(--panel2);padding:10px 14px;max-width:980px}} .warn{{color:#C6C8DE}} ul{{max-width:980px}}
details.sc-pagespecs{{margin-top:40px;color:var(--ink3);font-size:11px}} details.sc-pagespecs summary{{color:var(--mute);letter-spacing:.16em;font-size:9px;cursor:pointer}}</style></head><body>
<h1>Station controls, the X feed's edge, and two tapes</h1>
<div class="sub">S12 · 5 Oct 2026 · branch <b>station/s12-controls-20261005</b> at <b>{sha}</b> · the real Station page in a hidden browser · nothing deployed, nothing live · built {datetime.datetime.now().strftime('%-d %b %Y %H:%M')} ET</div>

<h2>A1 · The X feed's right edge</h2>
<p><b>What was cut, and why.</b> The X picture is not framed by the Station: a helper in Alan's Chrome (the X Bridge) captures the real x.com tab and tells the pane which rectangle of it to show. That rule <b>started the rectangle where the post's text starts</b> — so the avatar rail, 52 px of a 598 px column, was never in the picture — and <b>stopped 18 px short of the column's right edge</b>, which is where x.com puts the ··· menu and the end of a long line. The pane itself draws the whole rectangle it is given, at every width (measured: the full rectangle lands inside the 403 / 461 / 614 px column with 6–8 px of black padding each side and nothing scrolled off). So the right-side loss was decided at the source, not in the column. The fix is in the bridge's rule: the rectangle is now the <b>whole timeline column, border to border</b>; the pane scales all of it to the column's width. The X pane's own bar also piled up: when the row ran short, the "live" state and the source's name were painted straight over the list and bell buttons. Every item now keeps its size, and −30 s · iPad link · pip · the source sit behind one ⋯.</p>
<p class="warn"><b>How this was measured.</b> The hidden browser cannot run the bridge and may never open a visible window, so a <b>stand-in</b> plays the x.com tab: a page with x.com's three columns at x.com's widths on a 1792 × 1080 window (the frame size the one live health row reports today), with the same DOM hooks the bridge reads. Its picture is fed to the real X shell as a video stream through the shell's own attach path, and the rectangle is computed by the bridge's own <code>calculateCropRect()</code> run on that page. Everything downstream of the pixels is real. On Alan's screen the posts are his; the proportions are these.</p>
<div class="pics">{x_pics}</div>
<h3>The X bar</h3><div class="pics">{xbar_pics}</div>
<table><tr><th>Screen</th><th>Column</th><th>Shown before</th><th>Shown after</th><th>Post text height</th><th>The X bar</th></tr>{rows_x}</table>
<p><small>"Shown" is how much of the 598 px timeline column lands in the pane. "Post text height" is x.com's 15 px body text as drawn in the column: the whole column at 403 px is smaller type than the trimmed one was. That is the trade: nothing lost, or bigger type — Alan's words were the former.</small></p>
<p class="warn"><b>What the bridge change needs:</b> the bridge is an extension in Alan's Chrome and Brave, so after the merge each browser reloads it once (↻ on the extensions page, then ⌥⇧S). The health page now expects 0.7.22 and says "needs ↻ + ⌥⇧S" against any browser still on 0.7.21.</p>

<h2>A2 · The YouTube controls</h2>
<p><b>The layout chosen: the critical controls on the bar, the filters one tap away.</b> The bar now holds the channel switch (PERSONAL ▾ / SCINTILLA ▾ …), REFRESH (↻), one chip that <b>names the filters in force</b> (VIDEOS · SUBSCRIBED ▾), and ⛶. Tapping the chip opens the filter row — GRID · VIDEOS · SHORTS | the lists — under the bar, over the thumbnails; a choice applies and folds the row; Esc folds it. While a video plays the chip and ↻ step aside and the player keeps its own transport (prev · next · •••), so nothing sits over the picture. <b>Why not a swipeable row:</b> at 403 px a swipeable row hides whatever is off-screen, and that is often the active filter — you cannot see what the grid is showing you. The named chip always says it.</p>
<div class="pics">{y_pics}</div>
<div class="pics">{menu_pics}</div>
<table><tr><th>Screen</th><th>Feed</th><th>The row before</th><th>The row after</th></tr>{rows_y}</table>

<h2>B · Two tapes in the chart space — a proposal</h2>
<p><b>What the tapes are.</b> LIKED = the Hub's liked names (the ♥, 148 today). FAVORITES = the Station's favorites list (63 today). The LIKED tape shows only the liked names that are <b>not</b> on FAVORITES (85 today), so a name is on one tape, never both. A cell is <b>ticker · price · change % · the Geiger mark</b> (four rungs lit from the composite: cyan up, red down) and a price that ticks <b>flashes once</b> — the scintilla. 45 px a second whatever the length, pause on hover; tap a cell and that chart opens in a slot. Real quotes from the chart API, the real lists, on a throwaway page that mocks the floor plan (the charts are placeholders carrying the real price and change).</p>
<div class="pics">{t_pics}</div>
<table><tr><th>Variant</th><th>Screen</th><th>Charts, share of the width</th><th>The two tapes</th><th>One chart</th><th>The lists</th><th>Priced</th></tr>{rows_t}</table>
<div class="rec"><b>Recommendation: A, both tapes at the top of the chart area.</b> They read as one strip under the dock, the way the Hub's bands read; the three-by-three wall stays a wall (B cuts it into three bands with tapes between, which the eye reads as three unrelated rows; C puts the tapes where the eye never rests). The cost is the same for all three — two 22 px tapes, 44 px, 4.1% of the screen's height — and the charts keep their 76% of the width untouched; each chart gives up 14 px of height (348 → 334 on the Apple TV). If 44 px is too much, one tape that alternates LIKED and FAVORITES every 30 s costs 22 px; shown here as the numbers, not pictured.</div>

<h2>Notes</h2>
<ul><li><b>Not verified on a real capture.</b> The stand-in reproduces x.com's geometry and the bridge's rule; Alan's own feed goes through the same code. The one browser reporting to the health page today (the iMac's Brave, a 1167 × 662 Station window) was measured at its size too: at 280 px of column the chips were cut before and are not after, and post text is 6.8 px — that window is too small for X at any rule.</li>
<li><b>Pre-existing, not touched:</b> the deck's ‹ page arrow sits over the X pane's left edge at mid-height (visible in the pictures). Say the word and it moves.</li>
<li>Station tests: 953 → 957, the same 18 known failures. The bridge draft's own tests: 75, the same 9 failures before and after (none touch the crop rule).</li>
<li>Nothing deployed; nothing written to any table; the headless browser blocked every non-GET request (14 per screen, counted).</li></ul>
<details class="sc-pagespecs"><summary>PAGE SPECS</summary><div>Harness: <code>harness/s12.mjs before|after</code> (the deck at 1680 / 1920 / 2560 and the iMac window; the stand-in at <code>harness/x-standin.html</code>, fed through <code>attachXFloatStream</code>; the crop by the bridge's <code>calculateCropRect</code>) → <code>s12-before.json</code>, <code>s12-after.json</code>, <code>shots/</code>. Tapes: <code>harness/tapes.mjs</code> → <code>tapes.json</code>; the page is <code>tapes/index.html?v=top|between|foot</code>. Test: <code>tests/station-s12-controls-20261005.test.mjs</code>. This page: <code>harness/build-page.py</code>.</div></details>
</body></html>"""
open(os.path.join(ROOT, "STATION-CONTROLS.html"), "w").write(html); print("page written", sha)
