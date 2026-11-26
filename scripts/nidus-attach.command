#!/bin/sh
# Opened by Terminal from the menu bar plugin: attach to the always-on session.
export PATH=$PATH:/opt/homebrew/bin:/usr/local/bin
exec tmux attach -t nidus
