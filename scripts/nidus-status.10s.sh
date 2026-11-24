#!/bin/sh
# SwiftBar plugin: Nidus session state in the menu bar, refreshed every 10s (interval comes from the filename).
# install: brew install --cask swiftbar → pick a plugin folder → ln -s "$PWD/scripts/nidus-status.10s.sh" <plugin folder>/
export PATH=$PATH:/opt/homebrew/bin:/usr/local/bin # SwiftBar's PATH may lack homebrew
LOG=$HOME/Library/Logs/nidus-watchdog.log
ATTACH=$(dirname "$(realpath "$0")")/nidus-attach.command # $0 is the symlink in the SwiftBar folder

# shortcut: state is guessed from on-screen text of Claude Code's TUI; update the patterns if its wording changes.
if ! tmux has-session -t nidus 2>/dev/null; then
  icon=🔴 state=꺼짐
else
  pane=$(tmux capture-pane -p -t nidus 2>/dev/null)
  case $pane in
  *"Enter to confirm"* | *"Do you want"* | *"Esc to cancel"*) icon=🟡 state="승인 대기 (attach해서 확인)" ;;
  *"esc to interrupt"*) icon=🔵 state="작업 중" ;;
  *) icon=🟢 state=대기 ;;
  esac
fi

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
