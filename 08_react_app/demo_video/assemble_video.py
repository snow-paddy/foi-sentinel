#!/usr/bin/env python3
"""
assemble_video.py — Assemble the final FOI Sentinel demo MP4.

  intro slides + body.mp4 (the login-free 3-act capture) + outro slide
  -> concat (stream copy) -> burn captions (libass) + persistent footer (drawtext)
  -> optional: mux a clean voiceover track (vo.m4a/.wav) as the LAST step.

The captioned cut ships even if the VO is not ready. Run with VO=1 once vo exists.

Run:  python demo_video/assemble_video.py
"""
import os, shutil, subprocess, sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def find_ffmpeg():
    for c in ("/opt/homebrew/bin/ffmpeg", "/Users/pgardner/.cache/coco-demo-video/ffmpeg", shutil.which("ffmpeg")):
        if c and os.path.exists(c):
            return c
    return "ffmpeg"
FFMPEG = find_ffmpeg()

# ── CUSTOMISE ────────────────────────────────────────────────────────────────
INTRO_SLIDES = [("slides/00_intro_title.png", 5), ("slides/01_architecture.png", 6)]
# Body is the three phase clips in order. Trim each raw/phaseN.mkv -> raw/phaseN.mp4
# (only dead air at head/tail; there are no logins to remove). If a single
# raw/body.mp4 exists it is used instead.
PHASE_CLIPS  = ["raw/phase1.mp4", "raw/phase2.mp4", "raw/phase3.mp4"]
SINGLE_BODY  = "raw/body.mp4"
OUTRO_SLIDES = [("slides/02_outro.png", 6)]
CAPTIONS_ASS = "captions.ass"          # lower-third, PlayResY=1080; synced to the assembled body
FPS, WIDTH, HEIGHT = 30, 1920, 1080
FOOTER_TEXT = "Indicative demonstration on synthetic data. Not contractual figures."
FOOTER_FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
VO_FILE     = "vo.m4a"                 # clean voiceover, muxed last when VO=1
KEEP_LIVE_AUDIO = os.environ.get("LIVE_AUDIO") == "1"  # keep the mic track captured during phases
# ── END CUSTOMISE ─────────────────────────────────────────────────────────────

WORK = os.path.join(SCRIPT_DIR, ".assemble_tmp")
NOCAP = "assembled_nocaptions.mp4"
OUTPUT = "final.mp4"
VCODEC = ["-c:v", "libx264", "-preset", "fast", "-crf", "18"]

def run(args):
    subprocess.run(args, cwd=SCRIPT_DIR, check=True, capture_output=True, text=True)

def slide_clip(png, hold, out):
    run([FFMPEG, "-y", "-loop", "1", "-t", str(hold), "-i", png,
         "-vf", f"scale={WIDTH}:{HEIGHT}", "-r", str(FPS), *VCODEC, "-pix_fmt", "yuv420p",
         "-f", "lavfi", "-t", str(hold), "-i", "anullsrc=r=48000:cl=stereo",
         "-c:a", "aac", "-shortest", out])

def normalise(src, out):
    """Scale + fps-normalise a body clip. Keeps a stereo audio track (silent if the
    source had none) so concat is uniform; keeps live mic audio when LIVE_AUDIO=1."""
    args = [FFMPEG, "-y", "-i", src]
    if not KEEP_LIVE_AUDIO:
        # replace any (patchy) mic track with silence; VO is added later
        args += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
    args += ["-vf", f"scale={WIDTH}:{HEIGHT}", "-r", str(FPS), *VCODEC, "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "192k"]
    if not KEEP_LIVE_AUDIO:
        args += ["-map", "0:v:0", "-map", "1:a:0"]
    args += ["-shortest", out]
    run(args)

def body_sources():
    if os.path.exists(os.path.join(SCRIPT_DIR, SINGLE_BODY)):
        return [SINGLE_BODY]
    clips = [c for c in PHASE_CLIPS if os.path.exists(os.path.join(SCRIPT_DIR, c))]
    return clips

def main():
    if not os.path.exists(FFMPEG):
        print("ffmpeg not found"); sys.exit(1)
    bodies = body_sources()
    if not bodies:
        print("No body clips found. Expected raw/phase1.mp4..phase3.mp4 (trim from raw/phaseN.mkv) "
              "or a single raw/body.mp4.")
        sys.exit(1)
    print(f"body clips: {bodies}  (live audio kept: {KEEP_LIVE_AUDIO})")
    os.makedirs(WORK, exist_ok=True)
    rel = lambda p: os.path.relpath(p, SCRIPT_DIR)
    clips = []
    for i, (png, hold) in enumerate(INTRO_SLIDES):
        out = os.path.join(WORK, f"intro_{i:02d}.mp4")
        if os.path.exists(os.path.join(SCRIPT_DIR, png)):
            print(f"intro {png}"); slide_clip(png, hold, rel(out)); clips.append(out)
    for i, src in enumerate(bodies):
        out = os.path.join(WORK, f"body_{i:02d}.mp4")
        print(f"normalising {src}…"); normalise(src, rel(out)); clips.append(out)
    for i, (png, hold) in enumerate(OUTRO_SLIDES):
        out = os.path.join(WORK, f"outro_{i:02d}.mp4")
        if os.path.exists(os.path.join(SCRIPT_DIR, png)):
            print(f"outro {png}"); slide_clip(png, hold, rel(out)); clips.append(out)
    concat = os.path.join(WORK, "concat.txt")
    with open(concat, "w") as f:
        for c in clips: f.write(f"file '{c}'\n")
    print("concatenating…")
    run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", NOCAP])

    vf = f"ass={CAPTIONS_ASS}" if os.path.exists(os.path.join(SCRIPT_DIR, CAPTIONS_ASS)) else None
    footer = (f"drawtext=text='{FOOTER_TEXT}':fontfile={FOOTER_FONT}:fontsize=22:"
              f"fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=12:x=(w-text_w)/2:y=h-44")
    vf = f"{vf},{footer}" if vf else footer
    print("burning captions + footer…")
    # keep the concatenated audio track (live mic or silence) through the caption burn
    run([FFMPEG, "-y", "-i", NOCAP, "-vf", vf, *VCODEC, "-pix_fmt", "yuv420p", "-c:a", "copy", OUTPUT])
    os.remove(os.path.join(SCRIPT_DIR, NOCAP))

    if os.environ.get("VO") == "1" and os.path.exists(os.path.join(SCRIPT_DIR, VO_FILE)):
        print("muxing voiceover…")
        withvo = "final_vo.mp4"
        run([FFMPEG, "-y", "-i", OUTPUT, "-i", VO_FILE, "-map", "0:v:0", "-map", "1:a:0",
             "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", withvo])
        print(f"Done → {withvo}")
    shutil.rmtree(WORK, ignore_errors=True)
    size = os.path.getsize(os.path.join(SCRIPT_DIR, OUTPUT)) / 1_048_576
    print(f"\nDone → {OUTPUT}  ({size:.1f} MB)")

if __name__ == "__main__":
    main()
