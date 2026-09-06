# select a previously executed command.
function select-history() {
  BUFFER=$(\history -n -r 1 | peco --query "$LBUFFER")
  CURSOR=$#BUFFER
  zle clear-screen
}
zle -N select-history
bindkey '^r' select-history

# git worktree remove + cd to main worktree
rm-wt() {
  local main_worktree target
  main_worktree=$(git worktree list | head -1 | awk '{print $1}')
  target=$(git worktree list | tail -n +2 | peco --prompt "REMOVE WORKTREE>" | awk '{print $1}')
  [[ -z "$target" ]] && return
  git worktree remove "$target" "$@" && cd "$main_worktree"
}

# Herdrのペインで手動起動したClaude Codeに driver のセッション名を付ける。
# セッション間メッセージの宛先とペインボーダーのラベルが一致し、宛先を探さずに済む。
# 名前をSessionStartフックにも渡し、Herdr側のagent名を同じものに揃えさせる。
# -n を明示した起動 (herdr-layout のワーカーなど) はワーカー側の名前を尊重して素通しする。
claude() {
  if [[ -n ${HERDR_PANE_ID:-} && ( $# -eq 0 || $1 == -* ) \
        && " $* " != *" -n "* && " $* " != *" --name "* ]]; then
    local name
    name="$(herdr-agent-name)" || { command claude "$@"; return }
    HERDR_AGENT_NAME="$name" command claude -n "$name" "$@"
  else
    command claude "$@"
  fi
}
