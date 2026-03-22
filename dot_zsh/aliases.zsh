alias c="claude"

## select git branch interactively (used with gco, git wt, etc.)
alias -g lb='$(git branch | peco --prompt "GIT BRANCH>" | head -n 1 | sed -e "s/^[*+][[:space:]]*//g")'
