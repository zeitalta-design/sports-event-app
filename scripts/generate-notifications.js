/**
 * 通知候補生成スクリプト（ジョブ履歴記録付き）
 *
 * Usage:
 *   node scripts/generate-notifications.js
 *   node scripts/generate-notifications.js --date 2026-03-15
 */

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const webRequire = createRequire(path.join(__dirname, "..", "web", "package.json"));
const Database = webRequire("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "web", "data", "sports-event.db");
const SCHEMA_PATH = path.join(__dirname, "..", "sql", "001_create_tables.sql");

// --- DB setup ---
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

if (fs.existsSync(SCHEMA_PATH)) {
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf-8"));
}

// --- Parse args ---
const args = process.argv.slice(2);
let today;
const dateIdx = args.indexOf("--date");
if (dateIdx !== -1 && args[dateIdx + 1]) {
  today = args[dateIdx + 1];
} else {
  today = new Date().toISOString().slice(0, 10);
}

const startTime = Date.now();
console.log(`=== 通知候補生成 ===`);
console.log(`対象日: ${today}`);
console.log(`開始:   ${new Date().toISOString()}`);

// --- Schema migration ---
try { db.exec("ALTER TABLE notifications ADD COLUMN event_id INTEGER"); } catch {}
try { db.exec("ALTER TABLE notifications ADD COLUMN related_search_id INTEGER"); } catch {}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedup ON notifications(user_key, type, event_id)");

// --- Job record: start ---
const jobId = db.prepare(
  "INSERT INTO notification_jobs (job_type, run_date, status) VALUES ('generate_notifications', ?, 'running')"
).run(today).lastInsertRowid;
console.log(`ジョブID: ${jobId}`);

// --- Helper ---
function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

try {
  // --- A. 締切通知 ---
  console.log("\n[1] 締切通知を生成中...");
  const deadlineDefs = [
    { type: "deadline_today", days: 0, prefix: "本日締切", body: (d) => "本日がエントリー締切です。" },
    { type: "deadline_3d", days: 3, prefix: "締切間近", body: (d) => `エントリー締切は ${d} です。あと3日で締切です。` },
    { type: "deadline_7d", days: 7, prefix: "締切間近", body: (d) => `エントリー締切は ${d} です。あと7日で締切です。` },
  ];
  const deadlines = [];
  for (const def of deadlineDefs) {
    const targetDate = addDays(today, def.days);
    const events = db.prepare(
      "SELECT id, title, entry_end_date FROM events WHERE is_active = 1 AND entry_end_date = ?"
    ).all(targetDate);
    for (const ev of events) {
      deadlines.push({
        user_key: "system", type: def.type,
        title: `${def.prefix}: ${ev.title}`,
        body: def.body(ev.entry_end_date),
        payload_json: JSON.stringify({ event_id: ev.id, deadline_date: ev.entry_end_date }),
        event_id: ev.id, related_search_id: null,
      });
    }
    console.log(`  ${def.type}: ${events.length}件 (対象日: ${targetDate})`);
  }

  // --- B. 保存検索一致通知 ---
  console.log("\n[2] 保存検索一致通知を生成中...");
  const searches = db.prepare("SELECT * FROM saved_searches").all();
  const matches = [];
  for (const search of searches) {
    const where = ["e.is_active = 1"];
    const params = [];
    const condParts = [];
    let joins = "";
    if (search.sport_type) { where.push("e.sport_type = ?"); params.push(search.sport_type); condParts.push(search.sport_type === "marathon" ? "マラソン" : search.sport_type); }
    if (search.prefecture) { where.push("e.prefecture = ?"); params.push(search.prefecture); condParts.push(search.prefecture); }
    if (search.keyword) { where.push("(e.title LIKE ? OR e.normalized_title LIKE ?)"); const kw = `%${search.keyword}%`; params.push(kw, kw); condParts.push(`「${search.keyword}」`); }
    if (search.event_month) { where.push("e.event_month = ?"); params.push(search.event_month); condParts.push(`${search.event_month}月`); }
    if (search.filters_json) {
      try {
        const filters = JSON.parse(search.filters_json);
        if (filters.distance) {
          const ranges = { "5": [0, 5], "10": [5.1, 10], half: [20, 22], full: [42, 43], ultra: [43.1, 999] };
          const range = ranges[filters.distance];
          if (range) { joins = "JOIN event_races er ON er.event_id = e.id"; where.push("er.distance_km >= ? AND er.distance_km <= ?"); params.push(range[0], range[1]); const labels = { "5": "5km", "10": "10km", half: "ハーフ", full: "フル", ultra: "ウルトラ" }; condParts.push(labels[filters.distance] || filters.distance); }
        }
      } catch {}
    }
    const condStr = condParts.join(" / ") || "全件";
    const events = db.prepare(`SELECT DISTINCT e.id, e.title FROM events e ${joins} WHERE ${where.join(" AND ")} LIMIT 50`).all(...params);
    for (const ev of events) {
      matches.push({
        user_key: search.user_key, type: "saved_search_match",
        title: `保存条件に一致する大会: ${ev.title}`,
        body: `「${condStr}」の条件に一致する大会が見つかりました。`,
        payload_json: JSON.stringify({ event_id: ev.id, search_id: search.id }),
        event_id: ev.id, related_search_id: search.id,
      });
    }
    console.log(`  保存検索 #${search.id} [${condStr}]: ${events.length}件一致`);
  }

  // --- C. お気に入り締切通知 ---
  console.log("\n[3] お気に入り締切通知を生成中...");
  const favDefs = [
    { type: "favorite_deadline_today", days: 0, prefix: "お気に入り大会が本日締切", body: (title, d) => `お気に入り登録している「${title}」のエントリーが本日締切です。お見逃しなく！` },
    { type: "favorite_deadline_3d", days: 3, prefix: "お気に入り大会が締切間近", body: (title, d) => `お気に入り登録している「${title}」のエントリー締切は ${d} です。あと3日で締切です。エントリーを確認してください。` },
    { type: "favorite_deadline_7d", days: 7, prefix: "お気に入り大会が締切間近", body: (title, d) => `お気に入り登録している「${title}」のエントリー締切は ${d} です。あと7日で締切です。` },
  ];
  const favorites = [];
  for (const def of favDefs) {
    const targetDate = addDays(today, def.days);
    const rows = db.prepare(`SELECT f.user_key, e.id, e.title, e.entry_end_date FROM favorites f JOIN events e ON e.id = f.event_id WHERE e.is_active = 1 AND e.entry_end_date = ?`).all(targetDate);
    for (const row of rows) {
      favorites.push({
        user_key: row.user_key, type: def.type,
        title: `${def.prefix}: ${row.title}`,
        body: def.body(row.title, row.entry_end_date),
        payload_json: JSON.stringify({ event_id: row.id, source: "favorite", deadline_date: row.entry_end_date, days_left: def.days }),
        event_id: row.id, related_search_id: null,
      });
    }
    console.log(`  ${def.type}: ${rows.length}件 (対象日: ${targetDate})`);
  }

  // --- Settings filter ---
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notification_settings'").get();
  const settingsMap = {};
  if (tableExists) {
    for (const row of db.prepare("SELECT * FROM notification_settings").all()) {
      settingsMap[row.user_key] = row;
    }
  }
  function isTypeEnabled(userKey, type) {
    const s = settingsMap[userKey];
    if (!s) return true;
    const col = `enable_${type}`;
    return s[col] === undefined ? true : !!s[col];
  }

  const allRaw = [...deadlines, ...matches, ...favorites];
  const all = allRaw.filter(n => isTypeEnabled(n.user_key, n.type));
  const filteredCount = allRaw.length - all.length;
  if (filteredCount > 0) console.log(`\n  設定でOFF: ${filteredCount}件除外`);

  // --- Insert ---
  console.log(`\n[4] DB挿入中... (候補: ${all.length}件)`);
  let inserted = 0;
  if (all.length > 0) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO notifications
      (user_key, type, title, body, payload_json, event_id, related_search_id, created_at)
      VALUES (@user_key, @type, @title, @body, @payload_json, @event_id, @related_search_id, datetime('now'))
    `);
    const doInsert = db.transaction(() => {
      for (const n of all) {
        if (stmt.run(n).changes > 0) inserted++;
      }
    });
    doInsert();
  }

  const durationMs = Date.now() - startTime;
  const breakdown = {};
  for (const n of all) { breakdown[n.type] = (breakdown[n.type] || 0) + 1; }

  // --- Job record: success ---
  db.prepare(`
    UPDATE notification_jobs
    SET status = 'success', finished_at = datetime('now'), duration_ms = ?,
        total_generated = ?, total_inserted = ?, total_skipped = ?,
        summary_json = ?
    WHERE id = ?
  `).run(durationMs, all.length, inserted, all.length - inserted, JSON.stringify(breakdown), jobId);

  console.log(`\n=== 完了 (${durationMs}ms) ===`);
  console.log(`  締切通知候補:      ${deadlines.length}件`);
  console.log(`  保存検索一致:      ${matches.length}件`);
  console.log(`  お気に入り締切:    ${favorites.length}件`);
  console.log(`  合計候補:          ${all.length}件`);
  console.log(`  新規挿入:          ${inserted}件`);
  console.log(`  重複スキップ:      ${all.length - inserted}件`);
  console.log("\n--- 種別内訳 ---");
  for (const [type, count] of Object.entries(breakdown)) {
    console.log(`  ${type}: ${count}件`);
  }
  const totalInDb = db.prepare("SELECT COUNT(*) as c FROM notifications").get().c;
  console.log(`\n  DB総通知数:        ${totalInDb}件`);

} catch (error) {
  const durationMs = Date.now() - startTime;
  console.error(`\n!!! エラー発生 (${durationMs}ms) !!!`);
  console.error(error.message);
  console.error(error.stack);

  // --- Job record: failed ---
  db.prepare(`
    UPDATE notification_jobs
    SET status = 'failed', finished_at = datetime('now'), duration_ms = ?,
        error_message = ?
    WHERE id = ?
  `).run(durationMs, error.message, jobId);

  process.exitCode = 1;
}

db.close();
