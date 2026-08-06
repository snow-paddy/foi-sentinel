#!/bin/bash
set -e
cd /Users/pgardner/Desktop/Finito/FOI/foi_sentinel_v2/08_react_app/demo_video
FF=/opt/homebrew/bin/ffmpeg
SRC=raw/phase3.mkv
W=work_p3
SCALE="scale=1710:-2"
mkdir -p "$W" out

# Frame-accurate hybrid seek: fast -ss (before -i) to ~10s before target, then accurate -ss 10 after -i, take -t seconds.

# SEG A  raw 117 -> 228 (111s), 1x
$FF -hide_banner -loglevel error -ss 107 -i "$SRC" -ss 10 -t 111 -vf "$SCALE,fps=30" -c:v h264_videotoolbox -b:v 6M -an -y "$W/A.mp4"

# SEG B1 raw 253 -> 267 (14s), normal (will be sped up next)
$FF -hide_banner -loglevel error -ss 243 -i "$SRC" -ss 10 -t 14 -vf "$SCALE,fps=30" -c:v h264_videotoolbox -b:v 6M -an -y "$W/B1raw.mp4"

# Speed B1raw up 2.2x -> B1
$FF -hide_banner -loglevel error -i "$W/B1raw.mp4" -vf "setpts=PTS/2.2,fps=30" -c:v h264_videotoolbox -b:v 6M -an -y "$W/B1.mp4"

# SEG B2 raw 267 -> 281 (14s), 1x  (tick + open doc)
$FF -hide_banner -loglevel error -ss 257 -i "$SRC" -ss 10 -t 14 -vf "$SCALE,fps=30" -c:v h264_videotoolbox -b:v 6M -an -y "$W/B2.mp4"

# SEG C raw 696 -> 703 (7s), 1x
$FF -hide_banner -loglevel error -ss 686 -i "$SRC" -ss 10 -t 7 -vf "$SCALE,fps=30" -c:v h264_videotoolbox -b:v 6M -an -y "$W/C.mp4"

printf "file 'A.mp4'\nfile 'B1.mp4'\nfile 'B2.mp4'\nfile 'C.mp4'\n" > "$W/list.txt"
$FF -hide_banner -loglevel error -f concat -safe 0 -i "$W/list.txt" -c copy -y out/phase3_roughcut_v2.mp4

echo "DONE"
for f in A B1raw B1 B2 C; do d=$(/opt/homebrew/bin/ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$W/$f.mp4"); echo "$f = ${d}s"; done
D=$(/opt/homebrew/bin/ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 out/phase3_roughcut_v2.mp4)
echo "TOTAL out/phase3_roughcut_v2.mp4 = ${D}s"
