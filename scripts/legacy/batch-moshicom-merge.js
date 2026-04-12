#!/usr/bin/env node

/**
 * MOSHICOM一括統合バッチ
 *
 * 全RUNNETイベント（または指定条件）に対し、MOSHICOM検索→マッチング→統合を実行。
 *
 * Usage:
 *   node scripts/batch-moshicom-merge.js [options]
 *
 * Options:
 *   --dry-run    マッチのみ確認、統合しない（デフォルト: false）
 *   --limit N    N件で打ち切り（デフォルト: 全件）
 *   --min-score  マッチ最低スコア（デフォルト: 80）
 *   --delay      リクエスト間隔ms（デフォルト: 2500）
 *   --skip-merged 統合済みをスキップ（デフォルト: true）
 */

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CWD を web/ に設定（DB接続のため）
process.chdir(path.join(__dirname, "..", "web"));

// 動的インポート（CWD設定後に実行）
async function main() {
  const { getDb } = await import("../web/lib/db.js");
  const { findMoshicomMatch } = await import("../web/lib/moshicom-search.js");
  const { mergeSourceData } = await import("../web/lib/source-merge-service.js");

  // 引数パース
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const skipMerged = !args.includes("--no-skip-merged");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : Infinity;
  const minScoreIdx = args.indexOf("--min-score");
  const minScore = minScoreIdx >= 0 ? parseInt(args[minScoreIdx + 1]) : 80;
  const delayIdx = args.indexOf("--delay");
  const delay = delayIdx >= 0 ? parseInt(args[delayIdx + 1]) : 2500;

  console.log("=== MOSHICOM一括統合バッチ ===");
  console.log(`  dry-run: ${dryRun}`);
  console.log(`  limit: ${limit === Infinity ? "なし" : limit}`);
  console.log(`  min-score: ${minScore}`);
  console.log(`  delay: ${delay}ms`);
  console.log(`  skip-merged: ${skipMerged}`);
  console.log("");

  const db = getDb();

  // 対象イベント取得
  let query = `
    SELECT e.id, e.title, e.event_date, e.prefecture, e.source_site,
           md.source_priority, md.moshicom_url
    FROM events e
    LEFT JOIN marathon_details md ON md.marathon_id = e.id
    WHERE e.is_active = 1
  `;
  if (skipMerged) {
    query += " AND (md.source_priority IS NULL OR md.source_priority = 'runnet')";
  }
  query += " ORDER BY e.event_date DESC NULLS LAST";

  const allEvents = db.prepare(query).all();
  const targetEvents = limit < Infinity ? allEvents.slice(0, limit) : allEvents;

  console.log(`対象: ${targetEvents.length}件 (全${allEvents.length}件中)`);
  console.log("");

  let processed = 0;
  let matched = 0;
  let merged = 0;
  let skipped = 0;
  let errors = 0;

  for (const event of targetEvents) {
    processed++;
    const prefix = `[${processed}/${targetEvents.length}]`;

    // MOSHICOM検索
    try {
      console.log(`${prefix} 検索: ${event.title}`);

      const result = await findMoshicomMatch(
        { title: event.title, event_date: event.event_date, prefecture: event.prefecture },
        { minScore }
      );

      if (!result || !result.match) {
        const bestScore = result?.score || 0;
        console.log(`  → マッチなし (最高スコア: ${bestScore})`);
        skipped++;
      } else {
        matched++;
        console.log(`  → マッチ: ${result.match.title} (スコア: ${result.score})`);
        console.log(`    URL: ${result.match.url}`);

        if (dryRun) {
          console.log(`  → [dry-run] 統合スキップ`);
        } else {
          try {
            const mergeResult = await mergeSourceData(event.id, result.match.url, {
              useLlm: false, // バッチではLLM使わない（コスト抑制）
              dryRun: false,
            });
            merged++;
            console.log(`  → 統合完了 (${mergeResult.fieldsUpdated}フィールド更新)`);
          } catch (mergeErr) {
            errors++;
            console.error(`  → 統合エラー: ${mergeErr.message}`);
          }
        }
      }
    } catch (err) {
      errors++;
      console.error(`${prefix} エラー: ${err.message}`);
    }

    // ディレイ
    if (processed < targetEvents.length) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.log("");
  console.log("=== 結果サマリー ===");
  console.log(`  処理: ${processed}件`);
  console.log(`  マッチ: ${matched}件`);
  console.log(`  統合: ${merged}件`);
  console.log(`  スキップ: ${skipped}件`);
  console.log(`  エラー: ${errors}件`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
