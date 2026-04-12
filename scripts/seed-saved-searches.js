/**
 * 保存検索のseedデータ投入
 */

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const webRequire = createRequire(path.join(__dirname, "..", "web", "package.json"));
const Database = webRequire("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "web", "data", "risk-monitor.db");
const SCHEMA_PATH = path.join(__dirname, "..", "sql", "001_create_tables.sql");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

if (fs.existsSync(SCHEMA_PATH)) {
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf-8"));
}

console.log("=== Saved Searches Seed ===");

const seeds = [
  {
    user_key: "demo-user-1",
    sport_type: "marathon",
    keyword: null,
    area_region: "関東",
    prefecture: "東京都",
    event_month: null,
    filters_json: null,
  },
  {
    user_key: "demo-user-1",
    sport_type: "marathon",
    keyword: null,
    area_region: "関東",
    prefecture: "神奈川県",
    event_month: null,
    filters_json: JSON.stringify({ distance: "full" }),
  },
  {
    user_key: "demo-user-2",
    sport_type: "marathon",
    keyword: null,
    area_region: null,
    prefecture: null,
    event_month: "10",
    filters_json: null,
  },
];

const stmt = db.prepare(`
  INSERT INTO saved_searches
  (user_key, sport_type, keyword, area_region, prefecture, event_month, filters_json, created_at, updated_at)
  VALUES (@user_key, @sport_type, @keyword, @area_region, @prefecture, @event_month, @filters_json, datetime('now'), datetime('now'))
`);

// 既存データの確認
const existing = db.prepare("SELECT COUNT(*) as c FROM saved_searches").get().c;
if (existing > 0) {
  console.log(`既存データ: ${existing}件 (追加挿入します)`);
}

const doSeed = db.transaction(() => {
  for (const seed of seeds) {
    stmt.run(seed);
  }
});
doSeed();

const total = db.prepare("SELECT COUNT(*) as c FROM saved_searches").get().c;
console.log(`挿入完了: ${seeds.length}件追加 (合計: ${total}件)`);

// 確認表示
const all = db.prepare("SELECT * FROM saved_searches").all();
for (const s of all) {
  const parts = [s.sport_type, s.prefecture, s.event_month ? `${s.event_month}月` : null, s.filters_json].filter(Boolean);
  console.log(`  #${s.id} [${s.user_key}] ${parts.join(" / ")}`);
}

db.close();
