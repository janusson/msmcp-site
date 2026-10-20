#!/usr/bin/env python3
"""Regenerate public/og.png — the 1200x630 link-preview card.

Not part of the build: it runs by hand, only when the headline or the palette
changes, and the result is committed.  It exists so the card is not an opaque
binary that nobody can edit.

    pip install pillow
    INTER_TTF=/path/to/Inter.ttf python3 scripts/make-og-card.py

The card is a designed graphic.  Its spectrum motif is decorative, deliberately
unlabelled and not a plot of any dataset — the page's real figures are rendered
from tool output in src/components/IsotopeFigure.astro.
"""
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
HEADLINE = [
    "Ask your AI assistant about",
    "your mass spectrometry data.",
]
SUBLINE = [
    "An open-source MCP server that lets an AI assistant read your own",
    "mzML, MGF and imzML files — and compute on them locally.",
]
CHIPLINE = "13 TOOLS   ·   mzML · MGF · imzML   ·   LOCAL STDIO   ·   MIT"
EYEBROW = "OPEN-SOURCE MCP SERVER · MASS SPECTROMETRY"
FOOTER = "github.com/janusson/MSMCP"

# Path to Inter (variable TTF).  https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf
FONT = os.environ.get("INTER_TTF", "/root/work/Inter.ttf")

BG, LINE = (0x14, 0x17, 0x1A), (0x2B, 0x35, 0x40)
INK_SOFT, INK_MUTE = (0x9A, 0xA6, 0xAD), (0x7B, 0x87, 0x8E)
HEAD, ACC, ACC_DIM = (0xE3, 0xDC, 0xC4), (0x6F, 0xB3, 0xC9), (0x3C, 0x5F, 0x6D)


def font(size, weight="Regular"):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    return f


def spaced(draw, xy, text, fnt, fill, tracking=0.0):
    """Pillow has no letter-spacing; draw glyph by glyph."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking


def main():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    spaced(d, (72, 76), EYEBROW, font(16, "SemiBold"), ACC, 2.4)

    head = font(68, "Bold")
    for i, line in enumerate(HEADLINE):
        d.text((72, 120 + i * 78), line, font=head, fill=HEAD)

    for i, line in enumerate(SUBLINE):
        d.text((72, 300 + i * 36), line, font=font(26), fill=INK_SOFT)
    spaced(d, (72, 386), CHIPLINE, font(20, "Medium"), INK_MUTE, 1.2)

    # decorative spectrum motif
    base_y, top_y = 552, 452
    d.line([(0, base_y), (W, base_y)], fill=LINE, width=2)
    for i in range(46):
        h = 5 + int((((i * 37) % 53) / 52) ** 2.4 * (base_y - top_y))
        x = 72 + i * (1128 - 72) / 45
        d.line([(x, base_y), (x, base_y - h)], fill=ACC if h > 34 else ACC_DIM, width=3)

    mark = font(24, "Bold")
    d.text((72, 580), "MSMCP", font=mark, fill=ACC)
    d.text((72 + d.textlength("MSMCP", font=mark) + 22, 584), FOOTER, font=font(20), fill=INK_MUTE)
    d.rectangle([0, 0, W - 1, H - 1], outline=LINE, width=2)

    # Nothing may run past the border: fail loudly rather than shipping a clipped card.
    for line in HEADLINE:
        width = d.textlength(line, font=head)
        if width > W - 144:
            raise SystemExit(f"headline line too wide: {width:.0f}px > {W - 144}px -- {line!r}")
    for line in SUBLINE:
        width = d.textlength(line, font=font(26))
        if width > W - 144:
            raise SystemExit(f"subline too wide: {width:.0f}px > {W - 144}px -- {line!r}")

    out = os.path.join(os.path.dirname(__file__), "..", "public", "og.png")
    img.save(out, optimize=True)
    print(
        f"wrote {os.path.normpath(out)} "
        f"({img.size[0]}x{img.size[1]}, {os.path.getsize(out)} bytes)"
    )


if __name__ == "__main__":
    main()
