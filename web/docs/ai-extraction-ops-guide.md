# AI下書き・抽出 運用ガイド

## 概要
4ドメインの詳細ページから構造化情報を自動抽出し、review を支援する。
deterministic parser + LLM ハイブリッドで動作。

## コマンド一覧

### AI抽出実行
```bash
# food-recall の詳細ページから抽出（最大5件）
node scripts/run-ai-extraction.js food-recall --limit 5

# shitei の詳細ページから抽出
node scripts/run-ai-extraction.js shitei --limit 10

# sanpai の詳細ページから抽出
node scripts/run-ai-extraction.js sanpai --limit 3

# 抽出結果のステータス確認
node scripts/run-ai-extraction.js status
```

### 反映管理
```bash
# 反映ステータス確認
node scripts/apply-ai-extractions.js status

# 反映候補の分類（apply-ready / review-required / hold / failed）
node scripts/apply-ai-extractions.js classify

# 主テーブルに反映（dry-run）
node scripts/apply-ai-extractions.js apply food-recall --dry-run

# 実反映
node scripts/apply-ai-extractions.js apply food-recall
```

## LLM設定

### 環境変数
```bash
# LLMを有効化（Gemini推奨）
export LLM_ENABLED=true
export LLM_API_KEY=your-gemini-api-key
export LLM_PROVIDER=gemini          # or openai
export LLM_MODEL=gemini-2.0-flash   # or gpt-4o-mini
```

### 動作モード
| モード | LLM設定 | 動作 |
|--------|---------|------|
| deterministic | 未設定 | HTMLのテーブル/テキストから構造的に抽出 |
| hybrid | 有効 | deterministic + LLMで不足項目を補完 |

## 反映ルール

### 分類基準
| 分類 | confidence | quality | 不足項目 |
|------|-----------|---------|---------|
| apply-ready | ≥ 0.6 | good/draft | ≤ 2 |
| review-required | ≥ 0.6 | good/draft | > 2 |
| hold | < 0.6 | any | — |
| failed | < 0.3 | raw | — |

### 反映ポリシー
- **空項目のみ補完**（既存値は上書きしない）
- **手動コマンドでのみ反映**（自動上書きなし）
- **反映後は `applied_at` タイムスタンプを記録**
- **反映前に `--dry-run` で確認推奨**

## Admin ダッシュボード
- `/admin/automation` → 「AI抽出」タブで結果一覧を確認
- domain_id フィルタで絞り込み可能
- 品質レベル・信頼度・反映状態を一覧表示

## コスト管理
- LLM トークン消費は `ai_extractions.llm_tokens_used` に記録
- `--limit` で対象件数を制限
- deterministic で取れる項目はLLMに回さない

## 次のステップ
1. `LLM_ENABLED=true` でハイブリッド抽出を実行
2. confidence 改善を確認
3. apply-ready の件数を確認
4. 主テーブルへの反映を開始
5. 日次 cron に AI抽出ステップを追加
