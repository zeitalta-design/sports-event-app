/**
 * RUNNET 詳細データを SQLite へ反映
 * events の更新 + event_races の再生成
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
 * 詳細データを1件反映
 * @param {number} eventId - events.id
 * @param {object} eventUpdate - 更新フィールド
 * @param {object[]} races - race配列
 */
function importDetail(eventId, eventUpdate, races) {
  const db = getDb();
  const now = new Date().toISOString();

  const doImport = db.transaction(() => {
    // Build dynamic UPDATE for event
    const fields = [];
    const values = {};
    values.id = eventId;
    values.updated_at = now;
    values.scraped_at = now;

    for (const [key, val] of Object.entries(eventUpdate)) {
      if (val !== undefined && val !== null) {
        fields.push(`${key} = @${key}`);
        values[key] = val;
      }
    }

    fields.push("updated_at = @updated_at");
    fields.push("scraped_at = @scraped_at");

    if (fields.length > 0) {
      const sql = `UPDATE events SET ${fields.join(", ")} WHERE id = @id`;
      db.prepare(sql).run(values);
    }

    // Delete existing races and re-insert
    if (races && races.length > 0) {
      db.prepare("DELETE FROM event_races WHERE event_id = ?").run(eventId);

      const insertRace = db.prepare(`
        INSERT INTO event_races (
          event_id, race_name, race_type, distance_km,
          fee_min, fee_max, capacity, time_limit, start_time,
          eligibility, sort_order, created_at, updated_at
        ) VALUES (
          @event_id, @race_name, @race_type, @distance_km,
          @fee_min, @fee_max, @capacity, @time_limit, @start_time,
          @eligibility, @sort_order, @created_at, @updated_at
        )
      `);

      for (const race of races) {
        insertRace.run({
          event_id: eventId,
          race_name: race.race_name,
          race_type: race.race_type || null,
          distance_km: race.distance_km || null,
          fee_min: race.fee_min || null,
          fee_max: race.fee_max || null,
          capacity: race.capacity || null,
          time_limit: race.time_limit || null,
          start_time: race.start_time || null,
          eligibility: race.eligibility || null,
          sort_order: race.sort_order || 0,
          created_at: now,
          updated_at: now,
        });
      }
    }
  });

  doImport();
  db.close();

  return { eventId, fieldsUpdated: Object.keys(eventUpdate).length, racesInserted: races?.length || 0 };
}

/**
 * 対象イベント一覧を取得
 * @param {object} options
 * @returns {object[]}
 */
function getTargetEvents(options = {}) {
  const db = getDb();
  let sql = "SELECT id, source_event_id, source_url, title FROM events WHERE source_site = 'runnet' AND source_url IS NOT NULL";
  const params = [];

  if (options.id) {
    sql += " AND id = ?";
    params.push(options.id);
  }

  if (options.onlyMissing) {
    // description が空 or event_races が 0件
    sql += " AND (description IS NULL OR description = '' OR id NOT IN (SELECT DISTINCT event_id FROM event_races))";
  }

  if (options.limit) {
    sql += " LIMIT ?";
    params.push(options.limit);
  }

  const rows = db.prepare(sql).all(...params);
  db.close();
  return rows;
}

module.exports = { importDetail, getTargetEvents, getDb };
