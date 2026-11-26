# Sourced by office.sh and watchdog.sh. Reads the user's permission config line by line; the config is never sourced.
# Format (~/.config/nidus/config):  key = value   one value per line, repeat a key for more, # starts a comment
NIDUS_CONFIG=${NIDUS_CONFIG:-$HOME/.config/nidus/config}

# conf <key>: its values, one per line, with a leading ~ expanded
conf() {
  [ -f "$NIDUS_CONFIG" ] || return 0
  sed -nE "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*([^#]*[^#[:space:]])[[:space:]]*(#.*)?$/\1/p" "$NIDUS_CONFIG" |
    while IFS= read -r v; do case $v in "~") v=$HOME ;; "~/"*) v=$HOME/${v#"~/"} ;; esac; printf '%s\n' "$v"; done
}

# conf_paths <key>: values joined with ':'; fails on anything that would break the session's launch line or path lists
conf_paths() {
  conf "$1" | {
    out=""
    while IFS= read -r p; do
      case $p in /?*) ;; *) echo "nidus config $1: 절대 경로(또는 ~/...)여야 하고 / 하나는 안 됨: $p" >&2; exit 1 ;; esac
      case $p in *[\':]*) echo "nidus config $1: 경로에 ' 나 : 는 쓸 수 없음: $p" >&2; exit 1 ;; esac
      out=${out:+$out:}${p%/}
    done
    printf '%s' "$out"
  }
}
