# 比較サイトOS ロードマップ

> 作成日: 2026-03-25
> 関連: [domain-restructuring-plan.md](./domain-restructuring-plan.md)

---

## ドメイン一覧とステータス

### コアドメイン（継続）
| ドメイン | ID | ステータス | 備考 |
|---------|-----|----------|------|
| スポログ（スポーツ大会） | sports | **運用中** | メインプロダクト |
| SaaS比較ナビ | saas | **運用中** → Phase 5で拡充 | |
| 株主優待ナビ | yutai | **運用中** | 現状維持 |
| 補助金ナビ | hojokin | **運用中** | 現状維持 |
| 民泊ナビ | minpaku | **運用中** | 現状維持 |

### 保留ドメイン
| ドメイン | ID | ステータス | 備考 |
|---------|-----|----------|------|
| 入札ナビ | nyusatsu | **非優先保留** | データ更新停止、コードは参照実装として維持 |

### 新規ドメイン（計画中）
| ドメイン | ID | ステータス | Phase |
|---------|-----|----------|-------|
| 食品リコール監視 | food-recall | **計画策定済** | Phase 1 |
| 産廃処理業者・行政処分ウォッチ | sanpai | **計画策定済** | Phase 2 |
| 指定管理・委託公募まとめ | shitei | **計画策定済** | Phase 3 |
| 許認可・登録事業者横断検索 | kyoninka | **計画策定済** | Phase 4 |
| SaaS比較ナビ拡充 | saas | **計画策定済** | Phase 5 |

---

## Phase 0: 基盤整備

**期間目安**: 1-2日
**前提**: 計画書の承認後

### タスク
- [x] domain-restructuring-plan.md 作成
- [x] roadmap.md 作成
- [ ] nyusatsu データ更新ジョブの停止（cronから外す/環境変数で無効化）
- [ ] nyusatsu-source.js の外部API環境変数を本番から除外

### 成果物
- 計画ドキュメント 2件
- nyusatsu 非優先化の実施

---

## Phase 1: 食品リコール監視ダッシュボード（food-recall）

**優先順位**: 最優先
**選定理由**: データソース明確、社会的価値高、差別化容易、MVP範囲小

### Step 1.1: Scaffold + 基本構造
- [ ] scaffold 実行（dry-run → 本番）
- [ ] food-recall-config.js 作成
  - カテゴリ: 生鮮食品、加工食品、飲料、菓子、調味料、乳製品、冷凍食品、その他
  - リスクレベル: Class I（重篤）, Class II（中程度）, Class III（軽微）
  - 原因分類: 異物混入、微生物汚染、アレルゲン表示不備、化学物質、表示不備、その他
  - ステータス: 回収中、回収完了、調査中
- [ ] DB テーブル定義（food_recall_items）
- [ ] domains/food-recall.js 作成（レジストリ登録）

### Step 1.2: データ取得
- [ ] 消費者庁リコール情報サイトの構造調査
- [ ] food-recall-source.js（Source Adapter）作成
- [ ] food-recall importer 作成（normalize → upsert → report）
- [ ] 初期データ投入テスト

### Step 1.3: 公開ページ
- [ ] 一覧ページ（リスクレベル色分け、日付フィルタ）
- [ ] 詳細ページ（リコール詳細 + 対処方法）
- [ ] お気に入り（メーカーウォッチリスト）
- [ ] SEO（sitemap追加、メタ情報）

### Step 1.4: 管理画面
- [ ] Admin一覧・作成・編集ページ
- [ ] Admin API

### Step 1.5: 検証・改善
- [ ] 実データでの表示確認
- [ ] ダッシュボード型UIの検討（一覧の拡張）
- [ ] 通知機能の検討（Phase 1では設計のみでも可）

---

## Phase 2: 産廃処理業者・行政処分ウォッチ（sanpai）

**前提**: Phase 1 完了後

### Step 2.1: Scaffold + 基本構造
- [ ] scaffold 実行
- [ ] sanpai-config.js 作成
- [ ] DB テーブル定義（sanpai_items + sanpai_penalties）
- [ ] domains/sanpai.js 作成

### Step 2.2: データ取得
- [ ] 環境省「さんぱいくん」のデータ構造調査
- [ ] sanpai-source.js 作成
- [ ] sanpai importer 作成
- [ ] 行政処分情報のスクレイパー作成

### Step 2.3: 公開ページ
- [ ] 業者一覧ページ
- [ ] 業者詳細ページ + 処分履歴タイムライン
- [ ] お気に入り（ウォッチリスト）

### Step 2.4: 個別UI
- [ ] 処分履歴タイムラインコンポーネント
- [ ] リスクスコア表示

---

## Phase 3: 指定管理・委託公募まとめ（shitei）

**前提**: Phase 2 完了後
**特記**: nyusatsu からの流用が最も効果的

### Step 3.1: Scaffold + 基本構造
- [ ] scaffold 実行
- [ ] shitei-config.js 作成（nyusatsu-config.js をベースに改変）
- [ ] DB テーブル定義（shitei_items）
- [ ] domains/shitei.js 作成

### Step 3.2: データ取得
- [ ] 主要自治体（政令市 + 東京23区）の公募ページ調査
- [ ] shitei-source.js 作成
- [ ] shitei importer 作成

### Step 3.3: 公開ページ
- [ ] 案件一覧ページ（nyusatsu UIをベースに）
- [ ] 案件詳細ページ
- [ ] 締切アラート表示（nyusatsu の getDeadlineRemaining() 流用）

---

## Phase 4: 許認可・登録事業者横断検索（kyoninka）

**前提**: Phase 3 完了後
**特記**: 技術的複雑性が最も高い（法人番号名寄せ）

### Step 4.1: Scaffold + 基本構造
- [ ] scaffold 実行
- [ ] kyoninka-config.js 作成
- [ ] DB テーブル定義（kyoninka_items + kyoninka_licenses）
- [ ] domains/kyoninka.js 作成

### Step 4.2: データ取得
- [ ] 建設業者検索データの取得方法調査
- [ ] kyoninka-source.js 作成
- [ ] kyoninka importer 作成 + 法人番号名寄せロジック

### Step 4.3: 公開ページ
- [ ] 事業者検索ページ
- [ ] 事業者詳細ページ + 許認可一覧
- [ ] 業種横断フィルタ

---

## Phase 5: SaaS比較ナビ拡充（saas）

**前提**: Phase 1-4 の知見を反映
**特記**: 既存実装があるため、差分のみ

### タスク
- [ ] カテゴリ拡充（AI/ML, データ分析, Eコマース等）
- [ ] 料金プラン詳細ページの実装
- [ ] 連携サービス情報の追加
- [ ] セキュリティ認証バッジ表示
- [ ] SEOランディングページ拡充

---

## 横断施策（Phase 1-5 を通じて）

### 通知基盤
- Phase 1（food-recall）で基本設計
- Phase 2（sanpai）で行政処分通知として拡張
- Phase 3（shitei）で締切通知として拡張

### SEO基盤
- 各ドメインのカテゴリ別ランディングページを標準化
- sitemap.js への追加を自動化検討

### データ品質
- importer の共通テスト基盤
- データ鮮度監視の横断化
