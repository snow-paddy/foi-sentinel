#!/bin/zsh
# run_phase.sh — capture one demo phase end to end.
# Starts the screen recorder, drives the phase, stops automatically.
#
# Usage:
#   zsh demo_video/run_phase.sh <1|2|3|all> [mic|silent] [screenIdx]
#     mic     = capture MacBook Air mic too (live narration attempt)  [default]
#     silent  = no audio (VO added in post)
#     screenIdx defaults to 3 (Capture screen 1); use 2 for Capture screen 0 (primary)
#
# Prereq: run pw_login.mjs once first so the tabs are authenticated.
set -e
PHASE="${1:?phase required: 1|2|3|all}"
MODE="${2:-mic}"
VID="${3:-3}"
AUD="1"   # MacBook Air Microphone
SENT="/tmp/foi_stop_recording"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HERE/demo_video/raw/phase${PHASE}.mkv"
mkdir -p "$HERE/demo_video/raw"
rm -f "$SENT"
echo "== PHASE $PHASE  mode=$MODE  screen=$VID  -> $OUT =="

if [[ "$MODE" == "mic" ]]; then
  /opt/homebrew/bin/ffmpeg -hide_banner -loglevel warning \
    -f avfoundation -capture_cursor 1 -framerate 30 -i "${VID}:${AUD}" \
    -c:v h264_videotoolbox -b:v 10M -pix_fmt yuv420p -c:a aac -b:a 192k -async 1 \
    -y "$OUT" &
else
  /opt/homebrew/bin/ffmpeg -hide_banner -loglevel warning \
    -f avfoundation -capture_cursor 1 -framerate 30 -i "${VID}:none" \
    -c:v h264_videotoolbox -b:v 10M -pix_fmt yuv420p -an \
    -y "$OUT" &
fi
FF=$!
sleep 2
echo ">> recorder up; driving phase $PHASE (narrate now if mode=mic)"
PHASE="$PHASE" node "$HERE/demo_video/record_demo.mjs" || true
# record_demo.mjs touches the sentinel when done; wait for ffmpeg to flush.
for i in $(seq 1 20); do [[ -f "$SENT" ]] && break; sleep 1; done
kill -INT $FF 2>/dev/null || true
wait $FF 2>/dev/null || true
rm -f "$SENT"
echo "== PHASE $PHASE done -> $OUT =="
