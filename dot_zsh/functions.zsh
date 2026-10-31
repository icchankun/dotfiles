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

# Herdr.appのterminalで起動したClaude Codeに driver のセッション名 (`t7-driver`) を付ける。
# 名前に terminal の番地が入るので、セッション間メッセージの宛先を探さずに済む。
# -n を明示した起動 (herdr-coding のレビュー役など) はワーカー側の名前を尊重して素通しする。
claude() {
  if [[ -n ${HC_TERMINAL_ID:-} && ( $# -eq 0 || $1 == -* ) \
        && " $* " != *" -n "* && " $* " != *" --name "* ]]; then
    local name
    name="$(herdr-agent-name)" || { command claude "$@"; return }
    command claude -n "$name" "$@"
  else
    command claude "$@"
  fi
}
