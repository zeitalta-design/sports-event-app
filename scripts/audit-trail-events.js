#!/usr/bin/env node
/**
 * Phase55: trail イベント監査スクリプト
 *
 * trail データの品質を簡易チェックし、問題を報告する。
 *
 * 使い方:
 *   node scripts/audit-trail-events.js           # trail イベントの品質レポート
 *   node scripts/audit-trail-events.js --all     # marathon含む全イベントの分類チェック
 */

const path = require("path");
const { createRequire } = require("module");
const webRequire = createRequire(
  path.join(__dirname, "..", "web", "package.json")
);
const Database = webRequire("better-sqlite3");
const { inferSportType } = require("../scraper/sport-type-inference");

const DB_PATH = path.join(__dirname, "..", "web", "data", "sports-event.db");
const showAll = process.argv.includes("--all");

function run() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // 1. 基本統計
  console.log("\n=== Trail イベント監査レポート ===\n");

  const counts = db
    .prepare(
      "SELECT sport_type, COUNT(*) as cnt FROM events WHERE is_active = 1 GROUP BY sport_type ORDER BY cnt DESC"
    )
    .all();
  console.log("📊 sport_type 別件数:");
  counts.forEach((r) => console.log(`   ${r.sport_type}: ${r.cnt}件`));

  // 2. trail イベントの品質チェック
  const trails = db
    .prepare(
      `SELECT e.id, e.title, e.prefecture, e.event_date, e.source_url, e.description,
              (SELECT COUNT(*) FROM event_races er WHERE er.event_id = e.id) as race_count
       FROM events e
       WHERE e.is_active = 1 AND e.sport_type = 'trail'
       ORDER BY e.event_date`
    )
    .all();

  console.log(`\n🏔️ trail イベント: ${trails.length}件\n`);

  let issues = 0;
  const issueList = [];

  for (const ev of trails) {
    const problems = [];
    if (!ev.event_date) problems.push("event_date なし");
    if (!ev.prefecture) problems.push("prefecture なし");
    if (!ev.source_url) problems.push("source_url なし");
    if (!ev.title || ev.title.length < 3) problems.push("title が短い/空");

    if (problems.length > 0) {
      issues++;
      issueList.push({ id: ev.id, title: ev.title, problems });
    }
  }

  if (issueList.length > 0) {
    console.log(`⚠️ 問題のある trail イベント: ${issueList.length}件`);
    for (const item of issueList) {
      console.log(
        `   [${item.id}] ${item.title} — ${item.problems.join(", ")}`
      );
    }
  } else {
    console.log("✅ trail イベントに明らかな品質問題なし");
  }

  // 3. 都道府県分布
  const prefDist = db
    .prepare(
      `SELECT prefecture, COUNT(*) as cnt FROM events
       WHERE is_active = 1 AND sport_type = 'trail' AND prefecture IS NOT NULL
       GROUP BY prefecture ORDER BY cnt DESC LIMIT 15`
    )
    .all();
  console.log("\n📍 trail 都道府県分布 (上位15):");
  prefDist.forEach((r) => console.log(`   ${r.prefecture}: ${r.cnt}件`));

  // 4. 月別分布
  const monthDist = db
    .prepare(
      `SELECT event_month, COUNT(*) as cnt FROM events
       WHERE is_active = 1 AND sport_type = 'trail' AND event_month IS NOT NULL
       GROUP BY event_month ORDER BY CAST(event_month AS INTEGER)`
    )
    .all();
  console.log("\n📅 trail 月別分布:");
  monthDist.forEach((r) => console.log(`   ${r.event_month}月: ${r.cnt}件`));

  // 5. 分類の再チェック (trail → marathon 誤分類検出)
  if (showAll) {
    console.log("\n🔍 分類再チェック (全イベント)...");
    const allEvents = db
      .prepare(
        "SELECT id, title, description, sport_type FROM events WHERE is_active = 1"
      )
      .all();

    let mismatches = 0;
    for (const ev of allEvents) {
      const result = inferSportType(ev.title, ev.description);
      if (result.sportType !== ev.sport_type) {
        mismatches++;
        console.log(
          `   [${ev.id}] ${ev.sport_type} → ${result.sportType} (${result.confidence}) "${ev.title}"`
        );
      }
    }
    if (mismatches === 0) {
      console.log("   ✅ 全イベントの分類が最新ルールと一致");
    } else {
      console.log(`   ⚠️ ${mismatches}件の分類ミスマッチ`);
      console.log(
        "   修正するには: npm run reclassify:sport-types:apply"
      );
    }
  }

  // 6. race_count 統計
  const raceStats = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN (SELECT COUNT(*) FROM event_races er WHERE er.event_id = e.id) > 0 THEN 1 ELSE 0 END) as with_races,
        SUM(CASE WHEN e.description IS NOT NULL AND e.description != '' THEN 1 ELSE 0 END) as with_desc
       FROM events e WHERE e.is_active = 1 AND e.sport_type = 'trail'`
    )
    .get();
  console.log("\n📋 trail データ充実度:");
  console.log(`   総数: ${raceStats.total}`);
  console.log(
    `   description あり: ${raceStats.with_desc} (${Math.round((raceStats.with_desc / raceStats.total) * 100)}%)`
  );
  console.log(
    `   event_races あり: ${raceStats.with_races} (${Math.round((raceStats.with_races / raceStats.total) * 100)}%)`
  );

  console.log("\n=== 監査完了 ===\n");
  db.close();
}

run();
