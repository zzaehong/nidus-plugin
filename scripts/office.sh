#!/bin/sh
# Start the always-on Nidus office session in tmux. usage: scripts/office.sh <vault path> <office dir>
set -eu
[ $# -ge 2 ] || { echo "usage: $0 <vault path> <office dir>" >&2; exit 2; }
VAULT=$1
mkdir -p "$2"
OFFICE=$(cd "$2" && pwd)
PLUGIN=$(cd "$(dirname "$0")/../plugin" && pwd)
mkdir -p "$OFFICE/tasks" "$OFFICE/outputs" "$OFFICE/system"
touch "$OFFICE/jobs.md" "$OFFICE/system/chat.md"
# SessionStart only adds context, so after a watchdog restart nothing re-registers /loop until a prompt arrives.
case ${NIDUS_RESTARTED:-} in
1) PROMPT=" 'watchdog가 세션을 다시 시작했다. jobs.md의 반복 작업을 /loop로 다시 등록하고, 진행 중인 tasks를 이어 가고, 재시작 사실을 Telegram으로 알려라.'" ;;
daily) PROMPT=" 'watchdog의 일일 재시작이다. system/handoff.md를 읽고 이어 갈 일을 이어 가고, jobs.md의 반복 작업을 /loop로 다시 등록하라. 문제가 없으면 Telegram으로 알리지 마라.'" ;;
*) PROMPT="" ;;
esac
tmux new-session -d -s nidus -c "$OFFICE" \
  "caffeinate -i env NIDUS_GUARD=1 NIDUS_OFFICE='$OFFICE' NIDUS_VAULT='$VAULT' NIDUS_READONLY='$VAULT:$HOME/Developer/nidus-plugin:$HOME/Developer/Asset_Frame/var' NIDUS_WRITABLE='$HOME/Developer' claude --plugin-dir '$PLUGIN' --add-dir '$VAULT' --add-dir '$HOME/Developer' \
   --channels plugin:telegram@claude-plugins-official --permission-mode auto --model sonnet$PROMPT"
echo "started: tmux attach -t nidus"
