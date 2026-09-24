#!/usr/bin/env bash
# Renders each illustration HTML to a PNG next to docs/img. Headless Chrome at 1400px logical width, 2x.
set -e
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for f in social-preview workflow screen-anatomy lint-catches three-doors import-path; do
  h=3000; [ "$f" = social-preview ] && h=700
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars --force-device-scale-factor=2 \
    --screenshot="../$f.png" --window-size=1400,$h --default-background-color=FFFFFF "file://$PWD/$f.html" 2>/dev/null
  python3 - "../$f.png" <<'PY'
import sys
from PIL import Image, ImageChops
p=sys.argv[1]; im=Image.open(p).convert('RGB')
if 'social-preview' not in p:
    bg=Image.new('RGB', im.size, (255,255,255)); box=ImageChops.difference(im,bg).getbbox()
    if box: im=im.crop((0,0,im.width,min(im.height, box[3]+60)))
im.save(p, optimize=True); print(p, im.size)
PY
done
