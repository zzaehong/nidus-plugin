#!/bin/sh
# SwiftBar plugin: Nidus session state in the menu bar, refreshed every 10s (interval comes from the filename).
# install: brew install --cask swiftbar → pick a plugin folder → ln -s "$PWD/scripts/nidus-status.10s.sh" <plugin folder>/
export PATH=$PATH:/opt/homebrew/bin:/usr/local/bin # SwiftBar's PATH may lack homebrew
LOG=$HOME/Library/Logs/nidus-watchdog.log
HERE=$(dirname "$(realpath "$0")") # $0 is the symlink in the SwiftBar folder
ATTACH=$HERE/nidus-attach.command

icon=$(sh "$HERE/nidus-state.sh")
case $icon in
off) state=꺼짐 ;;
waiting) state="승인 대기 (attach해서 확인)" ;;
working) state="작업 중" ;;
*) icon=idle state=대기 ;;
esac
# Telegram channel alive = plugin's server.ts still holds bot.pid (same check as watchdog.sh tg_up).
pid=$(cat "${NIDUS_TG_DIR:-$HOME/.claude/channels/telegram}/bot.pid" 2>/dev/null)
if [ "$icon" != off ] && ! { [ -n "$pid" ] && ps -p "$pid" -o args= 2>/dev/null | grep -q server.ts; }; then
  icon=tgdown state="$state · Telegram 끊김 (watchdog이 대기 상태일 때 재시작)"
fi

# House whose window light shows the state; drawn in assets/menubar.svg, rendered by assets/render.swift.
echo " | image=$(base64 <"$HERE/../assets/menubar/$icon.png" | tr -d '\n')"
echo "---"
echo "Nidus: $state"
launchctl print "gui/$(id -u)/com.nidus.watchdog" >/dev/null 2>&1 || echo "watchdog 꺼져 있음 (scripts/watchdog.sh install) | color=red"
echo "---"
# open -a Terminal needs no Automation permission, unlike SwiftBar's terminal=true (AppleScript).
echo "터미널에서 열기 (tmux attach) | bash=/usr/bin/open param1=-a param2=Terminal param3=$ATTACH terminal=false"
echo "watchdog 최근 로그"
tail -n 5 "$LOG" 2>/dev/null | sed 's/^/--/; s/$/ | font=Menlo size=11/'
echo "새로고침 | refresh=true"
