/**
 * Docker ビルド時に SSG に必要な空 DB を初期化するスクリプト
 * getDb() の ALTER TABLE マイグレーションが失敗する場合があるため、
 * エラーをキャッチして続行する
 */
try {
  const { getDb } = await import("../lib/db.js");
  const db = getDb();
  console.log("Build DB initialized");
} catch (e) {
  // ALTER TABLE 失敗は既存テーブル不足のため許容
  // SSG に必要な最低限のテーブルを直接作成
  const Database = (await import("better-sqlite3")).default;
  const path = (await import("path")).default;
  const fs = (await import("fs")).default;

  const dbPath = path.join(process.cwd(), "data", "sports-event.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);

  // sports 系の最低限テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY, slug TEXT, name TEXT, date TEXT, location TEXT,
      prefecture TEXT, category TEXT, sub_category TEXT, distance TEXT,
      capacity INTEGER, entry_fee TEXT, entry_status TEXT, official_url TEXT,
      hero_image_url TEXT, summary TEXT, features_json TEXT, course_info TEXT,
      access_info TEXT, past_results_url TEXT, organizer TEXT, created_at TEXT,
      updated_at TEXT, event_group TEXT, month INTEGER, region TEXT, terrain TEXT,
      difficulty TEXT, elevation_gain INTEGER, aid_stations INTEGER, time_limit TEXT,
      popularity_score REAL, rating REAL, review_count INTEGER, is_featured INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS marathon_details (id INTEGER PRIMARY KEY, event_id INTEGER, detail_json TEXT);
    CREATE TABLE IF NOT EXISTS event_races (id INTEGER PRIMARY KEY, event_id INTEGER, name TEXT, distance TEXT);
    CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY, user_id TEXT, message TEXT, type TEXT, created_at TEXT);
    CREATE TABLE IF NOT EXISTS favorites (id INTEGER PRIMARY KEY, user_id TEXT, event_id INTEGER);
    CREATE TABLE IF NOT EXISTS saved_searches (id INTEGER PRIMARY KEY, user_id TEXT, name TEXT, query_json TEXT, created_at TEXT);
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT, password_hash TEXT, name TEXT, role TEXT DEFAULT 'user', created_at TEXT);
  `);

  db.close();
  console.log("Build DB initialized (fallback mode)");
}
