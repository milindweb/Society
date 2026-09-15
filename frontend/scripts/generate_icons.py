#!/usr/bin/env python3
"""generate_icons.py — build the app icon set from the society logo.

Source of truth: `logo.png` at the repository root (a 500x500 RGBA crest badge).
Outputs land in `frontend/public/`, which Vite copies verbatim to the site root:

    logo.png                 256x256  the in-app brand mark (header, login)
    favicon.ico              multi-resolution 16/32/48
    favicon-16x16.png        16x16
    favicon-32x32.png        32x32
    apple-touch-icon.png     180x180  composited on the badge's own navy
    icon-192.png             manifest, `purpose: any`
    icon-512.png             manifest, `purpose: any`
    icon-maskable-512.png    manifest, `purpose: maskable`, mark inset to 72%

`site.webmanifest` is hand-maintained and references the two manifest icons.

Two deliberate choices worth keeping:

* **Alpha is preserved** for the tab icons and the in-app mark. The crest is a
  navy disc on transparent corners, so it reads correctly on light *and* dark
  chrome — which matters because the app ships both themes.
* **`apple-touch-icon.png` is flattened onto navy.** iOS discards alpha and
  applies its own corner mask, so a transparent PNG would sit on black and the
  gold ring would disappear.

Assets at 128px and above are palette-quantised to 256 colours: ~5x smaller and
visually indistinguishable (mean channel delta ~1.4%) on this artwork. The small
favicons are left lossless — they are already ~1-3 KB.

Usage (from `frontend/`):

    python scripts/generate_icons.py

Requires Pillow:  pip install Pillow
"""

from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover - environment guard
    sys.exit("Pillow is required.  Install it with:  pip install Pillow")

HERE = Path(__file__).resolve()
FRONTEND = HERE.parents[1]
REPO_ROOT = HERE.parents[2]
SOURCE = REPO_ROOT / "logo.png"
OUT_DIR = FRONTEND / "public"

# Tile fill if the navy cannot be sampled from the artwork.
NAVY_FALLBACK = (1, 14, 35)

# Maskable icons must survive Android's crop, so the mark is inset.
MASKABLE_INSET = 0.72

# Palette-quantise at or above this size.
QUANTISE_AT = 128


def sample_navy(img: Image.Image) -> tuple[int, int, int]:
    """Return the badge's dominant dark colour, for use as a tile fill.

    Sampled rather than hardcoded so a restyled logo keeps a matching tile.
    Only opaque, dark pixels count — the transparent corners carry a meaningless
    RGB of (0,0,0), which would otherwise win the vote.
    """
    px = img.load()
    assert px is not None
    counts: Counter[tuple[int, int, int]] = Counter()
    step = max(1, img.width // 200)
    for y in range(0, img.height, step):
        for x in range(0, img.width, step):
            r, g, b, a = px[x, y]
            if a > 240 and r + g + b < 180:
                counts[(r, g, b)] += 1
    if not counts:
        return NAVY_FALLBACK
    return counts.most_common(1)[0][0]


def resized(img: Image.Image, size: int) -> Image.Image:
    """High-quality square downscale that preserves the alpha channel."""
    return img.resize((size, size), Image.LANCZOS)


def on_tile(img: Image.Image, size: int, bg: tuple[int, int, int], inset: float = 1.0) -> Image.Image:
    """Composite the mark onto a solid tile — for contexts that discard alpha."""
    canvas = Image.new("RGBA", (size, size), (*bg, 255))
    if inset < 1.0:
        inner = round(size * inset)
        canvas.alpha_composite(resized(img, inner), ((size - inner) // 2, (size - inner) // 2))
    else:
        canvas.alpha_composite(resized(img, size))
    return canvas


def for_web(im: Image.Image) -> Image.Image:
    """Palette-quantise large marks. Must stay in `P` mode to actually shrink.

    Converting back to RGBA afterwards would re-expand the palette and undo the
    saving — the PNG encoder only emits an indexed image for `P`-mode input.
    """
    if im.width < QUANTISE_AT:
        return im
    return im.quantize(colors=256, method=Image.FASTOCTREE)


def main() -> int:
    if not SOURCE.exists():
        print(f"error: source logo not found at {SOURCE}", file=sys.stderr)
        return 1

    img = Image.open(SOURCE).convert("RGBA")
    if img.width != img.height:
        print(f"  note: source is {img.width}x{img.height}; centring to a square")
        side = min(img.size)
        left, top = (img.width - side) // 2, (img.height - side) // 2
        img = img.crop((left, top, left + side, top + side))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    navy = sample_navy(img)
    written: list[tuple[str, int]] = []

    def save(im: Image.Image, name: str) -> None:
        path = OUT_DIR / name
        for_web(im).save(path, "PNG", optimize=True)
        written.append((name, path.stat().st_size))

    # In-app brand mark. 256 is crisp at the largest on-screen use (~128px @2x).
    save(resized(img, 256), "logo.png")

    # Browser tab icons — alpha kept so the crest sits on any tab colour.
    save(resized(img, 16), "favicon-16x16.png")
    save(resized(img, 32), "favicon-32x32.png")
    resized(img, 48).save(OUT_DIR / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    written.append(("favicon.ico", (OUT_DIR / "favicon.ico").stat().st_size))

    # iOS home-screen icon — alpha is discarded, so bake the navy tile in.
    save(on_tile(img, 180, navy), "apple-touch-icon.png")

    # PWA / Android manifest icons.
    save(resized(img, 192), "icon-192.png")
    save(resized(img, 512), "icon-512.png")
    save(on_tile(img, 512, navy, inset=MASKABLE_INSET), "icon-maskable-512.png")

    print(f"source : {SOURCE}  ({img.width}x{img.height})")
    print(f"tile   : #{navy[0]:02x}{navy[1]:02x}{navy[2]:02x}")
    print(f"output : {OUT_DIR}")
    for name, size in written:
        print(f"  {name:<24} {size / 1024:7.1f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
