/**
 * 暫定 popularity_score 計算スクリプト
 *
 * ユーザー行動データがない初期段階で、大会属性から推定人気スコアを付与する。
 * 本番でユーザー行動が蓄積されれば、そちらのスコアで上書きされる。
 *
 * スコア計算ロジック:
 *   - エントリー受付中 → +20
 *   - 締切7日以内 → +15（緊急性）
 *   - 締切14日以内 → +8
 *   - 画像あり → +5（リッチ表示）
 *   - race情報あり → +5（詳細充実）
 *   - 定員5000人以上 → +10（大規模大会）
 *   - 定員1000人以上 → +5
 *   - フルマラソン/ハーフあり → +5（主要距離）
 *   - 開催日が30日以内 → +8（直近開催）
 *   - 開催日が60日以内 → +3
 *
 * Usage:
 *   node scripts/calc-initial-popularity.js
 *   node scripts/calc-initial-popularity.js --dry-run
 */

const path = require("path");
const { createRequire } = require("module");
const webRequire = createRequire(path.join(__dirname, "..", "web", "package.json"));
const Database = webRequire("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "web", "data", "sports-event.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const dryRun = process.argv.includes("--dry-run");

console.log("=== 暫定 popularity_score 計算 ===");
if (dryRun) console.log("(dry-run mode)");

const events = db.prepare(`
  SELECT
    e.id,
    e.title,
    e.entry_status,
    e.entry_end_date,
    e.event_date,
    e.hero_image_url,
    e.popularity_score AS current_score,
    (SELECT COUNT(*) FROM event_races r WHERE r.event_id = e.id) AS race_count,
    (SELECT MAX(r.capacity) FROM event_races r WHERE r.event_id = e.id) AS max_capacity,
    (SELECT GROUP_CONCAT(r.race_type) FROM event_races r WHERE r.event_id = e.id) AS race_types
  FROM events e
  WHERE e.is_active = 1
`).all();

const now = new Date();
now.setHours(0, 0, 0, 0);

let updated = 0;
const updateStmt = db.prepare(`
  UPDATE events
  SET popularity_score = ?, popularity_label = ?, popularity_key = ?, updated_at = datetime('now')
  WHERE id = ?
`);

const results = [];

for (const ev of events) {
  let score = 0;

  // エントリー受付中
  if (ev.entry_status === "open") score += 20;

  // 締切の近さ
  if (ev.entry_end_date) {
    const endDate = new Date(ev.entry_end_date);
    const daysUntilDeadline = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    if (daysUntilDeadline >= 0 && daysUntilDeadline <= 7) score += 15;
    else if (daysUntilDeadline > 7 && daysUntilDeadline <= 14) score += 8;
  }

  // 画像あり
  if (ev.hero_image_url) score += 5;

  // race情報あり
  if (ev.race_count > 0) score += 5;

  // 大規模大会
  if (ev.max_capacity >= 5000) score += 10;
  else if (ev.max_capacity >= 1000) score += 5;

  // 主要距離
  if (ev.race_types) {
    const types = ev.race_types.split(",");
    if (types.some(t => ["full_marathon", "half_marathon"].includes(t))) score += 5;
  }

  // 開催日の近さ
  if (ev.event_date) {
    const eventDate = new Date(ev.event_date);
    const daysUntilEvent = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
    if (daysUntilEvent >= 0 && daysUntilEvent <= 30) score += 8;
    else if (daysUntilEvent > 30 && daysUntilEvent <= 60) score += 3;
  }

  // スコア上限100
  score = Math.min(100, score);

  // ラベル判定
  let label = null;
  let key = null;
  if (score >= 50) { label = "人気大会"; key = "popular"; }
  else if (score >= 35) { label = "注目大会"; key = "featured"; }
  else if (score >= 25) { label = "関心上昇"; key = "rising"; }

  results.push({ id: ev.id, title: ev.title, score, label, key, current: ev.current_score });

  if (!dryRun) {
    updateStmt.run(score, label, key, ev.id);
    updated++;
  }
}

// 結果サマリー
results.sort((a, b) => b.score - a.score);

console.log("\n=== TOP 10 ===");
results.slice(0, 10).forEach((r, i) =>
  console.log(`  ${i + 1}. [${r.score}] ${r.title?.substring(0, 45)} (${r.label || "-"})`)
);

const dist = { "50+": 0, "35-49": 0, "25-34": 0, "1-24": 0, "0": 0 };
for (const r of results) {
  if (r.score >= 50) dist["50+"]++;
  else if (r.score >= 35) dist["35-49"]++;
  else if (r.score >= 25) dist["25-34"]++;
  else if (r.score > 0) dist["1-24"]++;
  else dist["0"]++;
}
console.log("\n=== 分布 ===");
Object.entries(dist).forEach(([k, v]) => console.log(`  ${k}: ${v}件`));
console.log(`\n更新: ${updated}件`);
console.log("=== Done ===");
