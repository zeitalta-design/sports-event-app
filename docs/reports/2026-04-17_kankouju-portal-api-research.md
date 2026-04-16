# 官公需情報ポータル検索API 調査レポート（Phase C 下調べ）

**日付**: 2026-04-17
**担当**: 入札カテゴリ最優先方針・Phase C
**結論**: **即採用推奨**。公式XML API、無認証、自治体含む 約 30万件ヒット、PDF全文テキスト付き。

---

## 1. 基本情報

| 項目 | 値 |
|------|-----|
| 運営 | 中小企業庁（SME Agency） |
| サイト | https://www.kkj.go.jp/ （registry の `kankouju.go.jp` は誤り、要修正） |
| APIベース | `https://www.kkj.go.jp/api/` |
| 認証 | **不要**（APIキーなし・申請なし） |
| レスポンス | XML (UTF-8) |
| 公式仕様 | https://www.kkj.go.jp/doc/ja/api_guide.pdf （V1.1, 平成28年5月27日） |
| e-Gov カタログ | https://api-catalog.e-gov.go.jp/info/ja/apicatalog/view/67 |
| 収録件数 | `<SearchHits>296,543</SearchHits>` (Query=工事 時点) |

---

## 2. 調達ポータル (Phase B) との違い

| 観点 | 調達ポータル (P-Portal) | 官公需情報ポータル (KKJ) |
|------|-------------------------|---------------------------|
| データ種別 | **落札結果** | **入札公告** |
| 対象範囲 | 国のみ | 国 + **都道府県 + 市区町村** |
| 配布形式 | 年度/日次ZIP→CSV | XML REST API |
| 件数（既取得） | 298,839件 | 未取得（~30万件想定） |
| 認証 | 不要 | 不要 |
| 更新頻度 | 日次 | 日次 |
| 予定価格 | なし | なし |
| PDF全文 | なし | **あり**（ProjectDescription） |

**位置づけ**: Phase B が「落札者分析の基盤」なら、**Phase C は「公告DBの全国カバー」**。両者は相補関係で、`nyusatsu_items`（公告）と `nyusatsu_results`（結果）の両テーブルを両輪で埋めていく戦略と合致。

---

## 3. 利用可能な API パラメータ（公式仕様 + 実測）

### 検索条件
| パラメータ | 例 | 備考 |
|-----------|-----|------|
| `Query` | `工事` | 全文検索。**2文字以上必須**（カナ1文字は `Error: only one Kana character`） |
| `Project_Name` | - | 案件名限定 |
| `Organization_Name` | - | 機関名限定 |
| `LG_Code` | `13` (東京都) | JIS X0401（01=北海道〜47=沖縄） |
| `Category` | `1`=物品 / `2`=工事 / `3`=役務 | **実測: 4以降は無視される** |
| `Procedure_Type` | - | 入札方式 |
| `Certification` | - | 認証区分 |

### 日付レンジフィルタ
全て `YYYY-MM-DD/YYYY-MM-DD` 形式。片側省略可 (`2026-04-01/`)。
- `CFT_Issue_Date` — 公告日（**最重要**）
- `Tender_Submission_Deadline` — 入札書提出期限
- `Opening_Tenders_Event` — 開札日
- `Period_End_Time` — 履行期限

### 結果制御
| パラメータ | 値 | 備考 |
|-----------|-----|------|
| `Count` | 1〜1000 | デフォルト 10 |

### ⚠️ 制約：ページングなし（実質）
- `Start` / `Offset` / `Page` / `From` は**いずれも無効**（実測で確認。常に同じ先頭結果を返す）
- 公式仕様書より「**SearchHits 1,000 を超える結果は取得不可**」との記述
- **回避策**: 日付スライス + LG_Code × Category で 1,000件未満に分割してから取得

### ブール検索（Query/Project_Name/Organization_Name 用）
- `AND` / `OR` / `ANDNOT` 対応
- `()` でグルーピング可能
- 複数パラメータ間は暗黙の AND

### エラーコード
`invalid sort` / `Invalid Date Parameter` / `service does not exist` / `search disabled` / `Only one Kana character in search expression` / `internal error` / `no searchword`

---

## 4. レスポンス XML スキーマ（全フィールド）

```xml
<Results>
  <Version>1.0</Version>
  <SearchResults>
    <SearchHits>296543</SearchHits>
    <SearchResult>
      <ResultId>1</ResultId>
      <Key><![CDATA[base64エンコードされた内部キー]]></Key>
      <ExternalDocumentURI>元PDFのURL</ExternalDocumentURI>
      <ProjectName>案件名</ProjectName>
      <Date>2026-04-06T19:07:46+09:00</Date>        <!-- クロール日時 -->
      <FileType>pdf</FileType>
      <FileSize>150151</FileSize>
      <LgCode>07</LgCode>
      <PrefectureName>福島県</PrefectureName>
      <CityCode>072117</CityCode>
      <CityName>田村市</CityName>
      <OrganizationName>福島県田村市</OrganizationName>
      <Certification>…</Certification>
      <CftIssueDate>2026-04-20T00:00:00+09:00</CftIssueDate>
      <PeriodEndTime>…</PeriodEndTime>
      <Category>役務</Category>
      <ProcedureType>…</ProcedureType>
      <Location>…</Location>
      <TenderSubmissionDeadline>…</TenderSubmissionDeadline>
      <OpeningTendersEvent>…</OpeningTendersEvent>
      <ItemCode>…</ItemCode>
      <ProjectDescription>(PDF全文テキスト抽出)</ProjectDescription>
      <Attachments>
        <Attachment><Name>…</Name><Uri>…</Uri></Attachment>
      </Attachments>
    </SearchResult>
    ...
  </SearchResults>
</Results>
```

---

## 5. 既存 `nyusatsu_items` スキーマへのマッピング

| DBカラム | API フィールド | 備考 |
|----------|---------------|------|
| `slug` | `kkj-` + Key | UNIQUE。Key は既に base64 URLsafe 形式で衝突しにくい |
| `title` | `ProjectName` | PDF サイズ表記 `(146.6KB)` は除去 |
| `category` | `Category` 値 →英語化 | 工事→construction / 物品→goods / 役務→service |
| `issuer_name` | `OrganizationName` | 「福島県田村市」形式でそのまま可 |
| `target_area` | `PrefectureName` + `CityName` | |
| `deadline` | `TenderSubmissionDeadline` or `PeriodEndTime` | ISO8601 → `YYYY-MM-DD` |
| `budget_amount` | ❌ 取得不可 | API仕様にない |
| `bidding_method` | `ProcedureType` | |
| `summary` | `ProjectDescription` の先頭200字 | PDF全文は捨てるか別カラム検討 |
| `status` | deadline と現在日の比較 | 'open' / 'closed' |
| `announcement_date` | `CftIssueDate` → `YYYY-MM-DD` | |
| `announcement_url` | `ExternalDocumentURI` | |
| `contact_info` | ❌ | |
| `delivery_location` | `Location` | |
| `has_attachment` | `Attachments` 有無 | |
| `contract_period` | ❌ | |
| `source_name` | `'官公需情報ポータル（中小企業庁）'` | 固定 |
| `source_url` | API呼び出しURL（再現可能に） | |
| `lifecycle_status` | `active` | 既存パターンに従う |

**追加案（必要なら）**:
- `kkj_key TEXT` — 元APIの `Key` を保持（差分・重複検出用）
- 既存カラムで十分なら slug に埋め込みで可

---

## 6. 全件取得戦略（SearchHits 1,000 制限の回避）

### 戦略A: 日付スライス（推奨・最シンプル）
```
CftIssueDate を 1日単位で走査、1日あたり < 1,000 件の想定
実測: 2026-04-15 分 = 423件 / 2026-04-20 分 = 3件
→ 日次 cron は当日または前日分を1リクエストで取得可能
```

### 戦略B: 日付 × LG_Code 併用（バックフィル用）
```
for date in date_range:
  for lg_code in 01..47:
    GET ?CFT_Issue_Date={date}&LG_Code={lg_code}&Count=1000
```
1日47リクエスト × 過去N年 = 数万リクエスト相当。
レート制限は公式非公開だが、**既存 fetcher の1秒スリープ踏襲で安全**。

### 戦略C: 日付 × Category 併用
LG_Code=13（東京都）だけで 23,415 件あるので、日付×LG_Code だけでも大半ケースは1,000未満。まれに東京都の大型日があれば Category で再分割。

**最終方針**:
- **日次 cron**: 戦略A（昨日 + 今日を取得、重複は upsert で吸収）
- **初回バックフィル**: 戦略B を月単位で回す

---

## 7. 重複問題

既存の nyusatsu fetcher（maff/meti/soumu/mhlw/env/mlit の6省庁）と**同じ公告が重複取得される可能性**がある。

### 対応案
1. **slug プレフィックスで源泉分離**（推奨）:
   - 既存: `maff-*`, `meti-*`, ... → そのまま残す
   - 新規: `kkj-{Key}` → 別エントリとして受け入れる
   - 副作用: 同一案件が 2 レコードになる
2. **URL正規化で dedup**: `announcement_url` をキーに後処理で統合
3. **無視**: 官公需ポータルは自治体メイン、6省庁は国メインで棲み分け → 重複は限定的

**推奨: 案1 で実装 → 運用後、実際の重複率を計測して案2 の dedup バッチを検討**

---

## 8. 実装タスクの見積（参考）

Phase B の `nyusatsu-result-fetcher.js` (241行) がベンチマーク。Phase C はパース方式が違う（XML）が難易度は同等。

| 成果物 | 規模 |
|--------|------|
| `lib/nyusatsu-kkj-fetcher.js` | ~280行 (XMLパース + 日付走査 + upsert) |
| `scripts/fetch-kkj.mjs` | ~90行 (CLI、Phase B とほぼ同形) |
| `.github/workflows/fetch-kkj.yml` | ~80行 (日次 cron、Phase B 流用) |
| registry 更新 | URL修正 + `discoveryStatus: confirmed` へ昇格 |
| docs 追記 | 本レポートのサマリを `risk-monitoring-backlog.md` へ |

**依存ライブラリ**: `fast-xml-parser` or 正規表現パース。既存に XMLパーサが無いため、正規表現で行くのが最小依存。

---

## 9. 推奨 Next Step

1. **Phase C 実装にそのまま進む** — 調査で未知数はほぼ消えた
2. 実装順序:
   - `lib/nyusatsu-kkj-fetcher.js` を書く
   - CLI で `--dry-run` 1日分で動作確認
   - ローカルDBに少量投入してスキーマ整合を確認
   - 日次 cron workflow 追加
   - registry の官公需ポータルを `confirmed` へ昇格（URL も修正）
3. **初回バックフィル**: `fetch-pportal-results.mjs` の `--year`/`--limit` 分割方式を踏襲し、月単位で回す

---

## 10. 注意事項・TODO

- 利用規約は PDF 「6.5 利用規約」項に誘導あり。実装前にサイト本体の利用規約を目視確認すること
- アクセス頻度の明示制限は公式仕様書になし → 既存 fetcher の 1s sleep を踏襲で十分
- registry の `url: "https://kankouju.go.jp/"` は **`https://www.kkj.go.jp/` に修正**
- AI応用検索版（www.kkj.go.jp/as/）は別サービス、今回のAPIとは無関係（将来検討）
