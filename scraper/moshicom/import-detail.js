/**
 * moshicom 詳細データのDB反映
 * importDetail は runnet/import-detail.js を再利用
 */

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const webRequire = createRequire(
  path.join(__dirname, "..", "..", "web", "package.json")
);
const Database = webRequire("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "..", "web", "data", "sports-event.db");
const SCHEMA_PATH = path.join(__dirname, "..", "..", "sql", "001_create_tables.sql");

// importDetail を runnet から再利用
const { importDetail } = require("../runnet/import-detail");

function getDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);
  return db;
}

/**
 * moshicom系イベントの対象一覧を取得
 * @param {object} options
 * @param {number} options.id - 特定のevent id
 * @param {number} options.limit - 取得上限
 * @param {boolean} options.onlyMissingRaces - race_count=0のみ
 * @returns {object[]}
 */
function getMoshicomEvents(options = {}) {
  const db = getDb();
  let sql = `
    SELECT id, source_event_id, source_url, title
    FROM events
    WHERE source_site = 'runnet'
      AND source_url LIKE '%moshicom%'
  `;
  const params = [];

  if (options.id) {
    sql += " AND id = ?";
    params.push(options.id);
  }

  if (options.onlyMissingRaces) {
    sql += " AND id NOT IN (SELECT DISTINCT event_id FROM event_races)";
  }

  sql += " ORDER BY id";

  if (options.limit) {
    sql += " LIMIT ?";
    params.push(options.limit);
  }

  const rows = db.prepare(sql).all(...params);
  db.close();
  return rows;
}

module.exports = { importDetail, getMoshicomEvents };
