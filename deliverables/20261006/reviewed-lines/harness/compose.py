#!/usr/bin/env python3
"""LB1 — put our Station picture beside the Lab's own Clean-pane screenshot (read from INDICATOR_LAB, never written).
usage: compose.py <ourPng> <labPng> <outPng> <caption-left> <caption-right>"""
import sys
from PIL import Image, ImageDraw

ours, lab, out, cl, cr = sys.argv[1:6]
a = Image.open(ours).convert("RGB")
b = Image.open(lab).convert("RGB")
H = 900
a = a.resize((round(a.width * H / a.height), H))
b = b.resize((round(b.width * H / b.height), H))
pad, cap = 24, 44
canvas = Image.new("RGB", (a.width + b.width + 3 * pad, H + cap + 2 * pad), (7, 31, 36))
canvas.paste(a, (pad, pad + cap))
canvas.paste(b, (2 * pad + a.width, pad + cap))
d = ImageDraw.Draw(canvas)
d.text((pad, pad + 8), cl, fill=(143, 190, 187))
d.text((2 * pad + a.width, pad + 8), cr, fill=(143, 190, 187))
canvas.save(out)
print(out, canvas.size)
