"""Makes the fake camera videos the end-to-end test points Chromium at.

Each video is a short MJPEG clip of one EAN-13 barcode held in front of a beige background, like
someone holding a product up to the camera.

    pip install python-barcode pillow
    python3 e2e/make-camera-videos.py
"""

import io
import random
from pathlib import Path

import barcode
from barcode.writer import ImageWriter
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).parent / ".cam"
OUT.mkdir(exist_ok=True)

# name -> the first 12 digits (the 13th, the check digit, is added by python-barcode)
VIDEOS = {
    "bond": "480001000001",     # 4800010000016  Bond Paper A4 (ream)
    "alcohol": "480001000012",  # 4800010000122  Alcohol 70% 500ml, running low
    "unknown": "999999999999",  # 9999999999994  not in the catalogue
}


def barcode_image(digits: str) -> Image.Image:
    buf = io.BytesIO()
    barcode.get("ean13", digits, writer=ImageWriter()).write(
        buf, options={"module_width": 0.42, "module_height": 22, "quiet_zone": 6, "font_size": 9, "text_distance": 4, "dpi": 300}
    )
    buf.seek(0)
    return Image.open(buf).convert("RGB")


def make_video(name: str, digits: str) -> None:
    width, height = 640, 480
    code = barcode_image(digits)
    scale = (width * 0.72) / code.width
    code = code.resize((int(code.width * scale), int(code.height * scale)), Image.LANCZOS)

    random.seed(1)
    with open(OUT / f"{name}.mjpeg", "wb") as out:
        for _ in range(20):
            frame = Image.new("RGB", (width, height), (176, 168, 152))
            ImageDraw.Draw(frame).rectangle([0, 0, width, 60], fill=(150, 140, 125))
            jitter = (random.randint(-3, 3), random.randint(-3, 3))  # a hand is never perfectly still
            frame.paste(code, ((width - code.width) // 2 + jitter[0], (height - code.height) // 2 + jitter[1]))
            jpeg = io.BytesIO()
            frame.filter(ImageFilter.GaussianBlur(0.4)).save(jpeg, "JPEG", quality=90)
            out.write(jpeg.getvalue())
    print("wrote", OUT / f"{name}.mjpeg")


if __name__ == "__main__":
    for video, digits in VIDEOS.items():
        make_video(video, digits)
