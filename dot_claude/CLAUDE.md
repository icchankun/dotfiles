# セッション開始時の手順

以下のいずれかが渡された場合は `/git-branch` で branch・worktree を作成してから作業を開始する：
- GitHub Issue のリンク
- Notion チケットのリンク
- PR を前提とした実装方針

上記に該当しない場合（調査・質問・簡単な設定変更など）は、branch を作成せずそのまま対応する。

# Herdr のペイン間でやりとりする手順

相手が Claude セッションなら `SendMessage` を使う。宛先は `ListAgents` に出る名前で、Herdr の pane ID に役割を付けた形（`wC:p2` の driver なら `wc-p2-driver`、その reviewer なら `wc-p2-reviewer`）に揃えてある。

`herdr agent prompt` は TTY への打ち込みで、返事は画面から読み取るしかない。Codex や Gemini など Claude 以外が相手のとき、または `ListAgents` に出てこないときに使う。

# 文章を書くとき

人に読ませる文章（コミットメッセージ、PR、レビューへの返信、ドキュメント、コードコメント、この会話での返答）は、AI が書いたように見える癖を避ける。日本語は `humanizer-ja`、英語は `humanizer:humanizer` の観点で見直してから出す。
