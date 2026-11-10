# セッション開始時の手順

以下のいずれかと一緒に実装を頼まれたら、`dispatching-tasks` で branch・worktree を作り、driver に引き継ぐ：
- GitHub Issue のリンク
- Notion チケットのリンク
- PR を前提とした実装方針

上記に当たらない依頼（調査・質問・資料のまとめ・簡単な設定変更など）は、リンクがあっても branch を作らずそのまま対応する。

worktree の作成・削除は `git wt` で行う。`git worktree add` を直接使うと、Herdr.app で開くフックが走らない。

# コードを探すとき

リポジトリに `graphify-out/graph.json` があれば、grep やファイルを開く前に graphify でグラフを引く：
- `graphify query "<知りたいこと>"`：関係するファイルと関係
- `graphify explain "<名前>"`：1つのノードとそのつながり
- `graphify path "<A>" "<B>"`：2つのノードのつながり方

ファイルを読むのは、グラフで場所が分かってから。グラフはベースのブランチから1日2回作り直したもので、この branch で変えた分は入っていない。変えたファイルの関係を引きたいときは `graphify update .` で更新する（手元で解析するだけで、トークンは使わない）。

# Herdr.app のペイン間でやりとりする手順

相手が Claude Code でも Codex でも `hc` を使う。使う前に `hc --skill` を読み、それに従う。

- 送る: `hc send <番地> "<本文>"`。返事がほしいときは、本文に返信先として `hc send $HC_TERMINAL_ID` を書く。
- 待つ: `hc wait --children any`。返事は `<hc from="t8 …">…</hc>` の形で、次の入力として届く。`hc read` で相手のペインの画面を読みに行かない。自分が `hc run --bg` で動かしたジョブの出力は、`hc read <名前>` で読んでよい。
- 宛先は番地（`t7` など）で指定する。自分の番地は `$HC_TERMINAL_ID`。
- 「reviewer に送って」「t7 の driver に送って」のように役割で頼まれたら、ラベルから番地を探す。agent には `role`（`driver` か `reviewer`）と `driver`（どの driver のものか）のラベルが付いている。

```bash
hc ls --label role=reviewer --label driver="$HC_TERMINAL_ID"   # 自分の reviewer
hc ls --label role=driver --label driver=t7                     # t7 の driver
```

# ファイルを編集するとき

ファイルの編集は、使える編集ツールで、同じ応答の中にまとめて出す。複数のファイルを1回で編集できるツールなら、1回にまとめる。

サブエージェントに分けるのは、互いに関係しない機械的な変更が3ファイル以上あるときだけにする。何をどう変えるかは自分で決めて渡すので、軽いモデルでよい。サブエージェントは起動のたびに要件と周りのコードを読み直すので、小さな変更では自分で書くより遅く、トークンも増える。

# 文章・コメントを書くとき

返答は日本語で書く。

コードを書く・直すときは、`writing-code-comments` の SKILL.md を読み、コメントはその基準で書く。`ponytail:` のコメントは書かない。

人が読む、会話の外に残る文章（コミットメッセージ、PR、レビューへの返信、ドキュメント、コードコメント、Notion）は、`reviewing-writing` で見直してから出す。この会話での返答と、agent が読むもの（引き継ぎ・依頼・SKILL.md・AGENTS.md・CLAUDE.md などの指示ファイル）は対象外。

# モデルの重さ

skill や指示が「軽いモデル」「標準のモデル」「重いモデル」と書いたら、次のモデルを使う。モデルが廃止されたら、この表と、dotfiles（`~/.local/share/chezmoi`）でモデル名を直書きしている次のファイルを直す：`dot_bin/executable_codex-pr-review`、`dot_bin/executable_codex-dep-review`、`dot_bin/executable_herdr-coding`、`dot_codex/modify_config.toml.tmpl`、`dot_claude/settings.json`。

| 重さ | Claude Code | Codex |
|---|---|---|
| 軽い | `haiku` | `gpt-6-luna` |
| 標準 | `sonnet` | `gpt-6-luna` |
| 重い | `opus` | `gpt-6.1-sol` |

Codex のいちばん上のモデル（`gpt-6-astra`）は使わない。使える量が少なく、毎回の作業で回すと足りなくなる。

# skill を入れるとき

`find-skills` で見つけた skill は `npx skills add` で入れず、dotfiles の `dot_apm/apm.yml` に追記して apm で入れる。
