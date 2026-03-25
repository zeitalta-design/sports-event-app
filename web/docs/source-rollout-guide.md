# 実データソース URL 本番投入ガイド

> 各ドメインの実データソース URL を設定し、本番環境へ安全に投入するための標準手順。
> 初回投入・URL差し替え・新ドメイン追加時にこのドキュメントに沿って進める。

---

## 概要

source import のデータフロー:

```
.env の *_SOURCE_PRIMARY_URL
  → import-{domain}.js --source primary
    → {domain}-source.js (fetch + adaptFields)
      → normalize()
        → upsertItem()
          → {domain}_items テーブル
```

---

## 1. 事前準備

### 対象ドメイン確認

| ドメイン | source adapter | env 変数 |
|---------|---------------|---------|
| yutai | `lib/importers/yutai-source.js` | `YUTAI_SOURCE_PRIMARY_URL` |
| hojokin | `lib/importers/hojokin-source.js` | `HOJOKIN_SOURCE_PRIMARY_URL` |
| nyusatsu | `lib/importers/nyusatsu-source.js` | `NYUSATSU_SOURCE_PRIMARY_URL` |
| minpaku | `lib/importers/minpaku-source.js` | `MINPAKU_SOURCE_PRIMARY_URL` |

- [ ] 対象ドメインの source adapter が存在する
- [ ] 対象ドメインの `{DOMAIN}_SOURCE_PRIMARY_URL` env 名を確認した
- [ ] 認証が必要な場合は `{DOMAIN}_SOURCE_PRIMARY_TOKEN` も用意する

### 事前に確認すべきこと

- [ ] 取得先 URL が HTTPS であること（本番推奨）
- [ ] 取得先が返す JSON 形式を把握している
- [ ] 取得先のレート制限・利用規約を確認している

---

## 2. URL 設定

### 設定場所

本番環境の `.env` に記入:

```bash
# 例: yutai のソース URL を設定
YUTAI_SOURCE_PRIMARY_URL=https://api.example.com/yutai/v1/items

# 認証が必要な場合
YUTAI_SOURCE_PRIMARY_TOKEN=Bearer_xxxxx
```

### 設定ルール

| ルール | 説明 |
|-------|------|
| 1 ドメイン = 1 URL | primary source は各ドメイン 1 つ |
| env 優先 | `.env` より shell 環境変数が優先 |
| 空値 = 未設定扱い | URL が空なら source 実行時にエラー |
| token は任意 | 未設定なら認証ヘッダーを付けない |

---

## 3. 疎通確認

設定した URL がアクセス可能かを確認:

```bash
# URL に直接アクセスして JSON が返るか確認
curl -s "$YUTAI_SOURCE_PRIMARY_URL" | head -c 200

# token が必要な場合
curl -s -H "Authorization: Bearer $TOKEN" "$YUTAI_SOURCE_PRIMARY_URL" | head -c 200
```

### 確認ポイント

- [ ] HTTP 200 が返る
- [ ] JSON 形式である
- [ ] 配列 or `{ items: [...] }` or `{ data: [...] }` or `{ results: [...] }` のいずれか
- [ ] 各要素に title（または name）が含まれる
- [ ] 各要素に一意キー（code / slug / id）が含まれる

### フィールドマッピング確認

source adapter の `adaptFields()` が、取得先のフィールド名を normalize 互換に変換する。
取得先のフィールド名が adapter の想定と異なる場合は、adapter の `adaptFields()` を修正する必要がある。

```bash
# 取得先の JSON フィールド名を確認
curl -s "$YUTAI_SOURCE_PRIMARY_URL" | node -e "
  const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const items = Array.isArray(data) ? data : data.items || data.data || data.results;
  console.log('件数:', items.length);
  console.log('フィールド:', Object.keys(items[0] || {}));
"
```

---

## 4. dry-run（本番反映前の安全確認）

### 単一ドメイン dry-run

```bash
node scripts/import-{domain}.js --source primary --dry-run --verbose
```

### 全ドメイン dry-run

```bash
npm run imports:source:dry
```

### 確認ポイント

- [ ] 取得件数が想定と合っている
- [ ] valid 件数が 0 でない
- [ ] skip 件数が異常に多くない
- [ ] エラー詳細に致命的な問題がない
- [ ] `--verbose` で個別レコードの title が正しく取れている

### dry-run でよくある問題

| 症状 | 原因 | 対処 |
|------|------|------|
| 全件 skip | 必須フィールド不足（code/title） | adapter の `adaptFields` を確認 |
| JSON パース失敗 | 取得先が HTML を返している | URL が正しいか確認 |
| 0 件取得 | 配列キーが想定外 | `items`/`data`/`results` 以外の場合は adapter 修正 |
| env 未設定エラー | `.env` 未読み込み | `.env` の存在と内容を確認 |

---

## 5. 本番反映

### 初回投入の場合

```bash
# 1. dry-run で最終確認
node scripts/import-{domain}.js --source primary --dry-run --verbose

# 2. 本番実行
node scripts/import-{domain}.js --source primary --verbose

# 3. DB 件数確認
# レポートの「{domain}_items 合計: N 件」を確認
```

### 全ドメイン一括反映

```bash
# 1. dry-run
npm run imports:source:dry

# 2. 本番実行
npm run imports:source

# 3. Summary で全ドメイン success を確認
```

### 既存 URL 差し替えの場合

1. `.env` の URL を新しい値に変更
2. dry-run で新ソースの件数・品質を確認
3. 本番実行（upsert のため既存データは UPDATE される）
4. 反映後確認

**注意:** upsert は code / slug ベースで照合。新ソースで code / slug が変わると新規 INSERT になる。

### cron 設定済みの場合

- cron を一時停止してから URL を変更
- dry-run で確認してから cron を再開

---

## 6. 反映後確認

### DB 確認

```bash
# 件数確認（レポート出力に含まれる）
# 例: yutai_items 合計: 150 件
```

### 公開側確認

- [ ] `/{domain}` 一覧ページに新データが表示される
- [ ] `/{domain}/{slug}` 詳細ページが正常表示される
- [ ] 比較機能が動作する
- [ ] sitemap に新規追加分の URL が含まれる

### admin 側確認

- [ ] `/admin/{domain}` でデータ一覧が確認できる
- [ ] 新規追加分の `is_published` 状態が意図どおり

### 監査ログ確認

importer 実行は admin API 経由ではないため、audit log には記録されない。
import 結果はスクリプトの summary 出力で確認する。

---

## 7. ロールバック

### URL を戻す場合

1. `.env` の `{DOMAIN}_SOURCE_PRIMARY_URL` を旧 URL に戻す
2. cron が動いている場合は一時停止
3. 旧 URL で `--source primary` を実行（upsert で旧データに戻る）
4. 公開側の表示を確認

### import を停止する場合

1. `.env` の URL を空にする or コメントアウト
2. cron を停止
3. DB のデータは残る（物理削除はしない）
4. 問題のあるデータは admin 画面から `is_published = 0` にする

### 「戻せる範囲」の目安

| 操作 | 戻せるか |
|------|---------|
| upsert による UPDATE | 旧ソースで再 import すれば戻る |
| upsert による INSERT | admin で非公開にできる。物理削除は手動 |
| slug / code 変更 | 旧ソースの slug / code で照合し直し |

---

## 8. 新ドメイン追加時

新ドメイン（7th 以降）で source URL を投入する場合:

1. scaffold でドメイン生成
2. source adapter (`lib/importers/{key}-source.js`) を作成
3. `.env.example` と `.env` に `{KEY}_SOURCE_PRIMARY_URL` を追加
4. `scripts/run-imports.js` に `sourceSupported: true` で追加
5. このガイドの手順 1〜7 に沿って投入

---

## クイックリファレンス

```bash
# 疎通確認
curl -s "$YUTAI_SOURCE_PRIMARY_URL" | head -c 200

# 単一ドメイン dry-run
node scripts/import-yutai.js --source primary --dry-run --verbose

# 全ドメイン dry-run
npm run imports:source:dry

# 全ドメイン本番実行
npm run imports:source

# 全ドメイン verbose 本番実行
npm run imports:source:verbose
```
