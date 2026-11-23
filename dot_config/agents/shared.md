# エージェント共通の指示

## セッション開始時の手順

次のどれかと一緒に実装を頼まれたら、`dispatching-tasks` で branch・worktree を作り、driver に引き継ぐ：

- GitHub Issue のリンク
- Notion チケットのリンク
- PR を前提とした実装方針

それ以外の依頼（調査・質問・資料のまとめ・簡単な設定変更など）は、リンクがあっても branch を作らずにそのまま対応する。

- branch の worktree の作成・削除は `git wt` で行う。`git worktree add` を直接使うと、Herdr.app で開くフックが走らない。git-rewrite-guard が `--detach` のない `git worktree add` を止める。

## Herdr.app のペイン間でやりとりする手順

相手が Claude Code でも Codex でも `hc` を使う。使う前に `hc --skill` を読み、それに従う。

- 送る: `hc send <番地> "<本文>"`。返事がほしいときは、本文に返信先として `hc send $HC_TERMINAL_ID` を書く。
- 待つ: `hc wait --children any`。返事は `<hc from="t8 …">…</hc>` の形で、次の入力として届く。
- 相手のペインの画面を `hc read` で読みに行かない。自分が `hc run --bg` で動かしたジョブの出力は、`hc read <名前>` で読んでよい。
- 宛先は番地（`t7` など）で指定する。自分の番地は `$HC_TERMINAL_ID`。
- 「reviewer に送って」「t7 の driver に送って」のように役割で頼まれたら、ラベルから番地を探す。agent には `role`（`driver` か `reviewer`）と `driver`（どの driver のものか）のラベルが付いている。

```bash
hc ls --label role=reviewer --label driver="$HC_TERMINAL_ID"   # 自分の reviewer
hc ls --label role=driver --label driver=t7                     # t7 の driver
```

## ファイルを編集するとき

- ファイルの編集は、使える編集ツールで、同じ応答の中にまとめて出す。複数のファイルを1回で編集できるツールなら、1回にまとめる。
- サブエージェントに分けるのは、互いに関係しない機械的な変更が3ファイル以上あるときだけにする。サブエージェントは起動のたびに要件と周りのコードを読み直すので、小さな変更では自分で書くより遅く、トークンも増える。
- 分けるときは、何をどう変えるかを自分で決めて渡す。渡す相手は軽いモデルでよい。

## ユーザーに聞くとき

- 選択肢から選んでもらう質問は、選んで答えられる形で聞く。grilling など、skill の手順の中で聞く質問も同じ。
- Claude Code では `AskUserQuestion` を使う。
- Codex では、選択肢を出せるツールがあればそれを使い、なければ番号を振って並べる。

## 文章・コメントを書くとき

- 返答は日本語で書く。
- コードを書く・直すときは、`writing-code-comments` の SKILL.md を読み、コメントはその基準で書く。`ponytail:` のコメントは書かない。
- 人が読む、会話の外に残る文章（コミットメッセージ、PR、レビューへの返信、ドキュメント、コードコメント、Notion）は、推敲してから出す。日本語は `yomiyasu`、英語は `humanizer` の SKILL.md に従う。
- この会話での返答と、agent が読むもの（引き継ぎ・依頼・SKILL.md・AGENTS.md・CLAUDE.md などの指示ファイル）は推敲しない。

推敲の前に、読み手が判断や作業に使わない文を削る。yomiyasu は情報を削らないため。次のものは、読み手の判断に関わると言えない限り削る：

- 作業の経緯や試した過程
- 調べていないこと・確かめていないことの断り書き
- 読み手が何もしなくてよい後始末や予定
- 背景の説明に入れた細かい数値（件数・秒数・割合）

## ページを作るとき

- 説明の資料を HTML のページ・Claude の artifact・Notion の HTML ブロックで作るときは、`writing-explainer-pages` を使う。頼まれた言葉が「図解」「まとめ」「資料」のどれでも同じ。
- Notion のページを作るときは、作る前に `yomiyasu` と `visual-explainer` の SKILL.md を読む。文章は yomiyasu、図や表の見せ方は visual-explainer に従う。
- Notion に書き込むときは、どの skill を使っていても、先に書く場所と下書きを見せ、OK が出てから書き込む。

## UI を作るとき

- アプリの画面・コンポーネント・ランディングページの UI をデザインするとき、作るとき、直すときは、`frontend-design` と `unslop` の SKILL.md を両方読む。
- デザインの方向は frontend-design、AI が作ったように見えるところの直しは unslop に従う。

## 依頼を整えるとき

- `prompt-master` で依頼を整えるとき、依頼が日本語なら `tuning-japanese-prompts` の SKILL.md も読む。

## モデルの重さ

skill や指示が「軽いモデル」「標準のモデル」「重いモデル」と書いたら、次のモデルを使う。

| 重さ | Claude Code | Codex |
|---|---|---|
| 軽い | `haiku` | `gpt-6-luna` |
| 標準 | `sonnet` | `gpt-6-luna` |
| 重い | `opus` | `gpt-6.1-sol` |

- Codex のいちばん上のモデル（`gpt-6-astra`）は使わない。使える量が少なく、毎回の作業で回すと足りなくなる。
- モデルが廃止されたら、この表と、dotfiles（`~/.local/share/chezmoi`）でモデル名を直書きしているファイルを直す。ファイルの一覧は dotfiles の AGENTS.md にある。

## skill を入れるとき

- `find-skills` で見つけた skill は `npx skills add` で入れず、dotfiles の `dot_apm/apm.yml` に追記して apm で入れる。
