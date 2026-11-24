#!/bin/sh
# Start the always-on Nidus office session in tmux. usage: scripts/office.sh <vault path> [office dir]
set -eu
[ $# -ge 1 ] || { echo "usage: $0 <vault path> [office dir]" >&2; exit 2; }
VAULT=$1
OFFICE=${2:-$HOME/NidusOffice}
PLUGIN=$(cd "$(dirname "$0")/../plugin" && pwd)
mkdir -p "$OFFICE/tasks"
touch "$OFFICE/jobs.md" "$OFFICE/chat.md"
tmux new-session -d -s nidus -c "$OFFICE" \
  "caffeinate -i env NIDUS_GUARD=1 NIDUS_READONLY='$VAULT:$HOME/Developer/Asset_Frame' claude --plugin-dir '$PLUGIN' --add-dir '$VAULT' \
   --channels plugin:telegram@claude-plugins-official --permission-mode auto --model sonnet"
echo "started: tmux attach -t nidus"
