# Resolver Layer — 最小実装（Phase 1 Step 3）

Formatter で統一された生データから、**同一企業を 1 つの canonical entity に束ねる**層。

## 4 層判定（Layer 1-3 実装済、Layer 4 は未実装）

| 層 | 方式 | 実装 |
|----|------|------|
| 1 | 法人番号一致（入力側 or gBizINFO 経由） | ✅ resolve.js + gbizinfo.js（stub） |
| 2 | normalized_key 完全一致 | ✅ normalize.js |
| 3 | normalized_key の fuzzy 一致（Levenshtein） | ✅ resolve.js（既定閾値 0.90） |
| 4 | LLM 判定（キャッシュ前提） | ⏳ 未実装。Layer 3 で拾えない曖昧ケース用 |

## データ構造

3 テーブル（`scripts/migrate-resolved-entities.mjs` で作成）:

| テーブル | 役割 |
|---------|------|
| `resolved_entities`   | canonical entity 本体（id, corporate_number, canonical_name, normalized_key, prefecture, source） |
| `resolution_aliases`  | 表記ゆれ蓄積（raw_name → entity_id、seen_count 付き） |
| `resolution_scores`   | 判定ログ（監査・再実行安定性の確認） |

## 使い方

```js
import { resolveEntity, createDataStore } from "@/lib/agents/resolver";

const store = createDataStore();      // 同一プロセスで共有するとキャッシュが効く
const r = await resolveEntity(
  { name: "株式会社アサオ", prefecture: "兵庫県", corporateNumber: "02805143475" },
  { store, fuzzyThreshold: 0.90 }
);
// → { entityId: 42, canonicalName: "(株)アサオ", layer: "corp_number", score: 1.0, created: false }
```

## 正規化ポリシー（normalize.js）

```
株式会社アサオ   ─┐
㈱アサオ         ├─ normalizeCompanyKey() → "アサオ"
(株)アサオ       │
アサオ㈱         ─┘

canonicalizeCompanyName() → "(株)アサオ" （表示用）
```

具体的には:
- NFKC で全半角統一
- 会社形態語（株式会社/有限会社/合同会社/合資会社/合名会社/一般社団法人等）を除去
- 英字小文字化
- 空白・装飾記号・ハイフン類を全削除

## 実装ルール

- Resolver 本体は「純関数＋DataStore 抽象」で構成。判定ロジックは純粋
- gBizINFO 呼び出しは `useGbizinfo: true` 明示時のみ（デフォルトは叩かない）
- in-memory cache は `createDataStore()` 内で管理（prefix 単位）
- 全ての判定は `resolution_scores` にログ保存（再実行の安定性検証）

## 再実行時の挙動（成功条件「再実行で結果が安定する」）

1. 初回: 新規 entity 作成（layer=new）
2. 2 回目以降の同一 raw name: layer=normalized（既存 entity へマージ）
3. 類似度 >= 閾値の変種: layer=fuzzy（既存 entity にマージ、alias 蓄積）
4. 法人番号が渡された場合: layer=corp_number で確定（以降のすべての変種を束ねる）

## 禁止事項

- Analyzer で Resolver を経由しないクエリを書かない
- Formatter や Collector のスキーマを壊さない
- LLM を fallback 層以外で使用しない
