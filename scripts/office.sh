#!/bin/sh
# Start the always-on Nidus office session in tmux. usage: scripts/office.sh <vault path> <office dir>
set -eu
[ $# -ge 2 ] && [ -d "$1" ] || { echo "usage: $0 <vault path> <office dir>" >&2; exit 2; }
VAULT=$(cd "$1" && pwd) # guard compares absolute paths
mkdir -p "$2"
OFFICE=$(cd "$2" && pwd)
PLUGIN=$(cd "$(dirname "$0")/../plugin" && pwd)
REPO=$(dirname "$PLUGIN")
. "$REPO/scripts/nidus-config.sh"
WR=$(conf_paths writable) # separate lines: in one multi-assignment set -e only sees the last failure
RO_USER=$(conf_paths readonly)
NOREAD=$(conf_paths noread)
WR=${WR:-$HOME/Developer} # builder may write here
case ":$WR:" in *":$HOME:"*) echo "nidus config writable: 홈 폴더 전체는 안 됨 (.zshrc 같은 실행 파일이 들어 있음)" >&2; exit 2 ;; esac
# Fixed and not removable by config: the vault, this repo (hooks/agents), the config itself, launchd plists.
RO=$VAULT:$REPO:$(dirname "$NIDUS_CONFIG"):$HOME/Library/LaunchAgents${RO_USER:+:$RO_USER}
ADD=""
IFS=: && set -f
for d in $WR; do mkdir -p "$d"; ADD="$ADD --add-dir '$d'"; done
unset IFS && set +f
mkdir -p "$OFFICE/tasks" "$OFFICE/outputs" "$OFFICE/system"
touch "$OFFICE/jobs.md" "$OFFICE/system/chat.md"
# SessionStart only adds context, so after a watchdog restart nothing re-registers /loop until a prompt arrives.
case ${NIDUS_RESTARTED:-} in
1) PROMPT=" 'watchdog가 세션을 다시 시작했다. jobs.md의 반복 작업을 /loop로 다시 등록하고, 진행 중인 tasks를 이어 가고, 재시작 사실을 Telegram으로 알려라.'" ;;
daily) PROMPT=" 'watchdog의 일일 재시작이다. system/handoff.md를 읽고 이어 갈 일을 이어 가고, jobs.md의 반복 작업을 /loop로 다시 등록한 뒤, 일일 재시작을 마쳤다는 것과 이어 간 일을 Telegram으로 짧게 알려라. Telegram이 안 되면 office 스킬의 Telegram이 안 될 때 절차를 따른다.'" ;;
telegram) PROMPT=" 'Telegram 연결이 끊겨 watchdog이 세션을 다시 시작했다. system/handoff.md를 읽고 이어 갈 일을 이어 가고, jobs.md의 반복 작업을 /loop로 다시 등록하고, 재연결 사실을 Telegram으로 알려라. 끊긴 동안 온 메시지는 받지 못했을 수 있다고 함께 알려라.'" ;;
request) PROMPT=" '직전 세션의 요청으로 watchdog이 세션을 다시 시작했다. system/handoff.md를 읽고 이어 갈 일을 이어 가고, jobs.md의 반복 작업을 /loop로 다시 등록하라. Telegram이 되면 재시작 사실과 사유를 알리고, 안 되면 office 스킬의 Telegram이 안 될 때 절차를 따른다.'" ;;
*) PROMPT="" ;;
esac
tmux new-session -d -s nidus -c "$OFFICE" \
  "caffeinate -i env NIDUS_GUARD=1 NIDUS_WATCHDOG='$REPO/scripts/watchdog.sh' NIDUS_OFFICE='$OFFICE' NIDUS_VAULT='$VAULT' NIDUS_READONLY='$RO' NIDUS_WRITABLE='$WR' NIDUS_NOREAD='$NOREAD' claude --plugin-dir '$PLUGIN' --add-dir '$VAULT'$ADD \
   --channels plugin:telegram@claude-plugins-official --permission-mode auto --model sonnet$PROMPT"
echo "started: tmux attach -t nidus"
