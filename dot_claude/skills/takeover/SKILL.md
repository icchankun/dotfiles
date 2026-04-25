---
name: takeover
description: 指定worktreeの .claude/HANDOVER.md を読み込み、前セッションの作業内容を引き継ぐ。「引き継ぎ」「takeover」「前のセッションの続き」「handoverを読んで」「作業を引き継いで」と言及された場合に使用する。
---

# /takeover

`/handover` で保存された HANDOVER.md を読み込み、前セッションの文脈を引き継ぐ。

## ステップ1: HANDOVER.md の読み込み

ユーザーに引き継ぎ元のworktreeパスを確認し、HANDOVER.md を読み込む:

**読み込み先**: `<引き継ぎ元worktreeパス>/.claude/HANDOVER.md`

ファイルが存在しない場合は、その旨をユーザーに伝えて終了する。

## ステップ2: 現在の状態との照合

以下を**並列**で実行し、現在の環境を把握する:

```bash
git branch --show-current
pwd
git status --short
git log --oneline -5
```

HANDOVER.md に記載されたブランチ・worktree と現在の環境の差異を把握する。

## ステップ3: 引き継ぎ内容の報告

以下を簡潔に報告する（HANDOVER.md の内容をそのまま貼り付けない）:

1. **前セッションの概要**: タスク概要と完了/未完了の作業
2. **現在の状態との差異**: ブランチやworktreeの違いがあれば伝える
3. **推奨する次のアクション**: 現在の状態を踏まえて提案

「何から始めますか？」と問いかけて終了する。
