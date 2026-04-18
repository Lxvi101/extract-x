"""
generate_assets.py
Generates:
  - icons/icon16.png, icon32.png, icon48.png, icon128.png
  - assets/demo.gif  (animated popup mock-up for the README)

Run from the extension root:
    python3 scripts/generate_assets.py
"""

import math
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ── Paths ──────────────────────────────────────────────────────────────
ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS  = os.path.join(ROOT, "icons")
ASSETS = os.path.join(ROOT, "assets")
os.makedirs(ICONS,  exist_ok=True)
os.makedirs(ASSETS, exist_ok=True)

# ── Brand colours ──────────────────────────────────────────────────────
BG       = (15,  20,  25)        # #0f1419  dark background
BLUE     = (29, 155, 240)        # #1d9bf0  X blue
WHITE    = (255, 255, 255)
GREEN    = (0,  186, 124)        # #00ba7c
MUTED    = (113, 118, 123)       # #71767b
CARD_BG  = (22,  32,  42)        # #16202a
BORDER   = (47,  51,  54)        # #2f3336
RED      = (244,  33,  46)

# ══════════════════════════════════════════════════════════════════════
# ICON
# ══════════════════════════════════════════════════════════════════════

def rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill)

def draw_icon(size: int) -> Image.Image:
    S  = size
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d   = ImageDraw.Draw(img)

    r = max(2, S // 5)

    # ── Background ─────────────────────────────────────────────────
    rounded_rect(d, (0, 0, S-1, S-1), r, BG)

    # ── Eye outline (white ellipse) ────────────────────────────────
    pad  = S * 0.12
    ew, eh = S - 2*pad, (S - 2*pad) * 0.62
    ex0  = pad
    ey0  = (S - eh) / 2
    ex1  = S - pad
    ey1  = ey0 + eh
    d.ellipse([ex0, ey0, ex1, ey1], fill=WHITE)

    # ── Iris (blue filled circle) ──────────────────────────────────
    ir = eh * 0.36
    cx, cy = S/2, S/2
    d.ellipse([cx-ir, cy-ir, cx+ir, cy+ir], fill=BLUE)

    # ── Pupil (dark circle) ────────────────────────────────────────
    pr = ir * 0.48
    d.ellipse([cx-pr, cy-pr, cx+pr, cy+pr], fill=BG)

    # ── X mark inside pupil (two white strokes) ────────────────────
    if S >= 32:
        xr   = pr * 0.58
        lw   = max(1, int(S * 0.045))
        x0_, y0_ = cx - xr, cy - xr
        x1_, y1_ = cx + xr, cy + xr
        d.line([(x0_, y0_), (x1_, y1_)], fill=WHITE, width=lw)
        d.line([(x1_, y0_), (x0_, y1_)], fill=WHITE, width=lw)

    return img


ICON_SIZES = [16, 32, 48, 128]
for sz in ICON_SIZES:
    path = os.path.join(ICONS, f"icon{sz}.png")
    draw_icon(sz).save(path)
    print(f"  ✓ icons/icon{sz}.png")


# ══════════════════════════════════════════════════════════════════════
# DEMO GIF  (popup mock-up, 320 × 420 @2× → 640 × 840 source)
# ══════════════════════════════════════════════════════════════════════

W, H = 320, 418   # logical pixels  (1× — saved at 1× so README isn't huge)

def font(size, bold=False):
    """Best-effort font loading; falls back to default."""
    candidates_bold   = ["/System/Library/Fonts/Helvetica.ttc",
                         "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
    candidates_regular= ["/System/Library/Fonts/Helvetica.ttc",
                         "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    paths = candidates_bold if bold else candidates_regular
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def rr(draw, xy, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def draw_popup(count: int,
               status: str,              # 'idle' | 'watching' | 'paused'
               new_label: str = "",
               btn_export: bool = False) -> Image.Image:

    img = Image.new("RGB", (W, H), BG)
    d   = ImageDraw.Draw(img)

    # ── Header ────────────────────────────────────────────────────
    d.rectangle([(0, 0), (W, 44)], fill=BLUE)
    # X logo (two diagonal lines)
    lw = 2
    x0, y0 = 16, 13
    xs = 18
    d.line([(x0,      y0),      (x0+xs,   y0+18)], fill=WHITE, width=lw)
    d.line([(x0+xs,   y0),      (x0,      y0+18)], fill=WHITE, width=lw)
    # title
    d.text((44, 14), "Comment Scraper", font=font(13, bold=True), fill=WHITE)
    # badge
    badge_x = W - 42
    rr(d, [badge_x, 15, badge_x+34, 30], radius=8, fill=(255,255,255,60))
    d.text((badge_x+5, 16), "v1.1", font=font(10), fill=WHITE)

    y = 58   # body starts here

    # ── Card ──────────────────────────────────────────────────────
    card_x0, card_y0 = 14, y
    card_x1, card_y1 = W-14, y+130
    rr(d, [card_x0, card_y0, card_x1, card_y1],
       radius=12, fill=CARD_BG, outline=BORDER, width=1)

    # Shimmer strip when watching
    if status == "watching":
        for i in range(3):
            alpha = 18 - i*5
            strip_x = card_x0 + i*8
            rr(d, [strip_x, card_y0, strip_x+60, card_y1],
               radius=0, fill=(*BLUE, alpha))

    # Status dot + label
    dot_cx, dot_cy = card_x0+18, card_y0+20
    dot_r = 5
    dot_col  = {"idle": MUTED, "watching": BLUE, "paused": (255, 212, 0)}[status]
    d.ellipse([dot_cx-dot_r, dot_cy-dot_r, dot_cx+dot_r, dot_cy+dot_r], fill=dot_col)
    label_txt = {"idle": "Idle", "watching": "Watching…", "paused": "Paused"}[status]
    label_col = {"idle": MUTED,  "watching": BLUE,         "paused": (255, 212, 0)}[status]
    d.text((dot_cx+10, dot_cy-7), label_txt, font=font(12, bold=True), fill=label_col)

    # "+N" new badge
    if new_label:
        bw = 36
        bx = card_x1 - bw - 10
        by = card_y0 + 12
        rr(d, [bx, by, bx+bw, by+16], radius=8, fill=(0, 60, 40))
        d.text((bx+5, by+2), new_label, font=font(10, bold=True), fill=GREEN)

    # Big count
    count_str = str(count)
    cf = font(46, bold=True)
    # center text manually
    bbox = d.textbbox((0, 0), count_str, font=cf)
    tw = bbox[2] - bbox[0]
    tx = (W - tw) // 2
    d.text((tx, card_y0+32), count_str, font=cf, fill=WHITE)

    # Sub-label
    sub = "comments in database"
    sb  = d.textbbox((0, 0), sub, font=font(11))
    sw  = sb[2] - sb[0]
    d.text(((W-sw)//2, card_y0+96), sub, font=font(11), fill=MUTED)

    # ── Primary buttons ───────────────────────────────────────────
    y2 = card_y1 + 12

    # Start / Resume button
    start_dis = (status == "watching")
    start_col = (*BLUE, 100) if start_dis else BLUE
    start_txt = "▶ Resume" if (status == "paused" and count > 0) else "👁  Start Watching"
    rr(d, [14, y2, 162, y2+36], radius=18,
       fill=(70, 70, 80) if start_dis else BLUE)
    sb2 = d.textbbox((0,0), start_txt, font=font(12, bold=True))
    sw2 = sb2[2]-sb2[0]
    fc  = (130,130,140) if start_dis else WHITE
    d.text((14+(148-sw2)//2, y2+10), start_txt, font=font(12, bold=True), fill=fc)

    # Pause button
    pause_dis = (status != "watching")
    rr(d, [170, y2, W-14, y2+36], radius=18,
       fill=(70, 38, 40) if not pause_dis else RED)
    pt = "⏸  Pause"
    pb = d.textbbox((0,0), pt, font=font(12, bold=True))
    pw = pb[2]-pb[0]
    pfc = (130,80,84) if pause_dis else WHITE
    d.text((170+(136-pw)//2, y2+10), pt, font=font(12, bold=True), fill=pfc)

    y3 = y2 + 44

    # Reset button
    reset_dis = (status == "idle" or status == "watching")
    rr(d, [14, y3, W-14, y3+36], radius=18, fill=BORDER)
    rt = "🗑  Reset"
    rb = d.textbbox((0,0), rt, font=font(12, bold=True))
    rw = rb[2]-rb[0]
    rfc = (70, 74, 76) if reset_dis else (200, 205, 210)
    d.text(((W-rw)//2, y3+10), rt, font=font(12, bold=True), fill=rfc)

    y4 = y3 + 44 + 4

    # Export buttons
    exp_dis = not btn_export
    json_col = (0, 80, 54) if exp_dis else GREEN
    csv_col  = BORDER
    rr(d, [14,  y4, 156, y4+36], radius=18, fill=json_col)
    rr(d, [162, y4, W-14, y4+36], radius=18, fill=csv_col)

    jt = "⬇  Export JSON"
    jb = d.textbbox((0,0), jt, font=font(11, bold=True))
    jw = jb[2]-jb[0]
    jfc = (0, 130, 90) if exp_dis else WHITE
    d.text((14+(142-jw)//2, y4+10), jt, font=font(11, bold=True), fill=jfc)

    ct = "⬇  Export CSV"
    cb = d.textbbox((0,0), ct, font=font(11, bold=True))
    cw = cb[2]-cb[0]
    cfc = (70, 74, 76) if exp_dis else (200, 205, 210)
    d.text((162+(144-cw)//2, y4+10), ct, font=font(11, bold=True), fill=cfc)

    # ── Footer ────────────────────────────────────────────────────
    ft = "Scroll down — comments captured automatically"
    fb = d.textbbox((0,0), ft, font=font(10))
    fw = fb[2]-fb[0]
    d.text(((W-fw)//2, H-20), ft, font=font(10), fill=BORDER)

    return img


# ── Frame sequence ─────────────────────────────────────────────────────
sequence = [
    # (count, status, new_badge, export_enabled, hold_ms)
    (  0, "idle",     "",     False,  900),
    (  0, "watching", "",     False,  400),
    ( 12, "watching", "+12",  True,   500),
    ( 12, "watching", "",     True,   300),
    ( 29, "watching", "+17",  True,   500),
    ( 29, "watching", "",     True,   300),
    ( 51, "watching", "+22",  True,   500),
    ( 51, "watching", "",     True,   300),
    ( 88, "watching", "+37",  True,   500),
    ( 88, "watching", "",     True,   300),
    (134, "watching", "+46",  True,   500),
    (134, "watching", "",     True,   500),
    (134, "paused",   "",     True,   700),
    (134, "paused",   "",     True,   900),
    (134, "watching", "",     True,   400),
    (157, "watching", "+23",  True,   500),
    (157, "watching", "",     True,   800),
]

frames   = []
durations = []

for count, status, badge, exp, ms in sequence:
    frames.append(draw_popup(count, status, badge, exp))
    durations.append(ms)

gif_path = os.path.join(ASSETS, "demo.gif")
frames[0].save(
    gif_path,
    save_all=True,
    append_images=frames[1:],
    duration=durations,
    loop=0,
    optimize=True,
)
print(f"  ✓ assets/demo.gif  ({len(frames)} frames)")
print("\nDone.")
