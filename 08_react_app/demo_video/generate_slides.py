"""
Generate intro/outro title cards for the FOI Sentinel demo (Phase 3).

Dark brand slide with a Snowflake-blue accent, matching the script's title cards:
  intro : "FOI Sentinel" / "AI-assisted FOI, EIR and SAR handling on Snowflake"
  outro : "One governed platform." / "FOI, EIR and SAR: from inbox to defensible disclosure, on Snowflake."
Outputs demo_video/slides/NN_name.png at video resolution (1440x900).
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "slides")
W, H = 1440, 900
BG = (11, 31, 42)          # deep navy
ACCENT = (41, 181, 232)    # Snowflake blue
WHITE = (240, 245, 248)
MUTED = (150, 170, 182)

SLIDES = [
    {"name": "01_intro", "headline": "FOI Sentinel",
     "subline": "AI-assisted FOI, EIR and SAR handling on Snowflake"},
    {"name": "99_outro", "headline": "One governed platform.",
     "subline": "FOI, EIR and SAR: from inbox to defensible disclosure, on Snowflake"},
]

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial.ttf",
]
FONT_REG_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]


def load_font(paths, size):
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def center_text(draw, text, font, y, fill, max_w):
    # simple single-line centre; wrap subline if too wide
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    if w <= max_w:
        draw.text(((W - w) / 2, y), text, font=font, fill=fill)
        return y + (bbox[3] - bbox[1])
    # wrap
    words = text.split()
    line, lines = "", []
    for word in words:
        trial = (line + " " + word).strip()
        if draw.textbbox((0, 0), trial, font=font)[2] <= max_w:
            line = trial
        else:
            lines.append(line)
            line = word
    lines.append(line)
    for ln in lines:
        b = draw.textbbox((0, 0), ln, font=font)
        draw.text(((W - (b[2] - b[0])) / 2, y), ln, font=font, fill=fill)
        y += (b[3] - b[1]) + 12
    return y


def main():
    os.makedirs(OUT, exist_ok=True)
    hfont = load_font(FONT_CANDIDATES, 96)
    sfont = load_font(FONT_REG_CANDIDATES, 40)
    for s in SLIDES:
        img = Image.new("RGB", (W, H), BG)
        d = ImageDraw.Draw(img)
        # accent bar
        d.rectangle([(W / 2 - 90, 300), (W / 2 + 90, 308)], fill=ACCENT)
        center_text(d, s["headline"], hfont, 360, ACCENT if s["name"] == "01_intro" else WHITE, W - 240)
        center_text(d, s["subline"], sfont, 520, MUTED, W - 300)
        out = os.path.join(OUT, s["name"] + ".png")
        img.save(out)
        print(f"SLIDE {out}", flush=True)


if __name__ == "__main__":
    main()
