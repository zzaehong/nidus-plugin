#!/bin/sh
# Keep the nidus tmux session alive via launchd (runs every 60s): restart when gone, alert on Telegram when stuck,
# and restart once a day while idle after a handoff note. Its records live in <office>/system/.
# usage: watchdog.sh install <vault path> [office dir] | uninstall | check <vault path> [office dir] | notify <office dir> <text>
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
LABEL=com.nidus.watchdog
PLIST=$HOME/Library/LaunchAgents/$LABEL.plist
LOG=$HOME/Library/Logs/nidus-watchdog.log
MAX=3 WINDOW=1800            # at most 3 crash restarts per 30 min, so a crash loop can't burn usage limits
WAIT_ALERT=180               # approval prompt open this long → alert
WORK_ALERT=3600              # "working" this long → alert (spinner keeps redrawing even when stuck, so time is the signal)
export TZ=Asia/Seoul         # daily window is in KST regardless of the system setting
DAILY_HOUR=6 DAILY_END=8 HANDOFF_TIMEOUT=900 # daily restart only between 06:00 and 08:00
HANDOFF_PROMPT='일일 재시작 준비다. 다음 세션이 이어받을 내용(진행 중인 대화, 미완료 지시, 주의할 점)을 system/handoff.md에 덮어써라. 없으면 없음이라고 적어라. 새 작업은 시작하지 말고 Telegram으로 보내지 마라.'

num() { case $1 in '' | *[!0-9]*) echo "$2" ;; *) echo "$1" ;; esac; } # state file is writable by the session: never trust it

check() {
  VAULT=$1 OFFICE=$2
  SYS=$OFFICE/system STATEF=$OFFICE/system/watchdog.state
  mkdir -p "$SYS"
  NOW=$(num "${NIDUS_NOW:-}" "$(date +%s)")
  TODAY=$(date -r "$NOW" +%F) HOUR=$(date -r "$NOW" +%H)

  ST=none SINCE=$NOW ALERTED=0 DAILY=$TODAY HANDOFF=0 IDLE=0
  [ -f "$STATEF" ] && read -r ST SINCE ALERTED DAILY HANDOFF IDLE <"$STATEF" || true
  case ${ST:-} in off | waiting | working | idle) ;; *) ST=none ;; esac
  SINCE=$(num "${SINCE:-}" "$NOW") ALERTED=$(num "${ALERTED:-}" 0) HANDOFF=$(num "${HANDOFF:-}" 0) IDLE=$(num "${IDLE:-}" 0)
  case ${DAILY:-} in [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;; *) DAILY=$TODAY ;; esac # first run: no restart today

  cur=$(sh "$DIR/nidus-state.sh")
  [ "$cur" = "$ST" ] || { ST=$cur SINCE=$NOW ALERTED=0; }
  dur=$((NOW - SINCE))
  if [ "$cur" = idle ]; then IDLE=$((IDLE + 1)); else IDLE=0; fi

  case $cur in
  off) restart_crashed ;;
  waiting) [ "$dur" -ge $WAIT_ALERT ] && [ "$ALERTED" = 0 ] && tg "승인 대기 화면에서 $((dur / 60))분째 멈춰 있다. tmux attach -t nidus 로 확인해 줘." && ALERTED=1 ;;
  working) [ "$dur" -ge $WORK_ALERT ] && [ "$ALERTED" = 0 ] && tg "$((dur / 60))분째 작업 중이다. 멈췄을 수 있으니 확인해 줘." && ALERTED=1 ;;
  idle) daily_restart ;;
  esac

  # Rewrite only on change: system/ sits in the vault (git, Obsidian).
  printf '%s %s %s %s %s %s\n' "$ST" "$SINCE" "$ALERTED" "$DAILY" "$HANDOFF" "$IDLE" >"$STATEF.tmp"
  if cmp -s "$STATEF.tmp" "$STATEF"; then rm -f "$STATEF.tmp"; else mv "$STATEF.tmp" "$STATEF"; fi
}

restart_crashed() {
  f=$SYS/restarts
  touch "$f"
  awk -v t=$((NOW - WINDOW)) '$1 > t' "$f" >"$f.tmp" && mv "$f.tmp" "$f"
  if [ "$(wc -l <"$f")" -ge $MAX ]; then
    event "30분 안에 재시작 ${MAX}회 → 보류 (30분 뒤 재시도)"
    [ "$ALERTED" = 0 ] && tg "세션이 30분 안에 ${MAX}번 꺼져 재시작을 멈췄다. 로그: $LOG" && ALERTED=1
    return 0
  fi
  echo "$NOW" >>"$f"
  event "세션 없음 → 재시작"
  start 1
}

daily_restart() {
  [ "$DAILY" = "$TODAY" ] && return 0
  [ "$HOUR" -ge "$DAILY_HOUR" ] || return 0
  if [ "$HANDOFF" = 0 ]; then
    if [ "$HOUR" -ge $DAILY_END ]; then
      DAILY=$TODAY
      event "일일 재시작 건너뜀 (${DAILY_HOUR}~${DAILY_END}시 내내 바쁨)"
      tg "오늘 일일 재시작을 못 했다(계속 작업 중이거나 진행 중인 task가 있음). 내일 다시 시도한다." || true
      return 0
    fi
    [ "$IDLE" -ge 2 ] || return 0 # idle for two ticks in a row
    grep -lE '^status: *(접수|진행|검토)' "$OFFICE"/tasks/*/*/report.md >/dev/null 2>&1 && return 0
    tmux send-keys -t nidus -l "$HANDOFF_PROMPT"
    sleep "${NIDUS_KEY_DELAY:-1}"
    tmux send-keys -t nidus Enter
    HANDOFF=$NOW
    event "일일 재시작: handoff 요청"
    return 0
  fi
  h=$(stat -f %m "$SYS/handoff.md" 2>/dev/null || echo 0)
  if [ "$h" -ge "$HANDOFF" ] || [ $((NOW - HANDOFF)) -ge $HANDOFF_TIMEOUT ]; then
    [ "$h" -ge "$HANDOFF" ] || event "handoff.md가 15분 안에 안 써짐 → 그대로 재시작"
    tmux kill-session -t nidus || true
    DAILY=$TODAY HANDOFF=0 ST=none SINCE=$NOW ALERTED=0 IDLE=0
    event "일일 재시작"
    start daily
  fi
}

start() { NIDUS_RESTARTED=$1 "${OFFICE_SH:-$DIR/office.sh}" "$VAULT" "$OFFICE" || event "office.sh 실패 ($?)"; }

event() {
  echo "$(date -r "$NOW" '+%F %T') $1"
  echo "- $(date -r "$NOW" '+%F %H:%M') $1" >>"$SYS/events.md"
}

# Direct Bot API, so alerts work even when the session can't speak. sendMessage only: getUpdates would fight the plugin.
tg() {
  token=$(sed -nE 's/^TELEGRAM_BOT_TOKEN=["'\'']?([0-9]+:[A-Za-z0-9_-]+)["'\'']?$/\1/p' \
    "${NIDUS_TG_ENV:-$HOME/.claude/channels/telegram/.env}" 2>/dev/null | head -1)
  chat=$(grep -oE -- '-?[0-9]{3,}' "$OFFICE/system/chat.md" 2>/dev/null | head -1)
  [ -n "$token" ] && [ -n "$chat" ] || { event "Telegram 알림 실패: 토큰 또는 chat_id 없음"; return 1; }
  # url via stdin config keeps the token out of ps
  printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$token" |
    curl -fsS --max-time 10 -K - --data-urlencode "chat_id=$chat" --data-urlencode "text=[Nidus watchdog] $1" >/dev/null ||
    { event "Telegram 알림 실패: curl"; return 1; }
  event "Telegram 알림: $1"
}

case ${1:-} in
check)
  [ $# -ge 2 ] || { echo "usage: $0 check <vault path> [office dir]" >&2; exit 2; }
  check "$2" "${3:-$HOME/NidusOffice}"
  ;;
notify) # manual test of the direct Telegram path: watchdog.sh notify <office dir> <text>
  [ $# -ge 3 ] || { echo "usage: $0 notify <office dir> <text>" >&2; exit 2; }
  OFFICE=$2 SYS=$2/system NOW=$(date +%s)
  mkdir -p "$SYS"
  tg "$3"
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
*) sed -n 4p "$0" >&2; exit 2 ;;
esac
