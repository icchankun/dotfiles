---
name: git-branch
description: gitブランチ名をConventional Branch規則に従って提案し、worktreeとして作成する。差分がある場合は差分から、なければユーザーへの質問から命名候補を生成する。ユーザーが「ブランチを切りたい」「新しいブランチ」「作業を始めたい」「worktreeを作りたい」「この作業用のブランチ」「新しい機能を実装したい」「バグを直したい」と言った場合や、新しいタスクに取りかかろうとしている場合に使う。明示的にブランチ名を指定していなくても、新しい作業の開始を示唆していればこのスキルを使うこと。
---

# /git-branch スキル

gitの差分やユーザーの入力をもとに、[Conventional Branch](https://conventional-branch.github.io) 命名規則に従ったブランチ名候補を提案し、worktreeとして作成する

## 手順

### ステップ1: 変更内容の把握

以下のコマンドを**並列**で実行:

- `git diff`
- `git diff --cached`
- `git status`（`-uall` は使わない）

**差分がある場合**: 差分からどのような変更かを推測し、ステップ2へ進む
**差分がない場合**: ユーザーにどのような変更を行う予定かを質問する

### ステップ2: チケット番号の確認

引数でチケット番号が渡された場合はそれを使う
渡されていない場合は「チケット番号やissue番号はありますか？（なければそのままEnterで続行）」と確認する

### ステップ3: ブランチ名候補の提案

後述の「Conventional Branch 命名規則」に従って**3つ程度**の候補を提案する
候補はそれぞれ異なる粒度や視点で命名し、日本語の説明を添える:

```
1. feat/PROJ-123-add-user-profile - ユーザープロフィール機能の追加
2. feat/PROJ-123-user-profile-page - ユーザープロフィールページの実装
3. feat/add-user-profile - チケット番号なしの短い代替案
```

チケット番号がない場合はチケット番号なしの候補のみ提案する

### ステップ4: ユーザーの選択

番号で選択してもらう
ユーザーが修正した名前を返してきた場合はそれを使う

### ステップ5: 作成元ブランチの選択

以下を確認する:

```
どこからブランチを切りますか？
1. develop から切る
2. 現在のブランチ（<現在のブランチ名>）から切る
```

### ステップ6: worktreeの作成

`git wt`（`git worktree` のラッパー）でworktreeを作成する:

- developから切る場合: `git wt <ブランチ名> develop`
- 現在のブランチから切る場合: `git wt <ブランチ名>`

## Conventional Branch 命名規則

参考: [Conventional Branch](https://conventional-branch.github.io)

### フォーマット

```
<type>/<description>
<type>/<ticket-id>-<description>  （チケット番号がある場合）
```

### タイプ一覧

変更の主目的に最も合うタイプを選ぶ:

| type | 用途 | 例 |
|------|------|------|
| `feat` | 新機能の追加 | `feat/add-login-page` |
| `fix` | バグ修正 | `fix/header-alignment-bug` |
| `chore` | コード以外のタスク | `chore/update-dependencies` |
| `refactor` | リファクタリング | `refactor/extract-auth-service` |
| `docs` | ドキュメント | `docs/update-readme` |
| `test` | テスト | `test/add-user-model-specs` |
| `ci` | CI設定 | `ci/add-lint-workflow` |
| `perf` | パフォーマンス改善 | `perf/optimize-query` |

### 命名ルール

- 小文字（`a-z`）、数字（`0-9`）、ハイフン（`-`）のみ使用
- 単語の区切りはハイフン
- ハイフンやドットを連続・先頭・末尾に置かない
- 簡潔かつ目的が明確に伝わる英語の名前にする

**良い例:**
- `feat/add-user-profile` — 目的が明確で簡潔
- `fix/PROJ-42-null-name-in-performers` — チケット番号と問題の内容がわかる
- `refactor/extract-auth-middleware` — 何をリファクタするかが具体的

**悪い例:**
- `feat/update` — 何を追加するのか不明
- `fix/bug` — どのバグかわからない
- `feat/Add-User-Profile-Page` — 大文字が混在
- `feat/add_user_profile` — アンダースコアではなくハイフンを使う

## 禁止事項

- `git commit` はこのスキル内では実行しない
