# dotfiles の指示

## モデル名と permissions

モデル名と、確認なしで通す・止めるコマンドは `.chezmoidata/agents.yaml` に置く。`dot_config/agents/shared.md.tmpl` の表、Claude Code と Codex の設定、`herdr-coding` はそこから作る。

次のファイルはモデル名を直書きしているので、`agents.yaml` の `models` を変えたら合わせて直す：

- `dot_bin/executable_codex-code-pr-review`
- `dot_bin/executable_codex-dep-pr-review`
