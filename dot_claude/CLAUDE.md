# セッション開始時の手順

以下のいずれかが渡された場合は `/git-branch` で branch・worktree を作成してから作業を開始する：
- GitHub Issue のリンク
- Notion チケットのリンク
- PR を前提とした実装方針

上記に該当しない場合（調査・質問・簡単な設定変更など）は、branch を作成せずそのまま対応する。

# Herdr のペイン間でやりとりする手順

相手が Claude セッションなら `SendMessage` を使う。宛先は `ListAgents` に出る名前で、Herdr の pane ID と同じ規則（`wC:p2` → `wc-p2`）に揃えてある。

`herdr agent prompt` は TTY への打ち込みで、返事は画面から読み取るしかない。Codex や Gemini など Claude 以外が相手のとき、または `ListAgents` に出てこないときに使う。
