#!/bin/sh
# Keep the nidus tmux session alive via launchd (checks every 60s).
# usage: watchdog.sh install <vault path> [office dir] | uninstall | check <vault path> [office dir]
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
LABEL=com.nidus.watchdog
PLIST=$HOME/Library/LaunchAgents/$LABEL.plist
LOG=$HOME/Library/Logs/nidus-watchdog.log
MAX=3 WINDOW=1800 # at most 3 restarts per 30 min, so a crash loop can't burn usage limits

case ${1:-} in
check)
  VAULT=$2 OFFICE=${3:-$HOME/NidusOffice}
  tmux has-session -t nidus 2>/dev/null && exit 0
  f=$OFFICE/.watchdog-restarts now=$(date +%s)
  mkdir -p "$OFFICE" && touch "$f"
  awk -v t=$((now - WINDOW)) '$1 > t' "$f" >"$f.tmp" && mv "$f.tmp" "$f"
  if [ "$(wc -l <"$f")" -ge $MAX ]; then
    echo "$(date '+%F %T') 30분 안에 재시작 ${MAX}회 → 보류 (로그 확인, 30분 뒤 재시도)"
    exit 0
  fi
  echo "$now" >>"$f"
  echo "$(date '+%F %T') nidus 세션 없음 → 재시작"
  NIDUS_RESTARTED=1 exec "${OFFICE_SH:-$DIR/office.sh}" "$VAULT" "$OFFICE"
  ;;
install)
  [ $# -ge 2 ] && [ -d "$2" ] || { echo "usage: $0 install <vault path> [office dir]" >&2; exit 2; }
  VAULT=$(cd "$2" && pwd) OFFICE=${3:-$HOME/NidusOffice}
  # launchd PATH is only /usr/bin:/bin:..., so bake in where claude/tmux/bun/node live (node runs the guard hook).
  P=""
  for c in claude tmux bun node; do
    p=$(command -v "$c") || { echo "$c 를 찾을 수 없음" >&2; exit 1; }
    d=$(dirname "$p")
    case $d in *fnm_multishells*) d=${FNM_DIR:-$HOME/.local/share/fnm}/aliases/default/bin ;; esac # per-shell fnm dir vanishes
    P=$P$d:
  done
  mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
  # shortcut: paths go into XML unescaped; a vault path containing & or < breaks the plist.
  cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>/bin/sh</string><string>$DIR/watchdog.sh</string><string>check</string>
    <string>$VAULT</string><string>$OFFICE</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>${P}/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>LANG</key><string>en_US.UTF-8</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>60</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict></plist>
EOF
  plutil -lint "$PLIST" >/dev/null
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  echo "설치됨: $PLIST (로그: $LOG)"
  ;;
uninstall)
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "제거됨. 실행 중인 nidus 세션은 그대로 둔다."
  ;;
*) sed -n 3p "$0" >&2; exit 2 ;;
esac
