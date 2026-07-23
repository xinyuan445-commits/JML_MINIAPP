import base64
import json
import math
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont


OUTPUT_DIR = Path(__file__).resolve().parent
WIDTH = 800
HEIGHT = 1440
QR_CONTENT = json.dumps(
    {"mocode": "SCDD26062742", "sortseq": 1, "execid": 321},
    ensure_ascii=False,
    separators=(",", ":"),
)


def font(size, bold=False):
    name = "Dengb.ttf" if bold else "Deng.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


image = Image.new("RGB", (WIDTH, HEIGHT), "white")
draw = ImageDraw.Draw(image)

draw.text((50, 55), "工序流转标签", fill="black", font=font(48, True))
draw.text((50, 125), "完整路线", fill="black", font=font(24, True))
draw.rectangle((160, 117, 278, 155), fill="black")
draw.text((170, 124), "当前工序", fill="white", font=font(22, True))
draw.rectangle((295, 117, 413, 155), outline="black", width=3)
draw.text((305, 124), "下一工序", fill="black", font=font(22, True))
draw.rectangle((50, 175, 110, 215), fill="black")
draw.text((58, 182), "水性", fill="white", font=font(24, True))
draw.text((118, 182), "→", fill="black", font=font(24, True))
draw.rectangle((150, 175, 210, 215), outline="black", width=3)
draw.text((158, 182), "修色", fill="black", font=font(24, True))
draw.text((218, 182), "→ 木皮打印（含覆膜）", fill="black", font=font(24, True))

qr = qrcode.make(QR_CONTENT).convert("RGB").resize((164, 164), Image.Resampling.NEAREST)
image.paste(qr, (560, 55))
draw.text((590, 245), "扫码追溯", fill="black", font=font(22, True))

draw.line((50, 330, 730, 330), fill="black", width=4)
draw.text((50, 365), "工单：SCDD26062742", fill="black", font=font(44, True))
draw.text((50, 420), "行号：1", fill="black", font=font(44, True))
draw.text((50, 485), "产品", fill="black", font=font(22))
draw.text((50, 525), "31-MDF-P2-1116*1220*08-WW", fill="black", font=font(24))
draw.text((50, 570), "P2 760高密度纤维板1116*1220*08（成型）", fill="black", font=font(28, True))

draw.line((50, 710, 730, 710), fill="black", width=4)
draw.text((50, 740), "当前流转", fill="black", font=font(42, True))
draw.text((590, 750), "步骤 1/3", fill="black", font=font(24, True))
draw.rectangle((50, 800, 245, 852), fill="black")
draw.text((65, 811), "当前：水性", fill="white", font=font(28, True))
draw.rectangle((390, 800, 730, 852), outline="black", width=3)
draw.text((405, 811), "下一步：修色", fill="black", font=font(28, True))

draw.rectangle((50, 930, 730, 1080), outline="black", width=4)
grades = [("合计", "100"), ("A", "96"), ("A1", "2"), ("A2", "1"), ("C", "1")]
for index, (title, value) in enumerate(grades):
    left = 50 + index * 136
    if index:
        draw.line((left, 930, left, 1080), fill="black", width=2)
    if index == 4:
        draw.rectangle((left, 930, left + 136, 1080), fill="black")
        color = "white"
    else:
        color = "black"
    title_font = font(26, True)
    value_font = font(48, True)
    title_box = draw.textbbox((0, 0), title, font=title_font)
    value_box = draw.textbbox((0, 0), value, font=value_font)
    draw.text((left + (136 - (title_box[2] - title_box[0])) / 2, 955), title, fill=color, font=title_font)
    draw.text((left + (136 - (value_box[2] - value_box[0])) / 2, 1005), value, fill=color, font=value_font)

draw.text((50, 1130), "工站：水性", fill="black", font=font(24, True))
draw.text((50, 1180), "完工：2026-07-20 14:30:00", fill="black", font=font(24, True))
draw.line((50, 1230, 730, 1230), fill="black", width=2)
draw.text((50, 1260), "提示：下一工序接收前，请核对工单、步骤、", fill="black", font=font(22))
draw.text((50, 1300), "数量与产品信息。", fill="black", font=font(22))
draw.rectangle((20, 20, 760, 1420), outline="black", width=4)

regions = [
    (50, 50, 500, 280),
    (558, 53, 168, 168),
    (570, 235, 160, 50),
    (50, 350, 680, 120),
    (50, 480, 680, 210),
    (50, 730, 680, 60),
    (50, 795, 680, 65),
    (48, 928, 684, 154),
    (50, 1120, 680, 230),
]


def bitmap_region(region):
    x0, y0, width, height = region
    region_image = image.crop((x0, y0, x0 + width, y0 + height)).convert("L")
    pixels = region_image.load()
    points = [
        (x, y)
        for y in range(height)
        for x in range(width)
        if pixels[x, y] < 245
    ]
    if not points:
        return None
    min_x = max(0, min(p[0] for p in points) - 2)
    min_y = max(0, min(p[1] for p in points) - 2)
    max_x = min(width - 1, max(p[0] for p in points) + 2)
    max_y = min(height - 1, max(p[1] for p in points) + 2)
    width_bytes = math.ceil((max_x - min_x + 1) / 8)
    packed_width = width_bytes * 8
    packed_height = max_y - min_y + 1
    bitmap = bytearray(width_bytes * packed_height)
    for y in range(packed_height):
        for x in range(packed_width):
            source_x = min_x + x
            source_y = min_y + y
            if source_x <= max_x and region_image.getpixel((source_x, source_y)) < 220:
                bitmap[y * width_bytes + (x >> 3)] |= 0x80 >> (x & 7)
    return x0 + min_x, y0 + min_y, width_bytes, packed_height, bitmap


payload = bytearray(b"! 0 200 200 1440 1\r\nPAGE-WIDTH 800\r\nGAP-SENSE\r\n")
for region in regions:
    item = bitmap_region(region)
    if not item:
        continue
    x, y, width_bytes, height, bitmap = item
    max_rows = 128
    for row in range(0, height, max_rows):
        rows = min(max_rows, height - row)
        payload.extend(f"CG {width_bytes} {rows} {x} {y + row}\n".encode("ascii"))
        start = row * width_bytes
        payload.extend(bitmap[start : start + rows * width_bytes])

payload.extend(
    (
        "BOX 20 20 760 1420 4\r\n"
        "LINE 50 330 730 330 4\r\n"
        "LINE 50 710 730 710 4\r\n"
        "LINE 50 1230 730 1230 2\r\n"
        "FORM\r\n"
        "PRINT\r\n"
    ).encode("ascii")
)

basename = "01_修改前_位图CPCL_100字节分包"
(OUTPUT_DIR / f"{basename}.bin").write_bytes(payload)
(OUTPUT_DIR / f"{basename}.hex.txt").write_text(
    "\n".join(payload.hex()[index : index + 200] for index in range(0, len(payload.hex()), 200)),
    encoding="utf-8",
)
(OUTPUT_DIR / f"{basename}.base64.txt").write_text(
    base64.b64encode(payload).decode("ascii"),
    encoding="ascii",
)
image.save(OUTPUT_DIR / "01_修改前_位图结构示意.png")

print(
    json.dumps(
        {
            "file": f"{basename}.bin",
            "byteLength": len(payload),
            "packetsAt100Bytes": math.ceil(len(payload) / 100),
        },
        ensure_ascii=False,
    )
)

