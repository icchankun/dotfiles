# Keep the base branch current when entering a repository: git-auto-sync runs in
# the background, and its result is printed before the next prompt so it does
# not break the line being typed.
# (リポジトリに入ったら、ベースのブランチを最新にする。git-auto-sync は裏で動き、
#  結果は次のプロンプトの前に出す。入力中の行を崩さないため。)
autoload -Uz add-zsh-hook

# Under the home directory, not /tmp, so another user cannot plant a link there.
# (/tmp ではなくホームの下に置く。ほかのユーザーにリンクを仕込まれないため。)
_git_auto_sync_report_file="${XDG_STATE_HOME:-$HOME/.local/state}/dev-flow/git-auto-sync.$$"
mkdir -p -- "${_git_auto_sync_report_file:h}"

_git_auto_sync() {
  git rev-parse --is-inside-work-tree &>/dev/null || return
  git-auto-sync "$_git_auto_sync_report_file" &>/dev/null &!
}

_git_auto_sync_report() {
  [[ -s $_git_auto_sync_report_file ]] || return
  cat -- "$_git_auto_sync_report_file"
  command rm -f -- "$_git_auto_sync_report_file"
}

add-zsh-hook chpwd _git_auto_sync
add-zsh-hook precmd _git_auto_sync_report
_git_auto_sync
