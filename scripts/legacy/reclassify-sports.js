/**
 * 既存大会の競技カテゴリ再分類スクリプト
 *
 * 全active大会に対して inferSportType を再実行し、
 * sport_type / sport_slug を修正する。
 *
 * Usage:
 *   node scripts/reclassify-sports.js                # 全件再分類
 *   node scripts/reclassify-sports.js --dry-run      # 変更なし（確認のみ）
 *   node scripts/reclassify-sports.js --verbose      # 詳細ログ
 */

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");

const webRequire = createRequire(
  path.join(__dirname, "..", "web", "package.json")
);
const Database = webRequire("better-sqlite3");
const { inferSportType } = require("../scraper/sport-type-inference");

const DB_PATH = path.join(__dirname, "..", "web", "data", "sports-event.db");
const SCHEMA_PATH = path.join(__dirname, "..", "sql", "001_create_tables.sql");

function getDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);
  return db;
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
    verbose: args.includes("--verbose") || args.includes("-v"),
  };
}

function main() {
  const opts = parseArgs();
  const db = getDb();

  const events = db.prepare(
    "SELECT id, title, description, sport_type, sport_slug FROM events WHERE is_active = 1"
  ).all();

  console.log("=== Sport Reclassification ===");
  console.log(`  Total events: ${events.length}`);
  if (opts.dryRun) console.log("  *** DRY RUN ***");

  const changes = {};
  let changed = 0;
  let unchanged = 0;

  const updateStmt = db.prepare(
    "UPDATE events SET sport_type = ?, sport_slug = ?, updated_at = datetime('now') WHERE id = ?"
  );

  const doAll = db.transaction(() => {
    for (const ev of events) {
      const result = inferSportType(ev.title, ev.description);
      const newType = result.sportType;
      const newSlug = result.sportSlug;

      if (newType !== ev.sport_type) {
        const key = `${ev.sport_type} → ${newType}`;
        changes[key] = (changes[key] || 0) + 1;

        if (opts.verbose) {
          console.log(`  [${ev.id}] ${ev.sport_type} → ${newType}: ${ev.title.substring(0, 50)}`);
        }

        if (!opts.dryRun) {
          updateStmt.run(newType, newSlug, ev.id);
        }
        changed++;
      } else {
        unchanged++;
      }
    }
  });

  doAll();
  db.close();

  console.log(`\n=== Summary ===`);
  console.log(`  Changed: ${changed}`);
  console.log(`  Unchanged: ${unchanged}`);
  if (Object.keys(changes).length > 0) {
    console.log("\n  Changes by type:");
    for (const [key, count] of Object.entries(changes).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${key}: ${count}`);
    }
  }
  console.log("=== Done ===");
}

main();
