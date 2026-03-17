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
      // Phase131: 運営確認ステータス
      "ALTER TABLE events ADD COLUMN organizer_verified TEXT DEFAULT 'unconfirmed'",
      "ALTER TABLE events ADD COLUMN organizer_verified_at TEXT",
      "ALTER TABLE events ADD COLUMN organizer_verified_note TEXT",
      // Phase148: 大会結果拡張
      "ALTER TABLE event_results ADD COLUMN sport_type TEXT",
      "ALTER TABLE event_results ADD COLUMN bib_number TEXT",
      "ALTER TABLE event_results ADD COLUMN overall_rank INTEGER",
      "ALTER TABLE event_results ADD COLUMN gender_rank INTEGER",
      "ALTER TABLE event_results ADD COLUMN age_rank INTEGER",
      "ALTER TABLE event_results ADD COLUMN finish_time TEXT",
      "ALTER TABLE event_results ADD COLUMN net_time TEXT",
      "ALTER TABLE event_results ADD COLUMN category_name TEXT",
      "ALTER TABLE event_results ADD COLUMN gender TEXT",
      "ALTER TABLE event_results ADD COLUMN age_group TEXT",
      "ALTER TABLE event_results ADD COLUMN finish_status TEXT DEFAULT 'finished'",
      "ALTER TABLE event_results ADD COLUMN is_public INTEGER DEFAULT 1",
      "ALTER TABLE event_results ADD COLUMN runner_name_hash TEXT",
      // Phase138: 口コミ機能拡張
      "ALTER TABLE event_reviews ADD COLUMN sport_type TEXT",
      "ALTER TABLE event_reviews ADD COLUMN rating_overall INTEGER",
      "ALTER TABLE event_reviews ADD COLUMN rating_course INTEGER",
      "ALTER TABLE event_reviews ADD COLUMN rating_access INTEGER",
      "ALTER TABLE event_reviews ADD COLUMN rating_venue INTEGER",
      "ALTER TABLE event_reviews ADD COLUMN rating_beginner INTEGER",
      "ALTER TABLE event_reviews ADD COLUMN review_title TEXT",
      "ALTER TABLE event_reviews ADD COLUMN review_body TEXT",
      "ALTER TABLE event_reviews ADD COLUMN participant_type TEXT",
      "ALTER TABLE event_reviews ADD COLUMN visit_type TEXT",
      "ALTER TABLE event_reviews ADD COLUMN year_joined INTEGER",
      "ALTER TABLE event_reviews ADD COLUMN nickname TEXT",
      "ALTER TABLE event_reviews ADD COLUMN status TEXT DEFAULT 'published'",
      "ALTER TABLE event_reviews ADD COLUMN recommended_for TEXT",
      // 口コミ認証必須化: user_id紐付け
      "ALTER TABLE event_reviews ADD COLUMN user_id INTEGER",
      // Phase205: 大会タグ
      "ALTER TABLE events ADD COLUMN tags_json TEXT",
      // MOSHICOM統合: ソース優先度・URL
      "ALTER TABLE marathon_details ADD COLUMN source_priority TEXT DEFAULT 'runnet'",
      "ALTER TABLE marathon_details ADD COLUMN source_updated_at TEXT",
      "ALTER TABLE marathon_details ADD COLUMN moshicom_url TEXT",
      // Phase220: 人気指数カラム（計算済みスコア格納）
      "ALTER TABLE events ADD COLUMN popularity_score INTEGER DEFAULT 0",
      "ALTER TABLE events ADD COLUMN popularity_label TEXT",
      "ALTER TABLE events ADD COLUMN popularity_key TEXT",
    ];
    for (const sql of migrations) {
      try { _db.exec(sql); } catch { /* duplicate column → ignore */ }
    }

    // Phase205: event_tags テーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS event_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        tag TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (event_id) REFERENCES events(id),
        UNIQUE(event_id, tag)
      )
    `);

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

    // Phase130: 運営修正依頼テーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS organizer_update_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER,
        event_name TEXT NOT NULL,
        official_url TEXT,
        requester_role TEXT NOT NULL,
        correction_items TEXT,
        correction_content TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_organizer_requests_status
        ON organizer_update_requests(status, created_at DESC)
    `);

    // Phase132: 管理メモテーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS admin_event_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        note_type TEXT NOT NULL,
        note_text TEXT NOT NULL,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (event_id) REFERENCES events(id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_admin_event_notes_event
        ON admin_event_notes(event_id, created_at DESC)
    `);

    // Phase148: ユーザー結果紐付けテーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS user_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        result_id INTEGER NOT NULL,
        event_id INTEGER NOT NULL,
        verified INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (result_id) REFERENCES event_results(id),
        FOREIGN KEY (event_id) REFERENCES events(id),
        UNIQUE(user_id, result_id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_user_results_user
        ON user_results(user_id, created_at DESC)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_results_event_year
        ON event_results(event_id, result_year, overall_rank)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_results_bib
        ON event_results(event_id, result_year, bib_number)
    `);

    // Phase158: 大会写真テーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS event_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        sport_type TEXT,
        image_url TEXT NOT NULL,
        thumbnail_url TEXT,
        image_type TEXT DEFAULT 'other',
        caption TEXT,
        alt_text TEXT,
        source_type TEXT DEFAULT 'editorial',
        source_url TEXT,
        display_order INTEGER DEFAULT 0,
        status TEXT DEFAULT 'published',
        uploaded_by INTEGER,
        taken_year INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (event_id) REFERENCES events(id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_photos_event
        ON event_photos(event_id, status, display_order)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_photos_type
        ON event_photos(event_id, image_type, status)
    `);

    // Phase171: ユーザー大会メモテーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS event_memos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        event_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        memo_text TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (event_id) REFERENCES events(id),
        UNIQUE(user_id, event_id, category)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_memos_user_event
        ON event_memos(user_id, event_id, updated_at DESC)
    `);

    // Phase138: 口コミインデックス
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_reviews_event_status
        ON event_reviews(event_id, status, created_at DESC)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_reviews_sport
        ON event_reviews(sport_type, status, created_at DESC)
    `);

    // Phase220: パフォーマンス最適化インデックス
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_created
        ON event_activity_logs(created_at, event_id, action_type)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_event
        ON event_activity_logs(event_id, action_type, created_at)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_favorites_event
        ON favorites(event_id)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_races_event
        ON event_races(event_id, sort_order)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_sport_date
        ON events(sport_type, event_date)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_popularity
        ON events(popularity_score DESC)
    `);

    // MOSHICOM統合検証ログ
    _db.exec(`
      CREATE TABLE IF NOT EXISTS merge_verification_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        runnet_title TEXT NOT NULL,
        moshicom_title TEXT,
        moshicom_url TEXT,
        moshicom_id TEXT,
        score INTEGER DEFAULT 0,
        matched INTEGER DEFAULT 0,
        all_candidates_json TEXT,
        search_error TEXT,
        selector_errors_json TEXT,
        human_review TEXT DEFAULT 'pending',
        review_result TEXT,
        review_note TEXT,
        reviewed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (event_id) REFERENCES events(id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mvl_event
        ON merge_verification_logs(event_id)
    `);

    // Phase228: 運営管理画面 — 問い合わせテーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inquiry_type TEXT NOT NULL DEFAULT 'general',
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT NOT NULL DEFAULT 'normal',
        assignee TEXT,
        event_id INTEGER,
        target_url TEXT,
        source_page TEXT,
        admin_memo TEXT,
        resolved_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (event_id) REFERENCES events(id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_inquiries_status
        ON inquiries(status, priority, created_at DESC)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_inquiries_type
        ON inquiries(inquiry_type, status, created_at DESC)
    `);

    // Phase228: 問い合わせ返信・メモ履歴
    _db.exec(`
      CREATE TABLE IF NOT EXISTS inquiry_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inquiry_id INTEGER NOT NULL,
        note_type TEXT NOT NULL DEFAULT 'memo',
        note_text TEXT NOT NULL,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (inquiry_id) REFERENCES inquiries(id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_inquiry_notes_inquiry
        ON inquiry_notes(inquiry_id, created_at DESC)
    `);

    // Phase228: スクレイピング実行ログ
    _db.exec(`
      CREATE TABLE IF NOT EXISTS scraping_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_name TEXT NOT NULL,
        job_type TEXT NOT NULL DEFAULT 'list',
        status TEXT NOT NULL DEFAULT 'running',
        total_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        fail_count INTEGER DEFAULT 0,
        new_count INTEGER DEFAULT 0,
        update_count INTEGER DEFAULT 0,
        error_summary TEXT,
        details_json TEXT,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        finished_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_scraping_logs_source
        ON scraping_logs(source_name, created_at DESC)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_scraping_logs_status
        ON scraping_logs(status, created_at DESC)
    `);

    // Phase228: 管理操作ログ（将来のロール設計の土台）
    _db.exec(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        details_json TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user
        ON admin_audit_logs(user_id, created_at DESC)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action
        ON admin_audit_logs(action, created_at DESC)
    `);

    // Phase229: ログイン試行制限テーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        email TEXT PRIMARY KEY,
        fail_count INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        last_attempt_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Phase229: users テーブル拡張（パスワード変更日時）
    const userPasswordMigrations = [
      "ALTER TABLE users ADD COLUMN password_changed_at TEXT",
      "ALTER TABLE users ADD COLUMN last_login_at TEXT",
    ];
    for (const sql of userPasswordMigrations) {
      try { _db.exec(sql); } catch { /* duplicate column → ignore */ }
    }

    // Phase230: パスワードリセットトークンテーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_prt_token
        ON password_reset_tokens(token)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_prt_user
        ON password_reset_tokens(user_id, created_at DESC)
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
