#!/bin/sh
# Regenerates the iOS and Android app icons from assets/brand/app-icon.svg.
# The SVG itself is generated: python3 scripts/app-icon-svg.py assets/brand/app-icon.svg
# Needs Google Chrome (renders the SVG) and Python 3 with Pillow (resizes).
set -e
here=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
printf '<html><body style="margin:0">%s</body></html>' "$(cat "$here/assets/brand/app-icon.svg")" > "$work/icon.html"
"$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1024,1024 --screenshot="$work/icon-1024.png" "file://$work/icon.html" 2>/dev/null
python3 - "$work/icon-1024.png" "$here" <<'PY'
import json, os, sys
from PIL import Image, ImageDraw
master = Image.open(sys.argv[1]).convert("RGB")  # iOS rejects icons with alpha
root = sys.argv[2]

ios = os.path.join(root, "ios/FutCareer/Images.xcassets/AppIcon.appiconset")
contents = json.load(open(os.path.join(ios, "Contents.json")))
for image in contents["images"]:
    points = float(image["size"].split("x")[0])
    px = round(points * int(image["scale"][0]))
    name = "AppIcon-%s@%s.png" % (image["size"].split("x")[0], image["scale"])
    master.resize((px, px), Image.LANCZOS).save(os.path.join(ios, name), optimize=True)
    image["filename"] = name
json.dump(contents, open(os.path.join(ios, "Contents.json"), "w"), indent=2)

def masked(size, shape):
    icon = master.resize((size, size), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (size * 4, size * 4), 0)
    draw = ImageDraw.Draw(mask)
    if shape == "round":
        draw.ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    else:
        draw.rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=size * 4 // 5, fill=255)
    icon.putalpha(mask.resize((size, size), Image.LANCZOS))
    return icon

for folder, size in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    res = os.path.join(root, "android/app/src/main/res/mipmap-" + folder)
    masked(size, "square").save(os.path.join(res, "ic_launcher.png"), optimize=True)
    masked(size, "round").save(os.path.join(res, "ic_launcher_round.png"), optimize=True)
print("app icons written")
PY
