#!/usr/bin/env python3
"""build_full.py - assemble FULL_DEMO.mp4 from captioned acts + segment cards.
Normalises each captioned act to 1920x1080 (scale-to-fit + F4F5F7 pad), splits
at segment-gap timestamps, builds fade in/out card clips, concatenates in order.
"""
import os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
FF = "/Users/pgardner/.cache/coco-demo-video/ffmpeg"
W, H, FPS = 1920, 1080, 30
WORK = os.path.join(HERE, ".build_tmp")
CARDS = os.path.join(HERE, "cards")
OUT = os.path.join(HERE, "FULL_DEMO.mp4")

NORM = (f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
        f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=0xF4F5F7,setsar=1")
VC = ["-r", str(FPS), "-c:v", "libx264", "-crf", "18", "-preset", "medium",
      "-pix_fmt", "yuv420p", "-an", "-video_track_timescale", "30000"]

# card holds (seconds), keyed by file stem
HOLD = {"00_title": 4.5, "01_command": 5.5, "02_caseload": 3.5, "03_quickwins": 3.5,
        "04_knowledge": 3.5, "05_inbox": 4.0, "06_pipeline": 4.0, "07_sar": 4.0,
        "08_estate": 3.5, "09_improves": 4.5, "10_outro": 4.5}

# ordered build: ("card", name) or ("seg", act_file, start, end_or_None)
SEQ = [
    ("card", "00_title"),
    ("card", "01_command"),
    ("seg", "ACT1_captioned.mp4", 0, 71),
    ("card", "02_caseload"),
    ("seg", "ACT1_captioned.mp4", 71, 234),
    ("card", "03_quickwins"),
    ("seg", "ACT1_captioned.mp4", 234, 275),
    ("card", "04_knowledge"),
    ("seg", "ACT1_captioned.mp4", 275, None),
    ("card", "05_inbox"),
    ("seg", "ACT2_captioned.mp4", 0, 10),
    ("card", "06_pipeline"),
    ("seg", "ACT2_captioned.mp4", 10, None),
    ("card", "07_sar"),
    ("seg", "ACT3_captioned.mp4", 0, 98),
    ("card", "08_estate"),
    ("seg", "ACT3_captioned.mp4", 98, None),
    ("card", "10_outro"),
]


def run(args):
    r = subprocess.run(args, cwd=HERE, capture_output=True, text=True)
    if r.returncode != 0:
        print("FFMPEG ERROR:\n", r.stderr[-2000:]); sys.exit(1)


def main():
    os.makedirs(WORK, exist_ok=True)
    parts = []
    for i, item in enumerate(SEQ):
        out = os.path.join(WORK, f"p{i:02d}.mp4")
        if item[0] == "card":
            name = item[1]; hold = HOLD[name]
            png = os.path.join(CARDS, name + ".png")
            vf = (f"scale={W}:{H},fade=t=in:st=0:d=0.3,"
                  f"fade=t=out:st={hold-0.3:.2f}:d=0.3,setsar=1")
            run([FF, "-y", "-v", "error", "-loop", "1", "-t", str(hold), "-i", png,
                 "-vf", vf, *VC, out])
            print(f"card {name} ({hold}s)")
        else:
            _, af, a, b = item
            args = [FF, "-y", "-v", "error", "-i", af, "-ss", str(a)]
            if b is not None:
                args += ["-to", str(b)]
            args += ["-vf", NORM, *VC, out]
            run(args)
            print(f"seg {af} [{a},{b}]")
        parts.append(out)

    lst = os.path.join(WORK, "concat.txt")
    with open(lst, "w") as f:
        for p in parts:
            f.write(f"file '{p}'\n")
    print("concatenating (copy)…")
    r = subprocess.run([FF, "-y", "-v", "error", "-f", "concat", "-safe", "0",
                        "-i", lst, "-c", "copy", OUT], cwd=HERE,
                       capture_output=True, text=True)
    if r.returncode != 0:
        print("copy concat failed, re-encoding via filter…")
        n = len(parts)
        ins = []
        for p in parts:
            ins += ["-i", p]
        fc = "".join(f"[{i}:v]" for i in range(n)) + f"concat=n={n}:v=1:a=0[v]"
        run([FF, "-y", "-v", "error", *ins, "-filter_complex", fc, "-map", "[v]",
             "-c:v", "libx264", "-crf", "18", "-preset", "medium",
             "-pix_fmt", "yuv420p", "-an", OUT])
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                          "format=duration", "-of", "default=nw=1:nk=1", OUT],
                         cwd=HERE, capture_output=True, text=True).stdout.strip()
    size = os.path.getsize(OUT) / 1_048_576
    print(f"\nDONE -> FULL_DEMO.mp4  {dur}s  {size:.1f} MB")


if __name__ == "__main__":
    main()
