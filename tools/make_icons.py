#!/usr/bin/env python3
"""Build PWA icons from the round TRITON logo.
Usage: python3 tools/make_icons.py <logo.jpg|png> [--preview out.png]
Finds the coloured circle on the dark background, crops it to a perfect circle and writes
public/icons: icon-192/512 (round, transparent), maskable-192/512 (circle inside the 80% safe zone
on the logo's own dark background), apple-touch-icon.png (180), favicon-32.png, favicon.ico, logo-256.png."""
import sys, os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

src = sys.argv[1]
prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'icons')
os.makedirs(out, exist_ok=True)

im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(np.int16)
h, w, _ = a.shape
# background colour = median of a thin border
border = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
bg = tuple(int(x) for x in np.median(border, axis=0))
# pixels clearly different from the background belong to the circle (pink/purple gradient)
diff = np.abs(a - np.array(bg)).sum(axis=2)
mask = diff > 90
ys, xs = np.nonzero(mask)
if len(xs) < 100:
    sys.exit('circle not found')
# robust bounds (ignore stray specks)
x0, x1 = np.percentile(xs, [0.2, 99.8]); y0, y1 = np.percentile(ys, [0.2, 99.8])
cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
r = max(x1 - x0, y1 - y0) / 2 * 1.01
box = (int(round(cx - r)), int(round(cy - r)), int(round(cx + r)), int(round(cy + r)))
pad = Image.new('RGB', (w + 4 * int(r), h + 4 * int(r)), bg)
off = 2 * int(r)
pad.paste(im, (off, off))
sq = pad.crop((box[0] + off, box[1] + off, box[2] + off, box[3] + off))
S = 1024
sq = sq.resize((S, S), Image.LANCZOS)

def circle_mask(size, scale=4):
    m = Image.new('L', (size * scale, size * scale), 0)
    ImageDraw.Draw(m).ellipse((0, 0, size * scale - 1, size * scale - 1), fill=255)
    return m.resize((size, size), Image.LANCZOS)

def round_icon(size):
    c = sq.resize((size, size), Image.LANCZOS).convert('RGBA')
    c.putalpha(circle_mask(size))
    return c

def on_bg(size, frac):
    base = Image.new('RGBA', (size, size), bg + (255,))
    d = int(round(size * frac)); o = (size - d) // 2
    base.alpha_composite(round_icon(d), (o, o))
    return base

files = {}
for s in (192, 512):
    files[f'icon-{s}.png'] = round_icon(s)
    files[f'maskable-{s}.png'] = on_bg(s, 0.80)   # inside the 80% safe-zone circle
files['apple-touch-icon.png'] = on_bg(180, 0.92).convert('RGB')
files['favicon-32.png'] = round_icon(32)
files['logo-256.png'] = round_icon(256)
for n, img in files.items():
    img.save(os.path.join(out, n), optimize=True)
round_icon(48).save(os.path.join(out, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
with open(os.path.join(out, 'bg.txt'), 'w') as f:
    f.write('#%02x%02x%02x' % bg)
print('bg #%02x%02x%02x' % bg, 'circle', box, 'files', len(files) + 1)

if prev:
    W = 1100; P = Image.new('RGB', (W, 420), (24, 24, 30)); dr = ImageDraw.Draw(P)
    x = 20
    for n, sz in (('icon-512.png', 220), ('maskable-512.png', 220), ('apple-touch-icon.png', 180), ('icon-192.png', 96), ('favicon-32.png', 32)):
        ic = Image.open(os.path.join(out, n)).convert('RGBA').resize((sz, sz), Image.LANCZOS)
        P.paste(ic, (x, 40), ic); dr.text((x, 40 + sz + 10), n, fill=(220, 220, 220)); x += sz + 30
    # Android mask simulation (circle and squircle crop of the maskable icon)
    m = Image.open(os.path.join(out, 'maskable-512.png')).convert('RGBA').resize((150, 150), Image.LANCZOS)
    cm = circle_mask(150); mm = Image.new('RGBA', (150, 150)); mm.paste(m, (0, 0), cm)
    P.paste(mm, (20, 330 - 60), mm); dr.text((180, 330), 'maskable under Android circle mask', fill=(220, 220, 220))
    P.save(prev); print('preview', prev)
