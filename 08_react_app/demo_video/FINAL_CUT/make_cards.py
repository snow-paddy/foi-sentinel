#!/usr/bin/env python3
"""make_cards.py - full-screen segment/title cards for FOI Sentinel FULL_DEMO.
Dark navy brand card, Snowflake-blue accent, matching the HMLR quality bar.
Copy rules: British English, no em dashes, no prose semicolons, no "not X but Y".
Output: cards/NN_name.png at 1920x1080. Holds printed for the assembler.
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "cards")
W, H = 1920, 1080
BG = (11, 31, 42)          # deep navy
ACCENT = (41, 181, 232)    # Snowflake blue
TEXT = (242, 246, 248)
SUB = (154, 176, 188)
BRAND = "FOI Sentinel"
LOGO = os.path.join(HERE, "assets", "snowflake_logo.png")

FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"

# name, headline, subline (\n allowed), type(title|seg), hold_s
CARDS = [
    ("00_title", "FOI Sentinel", "AI-assisted FOI, EIR and SAR handling on Snowflake", "title", 4.5),
    ("01_command", "The command centre",
     "Your dashboard for measuring organisational performance against the statutory clock. Aggregated insight into your pipeline, bottlenecks and trends", "seg", 3.5),
    ("02_caseload", "The caseload", "AI-triaged, and learning from human decisions", "seg", 3.5),
    ("03_quickwins", "Quick wins", "Strong-precedent and section 21 replies, sent as one confirmed batch", "seg", 3.5),
    ("04_knowledge", "The knowledge base", "The grounded evidence base behind every answer", "seg", 3.5),
    ("05_inbox", "A real request, from inbox to draft", "Outlook to Snowflake, with no middleware", "seg", 4.0),
    ("06_pipeline", "How the AI triage pipeline works", "Classified, triaged, grounded and self-checked", "seg", 4.0),
    ("07_sar", "Subject access and redaction", "Third-party data removed under the UK GDPR balancing test, officer-approved", "seg", 4.0),
    ("08_estate", "Integrate all your data sources", "SharePoint mirrored into Snowflake by Openflow", "seg", 3.5),
    ("10_outro", "One governed platform", "FOI, EIR and SAR: from inbox to defensible disclosure, on Snowflake", "title", 4.5),
]


def fit_font(draw, text, path, base, maxw):
    size = base
    while size > 36:
        f = ImageFont.truetype(path, size)
        if draw.textlength(text, font=f) <= maxw:
            return f
        size -= 2
    return ImageFont.truetype(path, size)


def wrap(draw, text, font, maxw):
    out = []
    for para in text.split("\n"):
        words, cur = para.split(), ""
        for w in words:
            t = (cur + " " + w).strip()
            if draw.textlength(t, font=font) <= maxw or not cur:
                cur = t
            else:
                out.append(cur); cur = w
        out.append(cur)
    return out


def render(card):
    name, headline, subline, stype, _ = card
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    base = 112 if stype == "title" else 88
    hf = fit_font(d, headline, FONT_BOLD, base, W - 260)
    hw = d.textlength(headline, font=hf)
    hy = 372
    d.text(((W - hw) / 2, hy), headline, font=hf, fill=TEXT)
    # accent bar under headline
    hb = d.textbbox((0, 0), headline, font=hf)
    bar_y = hy + (hb[3] - hb[1]) + 46
    d.rectangle([W // 2 - 150, bar_y, W // 2 + 150, bar_y + 6], fill=ACCENT)
    # subline
    sf = ImageFont.truetype(FONT_REG, 44)
    lines = wrap(d, subline, sf, W - 360)
    sy = bar_y + 56
    for ln in lines:
        lw = d.textlength(ln, font=sf)
        d.text(((W - lw) / 2, sy), ln, font=sf, fill=SUB)
        sy += 60
    # brand mark: Snowflake logo bottom-right on every card (no text wordmark)
    try:
        logo = Image.open(LOGO).convert("RGBA")
        lh = 56
        lw = round(logo.width * lh / logo.height)
        logo = logo.resize((lw, lh))
        img.paste(logo, (W - lw - 64, H - 78 - 12), logo)
    except Exception as e:
        print("logo skip:", e)
    out = os.path.join(OUT, name + ".png")
    img.save(out)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    for c in CARDS:
        p = render(c)
        print(f"{p}  hold={c[4]}s")


if __name__ == "__main__":
    main()
