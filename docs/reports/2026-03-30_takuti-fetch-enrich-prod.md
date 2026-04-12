# 宅建業（real_estate）fetch → enrich 本番反映 完了レポート

**実施日**: 2026-03-30
**実施者**: GitHub Actions (Ops: Manual Task Runner)
**対象リポジトリ**: sports-event-app
**対象セクター**: takuti (宅建業 / real_estate)

---

## 背景

行政処分DBの運用では、これまで建設業（construction）のみ本番投入・cron 運用が稼働していた。宅建業（real_estate）については fetch / enrich スクリプトの対応は完了していたが、本番投入は未実施だった。

今回、VPS 手打ちを削減するために導入した GitHub Actions 手動運用基盤を使い、宅建業の初回本番反映を実施した。

## 目的

- 宅建業の行政処分データを MLIT から取得し、本番 DB に投入する
- 取得済みレコードの summary / detail を enrich で品質強化する
- GitHub Actions 経由での本番実行フローが安全に機能することを実証する

## 対象とスコープ

| 項目 | 内容 |
|------|------|
| 対象業種 | 宅建業（real_estate / takuti） |
| データソース | 国土交通省 ネガティブ情報等検索サイト |
| 取得期間 | 2021-01 〜 2026-03 |
| 実施内容 | fetch（一覧取得 + DB投入）→ enrich（詳細取得 + summary/detail 更新） |
| 実施方法 | GitHub Actions workflow_dispatch（手動実行） |
| 対象外 | 建設業の既存 cron 変更、DB スキーマ変更、公開画面の改修 |

---

## 事前確認結果

GitHub Actions 基盤の導入確認として、以下を事前に実施・成功済み。

| 確認項目 | 結果 |
|----------|------|
| `status`（SSH接続 / Docker / cron / DB件数） | 成功 |
| `db_counts`（DB詳細件数） | 成功 |
| `logs`（運用ログ tail） | 成功 |
| `fetch_construction_dry_run` | 成功（533件 / 54ページ） |
| `fetch_takuti_dry_run --since=2021-01` | 成功（258件 / 26ページ） |
| `enrich_takuti_dry_run` | 成功（enriched: 257 / errors: 0） |

## dry-run 結果

### fetch_takuti_dry_run

| 項目 | 値 |
|------|----|
| Mode | DRY-RUN |
| Sector | takuti |
| Since | 2021-01 |
| 総件数 | 258件 |
| ページ数 | 全26ページ |
| Exit code | 0 |

### enrich_takuti_dry_run

| 項目 | 値 |
|------|----|
| Mode | DRY-RUN |
| Industry | real_estate |
| enriched | 257 |
| skipped | 0 |
| errors | 0 |
| Exit code | 0 |

---

## fetch_takuti_prod 実施内容と結果

| 項目 | 値 |
|------|----|
| Action | `fetch_takuti_prod` |
| confirm_production | YES |
| extra_args | `--since=2021-01` |
| 検索期間 | 2021/01 〜 2026/03 |
| 総件数 | 258件 |
| ページ数 | 全26ページ |
| created | 0 |
| updated | 258 |
| skipped | 0 |
| Exit code | 0 |

created=0 / updated=258 という結果は、258件全てが既に DB に存在していたことを示す。これは事前の dry-run 段階で既にデータが投入されていたか、以前の手動投入で登録済みだったためと考えられる。fetch は upsert 方式のため、既存データの最新化として正常に動作した。

## enrich_takuti_prod 実施内容と結果

| 項目 | 値 |
|------|----|
| Action | `enrich_takuti_prod` |
| confirm_production | YES |
| enriched | 257 |
| skipped | 0 |
| errors | 0 |
| detail入力済み（全体） | 788件 |
| Exit code | 0 |

258件中 257件の detail が更新された。1件の差は、詳細ページ URL が存在しないレコード（`source_url` に `no=` パラメータがないもの）が対象外となったためと推定される。errors=0 のため、処理自体は全件正常完了。

---

## 実行前後比較表

| industry | 実行前 | fetch 後 | enrich 後 | 変化 |
|----------|--------|----------|-----------|------|
| construction | 540 | 540 | 540 | 変化なし |
| real_estate | 258 | 258 | 258 | 件数変化なし（内容更新） |
| transport | 1 | 1 | 1 | 変化なし |
| **TOTAL** | **799** | **799** | **799** | **変化なし** |

件数の増減はなく、既存レコードの内容更新（fetch による upsert + enrich による detail 充填）が行われた。建設業・transport のデータには一切影響がない。

---

## バックアップ情報

| 項目 | 内容 |
|------|------|
| fetch 前バックアップ | `/opt/app/backups/sports-event_20260330_182114_fetch_takuti.db` |
| enrich 前バックアップ | 自動取得（`pre_production` による自動実行） |
| バックアップ方式 | better-sqlite3 の `.backup()` API（WAL 安全） |
| 保持ポリシー | 最新20件、超過分は自動削除 |

---

## 運用上の評価

### 安全機構の動作確認

| 機構 | 状態 |
|------|------|
| confirm_production ガード | 機能確認済み（YES 未入力時にブロック） |
| 本番前自動バックアップ | 機能確認済み |
| GitHub Actions concurrency 制御 | 有効（同一 workflow の並列防止） |
| VPS 側 flock 排他制御 | 有効（書き込み系タスクの排他） |
| extra_args バリデーション | 有効（危険文字の拒否） |

### 既存建設業運用への影響

- 建設業の既存 cron（月初1日 fetch: 05:20 / enrich: 06:00）は **変更なし**
- 建設業データ（540件）は fetch / enrich いずれの前後でも **件数変化なし**
- 宅建業の処理は `--sector=takuti` / `--industry=real_estate` でスコープが限定されており、建設業データへの影響経路はない

### 運用方針

- 宅建業は当面 GitHub Actions 手動運用で継続するのが妥当
- 建設業の既存 cron はそのまま維持
- 月初1日の早朝（05:00-06:30）は既存 cron との時間帯重複を避け、GitHub Actions からの手動本番実行は控える

---

## 未確認事項 / 残課題

| 項目 | 状態 | 備考 |
|------|------|------|
| 公開画面 `/gyosei-shobun` の目視確認 | **未確認** | 宅建業データが正しく表示されるか要確認 |
| admin 画面 `/admin/gyosei-shobun` の目視確認 | **未確認** | 管理画面での宅建業フィルタ・表示を要確認 |
| legal_basis の宅建業側入力状況 | **未確認** | enrich で取得された法令根拠の内容精度を目視確認 |
| 宅建業 cron 化の要否判断 | 未着手 | 月次手動で十分か、cron 化すべきかは運用実績を見て判断 |
| 建設業の GitHub Actions 本番実行 | 未実施 | 既存 cron があるため優先度低。必要時に dry-run から開始 |
| enrich_construction_prod | 未実施 | 建設業 enrich の detail 充填状況を確認後に判断 |

---

## 最終判定

GitHub Actions を用いた宅建業 fetch → enrich の本番反映は **技術的に成功** した。

- fetch: 258件の upsert が正常完了（created=0, updated=258, errors=0）
- enrich: 257件の detail 更新が正常完了（enriched=257, errors=0）
- 件数破壊なし、エラー終了なし、バックアップ取得済み
- 建設業の既存運用に影響なし
- GitHub Actions の安全機構（confirm ガード / バックアップ / 排他制御）が全て正常動作

**公開画面および admin 画面の最終目視確認は別途実施が必要。** 技術的な DB 反映の成功と、ユーザー向け表示の正常性は分けて評価する。

---

## 次の推奨3アクション

1. **公開画面 `/gyosei-shobun` で宅建業データの表示を目視確認** — industry フィルタで real_estate を選択し、件数・内容・detail の表示を確認
2. **admin 画面 `/admin/gyosei-shobun` で宅建業データの管理状態を確認** — review_status、legal_basis、summary/detail の品質を目視チェック
3. **建設業 enrich の現状を `enrich_construction_dry_run` で確認** — detail 未入力件数を把握し、enrich 実行の要否を判断

---

## サマリー（社内共有用）

> GitHub Actions 手動運用基盤を用いて、宅建業（real_estate）の行政処分データ fetch → enrich を本番実行した。fetch で 258件を更新、enrich で 257件の detail を充填し、いずれもエラーなく正常完了。建設業の既存 cron 運用への影響はなし。バックアップ・確認入力ガード・排他制御も正常動作を確認。公開画面 / admin 画面の最終目視確認は別途実施予定。

---

**確定したこと**: 宅建業データの技術的な本番反映は完了。GitHub Actions 手動運用フローが安全に機能することを実証。

**残っている確認**: 公開画面・admin 画面での宅建業データ表示の最終目視確認。

**次にやるべきこと**: 公開画面の目視確認 → admin 画面の目視確認 → 建設業 enrich 状況の確認。
