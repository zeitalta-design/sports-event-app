#!/usr/bin/env node

/**
 * MOSHICOM統合 検索精度検証スクリプト
 *
 * RUNNETイベントから検証対象を抽出し、MOSHICOM検索→マッチング精度を検証。
 * 結果を merge_verification_logs に保存。
 *
 * Usage:
 *   node scripts/verify-moshicom-match.js [options]
 *
 * Options:
 *   --limit N      検証件数（デフォルト: 50）
 *   --delay N      リクエスト間隔ms（デフォルト: 3000）
 *   --sample TYPE  サンプル戦略: mixed(デフォルト) / urban / rural / recent / all
 *   --reset        既存ログをクリアして再実行
 *   --skip-done    既に検証済みのイベントをスキップ
 */

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.chdir(path.join(__dirname, "..", "web"));

async function main() {
  const { getDb } = await import("../web/lib/db.js");
  const { searchMoshicom, matchEventScore, normalizeEventName } = await import("../web/lib/moshicom-search.js");
  const { fetchAndParseMoshicom, extractEventInfo, extractRaces } = await import("../web/lib/moshicom-fetcher.js");
  const cheerio = await import("cheerio");

  const args = process.argv.slice(2);
  const limit = parseInt(getArg(args, "--limit") || "50");
  const delay = parseInt(getArg(args, "--delay") || "3000");
  const sampleType = getArg(args, "--sample") || "mixed";
  const reset = args.includes("--reset");
  const skipDone = args.includes("--skip-done");

  const db = getDb();

  if (reset) {
    db.prepare("DELETE FROM merge_verification_logs").run();
    console.log("既存ログをクリアしました。");
  }

  console.log("=== MOSHICOM統合 検索精度検証 ===");
  console.log(`  サンプル: ${sampleType}, 件数: ${limit}, delay: ${delay}ms`);
  console.log("");

  // ─── サンプル抽出 ─────────────────────
  const samples = extractSamples(db, sampleType, limit, skipDone);
  console.log(`検証対象: ${samples.length}件\n`);

  // ─── 検証実行 ──────────────────────
  let stats = {
    total: 0,
    searched: 0,
    matchFound: 0,
    highScore: 0,   // 80+
    midScore: 0,    // 50-79
    lowScore: 0,    // <50
    noResult: 0,
    searchError: 0,
    selectorIssues: 0,
  };

  for (let i = 0; i < samples.length; i++) {
    const event = samples[i];
    stats.total++;
    const prefix = `[${i + 1}/${samples.length}]`;
    console.log(`${prefix} ${event.title}`);
    console.log(`  ID:${event.id} / ${event.event_date || "日付不明"} / ${event.prefecture || "地域不明"}`);

    let logEntry = {
      event_id: event.id,
      runnet_title: event.title,
      moshicom_title: null,
      moshicom_url: null,
      moshicom_id: null,
      score: 0,
      matched: 0,
      all_candidates_json: null,
      search_error: null,
      selector_errors_json: null,
    };

    try {
      // MOSHICOM検索
      const results = await searchMoshicom(event.title);
      stats.searched++;

      if (results.length === 0) {
        stats.noResult++;
        console.log(`  → 候補なし`);
      } else {
        // スコア計算
        const scored = results.map((r) => ({
          ...r,
          score: matchEventScore(event, r),
        }));
        scored.sort((a, b) => b.score - a.score);

        logEntry.all_candidates_json = JSON.stringify(
          scored.slice(0, 10).map((r) => ({
            title: r.title,
            url: r.url,
            score: r.score,
            date: r.date,
            prefecture: r.prefecture,
          }))
        );

        const best = scored[0];
        logEntry.moshicom_title = best.title;
        logEntry.moshicom_url = best.url;
        logEntry.moshicom_id = best.moshicomId;
        logEntry.score = best.score;
        logEntry.matched = best.score >= 80 ? 1 : 0;

        if (best.score >= 80) {
          stats.matchFound++;
          stats.highScore++;
          console.log(`  → マッチ: ${best.title} (${best.score}点)`);
        } else if (best.score >= 50) {
          stats.midScore++;
          console.log(`  → 要確認: ${best.title} (${best.score}点)`);
        } else {
          stats.lowScore++;
          console.log(`  → 低スコア: ${best.title} (${best.score}点)`);
        }

        // セレクタ検証: 最高スコアのURLで詳細ページ取得→フィールド確認
        if (best.score >= 50 && best.url) {
          try {
            const selectorErrors = await verifySelectorFields(best.url);
            if (selectorErrors.length > 0) {
              logEntry.selector_errors_json = JSON.stringify(selectorErrors);
              stats.selectorIssues++;
              console.log(`  → セレクタ問題: ${selectorErrors.join(", ")}`);
            }
          } catch (e) {
            console.log(`  → セレクタ検証スキップ: ${e.message}`);
          }
        }
      }
    } catch (err) {
      stats.searchError++;
      logEntry.search_error = err.message;
      console.log(`  → 検索エラー: ${err.message}`);
    }

    // DB保存
    db.prepare(`
      INSERT INTO merge_verification_logs
        (event_id, runnet_title, moshicom_title, moshicom_url, moshicom_id,
         score, matched, all_candidates_json, search_error, selector_errors_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logEntry.event_id, logEntry.runnet_title, logEntry.moshicom_title,
      logEntry.moshicom_url, logEntry.moshicom_id, logEntry.score,
      logEntry.matched, logEntry.all_candidates_json, logEntry.search_error,
      logEntry.selector_errors_json
    );

    // ディレイ
    if (i < samples.length - 1) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // ─── レポート ──────────────────────
  console.log("");
  console.log("=== 検証結果サマリー ===");
  console.log(`  検証件数:     ${stats.total}`);
  console.log(`  検索成功:     ${stats.searched}`);
  console.log(`  マッチ(≥80):  ${stats.highScore} (${pct(stats.highScore, stats.total)})`);
  console.log(`  要確認(50-79): ${stats.midScore} (${pct(stats.midScore, stats.total)})`);
  console.log(`  低スコア(<50): ${stats.lowScore} (${pct(stats.lowScore, stats.total)})`);
  console.log(`  候補なし:     ${stats.noResult} (${pct(stats.noResult, stats.total)})`);
  console.log(`  検索エラー:   ${stats.searchError} (${pct(stats.searchError, stats.total)})`);
  console.log(`  セレクタ問題: ${stats.selectorIssues}`);
  console.log("");
  console.log("管理画面 /admin/source-merge でレビューしてください。");
}

// ─── サンプル抽出 ─────────────────────

function extractSamples(db, type, limit, skipDone) {
  let conditions = "WHERE e.is_active = 1 AND e.source_site = 'runnet'";

  if (skipDone) {
    conditions += " AND e.id NOT IN (SELECT event_id FROM merge_verification_logs)";
  }

  // 統合済みは除外
  conditions += " AND (md.source_priority IS NULL OR md.source_priority = 'runnet')";

  if (type === "urban") {
    conditions += " AND e.prefecture IN ('東京都','大阪府','神奈川県','愛知県','福岡県','埼玉県','千葉県')";
  } else if (type === "rural") {
    conditions += " AND e.prefecture NOT IN ('東京都','大阪府','神奈川県','愛知県','福岡県','埼玉県','千葉県')";
  } else if (type === "recent") {
    conditions += " AND e.event_date >= date('now')";
  }

  // mixed: 都市部/地方を混在させるため、各地方から均等に抽出
  if (type === "mixed") {
    const urbanLimit = Math.ceil(limit * 0.4);
    const ruralLimit = Math.ceil(limit * 0.4);
    const recentLimit = limit - urbanLimit - ruralLimit;

    const urban = db.prepare(`
      SELECT e.id, e.title, e.event_date, e.prefecture, e.source_event_id
      FROM events e LEFT JOIN marathon_details md ON md.marathon_id = e.id
      ${conditions} AND e.prefecture IN ('東京都','大阪府','神奈川県','愛知県','福岡県')
      ORDER BY RANDOM() LIMIT ?
    `).all(urbanLimit);

    const urbanIds = new Set(urban.map((e) => e.id));

    const rural = db.prepare(`
      SELECT e.id, e.title, e.event_date, e.prefecture, e.source_event_id
      FROM events e LEFT JOIN marathon_details md ON md.marathon_id = e.id
      ${conditions} AND e.prefecture NOT IN ('東京都','大阪府','神奈川県','愛知県','福岡県')
        AND e.id NOT IN (${[...urbanIds].join(",") || "0"})
      ORDER BY RANDOM() LIMIT ?
    `).all(ruralLimit);

    const usedIds = new Set([...urbanIds, ...rural.map((e) => e.id)]);

    const recent = db.prepare(`
      SELECT e.id, e.title, e.event_date, e.prefecture, e.source_event_id
      FROM events e LEFT JOIN marathon_details md ON md.marathon_id = e.id
      ${conditions} AND e.event_date >= date('now')
        AND e.id NOT IN (${[...usedIds].join(",") || "0"})
      ORDER BY RANDOM() LIMIT ?
    `).all(recentLimit);

    return [...urban, ...rural, ...recent];
  }

  return db.prepare(`
    SELECT e.id, e.title, e.event_date, e.prefecture, e.source_event_id
    FROM events e LEFT JOIN marathon_details md ON md.marathon_id = e.id
    ${conditions}
    ORDER BY RANDOM() LIMIT ?
  `).all(limit);
}

// ─── セレクタ検証 ─────────────────────

async function verifySelectorFields(moshicomUrl) {
  const errors = [];

  try {
    const res = await fetch(moshicomUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html",
        "Accept-Language": "ja,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      errors.push(`HTTP_${res.status}`);
      return errors;
    }

    const html = await res.text();
    const cheerio = await import("cheerio");
    const $ = cheerio.load(html);

    // タイトル確認
    const title = $('meta[property="og:title"]').attr("content") || $("h1").first().text().trim();
    if (!title || title.length < 3) errors.push("title_missing");

    // 日付確認
    const bodyText = $("body").text();
    const dateMatch = bodyText.match(/(\d{4})[/年](\d{1,2})[/月](\d{1,2})/);
    if (!dateMatch) errors.push("date_missing");

    // 会場確認
    let hasVenue = false;
    $("dt, th, .label, strong, b").each((i, el) => {
      if (/^会場$|^開催場所$|^開催会場$/.test($(el).text().trim())) {
        hasVenue = true;
      }
    });
    if (!hasVenue) errors.push("venue_selector_miss");

    // 料金確認（テーブルまたはDLから）
    const hasFee = bodyText.match(/[\d,]+円/);
    if (!hasFee) errors.push("fee_missing");

    // 概要確認
    const ogDesc = $('meta[property="og:description"]').attr("content") || "";
    if (!ogDesc || ogDesc.length < 10) errors.push("description_short");

  } catch (e) {
    errors.push(`fetch_error: ${e.message.substring(0, 50)}`);
  }

  return errors;
}

// ─── ヘルパー ─────────────────────

function getArg(args, flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
}

function pct(n, total) {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
