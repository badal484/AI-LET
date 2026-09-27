#!/bin/bash
# Keeps the dev phone's USB tunnels (Metro 8081, API 4000) alive across USB reconnects.
# Re-adds forwarding only after two consecutive failed checks, and never removes a working tunnel.
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
fails=0
while true; do
  for serial in $("$ADB" devices </dev/null | awk 'NR>1 && $2=="device" {print $1}'); do
    if "$ADB" -s "$serial" shell 'curl -s -m 3 -o /dev/null http://127.0.0.1:8081/status && curl -s -m 3 -o /dev/null http://127.0.0.1:4000/health/live && echo OK' </dev/null 2>/dev/null | grep -q OK; then
      fails=0
    else
      fails=$(( fails + 1 ))
      if [ "$fails" -ge 2 ]; then
        "$ADB" -s "$serial" reverse tcp:8081 tcp:8081 </dev/null >/dev/null 2>&1
        "$ADB" -s "$serial" reverse tcp:4000 tcp:4000 </dev/null >/dev/null 2>&1
        echo "$(date '+%H:%M:%S') restored adb reverse for $serial"
        fails=0
      fi
    fi
  done
  sleep 3
done
