#!/bin/bash
# statusline 用: 今のブランチの PR の URL を出力する。gh は遅いので、ブランチごとに60秒キャッシュする
dir=$(jq -r '.cwd // .workspace.current_dir // empty' 2>/dev/null)
[ -n "$dir" ] && cd "$dir" 2>/dev/null || exit 0
branch=$(git branch --show-current 2>/dev/null)
[ -z "$branch" ] && exit 0
cache="$HOME/.cache/statusline-pr-url/$(git rev-parse --show-toplevel | tr / _)_${branch//\//_}"
if [ -z "$(find "$cache" -mmin -1 2>/dev/null)" ]; then
  mkdir -p "$(dirname "$cache")"
  # mise のシムは cwd の設定で使うものを変えるので、開いているリポジトリの外で gh の場所を決める
  gh=$(cd ~ && mise which gh 2>/dev/null) || exit 0
  "$gh" pr view --json url -q .url >"$cache" 2>/dev/null || : >"$cache"
fi
cat "$cache"
