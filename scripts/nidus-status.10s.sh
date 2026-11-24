#!/bin/sh
# SwiftBar plugin: Nidus session state in the menu bar, refreshed every 10s (interval comes from the filename).
# install: brew install --cask swiftbar → pick a plugin folder → ln -s "$PWD/scripts/nidus-status.10s.sh" <plugin folder>/
export PATH=$PATH:/opt/homebrew/bin:/usr/local/bin # SwiftBar's PATH may lack homebrew
LOG=$HOME/Library/Logs/nidus-watchdog.log
HERE=$(dirname "$(realpath "$0")") # $0 is the symlink in the SwiftBar folder
ATTACH=$HERE/nidus-attach.command

case $(sh "$HERE/nidus-state.sh") in
off) icon=🔴 state=꺼짐 ;;
waiting) icon=🟡 state="승인 대기 (attach해서 확인)" ;;
working) icon=🔵 state="작업 중" ;;
*) icon=🟢 state=대기 ;;
esac

echo "$icon"
echo "---"
echo "Nidus: $state"
launchctl print "gui/$(id -u)/com.nidus.watchdog" >/dev/null 2>&1 || echo "watchdog 꺼져 있음 (scripts/watchdog.sh install) | color=red"
echo "---"
# open -a Terminal needs no Automation permission, unlike SwiftBar's terminal=true (AppleScript).
echo "터미널에서 열기 (tmux attach) | bash=/usr/bin/open param1=-a param2=Terminal param3=$ATTACH terminal=false"
echo "watchdog 최근 로그"
tail -n 5 "$LOG" 2>/dev/null | sed 's/^/--/; s/$/ | font=Menlo size=11/'
echo "새로고침 | refresh=true"
