/**
 * RUNNET 一覧データを SQLite へ upsert
 */

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const webRequire = createRequire(
  path.join(__dirname, "..", "..", "web", "package.json")
);
const Database = webRequire("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "..", "web", "data", "risk-monitor.db");
const SCHEMA_PATH = path.join(__dirname, "..", "..", "sql", "001_create_tables.sql");

/**
 * DB接続を取得（必要ならスキーマ初期化）
 */
function getDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // スキーマ適用
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);

  return db;
}

/**
 * イベント配列をDBにupsert
 * @param {object[]} events - parse-list.js が返すイベント配列
 * @param {object} options
 * @param {boolean} options.onlyNew - trueの場合、既存イベントはスキップ
 * @returns {{ inserted: number, updated: number, skippedExisting: number, total: number }}
 */
function importEvents(events, options = {}) {
  const { onlyNew = false } = options;
  const db = getDb();
  const now = new Date().toISOString();

  // 既存のsource_event_idを確認
  const existingStmt = db.prepare(
    "SELECT id, source_event_id FROM events WHERE source_site = 'runnet' AND source_event_id = ?"
  );

  const insertStmt = db.prepare(`
    INSERT INTO events (
      source_site, source_event_id, title, normalized_title,
      sport_type, sport_slug, area_region, prefecture, city, venue_name,
      event_date, event_month, entry_status,
      source_url, official_url, hero_image_url, description,
      is_active, scraped_at, created_at, updated_at
    ) VALUES (
      @source_site, @source_event_id, @title, @normalized_title,
      @sport_type, @sport_slug, @area_region, @prefecture, @city, @venue_name,
      @event_date, @event_month, @entry_status,
      @source_url, @official_url, @hero_image_url, @description,
      @is_active, @scraped_at, @created_at, @updated_at
    )
  `);

  // 詳細データ保護: description, venue_name, city, official_url は
  // 既存値がある場合（詳細スクレイプで取得済み）は一覧値で上書きしない
  const updateStmt = db.prepare(`
    UPDATE events SET
      title = @title,
      normalized_title = @normalized_title,
      sport_type = @sport_type,
      sport_slug = @sport_slug,
      area_region = @area_region,
      prefecture = @prefecture,
      city = CASE WHEN city IS NOT NULL AND city != '' THEN city ELSE @city END,
      venue_name = CASE WHEN venue_name IS NOT NULL AND venue_name != '' THEN venue_name ELSE @venue_name END,
      event_date = @event_date,
      event_month = @event_month,
      entry_status = @entry_status,
      source_url = @source_url,
      hero_image_url = COALESCE(hero_image_url, @hero_image_url),
      description = CASE WHEN description IS NOT NULL AND description != '' THEN description ELSE @description END,
      official_url = COALESCE(official_url, @official_url),
      is_active = @is_active,
      scraped_at = @scraped_at,
      updated_at = @updated_at
    WHERE source_site = 'runnet' AND source_event_id = @source_event_id
  `);

  let inserted = 0;
  let updated = 0;
  let skippedExisting = 0;

  const upsertAll = db.transaction(() => {
    for (const ev of events) {
      const row = {
        ...ev,
        hero_image_url: ev.image_url || null,
        official_url: ev.official_url || null,
        scraped_at: now,
        created_at: now,
        updated_at: now,
      };
      // image_url は hero_image_url にマッピング済み
      delete row.image_url;

      const existing = existingStmt.get(ev.source_event_id);
      if (existing) {
        if (onlyNew) {
          skippedExisting++;
          continue;
        }
        updateStmt.run(row);
        updated++;
      } else {
        insertStmt.run(row);
        inserted++;
      }
    }
  });

  upsertAll();

  const total = db.prepare("SELECT COUNT(*) as c FROM events WHERE source_site = 'runnet'").get().c;

  db.close();
  return { inserted, updated, skippedExisting, total };
}

module.exports = { importEvents, getDb };
