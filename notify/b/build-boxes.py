#!/usr/bin/env python3
"""19 Nov 2026 (coordinator). Builds the iPhone's notification boxes: one Home Screen web app per box under /notify/b/<box>/.
Alan, 12:33 ET (relayed): "what are we gonna do about the notification center on the phone, buddy?" - the Macs file alerts in topic
boxes; a Home Screen web app gets one stack per app on iOS, so each phone box is its own little app: its own stack in Notification
Center, its own name on every alert, its own on/off switch in iPhone Settings. The database decides which box an alert belongs to
(public.phone_box over public.notify_topic); notify-push sends it to that box's apps. Run from the repo root: python3 notify/b/build-boxes.py
Writes, per box: index.html, manifest.webmanifest, icon-192.png, icon-512.png, apple-touch-icon.png, card.html; and the shared push-sw.js."""
import json, os, re
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
NOTIFY = os.path.dirname(HERE)
BOXES = [
    # id, name on the page, name under the icon and on every alert, colour, what it holds
    ("markets", "Markets", "SC Markets", "#00D4FF", "Market and company news on your names, the fast headlines, analyst ratings and the situation monitor."),
    ("press", "Press releases", "SC Press", "#B8BCD6", "Company press releases from the wires."),
    ("earnings", "Earnings & Fed", "SC Earnings", "#FAB219", "Earnings results and call transcripts, the Fed, economic releases (CPI, jobs, GDP) and macro news."),
    ("research", "Research & video", "SC Research", "#00FFA3", "The research desk (ANT watch, price and stockpile watches, market reads, Texas power) and new videos."),
    ("urth", "Urth & system", "SC Urth", "#8FE3A0", "Urth crew and weather alerts, and Scintilla's own notices."),
]
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

def icon(box_word, colour, size):
    """the Scintilla logo with a band in the box's colour carrying the box's word, so the five icons tell themselves apart"""
    logo = Image.open(os.path.join(NOTIFY, "icon-512.png")).convert("RGBA").resize((size, size), Image.LANCZOS)
    im = Image.new("RGBA", (size, size), (10, 10, 15, 255)); im.alpha_composite(logo)
    band = int(size * 0.27); d = ImageDraw.Draw(im)
    d.rectangle([0, size - band, size, size], fill=colour)
    f = ImageFont.truetype(FONT, int(band * 0.52)); w = d.textlength(box_word, font=f)
    while w > size * 0.9: f = ImageFont.truetype(FONT, f.size - 2); w = d.textlength(box_word, font=f)
    d.text(((size - w) / 2, size - band + (band - f.size) / 2 - f.size * 0.08), box_word, font=f, fill=(10, 10, 15, 255))
    return im.convert("RGB")

PAGE = open(os.path.join(HERE, "box.template.html")).read()
CARD = open(os.path.join(NOTIFY, "card.html")).read()

for bid, name, short, colour, holds in BOXES:
    out = os.path.join(HERE, bid); os.makedirs(out, exist_ok=True); scope = "/notify/b/" + bid + "/"
    word = {"markets": "MARKETS", "press": "PRESS", "earnings": "EARNINGS", "research": "RESEARCH", "urth": "URTH"}[bid]
    for sz, fn in ((512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png")): icon(word, colour, sz).save(os.path.join(out, fn), optimize=True)
    json.dump({"id": scope, "name": "Scintilla " + name, "short_name": short, "start_url": scope, "scope": scope, "display": "standalone",
               "background_color": "#0A0A0F", "theme_color": "#0A0A0F",
               "icons": [{"src": scope + "icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": scope + "icon-512.png", "sizes": "512x512", "type": "image/png"}]},
              open(os.path.join(out, "manifest.webmanifest"), "w"))
    page = (PAGE.replace("{{BOX}}", bid).replace("{{NAME}}", name).replace("{{SHORT}}", short).replace("{{COLOUR}}", colour)
                .replace("{{HOLDS}}", holds).replace("{{SCOPE}}", scope))
    open(os.path.join(out, "index.html"), "w").write(page)
    # the tapped alert's page, the same as the all-in-one app's, but its way back is this box
    card = CARD.replace('href="/notify/icon-192.png"', 'href="' + scope + 'icon-192.png"').replace('href="/notify/">All alerts</a>', 'href="' + scope + '">' + name + "</a>")
    card = card.replace('history.replaceState(null, "", "/notify/")', 'history.replaceState(null, "", "' + scope + '")').replace('location.replace("/notify/")', 'location.replace("' + scope + '")')
    assert card.count(scope) >= 4, bid + ": card.html did not take the box's way back"
    open(os.path.join(out, "card.html"), "w").write(card)
    print("built", scope)
