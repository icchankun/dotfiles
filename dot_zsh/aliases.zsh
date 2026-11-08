alias c="claude"

# Expands to a branch picked with peco, as in `gco lb`. sed strips the `*` of the current branch and the `+` of a branch checked out in a worktree.
alias -g lb='$(git branch | peco --prompt "GIT BRANCH>" | head -n 1 | sed -e "s/^[*+][[:space:]]*//g")'
