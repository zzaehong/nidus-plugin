#!/bin/sh
# Print the nidus session state: off | waiting | working | idle. Shared by watchdog.sh and the menu bar plugin.
# shortcut: guessed from Claude Code's on-screen text (checked 2026-11-25); update the patterns if its wording changes.
tmux has-session -t nidus 2>/dev/null || { echo off; exit 0; }
case $(tmux capture-pane -p -t nidus 2>/dev/null) in
*"Enter to confirm"* | *"Do you want"* | *"Esc to cancel"*) echo waiting ;;
*"esc to interrupt"*) echo working ;;
*) echo idle ;;
esac
