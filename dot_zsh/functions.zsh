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
