# dotfiles の Claude Code 向けの指示

@AGENTS.md

## コミットと PR

- コミットメッセージに `Claude-Session:` トレーラーを付けず、PR の説明に claude.ai のセッションのリンクを入れない。`.claude/settings.json` で切っているが、複数のリポジトリを扱うクラウドのセッションはそのファイルを読まない。
