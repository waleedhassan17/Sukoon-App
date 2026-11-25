#!/usr/bin/env python3
"""
Regenerate every Sukoon brand image from the one master logo.

    python3 tools/brand-assets.py           # write assets/images/*
    python3 tools/brand-assets.py --check   # measure and report only

Master: assets/brand/sukoon-logo.png — the heart-and-flowers mark on a flat
forest green (#1F3621). Keep that file untouched; change the logo by replacing
it and re-running this script.

Quality rules (the logo must look exactly as designed, at every size):
  * Downscale only, always with Lanczos, always to lossless PNG.
  * Colour assets never matte or recolour the artwork: they place the master on
    a canvas of its own background colour, so the seam is invisible and every
    artwork pixel is just resampled.
  * Single-colour assets (share mark, notification icon, Android themed icon)
    use a coverage mask taken from each pixel's colour distance to the
    background. The thin green lines inside the drawing become cut-outs, which
    keeps the veins and petals readable in a silhouette.

After running, `npx expo prebuild --platform android --no-install` copies the
new icons into android/ (EAS builds from that folder while it exists).
"""

import math
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.join(ROOT, 'assets', 'brand', 'sukoon-logo.png')
OUT = os.path.join(ROOT, 'assets', 'images')

BG = (0x1F, 0x36, 0x21)  # the master's own background; app.json + SukoonSplash use it too
RAMP = (8.0, 48.0)       # colour distance: <= 8 is background, >= 48 is solid artwork
ADAPTIVE_RADIUS = 0.28   # artwork radius / canvas; Android's 66 dp safe circle is 0.3056
SPLASH_MARGIN = 1.03     # breathing room so Android 12's circular splash mask never clips
LANCZOS = Image.Resampling.LANCZOS


def coverage_mask(img):
    """'L' image: 0 on the background, 255 on solid artwork, a ramp in between."""
    lo, hi = RAMP
    out = bytearray(img.width * img.height)
    for i, (r, g, b) in enumerate(img.getdata()):
        d = math.sqrt((r - BG[0]) ** 2 + (g - BG[1]) ** 2 + (b - BG[2]) ** 2)
        out[i] = 0 if d <= lo else 255 if d >= hi else round((d - lo) / (hi - lo) * 255)
    return Image.frombytes('L', img.size, bytes(out))


def art_geometry(mask):
    """Centre of the artwork's bounding box and its furthest covered pixel from it."""
    x0, y0, x1, y1 = mask.point(lambda a: 255 if a > 127 else 0).getbbox()
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    w = mask.width
    radius = 0.0
    for i, a in enumerate(mask.getdata()):
        if a:
            radius = max(radius, math.hypot(i % w + 0.5 - cx, i // w + 0.5 - cy))
    return (x0, y0, x1, y1), cx, cy, radius


def frame(img, fill, cx, cy, side, size):
    """Square of `side` source px centred on (cx, cy), resampled to `size` px.
    Anything outside the master is filled with `fill` (the background)."""
    half = side / 2
    pad = max(0, math.ceil(max(half - cx, half - cy, cx + half - img.width, cy + half - img.height))) + 2
    canvas = Image.new(img.mode, (img.width + 2 * pad, img.height + 2 * pad), fill)
    canvas.paste(img, (pad, pad))
    box = (cx + pad - half, cy + pad - half, cx + pad + half, cy + pad + half)
    return canvas.resize((size, size), LANCZOS, box=box)


def silhouette(alpha):
    """White RGBA whose alpha is the coverage mask (tintable, Android-safe)."""
    white = Image.new('RGBA', alpha.size, (255, 255, 255, 0))
    white.putalpha(alpha)
    return white


def mean_rgb(img):
    px = list(img.convert('RGB').getdata())
    n = len(px)
    return tuple(sum(p[c] for p in px) / n for c in range(3))


def main():
    check_only = '--check' in sys.argv
    master = Image.open(MASTER).convert('RGB')
    if master.width != master.height:
        sys.exit(f'master must be square, got {master.size}')

    edge = master.crop((0, 0, master.width, 40))
    edge_mean = mean_rgb(edge)
    seam = max(abs(edge_mean[c] - BG[c]) for c in range(3))
    if seam > 3:
        sys.exit(f'master background {edge_mean} is not {BG}; update BG before regenerating')

    mask = coverage_mask(master)
    bbox, cx, cy, radius = art_geometry(mask)
    bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    print(f'master {master.size}  art bbox {bbox} ({bw}x{bh})  centre ({cx:.1f}, {cy:.1f})  radius {radius:.1f}px')
    print(f'background seam: master edge mean {tuple(round(v, 2) for v in edge_mean)} vs fill {BG} -> {seam:.2f} levels')

    adaptive_side = radius / ADAPTIVE_RADIUS
    splash_side = 2 * radius * SPLASH_MARGIN
    tight_side = max(bw, bh) * 1.03
    notif_side = max(bw, bh) / 0.875  # artwork spans 21 of the icon's 24 dp

    outputs = {
        # iOS / legacy Android / store: the composition exactly as supplied.
        'icon.png': master.resize((1024, 1024), LANCZOS),
        # Android adaptive foreground: artwork inside the safe circle, opaque.
        'adaptive-icon.png': frame(master, BG, cx, cy, adaptive_side, 1024),
        # Android 13+ themed icon: same geometry, alpha only.
        'adaptive-icon-monochrome.png': silhouette(frame(mask, 0, cx, cy, adaptive_side, 1024)),
        # Native splash + SukoonSplash overlay: drawn on the same green.
        'splash-icon.png': frame(master, BG, cx, cy, splash_side, 720),
        # Share card footer: tinted with the card theme's brand colour.
        'share-mark.png': silhouette(frame(mask, 0, cx, cy, tight_side, 128)),
        # Android status-bar icon: must be white on transparent.
        'notification-icon.png': silhouette(frame(mask, 0, cx, cy, notif_side, 96)),
        'favicon.png': master.resize((192, 192), LANCZOS),
    }

    for name, img in outputs.items():
        alpha = img.getchannel('A').getextrema() if img.mode == 'RGBA' else 'opaque'
        print(f'  {name:30s} {img.size[0]}x{img.size[1]} {img.mode:4s} alpha={alpha}')
        if not check_only:
            img.save(os.path.join(OUT, name), optimize=True)

    # ── Fidelity checks ──
    icon_shift = max(abs(a - b) for a, b in zip(mean_rgb(outputs['icon.png']), mean_rgb(master)))
    print(f'colour shift icon.png vs master (mean RGB): {icon_shift:.2f} levels')

    mono = outputs['adaptive-icon-monochrome.png'].getchannel('A')
    c = (mono.width - 1) / 2
    w = mono.width
    reach = max(math.hypot(i % w - c, i // w - c) for i, a in enumerate(mono.getdata()) if a)
    safe = 1024 * 33 / 108
    print(f'adaptive artwork reach {reach:.1f}px  (safe circle {safe:.1f}px)  {"OK" if reach <= safe else "TOO BIG"}')

    splash_mask = frame(mask, 0, cx, cy, splash_side, 720)
    sw = splash_mask.width
    sc = (sw - 1) / 2
    s_reach = max(math.hypot(i % sw - sc, i // sw - sc) for i, a in enumerate(splash_mask.getdata()) if a)
    print(f'splash artwork reach {s_reach:.1f}px of inscribed circle {sw / 2:.1f}px  {"OK" if s_reach <= sw / 2 else "CLIPS"}')

    if check_only:
        print('(--check: nothing written)')


if __name__ == '__main__':
    main()
