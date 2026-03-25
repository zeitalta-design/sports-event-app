# データ取り込み 運用ガイド

> 定期実行（cron / scheduler）に載せるための実行手順。
> `.env` に URL を設定済みであることを前提とする。

---

## 1. 事前準備

### .env の設定

```bash
cp .env.example .env
```

以下を `.env` に設定する:

```
YUTAI_SOURCE_PRIMARY_URL=https://api.example.com/yutai
HOJOKIN_SOURCE_PRIMARY_URL=https://api.example.com/hojokin
NYUSATSU_SOURCE_PRIMARY_URL=https://api.example.com/nyusatsu
MINPAKU_SOURCE_PRIMARY_URL=https://api.example.com/minpaku
```

認証付き API の場合は token も設定:

```
YUTAI_SOURCE_PRIMARY_TOKEN=Bearer_xxx
```

---

## 2. 実行コマンド

### dry-run（本番実行前に必ず確認）

```bash
npm run imports:source:dry
```

DB を更新せず、取り込み予定件数のみ表示。

### 本実行

```bash
npm run imports:source
```

4ドメイン（yutai / hojokin / nyusatsu / minpaku）を順次実行。

### 詳細ログ付き実行

```bash
npm run imports:source:verbose
```

各レコードの INSERT / UPDATE / SKIP を表示。

### 単一ドメイン実行

```bash
npm run imports:run -- --domain yutai --source primary --dry-run
npm run imports:run -- --domain hojokin --source primary
```

### fail-fast モード

```bash
npm run imports:run -- --all --source primary --fail-fast
```

最初のドメインが失敗した時点で停止。

---

## 3. cron 設定例

### 毎日午前5時に全ドメイン取り込み

```cron
0 5 * * * cd /path/to/sports-event-app/web && npm run imports:source >> logs/imports.log 2>&1
```

### ログをローテーションする場合

```cron
0 5 * * * cd /path/to/sports-event-app/web && npm run imports:source >> logs/imports-$(date +\%Y\%m\%d).log 2>&1
```

### dry-run を先に実行して確認

```bash
# まず dry-run
npm run imports:source:dry

# 問題なければ本実行
npm run imports:source
```

---

## 4. 出力と exit code

### 正常終了

```
📋 Summary
  株主優待ナビ: source=primary success (inserted=3, updated=8, skipped=0)
  補助金ナビ: source=primary success (inserted=1, updated=10, skipped=0)
  入札ナビ: source=primary success (inserted=0, updated=11, skipped=0)
  民泊ナビ: source=primary success (inserted=2, updated=6, skipped=0)
```

**exit code: 0**

### 一部失敗

```
📋 Summary
  株主優待ナビ: source=primary success (inserted=0, updated=11, skipped=0)
  補助金ナビ: FAILED (環境変数 HOJOKIN_SOURCE_PRIMARY_URL が未設定です)
  入札ナビ: source=primary success (inserted=0, updated=11, skipped=0)
  民泊ナビ: source=primary success (inserted=0, updated=8, skipped=0)
```

**exit code: 1**（1件でも失敗があれば非0）

### 挙動

| モード | 1ドメイン失敗時 | exit code |
|--------|---------------|-----------|
| デフォルト（continue-on-error） | 他ドメインは継続、summary に FAILED 表示 | 1 |
| `--fail-fast` | 即停止、残りは SKIPPED | 1 |
| 全成功 | — | 0 |

---

## 5. npm scripts 一覧

| script | コマンド | 用途 |
|--------|---------|------|
| `imports:source` | `run-imports.js --all --source primary` | 本番実行 |
| `imports:source:dry` | 同上 + `--dry-run` | 事前確認 |
| `imports:source:verbose` | 同上 + `--verbose` | デバッグ用 |
| `imports:run` | `run-imports.js` | 汎用（引数を自由に渡す） |

---

## 6. 環境変数一覧

| 変数 | 用途 | 必須 |
|------|------|------|
| `YUTAI_SOURCE_PRIMARY_URL` | 株主優待 source URL | source 実行時 |
| `HOJOKIN_SOURCE_PRIMARY_URL` | 補助金 source URL | source 実行時 |
| `NYUSATSU_SOURCE_PRIMARY_URL` | 入札 source URL | source 実行時 |
| `MINPAKU_SOURCE_PRIMARY_URL` | 民泊 source URL | source 実行時 |
| `YUTAI_IMPORT_URL` | 株主優待 remote URL | remote 実行時 |
| `HOJOKIN_IMPORT_URL` | 補助金 remote URL | remote 実行時 |
| `NYUSATSU_IMPORT_URL` | 入札 remote URL | remote 実行時 |
| `MINPAKU_IMPORT_URL` | 民泊 remote URL | remote 実行時 |
| `*_SOURCE_PRIMARY_TOKEN` | 認証 token（各ドメイン） | 認証 API の場合のみ |

---

## 7. トラブルシューティング

### env 未設定で FAILED になる

```
❌ エラー: 環境変数 HOJOKIN_SOURCE_PRIMARY_URL が未設定です
```

→ `.env` に該当 URL を設定してください。

### 一部ドメインだけ失敗する

→ `--domain <name> --source primary --verbose` で単一実行して原因を確認。

### ログを見返したい

→ `>> logs/imports.log 2>&1` でファイルに出力。`logs/` ディレクトリは事前に `mkdir -p logs` で作成。

### dry-run で件数が0になる

→ source URL が返す JSON が空、または配列キーが想定外の形式。`--verbose` で確認。
