# 比較サイト OS — ドメイン基盤ガイド

> 新規ドメインを追加する開発者向けのリファレンスドキュメント。
> scaffold 実行から DB 化・importer・admin・sitemap まで、このファイルだけで完結できることを目指す。
>
> **最終更新:** 6ドメイン構成（minpaku 追加完了時点）

---

## 目次

1. [全体像](#1-全体像)
2. [ディレクトリ構成](#2-ディレクトリ構成)
3. [共通コンポーネント API リファレンス](#3-共通コンポーネント-api-リファレンス)
4. [compare-store リファレンス](#4-compare-store-リファレンス)
5. [domain registry リファレンス](#5-domain-registry-リファレンス)
6. [scaffold-domain 利用ガイド](#6-scaffold-domain-利用ガイド)
7. [生成後のカスタマイズガイド](#7-生成後のカスタマイズガイド)
8. [新規ドメイン追加チェックリスト](#8-新規ドメイン追加チェックリスト)
9. [トラブルシューティング](#9-トラブルシューティング)

---

## 1. 全体像

### 現在の構成

6ドメインが共通基盤上で稼働中。

| # | key | name | basePath | DB | importer | admin | status |
|---|-----|------|----------|----|----------|-------|--------|
| 1 | sports | スポーツ大会 | /marathon | ✅ | ✅(既存) | ✅(既存) | 本番稼働（独自実装） |
| 2 | saas | SaaS ナビ | /saas | ✅ | ✅(既存) | ✅(既存) | 本番稼働（共通基盤適用） |
| 3 | yutai | 株主優待ナビ | /yutai | ✅ | ✅ | ✅ | DB 駆動 + importer + admin |
| 4 | hojokin | 補助金ナビ | /hojokin | ✅ | ✅ | ✅ | DB 駆動 + importer + admin |
| 5 | nyusatsu | 入札ナビ | /nyusatsu | ✅ | ✅ | ✅ | DB 駆動 + importer + admin |
| 6 | minpaku | 民泊ナビ | /minpaku | ✅ | ✅ | ✅ | DB 駆動 + importer + admin |

### 6ドメイン詳細ステータス

| 機能 | sports | saas | yutai | hojokin | nyusatsu | minpaku |
|------|--------|------|-------|---------|----------|---------|
| 公開ページ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DB 駆動 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| compare | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| favorite | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| admin CRUD | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| importer | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| remote import | — | — | ✅ | ✅ | ✅ | ✅ |
| run-imports 対応 | — | — | ✅ | ✅ | ✅ | ✅ |
| sitemap 動的 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### この基盤で共通化されているもの

| レイヤー | 共通部品 | 各ドメインで差し替える部分 |
|---------|---------|----------------------|
| 一覧ページ | `DomainListPage` | カード描画、フィルタ UI、データ取得 |
| 詳細ページ | `DomainDetailPage` | セクション中身、SEO、データ取得 |
| 比較ボタン | `DomainCompareButton` | なし（domainId を渡すだけ） |
| 比較バー | `DomainCompareBar` | なし（domainId + comparePath を渡すだけ） |
| お気に入り | `DomainFavoriteButton` | なし（domain 設定を渡すだけ） |
| 比較状態管理 | `compare-store` | なし（domainId で自動分離） |
| ドメイン定義 | `domain-registry` | config + registry ファイル |
| 管理一覧 | `AdminListPage` | columns 定義 |
| 管理フォーム | `AdminFormPage` | fields 定義 |
| scaffold | `scaffold-domain.js` | 生成後にカスタマイズ |
| 一括 import | `run-imports.js` | env URL + ドメイン追加 |

### 新ドメイン追加で必要な作業の全体像

minpaku（6th domain）追加で実証済みの標準手順:

| Phase | 内容 | ファイル数 |
|-------|------|----------|
| 1. scaffold | config + registry + 公開ページ + favorites + **admin API + admin ページ** | 12新規 + 3追記 |
| 2. カスタマイズ | カテゴリ・項目・カード・admin columns/fields の書き換え | 既存ファイル修正 |
| 3. DB 化 | テーブル + repository + API + seed | 6新規 + 1修正 |
| 4. ページ DB 化 | 仮データ → API fetch | 3修正 |
| 5. importer | normalizer + upsert + CLI + remote | 2新規 |
| 6. admin カスタマイズ | scaffold 生成済みの admin API/ページのカラム調整 + admin トップ導線追加 | 数ファイル修正 |
| 7. sitemap | 動的詳細ルート | 1修正 |
| 8. run-imports | ドメイン追加 | 1修正 |

**合計: 約30ファイル（scaffold 12新規 + 手動追加約10 + 既存修正約5）**

> **注:** scaffold は admin API（`requireAdminApi` guard + audit log 付き）と admin ページ（AdminListPage / AdminFormPage 使用）を自動生成します。生成後はドメイン固有カラムの追加と admin トップへの導線追加のみ手動で行います。

---

## 2. ディレクトリ構成

```
web/
├── components/
│   ├── core/                      # 公開側共通コンポーネント
│   │   ├── DomainListPage.js
│   │   ├── DomainDetailPage.js
│   │   ├── DomainCompareButton.js
│   │   ├── DomainCompareBar.js
│   │   └── DomainFavoriteButton.js
│   └── admin/                     # 管理画面共通コンポーネント
│       ├── AdminListPage.js
│       └── AdminFormPage.js
├── lib/
│   ├── core/
│   │   ├── domain-registry.js
│   │   └── compare-store.js
│   ├── domains/
│   │   ├── index.js               # 全ドメイン import
│   │   ├── sports.js
│   │   ├── saas.js
│   │   ├── yutai.js
│   │   ├── hojokin.js
│   │   ├── nyusatsu.js
│   │   └── minpaku.js
│   ├── repositories/              # DB アクセス層
│   │   ├── yutai.js
│   │   ├── hojokin.js
│   │   ├── nyusatsu.js
│   │   └── minpaku.js
│   ├── importers/                 # データ取り込み
│   │   ├── yutai.js
│   │   ├── hojokin.js
│   │   ├── nyusatsu.js
│   │   └── minpaku.js
│   ├── yutai-config.js
│   ├── hojokin-config.js
│   ├── nyusatsu-config.js
│   └── minpaku-config.js
├── app/
│   ├── {domain}/                  # 公開ページ（各ドメイン共通構成）
│   │   ├── page.js                #   一覧
│   │   ├── compare/page.js        #   比較
│   │   └── [slug]/page.js         #   詳細
│   ├── api/
│   │   ├── {domain}/              # 公開 API
│   │   │   ├── route.js           #   一覧 + compare ids
│   │   │   └── [slug]/route.js    #   詳細
│   │   ├── {domain}-favorites/    # お気に入り API
│   │   │   ├── route.js           #   GET + POST
│   │   │   └── [itemId]/route.js  #   DELETE
│   │   └── admin/{domain}/        # 管理 API
│   │       ├── route.js           #   GET + POST
│   │       └── [id]/route.js      #   GET + PUT
│   └── admin/{domain}/            # 管理ページ
│       ├── page.js                #   一覧
│       ├── new/page.js            #   新規作成
│       └── [id]/edit/page.js      #   編集
├── scripts/
│   ├── scaffold-domain.js         # ドメイン scaffold
│   ├── run-imports.js             # 一括 import 実行
│   ├── seed-yutai.js
│   ├── seed-hojokin.js
│   ├── seed-nyusatsu.js
│   ├── seed-minpaku.js
│   ├── import-yutai.js
│   ├── import-hojokin.js
│   ├── import-nyusatsu.js
│   └── import-minpaku.js
├── data/                          # サンプル入力データ
│   ├── yutai-sample.json
│   ├── hojokin-sample.json
│   ├── nyusatsu-sample.json
│   └── minpaku-sample.json        # (任意)
└── docs/
    └── domain-platform-guide.md   # このファイル
```

---

## 3. 共通コンポーネント API リファレンス

### 3.1 DomainListPage

**ファイル:** `components/core/DomainListPage.js`
**利用実績:** saas, yutai, hojokin, nyusatsu, minpaku（5ドメインで実証済み）

**役割:** 一覧ページの共通骨格。

| prop | 型 | 必須 | 説明 |
|------|---|------|------|
| `title` | `string` | Yes | ページ h1 タイトル |
| `subtitle` | `string \| ReactNode` | — | 件数表示など |
| `items` | `array` | Yes | 表示対象アイテム |
| `loading` | `boolean` | Yes | ローディング中か |
| `renderItem` | `(item) => ReactNode` | Yes | カード描画関数（**key 必須**） |
| `renderFilters` | `() => ReactNode` | — | フィルタ UI slot |
| `renderSort` | `() => ReactNode` | — | ソート UI slot |
| `renderSkeleton` | `() => ReactNode` | — | カスタムスケルトン |
| `emptyState` | `ReactNode` | — | 0 件時の表示 |
| `page` | `number` | Yes | 現在ページ |
| `totalPages` | `number` | Yes | 総ページ数 |
| `onPageChange` | `(page) => void` | Yes | ページ変更ハンドラ |
| `headerSlot` | `ReactNode` | — | ヘッダーとメインの間 |
| `footerSlot` | `ReactNode` | — | ページネーション後 |
| `bottomBar` | `ReactNode` | — | 固定下部バー |
| `layout` | `"sidebar" \| "stacked"` | — | default: `"stacked"` |
| `error` | `ReactNode` | — | エラー時表示 |

**注意:** `layout="sidebar"` は saas でのみ使用。他ドメインは `"stacked"`（デフォルト）。

---

### 3.2 DomainDetailPage

**ファイル:** `components/core/DomainDetailPage.js`
**利用実績:** saas, yutai, hojokin, nyusatsu, minpaku

| prop | 型 | 必須 | 説明 |
|------|---|------|------|
| `loading` | `boolean` | — | default: `false` |
| `notFound` | `ReactNode` | — | 指定時は他を描画しない |
| `breadcrumb` | `ReactNode` | — | パンくず slot |
| `icon` | `ReactNode` | — | ヘッダーアイコン |
| `title` | `string \| ReactNode` | — | h1 タイトル |
| `subtitle` | `string \| ReactNode` | — | プロバイダ名など |
| `meta` | `ReactNode` | — | バッジ表示 |
| `actions` | `ReactNode` | — | favorite / compare ボタン |
| `children` | `ReactNode` | — | コンテンツセクション |
| `footerSlot` | `ReactNode` | — | 下部導線 |
| `renderSkeleton` | `() => ReactNode` | — | カスタムローディング |

---

### 3.3 DomainCompareButton / DomainCompareBar / DomainFavoriteButton

**利用実績:** 全6ドメインで実証済み。minpaku 追加時もコンポーネント変更なしで動作。

| コンポーネント | 主要 props | 動作 |
|--------------|-----------|------|
| `DomainCompareButton` | `domainId`, `itemId`, `variant` | 比較追加/削除トグル |
| `DomainCompareBar` | `domainId`, `comparePath`, `label` | 画面下部固定バー |
| `DomainFavoriteButton` | `itemId`, `domain`, `variant` | お気に入り追加/解除 |

---

### 3.4 AdminListPage / AdminFormPage

**ファイル:** `components/admin/AdminListPage.js`, `AdminFormPage.js`
**利用実績:** yutai, hojokin, nyusatsu, minpaku

| コンポーネント | 主要 props | 動作 |
|--------------|-----------|------|
| `AdminListPage` | `title`, `apiPath`, `basePath`, `publicPath`, `columns` | テーブル一覧 + 検索 + 公開切替 |
| `AdminFormPage` | `title`, `apiPath`, `basePath`, `itemId`, `fields`, `defaults` | フォーム + バリデーション + 保存 |

`columns` は `[{ key, label, render? }]` 形式。`fields` は `[{ key, label, type?, required?, options? }]` 形式。

---

## 4. compare-store リファレンス

**ファイル:** `lib/core/compare-store.js`

- storage key: `compare_ids_{domainId}`（6ドメイン完全分離済み）
- 上限: **3 件**
- `compare-change` カスタムイベントで UI 同期
- SSR 安全（参照系は空配列/0、変更系は no-op）
- `getCompareIdsFromUrlOrStore(domainId, searchParams)` で URL 優先 / store フォールバック

**6ドメインの storage key:**
- `compare_ids_sports`, `compare_ids_saas`, `compare_ids_yutai`
- `compare_ids_hojokin`, `compare_ids_nyusatsu`, `compare_ids_minpaku`

---

## 5. domain registry リファレンス

**ファイル:** `lib/core/domain-registry.js`

### registry 項目（minpaku の実例）

```js
registerDomain({
  id: "minpaku",
  name: "民泊ナビ",
  basePath: "/minpaku",
  apiBasePath: "/api/minpaku",
  adminBasePath: "/admin/minpaku",
  categories: minpakuConfig.categories,
  sorts: minpakuConfig.sorts,
  compareFields: minpakuConfig.compareFields,
  terminology: { item: "物件", itemPlural: "物件", provider: "ホスト", category: "カテゴリ", favorite: "お気に入り" },
  favorites: {
    tableName: "minpaku_favorites",
    idColumn: "minpaku_id",
    checkEndpoint: "/api/minpaku-favorites?check=",
    apiEndpoint: "/api/minpaku-favorites",
    deleteEndpoint: "/api/minpaku-favorites/",
  },
  seo: { titleTemplate: "%s | 民泊ナビ", descriptionTemplate: "%s の民泊情報。" },
  db: { mainTable: "minpaku_items", idColumn: "id" },
});
```

### registry 参照 API

```js
getDomain("minpaku")          // DomainConfig | undefined
getAllDomains()                // DomainConfig[] (6件)
getDomainByPath("/minpaku/1") // DomainConfig | undefined
hasDomain("minpaku")          // true
```

---

## 6. scaffold-domain 利用ガイド

### コマンド

```bash
npm run scaffold -- <key> <name> [--item <term>] [--provider <term>] [--param slug|code] [--dry-run]
```

### minpaku 追加時の実例

```bash
# 1. scaffold で骨格生成
npm run scaffold -- minpaku 民泊ナビ --item 物件 --provider ホスト

# 生成されるファイル (12):
#   lib/minpaku-config.js
#   lib/domains/minpaku.js
#   app/minpaku/page.js
#   app/minpaku/compare/page.js
#   app/minpaku/[slug]/page.js
#   app/api/minpaku-favorites/route.js
#   app/api/minpaku-favorites/[itemId]/route.js
#   app/api/admin/minpaku/route.js          ← guard + audit 付き
#   app/api/admin/minpaku/[id]/route.js     ← guard + audit 付き
#   app/admin/minpaku/page.js               ← AdminListPage 使用
#   app/admin/minpaku/new/page.js           ← AdminFormPage 使用
#   app/admin/minpaku/[id]/edit/page.js     ← AdminFormPage 使用
#
# 自動追記 (3):
#   lib/domains/index.js — import 追加
#   app/sitemap.js — 静的ルート追加
#   lib/db.js — favorites テーブル追加
```

### scaffold で自動生成されるが、手動カスタマイズが必要なもの

| 項目 | 生成状態 | 手動対応 |
|------|---------|---------|
| admin API (`app/api/admin/{key}/*`) | ✅ scaffold 生成（guard + audit 付き） | INSERT/UPDATE カラムをドメイン固有に合わせる |
| admin ページ (`app/admin/{key}/*`) | ✅ scaffold 生成 | columns / fields をドメイン固有に合わせる |
| admin トップ導線 | ❌ 未生成 | `app/admin/page.js` の DOMAINS 配列に手動追加 |

### scaffold では生成されないもの（手動で追加が必要）

| 項目 | 追加先 |
|------|--------|
| 本体データ DB テーブル | `lib/db.js` |
| repository | `lib/repositories/{key}.js` |
| 公開 API | `app/api/{key}/route.js`, `[slug]/route.js` |
| seed スクリプト | `scripts/seed-{key}.js` |
| importer | `lib/importers/{key}.js`, `scripts/import-{key}.js` |
| sitemap 動的ルート | `app/sitemap.js` |
| run-imports 対応 | `scripts/run-imports.js` |

---

## 7. 生成後のカスタマイズガイド

scaffold 後に仕上げるべき項目を、minpaku を例に優先順で示す。

### 7.1 config カスタマイズ

`lib/{key}-config.js` — scaffold の雛形カテゴリ3件をドメインに合わせて書き換え。

minpaku の例: city / resort / family / business / luxury / budget / other の7カテゴリ + propertyTypes + statusOptions + 8つの compareFields。

### 7.2 DB テーブル + repository

`lib/db.js` に `{key}_items` テーブルを追加。`lib/repositories/{key}.js` に以下の関数を実装:

| 関数 | 用途 |
|------|------|
| `list{Key}Items` | 公開一覧（フィルタ + ページネーション） |
| `get{Key}BySlug` | 公開詳細 |
| `get{Key}ById` | 内部参照 |
| `get{Key}ByIds` | compare 用 |
| `upsert{Key}Item` | importer 用 |
| `list{Key}SlugsForSitemap` | sitemap 用 |
| `list{Key}AdminItems` | admin 一覧 |
| `get{Key}AdminById` | admin 詳細 |
| `create{Key}Item` | admin 新規作成 |
| `update{Key}Item` | admin 更新 |

### 7.3 公開ページ DB 化

scaffold が生成する仮データ参照のページを、API fetch に書き換え:
- `app/{key}/page.js` — `useMemo(SEED_DATA)` → `fetch("/api/{key}")`
- `app/{key}/[slug]/page.js` — `getBySlug(params)` → `fetch("/api/{key}/{slug}")`
- `app/{key}/compare/page.js` — `ids.map(getById)` → `fetch("/api/{key}?ids=...")`

### 7.4 favorites API の DB JOIN 化

scaffold が生成する favorites API は仮データ参照。DB 化後は:
- GET 一覧: `JOIN {key}_items` に変更
- POST: `SELECT id FROM {key}_items WHERE id = ?` で存在確認

### 7.5 importer

`lib/importers/{key}.js` + `scripts/import-{key}.js` を追加:
- `loadJson(path)` — ローカル JSON 読み込み
- `loadRemoteJson(url)` — リモート JSON 取得
- `normalize(raw)` — 1件正規化
- `runImport(items, opts)` — 全件処理 + レポート

CLI: `node scripts/import-{key}.js data/{key}-sample.json --dry-run`
Remote: `node scripts/import-{key}.js --remote <URL> --verbose`

### 7.6 run-imports.js 対応

`scripts/run-imports.js` の `DOMAINS` に追加:

```js
minpaku: {
  name: "民泊ナビ",
  script: resolve(__dirname, "import-minpaku.js"),
  envKey: "MINPAKU_IMPORT_URL",
},
```

### 7.7 admin CRUD（scaffold 自動生成 + カスタマイズ）

scaffold が以下を自動生成します:

| ファイル | 自動生成内容 | 手動カスタマイズ |
|---------|------------|---------------|
| `app/api/admin/{key}/route.js` | GET + POST（`requireAdminApi` guard + `writeAuditLog` 付き） | INSERT カラムをドメイン固有に合わせる |
| `app/api/admin/{key}/[id]/route.js` | GET + PUT（guard + audit + `is_published_changed` 検知） | UPDATE カラムを合わせる |
| `app/admin/{key}/page.js` | `AdminListPage` ベース一覧 | `columns` をドメイン固有に合わせる |
| `app/admin/{key}/new/page.js` | `AdminFormPage` ベース新規作成 | `fields` + `defaults` を合わせる |
| `app/admin/{key}/[id]/edit/page.js` | `AdminFormPage` ベース編集 | `fields` を合わせる |

**手動で必要な作業:**
- `app/admin/page.js` の `DOMAINS` 配列に新ドメインを追加（scaffold では未追記）
- admin API の SQL を、実際の `{key}_items` テーブル構造に合わせて修正（scaffold 生成時は `slug`, `title`, `is_published` のみ）

**自動適用される保護:**
- `requireAdminApi()` — 未認証 → 401、非admin → 403
- `writeAuditLog()` — POST で `ADMIN_ITEM_CREATED`、PUT で `ADMIN_ITEM_UPDATED` を記録
- `extractRequestInfo()` — IP / User-Agent を audit に記録
- `is_published` 変更時は `details.is_published_changed` に旧値→新値を記録

### 7.8 sitemap 動的ルート

`app/sitemap.js` に:
1. `import { list{Key}SlugsForSitemap }` を追加
2. `let {key}DetailPages = [];` を追加
3. try ブロック内で DB から slug を取得
4. return 配列に `...{key}StaticPages, ...{key}DetailPages` を追加

---

## 8. 新規ドメイン追加チェックリスト

### Phase 1: scaffold

- [ ] `npm run scaffold -- <key> <name> --item <term> --provider <term> --dry-run` でプレビュー
- [ ] scaffold 実行、12ファイル生成 + 3ファイル追記を確認

### Phase 2: config カスタマイズ

- [ ] `lib/{key}-config.js` のカテゴリ・compareFields・terminology を書き換え
- [ ] ヘルパー関数（formatPrice 等）を必要に応じて追加

### Phase 3: DB 化

- [ ] `lib/db.js` に `{key}_items` テーブル追加
- [ ] `lib/repositories/{key}.js` 作成（10関数）
- [ ] `app/api/{key}/route.js` 作成（一覧 + compare ids）
- [ ] `app/api/{key}/[slug]/route.js` 作成（詳細）
- [ ] `scripts/seed-{key}.js` 作成、実行

### Phase 4: ページ DB 化

- [ ] `app/{key}/page.js` を API fetch に変更
- [ ] `app/{key}/[slug]/page.js` を API fetch に変更
- [ ] `app/{key}/compare/page.js` を API fetch に変更
- [ ] `app/api/{key}-favorites/route.js` を DB JOIN に変更

### Phase 5: importer

- [ ] `lib/importers/{key}.js` 作成（normalize + loadJson + loadRemoteJson + runImport）
- [ ] `scripts/import-{key}.js` 作成（--remote, --dry-run, --verbose, --limit）
- [ ] ローカル import テスト: `node scripts/import-{key}.js data/{key}-sample.json --dry-run`
- [ ] remote import テスト: `node scripts/import-{key}.js --remote <URL> --dry-run`

### Phase 6: run-imports 対応

- [ ] `scripts/run-imports.js` の DOMAINS に追加
- [ ] env: `{KEY}_IMPORT_URL`
- [ ] テスト: `{KEY}_IMPORT_URL=... node scripts/run-imports.js --domain {key} --dry-run`

### Phase 7: admin CRUD（scaffold 自動生成 + カスタマイズ）

**scaffold で自動生成済み（Phase 1 で生成）:**
- [x] `app/api/admin/{key}/route.js`（guard + audit 付き）
- [x] `app/api/admin/{key}/[id]/route.js`（guard + audit 付き）
- [x] `app/admin/{key}/page.js`（AdminListPage）
- [x] `app/admin/{key}/new/page.js`（AdminFormPage）
- [x] `app/admin/{key}/[id]/edit/page.js`（AdminFormPage）

**手動で必要:**
- [ ] admin API の INSERT/UPDATE SQL をドメイン固有カラムに合わせて修正
- [ ] admin 一覧の `columns` をドメイン固有に合わせて修正
- [ ] admin フォームの `fields` + `defaults` をドメイン固有に合わせて修正
- [ ] `app/admin/page.js` の DOMAINS 配列に追加

### Phase 8: sitemap

- [ ] `app/sitemap.js` に import + 変数 + try/catch + return 追記
- [ ] `/sitemap.xml` に `/{key}/{slug}` が出力されることを確認

### Phase 9: 動作確認

- [ ] `npx next build` 成功
- [ ] `/{key}` 一覧表示
- [ ] `/{key}/{slug}` 詳細表示
- [ ] `/{key}/compare` 比較動作
- [ ] compare-store が `compare_ids_{key}` で分離
- [ ] favorite ♡ ボタン表示・動作
- [ ] `/admin/{key}` 一覧・新規・編集
- [ ] コンソール / サーバーエラーなし

### Phase 10: 非破壊確認

- [ ] `/marathon` 正常
- [ ] `/saas` 正常
- [ ] `/yutai` 正常
- [ ] `/hojokin` 正常
- [ ] `/nyusatsu` 正常
- [ ] `/minpaku` 正常
- [ ] 他ドメインの compare / favorite が壊れていない

---

## 9. トラブルシューティング

### `import "@/lib/domains"` の side-effect を忘れた

**症状:** `getDomain("key")` が `undefined` を返す
**原因:** ページファイルに `import "@/lib/domains"` がない
**対処:** ページの先頭に追加。これは side-effect import で、全ドメインを registry に登録する

### compare-store の URL 同期がループする

**症状:** 比較ページで無限リダイレクト
**原因:** `router.replace` が毎 render で呼ばれている
**対処:** `useRef` で1回のみ実行するようガード。既存の compare ページの `urlSyncDone` パターンを参照

### sitemap に動的詳細 URL が出ない

**確認:**
1. `app/sitemap.js` に `list{Key}SlugsForSitemap` の import があるか
2. `let {key}DetailPages = [];` が宣言されているか
3. try ブロック内で DB クエリが実行されているか
4. return 配列に `...{key}DetailPages` があるか
5. DB にデータが入っているか（`is_published = 1` のもの）

### importer の remote URL が env 未設定

**症状:** `run-imports.js --all` で一部ドメインが `FAILED`
**原因:** 対応する環境変数が未設定
**対処:** 実行時に環境変数を設定。env 一覧:

| ドメイン | 環境変数 |
|---------|---------|
| yutai | `YUTAI_IMPORT_URL` |
| hojokin | `HOJOKIN_IMPORT_URL` |
| nyusatsu | `NYUSATSU_IMPORT_URL` |
| minpaku | `MINPAKU_IMPORT_URL` |

### run-imports.js で一部ドメインだけ失敗する

**確認:**
1. 対応する env が設定されているか
2. remote URL が有効か（手動で curl して確認）
3. `--continue-on-error`（デフォルト）なら他ドメインは継続される
4. `--fail-fast` なら最初の失敗で停止

### admin で保存しても公開側に出ない

**確認:**
1. `is_published` が 1 になっているか（admin 一覧で「公開中」表示を確認）
2. 公開側 API は `WHERE is_published = 1` でフィルタしている
3. `is_published = 0` のデータは admin からのみ見える

### scaffold 後に不足しがちなファイル群

scaffold は公開ページ + favorites のみ生成。以下は手動追加が必要:

- `lib/db.js` — 本体テーブル
- `lib/repositories/{key}.js`
- `app/api/{key}/route.js` + `[slug]/route.js`
- `scripts/seed-{key}.js`
- `lib/importers/{key}.js`
- `scripts/import-{key}.js`
- `app/api/admin/{key}/route.js` + `[id]/route.js`
- `app/admin/{key}/page.js` + `new/page.js` + `[id]/edit/page.js`
- `scripts/run-imports.js` へのドメイン追加
- `app/admin/page.js` への導線追加
- `app/sitemap.js` への動的ルート追加

### build エラー

**よくある原因:**
- config の export 名とページの import 名が不一致
- `getDomain()` が undefined（`import "@/lib/domains"` 漏れ）
- repository 関数名の typo
- DB テーブルが作成されていない（`lib/db.js` への追記漏れ）
- admin API の route param 名と repository の引数名が不一致
