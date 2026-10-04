"""
VESPER asset pipeline
raw/<name>.(png|jpg)  →  assets/web/<name>-<w>.webp  (+ dish cut-out, depth map, thumbs, og)

usage:  python3 tools/process.py            (all)
        python3 tools/process.py dish       (only the dish)
"""
import sys, json, os
from pathlib import Path
import numpy as np
import cv2
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets/raw"
WEB = ROOT / "assets/web"
WEB.mkdir(parents=True, exist_ok=True)

WIDE = {  # full-bleed images: 960 / 1920 / 2880
    "exterior-blue-hour": (960, 1920, 2880),
    "entrance-door": (1280, 1920, 2880, 3840),
    "interior-main": (960, 1920, 2880),
    "table-signature": (960, 1920, 2880),
    "table-candle-detail": (960, 1920),
    "exterior-night": (960, 1920, 2880),
}
PORTRAIT = {  # editorial 4:5
    "bar": (800, 1200, 1800),
    "kitchen-hearth": (800, 1200, 1800),
}
THUMBS = ["dish-beetroot", "dish-duck", "dish-dessert"]


def find(name):
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        p = RAW / (name + ext)
        if p.exists():
            return p
    return None


def save_webp(im, path, q=82):
    im.save(path, "WEBP", quality=q, method=6)


def resize_w(im, w):
    if im.width <= w:
        return im.copy()
    h = round(im.height * w / im.width)
    return im.resize((w, h), Image.LANCZOS)


def crop_ratio(im, rw, rh):
    W, H = im.size
    if W / H > rw / rh:
        nw = round(H * rw / rh); x = (W - nw) // 2
        return im.crop((x, 0, x + nw, H))
    nh = round(W * rh / rw); y = (H - nh) // 2
    return im.crop((0, y, W, y + nh))


def wide():
    for name, sizes in WIDE.items():
        p = find(name)
        if not p: print("missing", name); continue
        im = Image.open(p).convert("RGB")
        for w in sizes:
            save_webp(resize_w(im, w), WEB / f"{name}-{w}.webp", 80 if w > 2000 else 82)
        print(name, im.size)
    for name, sizes in PORTRAIT.items():
        p = find(name)
        if not p: print("missing", name); continue
        im = crop_ratio(Image.open(p).convert("RGB"), 4, 5)
        for w in sizes:
            save_webp(resize_w(im, w), WEB / f"{name}-{w}.webp")
        print(name, im.size)
    for name in THUMBS:
        p = find(name)
        if not p: print("missing", name); continue
        im = crop_ratio(Image.open(p).convert("RGB"), 4, 5)
        save_webp(resize_w(im, 480), WEB / f"{name}-thumb.webp", 84)
        print(name, im.size)
    p = find("exterior-blue-hour")
    if p:
        og = crop_ratio(Image.open(p).convert("RGB"), 1200, 630).resize((1200, 630), Image.LANCZOS)
        og.save(WEB / "og.jpg", quality=86)


def dish():
    """Cut the plate out of the table photograph (same pixels → seamless lift),
    then build a depth map: plate well low, rim raised, food highest."""
    p = find("table-signature")
    if not p: print("missing table-signature"); return
    src = Image.open(p).convert("RGB")
    S = 2880 / src.width
    if abs(S - 1) > .01:
        src = src.resize((2880, round(src.height * S)), Image.LANCZOS)
    a = np.asarray(src).astype(np.float32) / 255
    H, W = a.shape[:2]

    hint = json.load(open(ROOT / "tools/plate.json")) if (ROOT / "tools/plate.json").exists() else None

    hsv = cv2.cvtColor((a * 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    lum = a.mean(axis=2)
    if hint and "ellipse" in hint:
        (cx, cy), (ew, eh), ang = hint["ellipse"]
        cx *= W; cy *= H; ew *= W; eh *= H
    else:
        # bright, low-saturation stoneware against dark oak
        m = ((lum > .42) & (hsv[..., 1] < 95)).astype(np.uint8) * 255
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
        cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        c = max(cnts, key=cv2.contourArea)
        (cx, cy), (ew, eh), ang = cv2.fitEllipse(c)
    print("ellipse", (cx / W, cy / H), (ew / W, eh / H), ang)

    # anti-aliased ellipse mask (supersampled), with a hair of feather
    SS = 4
    big = np.zeros((H * SS // 4, W * SS // 4), np.uint8)
    mask = np.zeros((H, W), np.uint8)
    mp = ROOT / "tools/plate-mask.png"          # GrabCut-refined silhouette (top ellipse + rim wall)
    if mp.exists():
        mask = np.asarray(Image.open(mp).convert("L").resize((W, H), Image.LANCZOS))
        mask = cv2.erode(mask, np.ones((3, 3), np.uint8))
    else:
        cv2.ellipse(mask, ((cx, cy), (ew * .992, eh * .992), ang), 255, -1, cv2.LINE_AA)
    mask = cv2.GaussianBlur(mask, (0, 0), 1.1)

    # food = inside the plate and clearly not glaze (darker or more saturated)
    inner = np.zeros((H, W), np.uint8)
    cv2.ellipse(inner, ((cx, cy), (ew * .82, eh * .82), ang), 255, -1)
    plate_l = np.median(lum[(mask > 200) & (inner == 0)])
    food = (((plate_l - lum) > .14) | (hsv[..., 1] > 70)) & (inner > 0)
    food = cv2.morphologyEx(food.astype(np.uint8) * 255, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    food = cv2.morphologyEx(food, cv2.MORPH_CLOSE, np.ones((31, 31), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(food)
    keep = np.zeros_like(food)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] > W * H * .0006:
            keep[lab == i] = 255
    cnts, _ = cv2.findContours(keep, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    food = np.zeros_like(keep)
    cv2.drawContours(food, cnts, -1, 255, -1)          # fill holes (pale fish flesh)

    # depth
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    t = np.deg2rad(ang)
    dx, dy = xx - cx, yy - cy
    u = (dx * np.cos(t) + dy * np.sin(t)) / (ew / 2)
    v = (-dx * np.sin(t) + dy * np.cos(t)) / (eh / 2)
    rr = np.sqrt(u * u + v * v)                       # 0 centre → 1 rim
    plate_d = .36 + .12 * np.clip((rr - .72) / .26, 0, 1) ** 1.5 - .04 * np.clip(1 - rr / .7, 0, 1)
    dist = cv2.distanceTransform(food, cv2.DIST_L2, 5)
    if dist.max() > 0:
        dist = dist / dist.max()
    food_d = .5 + .42 * np.sqrt(dist)
    depth = np.where(food > 0, food_d, plate_d)
    depth = cv2.GaussianBlur(depth.astype(np.float32), (0, 0), 9)
    depth = np.where(mask > 0, depth, .36)

    # crop to the plate with a little air
    x0, y0, w0, h0 = cv2.boundingRect((mask > 8).astype(np.uint8))
    pad = int(max(w0, h0) * .02)
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(W, x0 + w0 + 2 * pad), min(H, y0 + h0 + 2 * pad)

    rgba = np.dstack([(a * 255).astype(np.uint8), mask])[y0:y1, x0:x1]
    cut = Image.fromarray(rgba, "RGBA")
    dep = Image.fromarray((np.clip(depth, 0, 1) * 255).astype(np.uint8)[y0:y1, x0:x1], "L")
    maxw = 1800
    if cut.width > maxw:
        hh = round(cut.height * maxw / cut.width)
        cut = cut.resize((maxw, hh), Image.LANCZOS); dep = dep.resize((maxw, hh), Image.LANCZOS)
    cut.save(WEB / "dish-signature.webp", "WEBP", quality=88, method=6)
    cut.save(RAW / "dish-signature-isolated.png")
    dep.resize((dep.width // 2, dep.height // 2), Image.LANCZOS).save(WEB / "dish-signature-depth.webp", "WEBP", quality=90)
    dep.save(RAW / "dish-signature-depth.png")
    # menu thumb: the same plate on warm black
    th = Image.new("RGB", (480, 600), (20, 17, 14))
    c2 = cut.copy(); c2.thumbnail((440, 440), Image.LANCZOS)
    th.paste(c2, ((480 - c2.width) // 2, (600 - c2.height) // 2), c2)
    save_webp(th, WEB / "dish-signature-thumb.webp", 86)

    plate = {"x": x0 / W, "y": y0 / H, "w": (x1 - x0) / W, "h": (y1 - y0) / H}
    print("plate", json.dumps(plate))
    json.dump({"plate": plate, "w": W, "h": H}, open(ROOT / "tools/plate.out.json", "w"))


if __name__ == "__main__":
    what = sys.argv[1:] or ["wide", "dish"]
    if "wide" in what: wide()
    if "dish" in what: dish()
