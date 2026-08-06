#!/bin/zsh
# Launch a dedicated Chrome instance with remote debugging for CDP-driven demo.
# Separate --user-data-dir => runs alongside your normal Chrome, untouched.
pkill -f "remote-debugging-port=9222" 2>/dev/null
sleep 1
PROFILE="$HOME/foi_demo_chrome"
rm -f "$PROFILE"/Singleton* 2>/dev/null
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="$PROFILE" \
  --no-first-run --no-default-browser-check \
  --new-window "https://mail.google.com/" \
  > /tmp/foi_chrome_launch.log 2>&1 &
echo "chrome_pid=$!"
