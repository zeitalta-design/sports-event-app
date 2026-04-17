# Analyzer Layer — 最小実装（Phase 1 Step 4）

**責務**: **Resolver 済みデータ**に対する集計・分析。UI への供給元。

## 前提

- 入力は Resolver 層で canonicalId が付与されたデータ
- Resolver 前の生レコードに対して集計を走らせてはいけない（禁止事項）
- 集計結果はキャッシュして良い（重い query の繰り返し回避）

## 予定される分析メニュー（入札ライン）

### A1 落札者分析ダッシュボード
- 落札者ランキング（件数順・金額順）
- 落札率の分布（価格帯別・業種別）
- 特定落札者の受注履歴タイムライン
- 発注機関 × 業種 の落札率マトリクス
- 法人番号ベースの名寄せ前提（Resolver 依存）

### 横展開用のメトリクス
- 行政処分の年次推移・都道府県別分布
- 補助金の採択率・業種別受給企業
- 産廃処理業者の処分頻度

## インターフェイス案

```js
/** Analyzer は "Query" クラス相当。純粋に読み取り専用 */
export async function getWinnerRanking({ period, limit = 50, sortBy = "count" }) { /* ... */ }
export async function getAwardRateDistribution({ category, period }) { /* ... */ }
```

## 実装済み（Step 4）

`lib/agents/analyzer/nyusatsu/` 配下:

| ファイル | 役割 |
|---------|------|
| `resolved.js`        | 共通 JOIN: nyusatsu_results × resolved_entities × entity_clusters の副問合せ SQL と filter ビルダ |
| `ranking.js`         | getAwardRanking — entity/cluster/issuer × count/amount |
| `timeline.js`        | getAwardTimeline — month/year 粒度、entity/cluster/issuer フィルタ |
| `buyer-relations.js` | getBuyerRelations — 発注機関内訳 + concentration_score (HHI) |
| `index.js`           | エントリ再 export |

CLI: `node scripts/analyze-nyusatsu.mjs ranking|timeline|buyers [options]`

## 結合戦略

nyusatsu_results を Resolver 結果に紐付ける OR 条件:
1. `winner_corporate_number = resolved_entities.corporate_number`（Layer 1 ヒット分）
2. `resolution_aliases.raw_name = winner_name`（alias 経由）

LEFT JOIN で未解決は `entity_id = NULL`。`resolvedOnly: true`（既定）で除外。

## 初期指標

- `total_awards`  件数
- `total_amount`  金額合計
- `unique_buyers` 発注機関の種類数（entity 視点）
- `active_months` 初受注〜最終受注の月数
- `concentration_score` HHI（0=均等、1=完全1機関依存）

## 禁止事項

- Resolver を通っていないデータで集計しない
- DB 書込みをしない（純粋 read-only）
- UI コンポーネント依存を持たない（Analyzer は UI を知らない）
