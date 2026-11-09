"""生成应用图标：绿色渐变圆角方块 + 白色闹钟"""
from PIL import Image, ImageDraw
import math, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icon.ico")

def rounded_rect(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)

def make(size):
    S = size * 4  # 超采样
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 背景：圆角方块 + 竖向渐变
    pad = int(S * 0.045)
    box = (pad, pad, S - pad, S - pad)
    radius = int(S * 0.235)

    grad = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    top = (146, 221, 113)
    bot = (74, 155, 50)
    for y in range(S):
        t = y / max(1, S - 1)
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,)
        gd.line([(0, y), (S, y)], fill=c)

    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=radius, fill=255)
    img.paste(grad, (0, 0), mask)

    # 顶部高光
    hl = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hl)
    hd.rounded_rectangle((pad, pad, S - pad, int(S * 0.5)), radius=radius, fill=(255, 255, 255, 46))
    img = Image.alpha_composite(img, Image.composite(hl, Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask))

    d = ImageDraw.Draw(img)

    # 表盘
    cx = cy = S / 2
    R = S * 0.315
    lw = max(2, int(S * 0.038))
    d.ellipse((cx - R, cy - R, cx + R, cy + R), outline=(255, 255, 255, 255), width=lw)

    # 指针：时针 10 点方向，分针 2 点方向（经典闹钟造型）
    def hand(angle_deg, length, width):
        a = math.radians(angle_deg - 90)
        x2 = cx + math.cos(a) * length
        y2 = cy + math.sin(a) * length
        d.line((cx, cy, x2, y2), fill=(255, 255, 255, 255), width=width)
        r2 = width / 2
        d.ellipse((x2 - r2, y2 - r2, x2 + r2, y2 + r2), fill=(255, 255, 255, 255))

    hand(300, R * 0.55, max(2, int(S * 0.045)))
    hand(35, R * 0.78, max(2, int(S * 0.038)))
    # 中心点
    cr = max(2, int(S * 0.032))
    d.ellipse((cx - cr, cy - cr, cx + cr, cy + cr), fill=(255, 255, 255, 255))

    # 两侧耳朵
    for sx in (-1, 1):
        bx = cx + sx * R * 0.74
        by = cy - R * 0.78
        rr = S * 0.072
        d.ellipse((bx - rr, by - rr, bx + rr, by + rr), fill=(255, 255, 255, 255))

    # 底座两只脚
    for sx in (-1, 1):
        x1 = cx + sx * R * 0.52
        d.line((x1, cy + R * 0.86, x1 + sx * S * 0.02, cy + R * 1.16),
               fill=(255, 255, 255, 255), width=max(2, int(S * 0.036)))

    return img.resize((size, size), Image.LANCZOS)

sizes = [16, 24, 32, 48, 64, 128, 256]
imgs = [make(s) for s in sizes]
imgs[-1].save(OUT, format="ICO", sizes=[(s, s) for s in sizes])
print("saved", OUT)

# 同时导出 png 方便预览
prev = make(256)
prev.save(os.path.join(os.path.dirname(OUT), "icon.png"))
print("preview png done")
