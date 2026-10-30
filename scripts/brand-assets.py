"""Build web renditions of the Trunk brand masters (run once after the masters change).

    python3 scripts/brand-assets.py

Reads public/brand/trunk-logo.png and trunk-icon.png (the unchanged masters from
the brand kit) and writes small renditions to public/brand/web/. Proportions and
transparency are kept; nothing is redrawn. Requires Pillow.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'public' / 'brand'
OUT = SRC / 'web'
OUT.mkdir(exist_ok=True)


def save(img: Image.Image, name: str, colors: int = 128) -> None:
    # Palette PNG with alpha: much smaller than RGBA, visually identical for flat two-colour art.
    q = img.quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    path = OUT / name
    q.save(path, optimize=True)
    print(f'{name}: {img.size[0]}x{img.size[1]}, {path.stat().st_size} bytes')


logo = Image.open(SRC / 'trunk-logo.png').convert('RGBA')
for w in (168, 336, 504):
    h = round(w * logo.height / logo.width)
    save(logo.resize((w, h), Image.Resampling.LANCZOS), f'trunk-logo-{w}.png')

icon = Image.open(SRC / 'trunk-icon.png').convert('RGBA')
for s in (32, 48, 192, 512):
    save(icon.resize((s, s), Image.Resampling.LANCZOS), f'trunk-icon-{s}.png')

# Apple touch icon: iOS fills transparency with black, so use the white canvas the kit specifies.
touch = Image.new('RGBA', (180, 180), (255, 255, 255, 255))
mark = icon.resize((168, 168), Image.Resampling.LANCZOS)
touch.alpha_composite(mark, (6, 6))
save(touch.convert('RGB').convert('RGBA'), 'trunk-icon-180.png')
