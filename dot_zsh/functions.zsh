# select a previously executed command.
function select-history() {
  BUFFER=$(\history -n -r 1 | peco --query "$LBUFFER")
  CURSOR=$#BUFFER
  zle clear-screen
}
zle -N select-history
bindkey '^r' select-history

# select a previously opened directory.
if [[ -n $(echo ${^fpath}/chpwd_recent_dirs(N)) && -n $(echo ${^fpath}/cdr(N)) ]]; then
    autoload -Uz chpwd_recent_dirs cdr add-zsh-hook
    add-zsh-hook chpwd chpwd_recent_dirs
    zstyle ':completion:*' recent-dirs-insert both
    zstyle ':chpwd:*' recent-dirs-default true
    zstyle ':chpwd:*' recent-dirs-max 1000
    zstyle ':chpwd:*' recent-dirs-file "$HOME/.cache/chpwd-recent-dirs"
fi
function get-destination-from-cdr() {
  cdr -l | \
  sed -e 's/^[[:digit:]]*[[:blank:]]*//' | \
  peco --query "$LBUFFER"
}
function cdr-cd() {
  local destination="$(get-destination-from-cdr)"
  if [ -n "$destination" ]; then
    BUFFER="cd $destination"
    zle accept-line
  else
    zle reset-prompt
  fi
}
zle -N cdr-cd
bindkey '^u' cdr-cd

# git worktree remove + cd to main worktree
rm-wt() {
  local main_worktree target
  main_worktree=$(git worktree list | head -1 | awk '{print $1}')
  target=$(git worktree list | tail -n +2 | peco --prompt "REMOVE WORKTREE>" | awk '{print $1}')
  [[ -z "$target" ]] && return
  git worktree remove "$target" "$@" && cd "$main_worktree"
}
