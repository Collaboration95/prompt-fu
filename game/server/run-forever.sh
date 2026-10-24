#!/bin/sh
# Keep the Prompt Fu backend up: restart on crash, keep the Mac awake while it runs.
# Usage (from anywhere): nohup sh game/server/run-forever.sh >> ~/Library/Logs/prompt-fu.log 2>&1 &
cd "$(dirname "$0")/../.." || exit 1
caffeinate -ims -w $$ &
while true; do
  echo "$(date '+%F %T') starting server"
  HOST=0.0.0.0 node game/server/server.mjs
  echo "$(date '+%F %T') server exited ($?), restarting in 2s"
  sleep 2
done
