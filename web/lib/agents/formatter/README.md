# Formatter Layer

Collector が返した生レコードを**統一スキーマ**に変換する純粋関数群。

## 統一スキーマ（2026-04-17 確定・最小7フィールド）

```js
/**
 * @typedef {Object} FormattedRecord
 * @property {string}        source       - Collector id ("nyusatsu.kkj" など)
 * @property {string|null}   title        - 案件名（トリム済）
 * @property {string|null}   organization - 発注機関名（コードのみの場合もある。名前解決は Resolver の責務）
 * @property {string|null}   published_at - 公告日 ISO (YYYY-MM-DD) / 落札結果の場合は開札日
 * @property {string|null}   deadline     - 締切 ISO (YYYY-MM-DD) / 該当なしなら null
 * @property {string|null}   detail_url   - 詳細URL
 * @property {Object}        raw          - 元レコードをそのまま保持（デバッグ・将来の再処理用）
 */
```

**原則:**
- **最小スキーマ**を保つ。拡張は Resolver / Analyzer の責務
- `raw` は必ず保持（失われたら再スクレイプ必要になる）
- `null` 可。「取れなかった」ことと「取れた空文字」を区別する
- 日付は常に ISO8601 (YYYY-MM-DD)。生の和暦・ISO タイムゾーン付きは受け取って変換

## 実装済み Formatter（nyusatsu ドメイン）

| Collector id | Formatter | 入力 shape | 備考 |
|--------------|-----------|-----------|------|
| `nyusatsu.kkj`                 | `nyusatsu/kkj.js`                 | parseKkjXml の出力 | `projectName` の末尾ファイルサイズ表記除去、`cftIssueDate` → published_at |
| `nyusatsu.central-ministries`  | `nyusatsu/central-ministries.js`  | scrapeMaff 等の行 | 省庁コードから日本語名へフォールバック |
| `nyusatsu.p-portal-results`    | `nyusatsu/p-portal-results.js`    | parseCsv の出力     | 落札結果なので `deadline=null`、`published_at=awardDate` |

## 使い方

```js
import kkjFormat from "@/lib/agents/formatter/nyusatsu/kkj";
const unified = kkjFormat(rawKkjRecord);

// または登録簿経由
import { getFormatter } from "@/lib/agents/formatter/nyusatsu";
const fmt = getFormatter("nyusatsu.kkj");
const unified = fmt(raw);
```

## 共通ユーティリティ

`util.js`:
- `toIsoDate(str)` - 和暦・括弧付き・スラッシュ区切り・ISO8601 すべて `YYYY-MM-DD` へ
- `stripFileSizeSuffix(title)` - `"タイトル(146.6KB)"` → `"タイトル"`

## 禁止事項

- HTTP fetch や DB 書込み禁止（Collector / pipeline の責務）
- 会社名の名寄せ禁止（Resolver の責務）。表記ゆれは raw に保持のまま
- ドメインをまたぐ参照禁止
