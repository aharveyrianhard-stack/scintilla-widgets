# W9: today (52b730d, what the Station serves) beside the branch, tonight and at 9:01 am ET, from shots/*.png.
#   python3 build-picture.py <w9 dir>   (needs Pillow)
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

D = os.path.abspath(sys.argv[1])
SHOTS, MEASURE = os.path.join(D, "shots"), os.path.join(D, "measure")
ROWS = [("now", "TONIGHT · Fri 23 Oct 00:12 ET (the real clock; just past midnight, so these are today's streams)"), ("0901", "FRI 23 OCT 9:01 am ET (page clock fixed; the table as it is at 00:12)")]
COLS = [("today", "TODAY · 52b730d (served now)"), ("build", "W9 BRANCH")]
CROP_H = 640
def font(size):
    for p in ("/System/Library/Fonts/Menlo.ttc", "/System/Library/Fonts/SFNSMono.ttf", "/Library/Fonts/Arial.ttf"):
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except Exception: pass
    return ImageFont.load_default()
F_HEAD, F_ROW, F_NOTE = font(26), font(20), font(17)
shots = {(r, c): Image.open(os.path.join(SHOTS, f"{c}-{r}.png")).convert("RGB") for r, _ in ROWS for c, _ in COLS}
w = max(im.width for im in shots.values())
PAD, HEAD, ROWHEAD, NOTE = 24, 70, 44, 64
W = PAD + len(COLS) * (w + PAD)
H = HEAD + len(ROWS) * (ROWHEAD + CROP_H + NOTE + PAD) + PAD
out = Image.new("RGB", (W, H), (8, 8, 14))
g = ImageDraw.Draw(out)
g.text((PAD, 20), "W9 · the Station's SCINTILLA YouTube feed: tomorrow's scheduled streams, live tables, read only", fill=(235, 235, 245), font=F_HEAD)
y = HEAD
for r, rlabel in ROWS:
    g.text((PAD, y + 8), rlabel, fill=(0, 212, 255), font=F_ROW)
    y += ROWHEAD
    for i, (c, clabel) in enumerate(COLS):
        x = PAD + i * (w + PAD)
        im = shots[(r, c)].crop((0, 0, shots[(r, c)].width, min(CROP_H, shots[(r, c)].height)))
        out.paste(im, (x, y))
        g.rectangle((x - 1, y - 1, x + im.width, y + im.height), outline=(60, 60, 80), width=2)
        m = json.load(open(os.path.join(MEASURE, f"{c}-{r}.json")))
        first = [t["badge"] + (" (due)" if t.get("due") else "") for t in m["first"][:5]]
        g.text((x, y + CROP_H + 8), clabel, fill=(255, 255, 255), font=F_ROW)
        g.text((x, y + CROP_H + 34), "tiles 1-5: " + " · ".join(first), fill=(190, 190, 205), font=F_NOTE)
    y += CROP_H + NOTE + PAD
out.save(os.path.join(D, "W9-LIVE-AT-THEIR-TIME.png"), optimize=True)
print("wrote", os.path.join(D, "W9-LIVE-AT-THEIR-TIME.png"), out.size)
