#!/bin/sh
# Print the nidus session state: off | waiting | working | idle. Shared by watchdog.sh and the menu bar plugin.
# shortcut: guessed from Claude Code's on-screen text (checked 2026-11-25); update the patterns if its wording changes.
tmux has-session -t nidus 2>/dev/null || { echo off; exit 0; }
case $(tmux capture-pane -p -t nidus 2>/dev/null) in
*"Enter to confirm"* | *"Do you want"* | *"Esc to cancel"*) echo waiting ;;
*"esc to interrupt"*) echo working ;;
*)
  # Background subagents leave the pane idle; plugin/hooks/running.mjs keeps a file per running one.
  # Files older than 3h count as leftovers of an agent that never reported SubagentStop.
  office=${NIDUS_OFFICE:-$(tmux display-message -p -t nidus '#{pane_current_path}' 2>/dev/null)} # claude's cwd is the office
  if [ -n "$office" ] && [ -n "$(find "$office/system/running" -type f -mmin -180 2>/dev/null | head -n 1)" ]; then
    echo working
  else echo idle; fi ;;
esac
