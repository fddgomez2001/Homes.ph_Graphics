"""Android launcher icons and launch screens from public/brand/app-icon-512.png.

Run from the project root after `npx cap add android`:  python scripts/android-assets.py
"""
import glob
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
DARK = (10, 15, 28, 255)  # #0a0f1c, the app's dark background

logo = Image.open(os.path.join(ROOT, "public", "brand", "app-icon-512.png")).convert("RGBA")
# The artwork is the H on a white tile: keep only the H (white becomes transparent, edges stay smooth).
pixels = logo.load()
for y in range(logo.height):
    for x in range(logo.width):
        r, g, b_, a = pixels[x, y]
        whiteness = min(r, g, b_)
        if whiteness > 200:
            # Fade the anti-aliased rim between the H and the white tile.
            keep = max(0, 255 - whiteness) / 55
            pixels[x, y] = (r, g, b_, round(a * min(1, keep)))
logo = logo.crop(logo.split()[3].point(lambda v: 255 if v > 24 else 0).getbbox())


def placed(size, fraction, background=(0, 0, 0, 0)):
    """The logo centered on a square canvas, its longer side `fraction` of the canvas."""
    canvas = Image.new("RGBA", (size, size), background)
    scale = size * fraction / max(logo.size)
    art = logo.resize((max(1, round(logo.width * scale)), max(1, round(logo.height * scale))), Image.LANCZOS)
    canvas.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return canvas


def masked(image, shape):
    """Supersampled rounded-square or circle mask."""
    size = image.width
    big = size * 4
    mask = Image.new("L", (big, big), 0)
    draw = ImageDraw.Draw(mask)
    if shape == "circle":
        draw.ellipse((0, 0, big - 1, big - 1), fill=255)
    else:
        draw.rounded_rectangle((0, 0, big - 1, big - 1), radius=big * 0.22, fill=255)
    out = image.copy()
    out.putalpha(mask.resize((size, size), Image.LANCZOS))
    return out


DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for name, factor in DENSITIES.items():
    folder = os.path.join(RES, f"mipmap-{name}")
    # Adaptive icon layers are 108dp; the logo stays inside the 66dp safe circle.
    fg = round(108 * factor)
    placed(fg, 0.42).save(os.path.join(folder, "ic_launcher_foreground.png"))
    mono = placed(fg, 0.42)
    mono.putalpha(mono.split()[3])
    white = Image.new("RGBA", mono.size, (255, 255, 255, 255))
    white.putalpha(mono.split()[3])
    white.save(os.path.join(folder, "ic_launcher_monochrome.png"))
    # Legacy icons (48dp) for launchers without adaptive icons.
    legacy = round(48 * factor)
    tile = placed(legacy, 0.62, (255, 255, 255, 255))
    masked(tile, "rounded").save(os.path.join(folder, "ic_launcher.png"))
    masked(tile, "circle").save(os.path.join(folder, "ic_launcher_round.png"))

with open(os.path.join(RES, "mipmap-anydpi-v26", "ic_launcher.xml"), "w", encoding="utf8", newline="\n") as f:
    f.write(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n'
        "</adaptive-icon>\n"
    )
round_xml = os.path.join(RES, "mipmap-anydpi-v26", "ic_launcher_round.xml")
if os.path.exists(round_xml):
    with open(round_xml, "w", encoding="utf8", newline="\n") as f:
        f.write(open(os.path.join(RES, "mipmap-anydpi-v26", "ic_launcher.xml"), encoding="utf8").read())
with open(os.path.join(RES, "values", "ic_launcher_background.xml"), "w", encoding="utf8", newline="\n") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>\n')

# Launch screens (Android 10/11; 12+ shows the icon on the dark background).
for path in glob.glob(os.path.join(RES, "drawable*", "splash.png")):
    width, height = Image.open(path).size
    screen = Image.new("RGBA", (width, height), DARK)
    side = round(min(width, height) * 0.28)
    tile = masked(placed(side, 0.62, (255, 255, 255, 255)), "rounded")
    screen.alpha_composite(tile, ((width - side) // 2, (height - side) // 2))
    screen.convert("RGB").save(path)

print("icons and launch screens written")
