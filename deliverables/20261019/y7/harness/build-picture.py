#!/usr/bin/env python3 -I
"""Y7: the pictures. Today (the live SHA, archived) beside the build, at each screen, with the YouTube pane's box, the
player's picture and the first tile printed on them; and the feed before (search rows marked) and after.
  python3 -I build-picture.py <shots dir> <measure dir> <out dir>"""
import json, sys, pathlib
from PIL import Image, ImageDraw, ImageFont
shots, measure, out = (pathlib.Path(a) for a in sys.argv[1:4]); out.mkdir(parents=True, exist_ok=True)
today = json.loads((measure / "today.json").read_text()); build = json.loads((measure / "build.json").read_text())
try: F = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 22); FS = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 17); FB = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 30)
except Exception: F = FS = FB = ImageFont.load_default()
CRK, VOL, INK, DIM, BG = (0, 212, 255), (255, 138, 0), (242, 242, 248), (134, 138, 170), (10, 10, 15)

def box_text(r): return "%d × %d px" % (r["w"], r["h"]) if r else "—"
def area_ratio(a, b):
    try: return "%.1f×" % ((b["w"] * b["h"]) / (a["w"] * a["h"]))
    except Exception: return "—"

def annotate(path, res, label, kind):
    im = Image.open(path).convert("RGB"); d = ImageDraw.Draw(im)
    deck = res.get("deckPlaying" if kind == "playing" else "deck") or {}; pane = res.get(kind if kind == "playing" else "pane") or {}
    v = deck.get("video")
    if v:
        d.rectangle([v["x"], v["y"], v["x"] + v["w"], v["y"] + v["h"]], outline=CRK, width=4)
        t = "YouTube pane " + box_text(v); d.rectangle([v["x"] + 6, v["y"] + 6, v["x"] + 6 + d.textlength(t, font=F) + 14, v["y"] + 40], fill=BG); d.text((v["x"] + 13, v["y"] + 10), t, font=F, fill=CRK)
        if kind == "playing" and pane.get("player"):
            p = pane["player"]; px, py = v["x"] + p["x"], v["y"] + p["y"]
            d.rectangle([px, py, px + p["w"], py + p["h"]], outline=VOL, width=3)
            t = "player box " + box_text(p); d.rectangle([px + 6, py + p["h"] - 40, px + 6 + d.textlength(t, font=F) + 14, py + p["h"] - 6], fill=BG); d.text((px + 13, py + p["h"] - 36), t, font=F, fill=VOL)
        if kind == "grid" and pane.get("tile"):
            tl = pane["tile"]; tx, ty = v["x"] + tl["x"], v["y"] + tl["y"]
            d.rectangle([tx, ty, tx + tl["w"], ty + tl["h"]], outline=VOL, width=3)
            t = "tile " + box_text(tl); d.rectangle([tx + 6, ty + tl["h"] - 40, tx + 6 + d.textlength(t, font=F) + 14, ty + tl["h"] - 6], fill=BG); d.text((tx + 13, ty + tl["h"] - 36), t, font=F, fill=VOL)
    x = deck.get("x")
    if x: d.rectangle([x["x"], x["y"], x["x"] + x["w"], x["y"] + x["h"]], outline=DIM, width=2)
    return im

def pair(key, kind):
    a, b = today["screens"].get(key, {}), build["screens"].get(key, {})
    pa, pb = shots / ("today-%s-%s.png" % (key, kind)), shots / ("build-%s-%s.png" % (key, kind))
    if not (pa.exists() and pb.exists()): return None
    A, B = annotate(pa, a, "today", kind), annotate(pb, b, "build", kind)
    W = A.width + B.width + 60; H = max(A.height, B.height) + 150
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    def line(res, k):
        deck = res.get("deckPlaying" if k == "playing" else "deck") or {}; pane = res.get(k if k == "playing" else "pane") or {}
        v = deck.get("video"); return ("pane %s · %s · charts on the wall %s · X %s · search tiles %s" % (box_text(v),
            ("player " + box_text(pane.get("player"))) if k == "playing" else ("tile " + box_text(pane.get("tile")) + " · " + str(pane.get("tilesVisible")) + " tiles in view"),
            deck.get("chartsShown"), box_text(deck.get("x")), pane.get("searchTiles")))
    va, vb = (a.get("deck") or {}).get("video"), (b.get("deck") or {}).get("video")
    d.text((20, 14), "Y7 · %s · %s · %s" % (key, (a.get("note") or ""), "player" if kind == "playing" else "grid"), font=FB, fill=INK)
    d.text((20, 60), "TODAY (live 180d125)  " + line(a, kind), font=FS, fill=DIM)
    d.text((20, 86), "BUILD (Y7 branch)     " + line(b, kind) + "   · pane area " + area_ratio(va, vb), font=FS, fill=CRK)
    im.paste(A, (20, 130)); im.paste(B, (A.width + 40, 130))
    d.text((20, 130 + A.height + 6), "today", font=F, fill=DIM); d.text((A.width + 40, 130 + B.height + 6), "build", font=F, fill=CRK)
    return im

sheets = []
for key in ["2560x1440", "1062x685"]:
    for kind in ["grid", "playing"]:
        im = pair(key, kind)
        if im: sheets.append(im)
if sheets:
    W = max(s.width for s in sheets); H = sum(s.height for s in sheets) + 10 * len(sheets)
    big = Image.new("RGB", (W, H), BG); y = 0
    for s in sheets: big.paste(s, (0, y)); y += s.height + 10
    big.save(out / "Y7-YOUTUBE-TODAY-VS-BUILD.png", optimize=True); print("wrote Y7-YOUTUBE-TODAY-VS-BUILD.png", big.size)
im = pair("1680x1050", "grid"); im2 = pair("1680x1050", "playing")
if im and im2:
    big = Image.new("RGB", (max(im.width, im2.width), im.height + im2.height + 10), BG); big.paste(im, (0, 0)); big.paste(im2, (0, im.height + 10))
    big.save(out / "Y7-YOUTUBE-TODAY-VS-BUILD-1680.png", optimize=True); print("wrote Y7-YOUTUBE-TODAY-VS-BUILD-1680.png", big.size)

# the feed itself: the SCINTILLA pane standalone, tall, at the width it has on the 2560 wall - today 614 px (search clips framed
# in orange and named SEARCH · ticker) beside the build at 1296 px
fa, fb = shots / "today-feed.png", shots / "build-feed.png"
if fa.exists() and fb.exists():
    ma, mb = json.loads((measure / "feed-today.json").read_text()), json.loads((measure / "feed-build.json").read_text())
    A, B = Image.open(fa).convert("RGB"), Image.open(fb).convert("RGB")
    im = Image.new("RGB", (A.width + B.width + 60, max(A.height, B.height) + 150), BG); d = ImageDraw.Draw(im)
    d.text((20, 14), "Y7 · the SCINTILLA feed on the Station · before and after (the pane at its 2560 × 1440 width, 1800 px tall)", font=FB, fill=INK)
    d.text((20, 60), "TODAY  lists %s · %s tiles loaded, %s of them search clips (no subscription account - framed, named SEARCH · ticker) · tile %s" % (ma["lists"], ma["tiles"], ma["search"], box_text(ma["tile"])), font=FS, fill=VOL)
    d.text((20, 86), "BUILD  lists %s · %s tiles loaded, %s of them search clips · tile %s · no MARKET SEARCH anywhere in the pane: %s" % (mb["lists"], mb["tiles"], mb["search"], box_text(mb["tile"]), not mb["menuHasMarket"]), font=FS, fill=CRK)
    im.paste(A, (20, 130)); im.paste(B, (A.width + 40, 130))
    d.text((20, 130 + A.height + 6), "today · ALL list (subscriptions + search clips)", font=F, fill=DIM); d.text((A.width + 40, 130 + B.height + 6), "build · SUBSCRIBED only", font=F, fill=CRK)
    im.save(out / "Y7-FEED-BEFORE-AFTER.png", optimize=True); print("wrote Y7-FEED-BEFORE-AFTER.png", im.size)
