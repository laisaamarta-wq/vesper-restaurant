"""Photographic finish for generated stills: open shadows a touch, take off
AI micro-contrast, add fine luminance grain. Usage: photofinish.py in out [lift]"""
import sys, numpy as np
from PIL import Image, ImageFilter
src, dst = sys.argv[1], sys.argv[2]
lift = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
im = Image.open(src).convert('RGB')
w, h = im.size
# soften: blend with a slightly blurred copy (kills crunchy edges, keeps detail)
soft = im.filter(ImageFilter.GaussianBlur(radius=max(1.0, w / 3200)))
a = np.asarray(im, dtype=np.float32) / 255
b = np.asarray(soft, dtype=np.float32) / 255
x = a * 0.55 + b * 0.45
# exposure: lift mids/shadows with a gentle curve, keep highlights
if lift:
    x = 1 - (1 - x) ** (1 + lift)
# grain: luminance-only, slightly clumped
rng = np.random.default_rng(7)
g = rng.normal(0, 1, (h // 2 + 1, w // 2 + 1)).astype(np.float32)
g = np.asarray(Image.fromarray(g).resize((w, h), Image.BILINEAR))[:h, :w]
lum = x.mean(axis=2, keepdims=True)
amt = 0.022 * (1 - np.abs(lum - 0.45) * 1.2).clip(0.25, 1)
x = (x + g[..., None] * amt).clip(0, 1)
Image.fromarray((x * 255 + 0.5).astype(np.uint8)).save(dst)
print(dst, im.size)
