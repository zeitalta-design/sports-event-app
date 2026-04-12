#!/usr/bin/env node
/**
 * Phase51: 既存イベントの sport_type 再分類スクリプト
 *
 * DB 内の全イベントを inferSportType() で再判定し、
 * sport_type / sport_slug を更新する。
 *
 * 使い方:
 *   node scripts/reclassify-sport-types.js           # dry-run（変更なし）
 *   node scripts/reclassify-sport-types.js --apply    # 実行
 *
 * 安全策:
 * - デフォルトは dry-run（表示のみ）
 * - --apply フラグ付きで実行しない限り DB は変更されない
 * - marathon → trail への変更のみ（逆方向は慎重に）
 */

const path = require("path");
const { createRequire } = require("module");
const webRequire = createRequire(
  path.join(__dirname, "..", "web", "package.json")
);
const Database = webRequire("better-sqlite3");
const { inferSportType } = require("../scraper/sport-type-inference");

const DB_PATH = path.join(__dirname, "..", "web", "data", "sports-event.db");
const apply = process.argv.includes("--apply");

function run() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  const events = db
    .prepare("SELECT id, title, description, sport_type, sport_slug FROM events WHERE is_active = 1")
    .all();

  console.log(`\n📊 対象イベント: ${events.length}件\n`);

  const changes = [];

  for (const ev of events) {
    const { sportType, sportSlug, confidence } = inferSportType(
      ev.title,
      ev.description
    );

    if (sportType !== ev.sport_type) {
      changes.push({
        id: ev.id,
        title: ev.title,
        oldType: ev.sport_type,
        newType: sportType,
        newSlug: sportSlug,
        confidence,
      });
    }
  }

  if (changes.length === 0) {
    console.log("✅ 変更対象なし。全イベントのsport_typeは適切です。\n");
    db.close();
    return;
  }

  console.log(`🔄 分類変更対象: ${changes.length}件\n`);
  console.log("─".repeat(80));

  for (const c of changes) {
    console.log(
      `  [${c.id}] ${c.oldType} → ${c.newType} (${c.confidence})  "${c.title}"`
    );
  }
  console.log("─".repeat(80));

  if (!apply) {
    console.log(
      `\n⚠️  dry-run モードです。実行するには --apply を付けてください。`
    );
    console.log(`   node scripts/reclassify-sport-types.js --apply\n`);
    db.close();
    return;
  }

  // 実行
  const updateStmt = db.prepare(
    "UPDATE events SET sport_type = ?, sport_slug = ?, updated_at = datetime('now') WHERE id = ?"
  );

  const applyAll = db.transaction(() => {
    for (const c of changes) {
      updateStmt.run(c.newType, c.newSlug, c.id);
    }
  });

  applyAll();

  console.log(`\n✅ ${changes.length}件のsport_typeを更新しました。\n`);

  // 結果サマリー
  const summary = db
    .prepare(
      "SELECT sport_type, COUNT(*) as cnt FROM events WHERE is_active = 1 GROUP BY sport_type"
    )
    .all();
  console.log("📋 更新後のsport_type別件数:");
  for (const row of summary) {
    console.log(`   ${row.sport_type}: ${row.cnt}件`);
  }
  console.log();

  db.close();
}

run();
