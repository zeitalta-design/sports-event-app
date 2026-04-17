# Pipeline Layer — 最小実装

Collector で取得した生レコードを Formatter で統一スキーマに変換し、DB に保存する配線層。

## Step 2 時点の実装範囲

| Collector | Formatter | Pipeline 配線 | 状態 |
|-----------|-----------|--------------|------|
| `nyusatsu.kkj` | ✅ | ✅ `processKkjRecords` | **Step 2 で完成** |
| `nyusatsu.central-ministries` | ✅ | ❌ | **Step 2.5 で配線**（既存 fetcher が fetch+format+save を内部完結しており要リファクタ） |
| `nyusatsu.p-portal-results` | ✅ | ❌ | **Step 2.5 で配線**（同上） |

## 使い方（KKJ のみ）

```js
import { processKkjRecords } from "@/lib/agents/pipeline/nyusatsu";
import { parseKkjXml } from "@/lib/nyusatsu-kkj-fetcher";

// (1) Collector 相当: HTTP fetch（ここはまだ既存関数を直接叩いているが、
//     将来は Collector#collectRaw() に一本化）
const res = await fetch(kkjApiUrl);
const xml = await res.text();

// (2) parse
const raw = parseKkjXml(xml);

// (3) Pipeline: format → DB upsert
const stats = processKkjRecords(raw, { dryRun: false });
// → { formatted, inserted, updated, skipped }
```

CLI は `scripts/demo-pipeline-nyusatsu.mjs` 参照。

## 次に埋めること（Step 2.5）

1. `nyusatsu-fetcher.js` と `nyusatsu-result-fetcher.js` を「parse 関数」単位に分解し export
2. それぞれに対応する `processCentralMinistries` / `processPPortalResults` を追加
3. CLI / cron を新パイプライン経由に切替
4. 切替後、旧 fetcher の DB書込みロジックを削除（fetcher は parse 返却のみに）

## 禁止事項

- Formatter / Collector の責務を侵食しない
- Resolver 相当の名寄せはこの層でやらない（別レイヤー）
- ドメインをまたぐ処理はしない（`pipeline/nyusatsu.js` は nyusatsu のみ触る）
