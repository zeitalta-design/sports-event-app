# 比較サイトOS ドメイン再編計画書

> 作成日: 2026-03-25
> ステータス: 計画策定（実装前）
> 方針: 入札（nyusatsu）集中を撤回し、共通基盤を活かして5本へ再編

---

## 1. エグゼクティブサマリー

### 1.1 背景・撤退理由

入札ナビ（nyusatsu）を事業の柱とする方針を撤回する。理由:

- 入札情報は官公庁が無料公開しており、有料レベルの差別化が困難
- データソースが分散・非標準で、スクレイピングコストが高い
- 競合（NJSS、入札王等）が先行しており、後発での優位性確保が難しい
- 比較サイトOSの汎用性を活かせば、より収益性の高い5分野に横展開可能

### 1.2 新5ドメイン一覧

| # | ID | 名称 | 一言 |
|---|-----|------|------|
| 1 | sanpai | 産廃処理業者・行政処分ウォッチ | 行政処分リスク情報を可視化 |
| 2 | kyoninka | 許認可・登録事業者横断検索 | 業種横断で事業者を検索 |
| 3 | shitei | 自治体の指定管理・委託公募まとめ | 自治体の公募案件を一元化 |
| 4 | food-recall | 食品リコール監視ダッシュボード | リコール情報をリアルタイム監視 |
| 5 | saas | SaaS比較ナビ | 既存ドメインを強化・拡充 |

### 1.3 原則

- 既存共通基盤の破壊禁止
- nyusatsu は即削除せず保留資産として管理
- docs → registry → scaffold → 実装の順序で段階的に進行
- 5本同時着手はせず、1本ずつ検証後に横展開

---

## 2. 現状資産の棚卸し

### 2.1 共通基盤（そのまま流用可能）

| 資産 | ファイル/ディレクトリ | 流用可否 |
|------|----------------------|---------|
| Domain Registry | `lib/core/domain-registry.js` | そのまま流用 |
| Domain Template | `lib/domains/_template.js` | そのまま流用 |
| Scaffold Script | `scripts/scaffold-domain.js` | そのまま流用 |
| 共通リストページ | `components/core/DomainListPage.js` | そのまま流用 |
| 共通詳細ページ | `components/core/DomainDetailPage.js` | そのまま流用 |
| 比較ボタン/バー | `components/core/DomainCompareButton.js`, `DomainCompareBar.js` | そのまま流用 |
| お気に入り | `components/core/DomainFavoriteButton.js` | そのまま流用 |
| Admin List/Form | `components/admin/AdminListPage.js`, `AdminFormPage.js` | そのまま流用 |
| 比較ストア | `lib/core/compare-store.js` | そのまま流用 |
| DB基盤 | `lib/db.js`（getDb, マイグレーション機構） | そのまま流用 |
| 認証 | `lib/auth.js` | そのまま流用 |
| Admin Guard | `lib/admin-api-guard.js` | そのまま流用 |
| 監査ログ | `lib/audit-log.js`, `audit-trail.js` | そのまま流用 |
| LLMクライアント | `lib/llm-client.js` | そのまま流用 |
| SEO基盤 | `lib/seo-config.js`（構造のみ） | 要カスタマイズ |
| サイト設定 | `lib/site-config.js` | 要カスタマイズ |
| Sitemap生成 | `app/sitemap.js` | 要追加 |
| デプロイ手順 | `DEPLOYMENT.md` | そのまま流用 |
| VPS/Docker手順 | `docs/vps-setup-guide.md` | そのまま流用 |
| リリースチェックリスト | `docs/release-checklist.md` | そのまま流用 |
| Import基盤 | importer パターン（normalize → upsert → report） | パターン流用 |
| Repository パターン | list/getBySlug/getById/upsert/admin系 | パターン流用 |

### 2.2 nyusatsu 固有資産の分類

#### A. 再利用可能（新ドメインへ横展開）

| 資産 | ファイル | 流用先 |
|------|---------|--------|
| ドメイン登録パターン | `lib/domains/nyusatsu.js` | 全新ドメインのテンプレート |
| Config構造 | `lib/nyusatsu-config.js` | 全新ドメインのconfig雛形 |
| Repository構造 | `lib/repositories/nyusatsu.js` | 全新ドメインのrepository雛形 |
| Importer骨格 | `lib/importers/nyusatsu.js` | normalize→upsert→reportパターン |
| Source Adapter | `lib/importers/nyusatsu-source.js` | 外部データ取得パターン |
| 一覧ページ | `app/nyusatsu/page.js` | フィルタUI・カード表示の参考 |
| 詳細ページ | `app/nyusatsu/[slug]/page.js` | 詳細レイアウトの参考 |
| 比較ページ | `app/nyusatsu/compare/page.js` | 比較UIの参考 |
| カテゴリ別一覧 | `app/nyusatsu/category/[category]/page.js` | SEO階層の参考 |
| エリア別一覧 | `app/nyusatsu/area/[area]/page.js` | 地域フィルタの参考 |
| 管理画面一式 | `app/admin/nyusatsu/` | Admin CRUD の参考 |
| API一式 | `app/api/nyusatsu/`, `app/api/nyusatsu-favorites/` | API構造の参考 |
| Admin API | `app/api/admin/nyusatsu/` | Admin API の参考 |
| 状況バッジ | `nyusatsu-config.js` の `getStatusBadge()` | ステータス表示の参考 |
| 締切残日数 | `nyusatsu-config.js` の `getDeadlineRemaining()` | 期限系UIの参考 |

#### B. 保留（当面維持、将来判断）

| 資産 | 理由 |
|------|------|
| DBテーブル `nyusatsu_items`, `nyusatsu_favorites` | データ削除リスク回避。db.js のCREATE TABLE文は残す |
| Sitemap内のnyusatsuセクション | 公開中URLがある場合のSEO影響回避 |
| `lib/domains/index.js` の nyusatsu import | レジストリから外すと他所に影響する可能性 |

#### C. 停止候補（非優先化・段階的に対応）

| 資産 | 対応方針 |
|------|---------|
| nyusatsu のスクレイピング/データ更新ジョブ | 定期実行を停止 |
| nyusatsu-source.js の外部API接続 | 環境変数を未設定にして無効化 |
| AdminNav内のnyusatsuタブ | 将来的に非表示化（優先度低） |

### 2.3 saas ドメインの現状と SaaS比較ナビへの流用

saas ドメインは **最も完成度が高く、SaaS比較ナビとしてそのまま拡充可能**:

- 完成済み機能: 一覧、詳細、比較、お気に入り、保存検索、Admin CRUD
- 8カテゴリ定義済み（CRM, 会計, HR, MA, PM, コミュニケーション, セキュリティ, インフラ）
- レビュー軸定義済み（使いやすさ, 機能充実度, サポート, コスパ, 安定性）
- 価格帯・企業規模フィルタ定義済み
- DB: `items` + `saas_details` テーブル

**SaaS比較ナビとしての拡充ポイント**:
- カテゴリ拡充（AI/ML, データ分析, Eコマース, etc.）
- 連携情報・API情報の追加
- 実ユーザーレビュー機能
- 料金プラン詳細比較
- SEO強化（カテゴリ別ランディングページ）

### 2.4 他既存ドメインの影響

| ドメイン | 現状 | 影響 |
|---------|------|------|
| sports | コアドメイン（スポログ） | 影響なし。独立して継続 |
| saas | SaaS比較ナビとして拡充 | 正の影響。開発優先度UP |
| yutai | 株主優待ナビ | 影響なし。現状維持 |
| hojokin | 補助金ナビ | 影響なし。現状維持 |
| minpaku | 民泊ナビ | 影響なし。現状維持 |
| nyusatsu | 入札ナビ | 非優先化。保留資産として維持 |

---

## 3. 新5ドメイン詳細設計

### 3.1 産廃処理業者・行政処分ウォッチ（sanpai）

**目的**: 産業廃棄物処理業者の許可情報と行政処分情報を横断的に検索・監視できるサービス

**想定ユーザー**:
- 排出事業者（委託先選定・リスク確認）
- 産廃処理業者（競合情報・コンプライアンス確認）
- 環境コンサルタント・行政書士
- 報道・調査関係者

**主要データソース候補**:
- 環境省「産業廃棄物処理業者情報検索システム」(さんぱいくん) — 許可業者データ
- 環境省「行政処分情報」 — 処分履歴
- 各都道府県の産廃許可情報公開ページ
- 不法投棄関連の公表情報

**情報モデル**:
```
sanpai_items:
  id, slug, company_name, permit_number, permit_type,
  prefecture, city, address, waste_types (JSON),
  permit_status, permit_expiry, permit_authority,
  penalty_count, latest_penalty_date, latest_penalty_type,
  is_published, created_at, updated_at

sanpai_penalties (詳細テーブル):
  id, sanpai_id (FK), penalty_date, penalty_type,
  penalty_authority, penalty_reason, penalty_detail,
  source_url, created_at
```

**機能要件**:
- 一覧: 必要（業者検索 + 処分歴フィルタ）
- 詳細: 必要（業者プロフィール + 処分履歴タイムライン）
- 比較: 低優先（業者間比較は需要小）
- 通知: **高優先**（新規行政処分の即時通知 = キラー機能）

**共通基盤の流用**:
- DomainListPage → 業者一覧（カテゴリ＝廃棄物種類、エリア＝都道府県）
- DomainDetailPage → 業者詳細 + 処分履歴タイムライン（**個別UIが必要**）
- DomainFavoriteButton → ウォッチリスト登録
- Repository パターン → sanpai用repository
- Importer パターン → さんぱいくんAPI + 行政処分情報スクレイパー

**個別化が必要な部分**:
- 処分履歴タイムラインUI
- リスクスコア表示（処分回数・直近処分からの経過日数）
- 新規処分通知メール
- 地図表示（業者所在地マップ）

**初期MVP範囲**:
1. 環境省データからの業者リスト取得・表示
2. 行政処分情報の紐付け表示
3. 都道府県・廃棄物種別フィルタ
4. 業者詳細ページ（処分履歴含む）
5. ウォッチリスト（お気に入り）

---

### 3.2 許認可・登録事業者横断検索（kyoninka）

**目的**: 複数省庁・業種にまたがる許認可・登録事業者情報を横断検索できるサービス

**想定ユーザー**:
- 取引先の許認可確認をしたい企業の総務・法務部門
- 行政書士・社労士（顧客候補のリサーチ）
- 新規参入を検討する事業者
- 金融機関（融資審査時の事業者確認）

**主要データソース候補**:
- 国土交通省「建設業者検索」
- 金融庁「免許・許可・登録等を受けている業者一覧」
- 厚生労働省「人材サービス総合サイト」
- 各業法に基づく登録事業者公表情報
- 各都道府県の事業者検索ポータル

**情報モデル**:
```
kyoninka_items:
  id, slug, company_name, corporate_number,
  license_type, license_category, license_number,
  prefecture, city, address,
  issuing_authority, issue_date, expiry_date,
  status, business_scope,
  is_published, created_at, updated_at

kyoninka_licenses (複数許認可に対応):
  id, kyoninka_id (FK), license_type, license_number,
  issuing_authority, issue_date, expiry_date,
  status, source_url, created_at
```

**機能要件**:
- 一覧: 必要（業種 × エリア × 許認可種別の横断検索）
- 詳細: 必要（事業者プロフィール + 保有許認可一覧）
- 比較: 低優先
- 通知: 中優先（許認可期限切れアラート）

**共通基盤の流用**:
- DomainListPage → 事業者検索（カテゴリ＝業種/許認可種別）
- DomainDetailPage → 事業者詳細 + 許認可一覧（**サブテーブル表示が個別**）
- Repository パターン → kyoninka用repository
- Importer パターン → 各省庁API/公開データのアダプタ

**個別化が必要な部分**:
- 法人番号での名寄せロジック（同一法人の複数許認可を統合）
- 許認可種別のマスタデータ管理
- 有効期限の一覧・アラート表示
- 業種横断フィルタUI

**初期MVP範囲**:
1. 建設業者検索データの取得・表示（最大規模データソース）
2. 業種・エリア・許認可種別フィルタ
3. 事業者詳細ページ
4. お気に入り

---

### 3.3 自治体の指定管理・委託公募まとめ（shitei）

**目的**: 自治体が公募する指定管理者制度・業務委託案件を横断的に検索できるサービス

**想定ユーザー**:
- 指定管理・委託受託を狙う民間企業
- NPO・社会福祉法人
- 自治体コンサル・行政書士
- 業界団体

**主要データソース候補**:
- 各自治体の公募情報ページ（スクレイピング）
- 総務省「指定管理者制度の導入状況」
- 自治体の入札・契約情報ポータル
- e-Gov等の公告情報

**情報モデル**:
```
shitei_items:
  id, slug, title, municipality, prefecture,
  facility_type, category,
  contract_type (指定管理/業務委託/プロポーザル),
  application_start, application_deadline,
  contract_start, contract_end, contract_period_years,
  estimated_amount, status,
  requirements_summary, evaluation_criteria,
  source_url, contact_info,
  is_published, created_at, updated_at
```

**機能要件**:
- 一覧: 必要（施設種別 × エリア × 契約種別のフィルタ）
- 詳細: 必要（公募要項の要約・リンク）
- 比較: 低〜中優先（類似案件の比較）
- 通知: **高優先**（新規公募案件の通知 = キラー機能）

**共通基盤の流用**:
- DomainListPage → 案件一覧（nyusatsuの一覧UIと類似度が高い）
- DomainDetailPage → 案件詳細
- nyusatsuの締切表示・ステータスバッジ → **直接流用可能**
- nyusatsuのエリアフィルタ → **直接流用可能**
- Importer パターン → 自治体ページスクレイパー

**個別化が必要な部分**:
- 施設種別マスタ（体育館、図書館、公園、福祉施設等）
- 評価基準の構造化表示
- 契約期間のタイムライン表示
- 過去の指定管理者情報（受託実績）

**初期MVP範囲**:
1. 主要自治体（政令市 + 東京23区）の公募情報収集
2. 施設種別・エリア・契約種別フィルタ
3. 案件詳細ページ（要項リンク + 要約）
4. 締切アラート
5. お気に入り

**nyusatsuからの流用が特に有効**: shitei は nyusatsu と最も類似性が高い。入札ナビで構築した検索UI、ステータスバッジ、エリアフィルタ、締切残日数表示をほぼそのまま転用可能。

---

### 3.4 食品リコール監視ダッシュボード（food-recall）

**目的**: 食品リコール・自主回収情報をリアルタイムに収集し、業界関係者や消費者に提供

**想定ユーザー**:
- 食品メーカーの品質管理部門
- 小売・流通業者（取扱商品のリコール確認）
- 消費者（安全確認）
- 食品安全コンサルタント
- 報道関係者

**主要データソース候補**:
- 消費者庁「リコール情報サイト」
- 厚生労働省「食品の回収情報」
- 農林水産省「食品の回収情報」
- 各自治体の食品衛生情報
- 企業の自主回収プレスリリース

**情報モデル**:
```
food_recall_items:
  id, slug, product_name, manufacturer,
  recall_type (リコール/自主回収/注意喚起),
  category (食品カテゴリ),
  reason (異物混入/表示不備/アレルゲン/微生物/化学物質),
  risk_level (class1/class2/class3),
  affected_area, lot_number,
  recall_date, discovered_date,
  status (回収中/回収完了/調査中),
  consumer_action (返品方法等),
  source_url, manufacturer_url,
  is_published, created_at, updated_at
```

**機能要件**:
- 一覧: 必要（日付順 + カテゴリ/リスクレベル/原因フィルタ）
- 詳細: 必要（リコール詳細 + 対象商品画像 + 対処方法）
- 比較: 不要（リコール同士の比較は意味がない）
- 通知: **最高優先**（リアルタイムリコール通知 = 最大の価値）

**共通基盤の流用**:
- DomainListPage → リコール一覧（ダッシュボードビュー）
- DomainDetailPage → リコール詳細
- DomainFavoriteButton → ウォッチ企業登録
- Importer パターン → 消費者庁API/スクレイパー

**個別化が必要な部分**:
- **ダッシュボードUI**（通常の一覧とは異なるレイアウト）
- リスクレベル表示（色分け・アイコン）
- リコール件数の統計・トレンドグラフ
- 食品カテゴリ別フィルタ（既存カテゴリとは異なる）
- メーカー別ウォッチリスト
- RSS/メール通知（頻度高）

**初期MVP範囲**:
1. 消費者庁リコール情報の自動収集
2. リコール一覧（日付順 + カテゴリ/リスクフィルタ）
3. リコール詳細ページ
4. メーカー別ウォッチリスト
5. 新規リコール通知

---

### 3.5 SaaS比較ナビ（saas — 既存拡充）

**目的**: 国内SaaSツールの比較・選定を支援するサービス（既存saasドメインの拡充）

**想定ユーザー**:
- 企業のIT部門・情シス
- スタートアップのCTO/エンジニア
- 業務改善担当者
- ITコンサル

**主要データソース候補**:
- 公式サイト情報（料金ページ、機能一覧）
- IT製品レビューサイト（ITreview, G2等の公開情報）
- プレスリリース（新機能・料金改定）
- SaaS企業の採用情報（成長指標として）

**情報モデル**: 既存 `items` + `saas_details` を拡張
```
追加カラム候補:
  pricing_json (プラン別料金詳細),
  integrations_json (連携サービス一覧),
  api_availability, api_docs_url,
  security_certifications (ISO27001, SOC2等),
  data_location (データセンター所在地),
  contract_period_options, cancellation_policy,
  last_pricing_updated_at
```

**機能要件**:
- 一覧: 済（拡充: フィルタ強化）
- 詳細: 済（拡充: 料金プラン比較、連携情報）
- 比較: 済（拡充: 比較項目追加）
- 通知: 中優先（料金改定・新機能通知）

**共通基盤の流用**: 既存実装をそのまま拡充

**個別化が必要な部分**:
- 料金プラン比較テーブル
- 連携サービスマトリクス
- セキュリティ認証バッジ
- 競合SaaS自動提案

**初期MVP範囲**（既存からの差分）:
1. カテゴリ拡充（AI/ML, データ分析, Eコマース）
2. 料金プラン詳細ページ
3. 連携サービス情報の追加
4. SEOランディングページ（カテゴリ別）

---

## 4. 共通基盤 vs 個別化の整理

### 4.1 共通基盤でカバーできる機能

| 機能 | sanpai | kyoninka | shitei | food-recall | saas |
|------|--------|----------|--------|-------------|------|
| 一覧表示 | O | O | O | △* | O（済） |
| 詳細表示 | O | O | O | O | O（済） |
| カテゴリフィルタ | O | O | O | O | O（済） |
| エリアフィルタ | O | O | O | O | - |
| お気に入り | O | O | O | O | O（済） |
| 保存検索 | O | O | O | O | O（済） |
| 比較 | △ | △ | △ | × | O（済） |
| Admin CRUD | O | O | O | O | O（済） |
| Repository | O | O | O | O | O（済） |
| Importer | O | O | O | O | - |
| Sitemap | O | O | O | O | O（済） |

O = 共通基盤そのまま、△ = 要カスタマイズ、× = 不要、△* = ダッシュボード型に変更

### 4.2 個別UIが必要な部分

| ドメイン | 個別UI |
|---------|--------|
| sanpai | 処分履歴タイムライン、リスクスコア表示、地図表示 |
| kyoninka | 許認可一覧テーブル（サブテーブル）、法人名寄せ表示 |
| shitei | 契約期間タイムライン、評価基準表示 |
| food-recall | ダッシュボードレイアウト、リスクレベル色分け、統計グラフ |
| saas | 料金プラン比較テーブル、連携マトリクス |

---

## 5. nyusatsu 資産の扱い方針

### 5.1 分類結果

```
【再利用】（新ドメインへ転用）
  - Config構造 → 全ドメインの雛形
  - Repository構造 → 全ドメインの雛形
  - Importer骨格 + Source Adapter → 全ドメインの雛形
  - 検索UI/フィルタ → shitei に特に転用可能
  - ステータスバッジ/締切表示 → shitei, sanpai に転用可能
  - SEO階層（カテゴリ別/エリア別） → 全ドメインに転用可能
  - Admin CRUD ページ → 全ドメインの参考

【保留】（当面維持）
  - DBテーブル定義（nyusatsu_items, nyusatsu_favorites）
  - lib/domains/nyusatsu.js（レジストリ登録）
  - lib/domains/index.js の import 行
  - 公開ページ一式（/nyusatsu/*）
  - API一式（/api/nyusatsu/*）

【停止候補】（段階的に対応）
  - データ更新ジョブ（cronから外す）
  - nyusatsu-source.js の外部API接続（環境変数で無効化）
  - SEO: sitemap優先度を 0.9 → 0.3 に下げる（任意）
```

### 5.2 nyusatsu の今後の選択肢

| 選択肢 | 説明 | 推奨度 |
|--------|------|--------|
| A. 非優先保留 | コード/DBそのまま。データ更新のみ停止。公開は維持 | **推奨** |
| B. 内部検証用 | 新ドメイン構築時の参照実装として活用。公開は維持 | 推奨 |
| C. 公開停止 | ルーティングを無効化。コードは残す | 将来検討 |
| D. 完全削除 | コード・DB・ドキュメントすべて削除 | **非推奨** |

**推奨**: A + B の併用。コードは「参照実装」として積極活用しつつ、データ更新のみ停止。

---

## 6. domain registry / scaffold / docs の更新方針

### 6.1 domain registry（`lib/domains/index.js`）

**変更方針**: 新ドメイン追加時に import を追加するだけ。既存の import は維持。

```javascript
// 現在
import "./sports";
import "./saas";
import "./yutai";
import "./hojokin";
import "./nyusatsu";  // 保留（削除しない）
import "./minpaku";

// 新5ドメイン追加後
import "./sports";
import "./saas";       // → SaaS比較ナビとして拡充
import "./yutai";
import "./hojokin";
import "./nyusatsu";   // 保留（参照実装として維持）
import "./minpaku";
import "./sanpai";     // NEW: 産廃処理業者・行政処分ウォッチ
import "./kyoninka";   // NEW: 許認可・登録事業者横断検索
import "./shitei";     // NEW: 指定管理・委託公募まとめ
import "./food-recall"; // NEW: 食品リコール監視ダッシュボード
```

### 6.2 scaffold（`scripts/scaffold-domain.js`）

**変更方針**: 変更不要。現在のscaffoldスクリプトは汎用的に設計されており、そのまま使える。

```bash
# 新ドメイン追加の実行例
npm run scaffold -- sanpai "産廃ウォッチ" --item "業者" --param "slug"
npm run scaffold -- kyoninka "許認可ナビ" --item "事業者" --param "slug"
npm run scaffold -- shitei "指定管理ナビ" --item "公募案件" --param "slug"
npm run scaffold -- food-recall "食品リコール" --item "リコール" --param "slug"
```

### 6.3 docs の更新対象

| ファイル | 更新内容 |
|---------|---------|
| `docs/domain-platform-guide.md` | 存在しない場合は新規作成。10ドメイン体制の全体像を記載 |
| `docs/release-checklist.md` | 新ドメイン追加時の確認項目を追加 |
| `docs/deploy-guide.md` | 環境変数に新データソース系を追加 |
| `docs/source-rollout-guide.md` | 存在しない場合は新規作成。各データソースの接続手順 |
| `DEPLOYMENT.md` | 新ドメインの環境変数セクション追加 |
| **NEW** `docs/domain-restructuring-plan.md` | 本ドキュメント |
| **NEW** `docs/roadmap.md` | フェーズ分割の詳細ロードマップ |

### 6.4 sitemap.js の更新

新ドメイン追加時に各ドメインの静的ページ・動的ページセクションを追加。nyusatsu セクションは維持（優先度だけ下げることも可能）。

### 6.5 db.js の更新

各新ドメインのCREATE TABLE文を追加。scaffoldが自動生成する部分 + ドメイン固有カラムの追加。

---

## 7. フェーズ分割と優先順位

### Phase 0: 基盤整備（1-2日）
- [ ] 本計画書の確定
- [ ] docs/roadmap.md の作成
- [ ] nyusatsu のデータ更新ジョブ停止
- [ ] 既存ドメイン一覧・ステータスの明文化

### Phase 1: 最初の1本 — 食品リコール監視ダッシュボード（food-recall）
**選定理由**:
1. **データソースが明確**: 消費者庁のリコール情報サイトが一元的なソース
2. **社会的価値が高い**: 食品安全は全消費者に関わる
3. **差別化しやすい**: 既存の優良な横断検索サービスが少ない
4. **通知機能でLTV向上**: リアルタイム通知はリピート利用を生む
5. **MVP範囲が小さい**: データ構造がシンプルで、最小限の実装で価値を出せる
6. **共通基盤の検証に最適**: 一覧・詳細・通知の基本パターンを検証できる

**Phase 1 のタスク分割**:
1. scaffold実行でファイル群生成
2. food-recall-config.js の作成
3. DB テーブル定義
4. 消費者庁データの importer/source adapter 作成
5. 一覧ページ（ダッシュボード型にカスタマイズ）
6. 詳細ページ
7. お気に入り（メーカーウォッチリスト）
8. Admin CRUD
9. SEO対応（sitemap, メタ情報）

### Phase 2: 産廃処理業者・行政処分ウォッチ（sanpai）
**理由**: 環境省のデータが構造化されており、Importer構築が比較的容易。通知機能をPhase 1で検証済みのため横展開しやすい。

### Phase 3: 自治体の指定管理・委託公募まとめ（shitei）
**理由**: nyusatsu との類似性が最も高く、既存資産の流用効果が最大。ただしデータソースが分散（各自治体個別）のため、スクレイパー構築に時間がかかる。

### Phase 4: 許認可・登録事業者横断検索（kyoninka）
**理由**: 複数省庁のデータ統合・法人番号での名寄せなど、技術的な複雑性が高い。Phase 1-3 の知見を活かして取り組む。

### Phase 5: SaaS比較ナビ拡充（saas）
**理由**: 既存実装が完成しており緊急性は低い。他4本の構築で得たUI/UXの知見を反映して拡充する。

---

## 8. 最小変更方針

### 今回の計画策定フェーズで変更するもの
1. **docs/domain-restructuring-plan.md** — 本ドキュメント（新規作成）
2. **docs/roadmap.md** — ロードマップ（新規作成）

### 今回は変更しないもの
- 公開アプリ本体のコード
- domain registry のコード
- scaffold スクリプト
- DB定義
- 既存ドメインの実装
- nyusatsu の実装（保留として維持）
- デプロイ・VPS関連ドキュメント（ドメイン再編に依存しない）

### 公開側への影響
**影響なし**。本フェーズは計画策定のみであり、公開環境への変更は一切含まない。

---

## 9. 次のステップ

### 即座に実行可能な次の推奨タスク

**「Phase 1: food-recall ドメインの scaffold 実行と初期実装」**

具体的には:
1. `npm run scaffold -- food-recall "食品リコール" --item "リコール" --param "slug" --dry-run` で生成予定ファイルを確認
2. scaffold 実行
3. food-recall-config.js の作成（カテゴリ、リスクレベル、原因分類等の定義）
4. DB テーブルのカスタマイズ（food_recall_items のカラム調整）
5. 消費者庁リコール情報の importer 作成

---

## 付録: 5ドメインの想定情報モデル差分

| 項目 | sanpai | kyoninka | shitei | food-recall | saas |
|------|--------|----------|--------|-------------|------|
| 主キー粒度 | 業者 | 事業者 | 案件 | リコール件 | SaaS製品 |
| サブテーブル | penalties | licenses | - | - | saas_details |
| カテゴリ軸 | 廃棄物種別 | 業種/許認可種別 | 施設種別 | 食品カテゴリ | SaaS分類 |
| エリア軸 | 都道府県 | 都道府県 | 自治体 | 影響地域 | - |
| 時間軸 | 許可期限/処分日 | 許認可期限 | 応募締切/契約期間 | リコール日 | - |
| ステータス | 許可中/処分歴あり | 有効/失効 | 公募中/締切/決定 | 回収中/完了 | active/beta/discontinued |
| 比較の必要性 | 低 | 低 | 低〜中 | 不要 | 高（済） |
| 通知の重要度 | 高 | 中 | 高 | 最高 | 中 |
| 固有UI | タイムライン,地図 | 名寄せ,許認可表 | 契約期間表示 | ダッシュボード,グラフ | 料金表,連携表 |
