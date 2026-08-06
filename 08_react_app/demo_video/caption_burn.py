#!/usr/bin/env python3
# caption_burn.py <input.mp4> <captions.tsv> <output.mp4>
# captions.tsv lines: start_sec <TAB> end_sec <TAB> text
import sys, subprocess, json, os, tempfile, textwrap
from PIL import Image, ImageDraw, ImageFont

inp, tsv, outp = sys.argv[1], sys.argv[2], sys.argv[3]

# probe dimensions
pr = subprocess.run(["ffprobe","-v","error","-select_streams","v:0",
    "-show_entries","stream=width,height","-of","json",inp],
    capture_output=True, text=True)
st = json.loads(pr.stdout)["streams"][0]
W, H = int(st["width"]), int(st["height"])
S = W/1920.0

FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
font = ImageFont.truetype(FONT_PATH, max(18, round(38*S)))
pad_x = round(40*S); pad_y = round(20*S)
line_gap = round(10*S)
bottom_margin = round(60*S)
maxbox_w = int(W*0.86)
radius = round(26*S)

def wrap(draw, text):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        t = (cur+" "+w).strip()
        if draw.textlength(t, font=font) <= (maxbox_w - 2*pad_x) or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

caps = []
with open(tsv) as f:
    for ln in f:
        ln = ln.rstrip("\n")
        if not ln.strip() or ln.startswith("#"): continue
        a,b,txt = ln.split("\t",2)
        caps.append((float(a),float(b),txt))

tmp = tempfile.mkdtemp()
pngs = []
# measure line height once
probe_img = Image.new("RGBA",(10,10)); pd = ImageDraw.Draw(probe_img)
asc, desc = font.getmetrics(); line_h = asc+desc
for i,(a,b,txt) in enumerate(caps):
    lines = wrap(pd, txt)
    tw = max(pd.textlength(l, font=font) for l in lines)
    box_w = int(min(maxbox_w, tw + 2*pad_x))
    box_h = int(len(lines)*line_h + (len(lines)-1)*line_gap + 2*pad_y)
    png_h = box_h + bottom_margin
    img = Image.new("RGBA",(W, png_h),(0,0,0,0))
    d = ImageDraw.Draw(img)
    bx0 = (W-box_w)//2; by0 = 0
    d.rounded_rectangle([bx0,by0,bx0+box_w,by0+box_h], radius=radius, fill=(15,23,42,210))
    y = by0+pad_y
    for l in lines:
        lw = pd.textlength(l, font=font)
        d.text(((W-lw)//2, y), l, font=font, fill=(255,255,255,255))
        y += line_h+line_gap
    p = os.path.join(tmp, f"cap_{i:03d}.png")
    img.save(p); pngs.append((p, png_h))

# build ffmpeg overlay chain
cmd = ["ffmpeg","-y","-v","error","-i",inp]
for p,_ in pngs: cmd += ["-i", p]
fc = []; last = "[0:v]"
for i,((a,b,_),(p,png_h)) in enumerate(zip(caps,pngs)):
    yexpr = f"H-{png_h}"
    outlbl = f"[v{i}]"
    fc.append(f"{last}[{i+1}:v]overlay=x=0:y={yexpr}:enable='between(t,{a},{b})'{outlbl}")
    last = outlbl
filter = ";".join(fc)
cmd += ["-filter_complex", filter, "-map", last, "-c:v","libx264","-crf","18","-preset","medium","-pix_fmt","yuv420p","-an", outp]
print(f"{len(caps)} captions, video {W}x{H}, rendering...")
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode!=0:
    print("FFMPEG ERROR:\n", r.stderr[-3000:]); sys.exit(1)
print("done ->", outp)
