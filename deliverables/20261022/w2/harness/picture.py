"""W2 (22 Oct 2026): the one picture - live-v1 beside the TradingView embed (tv-v1) at the WIDGETS slot sizes, with the
measured numbers under it. Real pixels from the headless runs (../shots), numbers from ../measure. Nothing is drawn by hand.
    python3 -I picture.py   ->  ../W2-LIVE-CHART.png
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS, MEASURE = os.path.join(HERE, "..", "shots"), os.path.join(HERE, "..", "measure")
OUT = os.path.join(HERE, "..", "W2-LIVE-CHART.png")
BG, INK, DIM, MUTE, CRK, BULL, BEAR, AMBER = "#0A0A0F", "#C8C8D8", "#868AAA", "#6E6E80", "#00D4FF", "#00FFA3", "#FF2D55", "#F2B33D"
MONO = "/System/Library/Fonts/Menlo.ttc"
F = lambda size: ImageFont.truetype(MONO, size)
prec = json.load(open(os.path.join(MEASURE, "w2-precision.json")))
live = json.load(open(os.path.join(MEASURE, "w2-live.json")))
# the TradingView reading: run 2's (w2-precision.json) when its newest bar matched one house bar exactly, else run 1's (the
# same harness 9 minutes earlier, w2-precision-run1.json), else the nearest house bar - said to be the nearest, never a match
run1_path = os.path.join(MEASURE, "w2-precision-run1.json")
prec1 = json.load(open(run1_path)) if os.path.exists(run1_path) else {"tv": {}}
def et_hhmm(iso):
    from datetime import datetime, timedelta, timezone
    t = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(timezone(timedelta(hours=-4)))
    return t.strftime("%H:%M")
def tv_reading(sym):
    for tag, src in (("run 2", prec), ("run 1", prec1)):
        t = src.get("tv", {}).get(sym) or {}
        if t.get("matchedHouseBar") and len(t["matchedHouseBar"]) == 1:
            return tag, t
    return "run 2", prec.get("tv", {}).get(sym) or {}
shot = lambda name: Image.open(os.path.join(SHOTS, name)).convert("RGB")

M, GAP, COLW = 28, 24, 1074
W = M * 2 + COLW * 2 + GAP
rows = [
    ("WIDGETS slot at 2560 x 1440 - 1074 x 756 - SPY 5m - the same moment", "live-v1 (this branch): the whole tape, live", "tv-v1 (W1): the free TradingView embed",
     "w2-slot-live-spy-1074x756.png", "w2-slot-tv-spy-1074x756.png"),
    ("WIDGETS slot at 1280 x 800 - 537 x 397 at dpr 2 (real pixels 1074 x 794) - SPY 5m", "live-v1", "tv-v1",
     "w2-slot-live-spy-537x397.png", "w2-slot-tv-spy-537x397.png"),
    ("the crosshair (price and time, O H L C V and both VWAPs of the bar under it) - and his clouds on 1D", "live-v1 - SPY 5m - crosshair", "live-v1 - SPY 1D - his clouds, chart-v1's drawing",
     "w2-live-spy-5m-crosshair.png", "w2-live-spy-1d-1074x756.png"),
    ("QQQ 5m - the same moment, both", "live-v1", "tv-v1", "w2-live-qqq-5m-1074x756.png", "w2-tv-qqq-5m-1074x756.png"),
    ("NVDA 5m - the same moment, both", "live-v1", "tv-v1", "w2-live-nvda-5m-1074x756.png", "w2-tv-nvda-5m-1074x756.png"),
]
imgs = [(r, shot(r[3]), shot(r[4])) for r in rows]
TABLE_H = 470
H = M + 60 + sum(52 + max(a.height, b.height) * COLW // max(a.width, b.width) + 26 for _, a, b in imgs) + TABLE_H + M
page = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(page)
y = M
d.text((M, y), "W2 - live-v1, the house live-bar chart, beside the TradingView embed", fill=INK, font=F(30))
d.text((M, y + 38), "branch station/w2-live-chart-20261022 - headless, real pixels - " + prec["at"][:16].replace("T", " ") + " UTC", fill=DIM, font=F(17))
y += 60
for (title, la, lb, *_), a, b in imgs:
    d.text((M, y + 14), title, fill=CRK, font=F(19))
    y += 52
    def put(img, x, label):
        s = COLW / img.width
        im = img.resize((COLW, round(img.height * s)), Image.LANCZOS) if img.width != COLW else img
        page.paste(im, (x, y))
        d.text((x, y + im.height + 4), label, fill=MUTE, font=F(15))
        return im.height
    ha = put(a, M, la); hb = put(b, M + COLW + GAP, lb)
    y += max(ha, hb) + 26

# the numbers, from ../measure (nothing typed in by hand)
d.text((M, y + 10), "MEASURED", fill=CRK, font=F(20)); y += 44
rowy = y
def line(text, color=INK, size=17):
    global rowy
    d.text((M, rowy), text, fill=color, font=F(size)); rowy += size + 9
for sym, r in prec["symbols"].items():
    s = r["summary"]
    line(f"{sym:5} last 10 completed 5m bars = the chart API's JSON: {s['barsEqual']}/{s['bars']}   readouts printed exactly: {s['readoutsEqual']}/{s['bars']}   "
         f"VWAP to the cent: 09:30 {s['vwap0930ToTheCent']}/10 · 04:00 {s['vwap0400ToTheCent']}/10 · 15:00-16:00 {s['regularSessionVwapToTheCent']}", BULL if s['barsEqual'] == s['bars'] else BEAR)
    tag, tv = tv_reading(sym)
    w = tv.get("widget") or {}
    if tv.get("matchedHouseBar") and len(tv["matchedHouseBar"]) == 1:
        mb, vw = tv["matchedHouseBar"][0], tv.get("vwapVsHouse0400") or {}
        line(f"      TradingView embed ({tag}, read {et_hhmm(tv['readAt'])} ET): its newest bar is the tape's {mb['et']} bar - {tv['minutesBehindClock']} min behind the clock; "
             f"its volume {round(w['v']):,} = {round(100 * tv['volumeShareOfTape'])} % of the tape's {mb['v']:,}; its VWAP {w['vwap']} vs the house 04:00 {vw.get('house')} ({vw.get('diff', 0):+.2f})", DIM, 16)
    elif tv.get("nearestHouseBarNotExact"):
        nb = tv["nearestHouseBarNotExact"]
        line(f"      TradingView embed ({tag}, read {et_hhmm(tv['readAt'])} ET): no house bar matched exactly; nearest is the {nb['et']} bar (O H L C off by {nb['ohlcDistance']}) - "
             f"{nb['minutesBehindClock']} min behind; its volume {round(w.get('v', 0)):,}", DIM, 16)
arr = {tf: c["arrivals"] for tf, c in live["charts"].items()}
lat = [a["secondsAfterClose"] for v in arr.values() for a in v]
line("")
line(f"LIVE ({live['calls']['minutes']} min, SPY 1m + 5m): {len(lat)} new bars reached the screen {min(lat):.1f}-{max(lat):.1f} s after their close" if lat else "LIVE: no bar closed in the window", AMBER)
per = live["calls"]["perMinutePerChart"]
line("      chart-API calls per chart per minute: " + " · ".join(f"{k} {v}" for k, v in per.items()), DIM, 16)
page = page.crop((0, 0, W, rowy + M))
page.save(OUT, optimize=True)
print(OUT, page.size)
