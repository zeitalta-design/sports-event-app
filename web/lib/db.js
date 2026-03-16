import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "sports-event.db");
const SCHEMA_PATH = path.join(process.cwd(), "..", "sql", "001_create_tables.sql");

let _db = null;

export function getDb() {
  if (!_db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("busy_timeout = 5000");
    _db.pragma("foreign_keys = ON");

    if (fs.existsSync(SCHEMA_PATH)) {
      const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
      _db.exec(schema);
    }

    // Phase35-36: 新カラム追加マイグレーション
    const migrations = [
      "ALTER TABLE marathon_details ADD COLUMN services_json TEXT",
      "ALTER TABLE marathon_details ADD COLUMN parking_info TEXT",
      "ALTER TABLE event_races ADD COLUMN category TEXT",
      "ALTER TABLE event_races ADD COLUMN note TEXT",
      // Phase36: 締切履歴・シグナル
      "ALTER TABLE events ADD COLUMN entry_signals_json TEXT",
      "ALTER TABLE events ADD COLUMN urgency_label TEXT",
      "ALTER TABLE events ADD COLUMN urgency_level TEXT",
      // Phase37: 定期監視・鮮度
      "ALTER TABLE events ADD COLUMN last_verified_at TEXT",
      "ALTER TABLE events ADD COLUMN monitor_error_count INTEGER DEFAULT 0",
      "ALTER TABLE events ADD COLUMN monitor_last_error TEXT",
      // Phase39: 相互検証・矛盾検知
      "ALTER TABLE events ADD COLUMN verification_conflict INTEGER DEFAULT 0",
      "ALTER TABLE events ADD COLUMN verification_conflict_level INTEGER DEFAULT 0",
      "ALTER TABLE events ADD COLUMN verification_conflict_summary TEXT",
      "ALTER TABLE events ADD COLUMN verification_conflict_updated_at TEXT",
      "ALTER TABLE events ADD COLUMN verification_status TEXT DEFAULT 'unverified'",
      // Phase40: 通知UI強化
      "ALTER TABLE notifications ADD COLUMN read_at TEXT",
      "ALTER TABLE notifications ADD COLUMN link_url TEXT",
      // Phase55: 詳細ページ情報拡充
      "ALTER TABLE marathon_details ADD COLUMN registration_requirements_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN health_management_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN terms_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN pledge_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN refund_policy_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN reception_place TEXT",
      "ALTER TABLE marathon_details ADD COLUMN reception_time_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN transit_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN race_method_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN cutoff_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN timetable_text TEXT",
      // Phase72: 募集状態監視強化
      "ALTER TABLE events ADD COLUMN official_entry_status TEXT",
      "ALTER TABLE events ADD COLUMN official_entry_status_label TEXT",
      "ALTER TABLE events ADD COLUMN official_checked_at TEXT",
      "ALTER TABLE events ADD COLUMN official_deadline_text TEXT",
      "ALTER TABLE events ADD COLUMN official_capacity_text TEXT",
      "ALTER TABLE events ADD COLUMN official_status_source_url TEXT",
      "ALTER TABLE events ADD COLUMN official_status_confidence INTEGER DEFAULT 0",
      "ALTER TABLE events ADD COLUMN official_status_note TEXT",
      // Phase79: 精度強化 — ソース種別・unknown理由
      "ALTER TABLE events ADD COLUMN official_status_source_type TEXT",
      "ALTER TABLE events ADD COLUMN official_unknown_reason TEXT",
    ];
    for (const sql of migrations) {
      try { _db.exec(sql); } catch { /* duplicate column → ignore */ }
    }

    // Phase72: 募集状態変更ログテーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS entry_status_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        previous_status TEXT,
        new_status TEXT NOT NULL,
        previous_label TEXT,
        new_label TEXT,
        change_source TEXT DEFAULT 'monitor',
        confidence INTEGER DEFAULT 0,
        detected_signals_json TEXT,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (event_id) REFERENCES events(id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_entry_status_changes_event
        ON entry_status_changes(event_id, created_at DESC)
    `);
  }
  return _db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
