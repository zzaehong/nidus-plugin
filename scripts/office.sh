#!/bin/sh
# Start the always-on Nidus office session in tmux. usage: scripts/office.sh <vault path> [office dir]
set -eu
[ $# -ge 1 ] || { echo "usage: $0 <vault path> [office dir]" >&2; exit 2; }
VAULT=$1
OFFICE=${2:-$HOME/NidusOffice}
PLUGIN=$(cd "$(dirname "$0")/../plugin" && pwd)
mkdir -p "$OFFICE/tasks"
touch "$OFFICE/jobs.md" "$OFFICE/chat.md"
# SessionStart only adds context, so after a watchdog restart nothing re-registers /loop until a prompt arrives.
PROMPT=""
[ "${NIDUS_RESTARTED:-}" = 1 ] && PROMPT=" 'watchdog가 세션을 다시 시작했다. jobs.md의 반복 작업을 /loop로 다시 등록하고, 진행 중인 tasks를 이어 가고, 재시작 사실을 Telegram으로 알려라.'"
tmux new-session -d -s nidus -c "$OFFICE" \
  "caffeinate -i env NIDUS_GUARD=1 NIDUS_READONLY='$VAULT:$HOME/Developer/Asset_Frame' claude --plugin-dir '$PLUGIN' --add-dir '$VAULT' \
   --channels plugin:telegram@claude-plugins-official --permission-mode auto --model sonnet$PROMPT"
echo "started: tmux attach -t nidus"
