-- MVP Sports Event Portal - Initial Schema
-- Created: 2026-03-15

-- ===== events: 大会本体 =====
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_site TEXT NOT NULL DEFAULT 'runnet',
  source_event_id TEXT,
  title TEXT NOT NULL,
  normalized_title TEXT,
  sport_type TEXT NOT NULL DEFAULT 'marathon',
  sport_slug TEXT NOT NULL DEFAULT 'marathon',
  area_region TEXT,
  prefecture TEXT,
  city TEXT,
  venue_name TEXT,
  event_date TEXT,
  event_month TEXT,
  entry_start_date TEXT,
  entry_end_date TEXT,
  entry_status TEXT DEFAULT 'unknown',
  source_url TEXT,
  official_url TEXT,
  hero_image_url TEXT,
  description TEXT,
  latitude REAL,
  longitude REAL,
  is_active INTEGER NOT NULL DEFAULT 1,
  scraped_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== event_races: 大会内の種目 =====
CREATE TABLE IF NOT EXISTS event_races (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  race_name TEXT NOT NULL,
  race_type TEXT,
  distance_km REAL,
  fee_min INTEGER,
  fee_max INTEGER,
  capacity INTEGER,
  time_limit TEXT,
  start_time TEXT,
  eligibility TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== event_results: 結果ページ保存用 =====
CREATE TABLE IF NOT EXISTS event_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  result_year INTEGER,
  result_url TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== event_reviews: 口コミ =====
CREATE TABLE IF NOT EXISTS event_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rating INTEGER,
  title TEXT,
  body TEXT,
  author_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== favorites: お気に入り =====
CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key TEXT NOT NULL,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== saved_searches: 保存検索 =====
CREATE TABLE IF NOT EXISTS saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key TEXT NOT NULL,
  sport_type TEXT,
  keyword TEXT,
  area_region TEXT,
  prefecture TEXT,
  event_month TEXT,
  filters_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== notifications: 通知キュー/履歴 =====
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  body TEXT,
  payload_json TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== notification_settings: 通知設定 =====
CREATE TABLE IF NOT EXISTS notification_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key TEXT NOT NULL UNIQUE,
  enable_deadline_7d INTEGER NOT NULL DEFAULT 1,
  enable_deadline_3d INTEGER NOT NULL DEFAULT 1,
  enable_deadline_today INTEGER NOT NULL DEFAULT 1,
  enable_saved_search_match INTEGER NOT NULL DEFAULT 1,
  enable_favorite_deadline_7d INTEGER NOT NULL DEFAULT 1,
  enable_favorite_deadline_3d INTEGER NOT NULL DEFAULT 1,
  enable_favorite_deadline_today INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== notification_jobs: 通知ジョブ実行履歴 =====
CREATE TABLE IF NOT EXISTS notification_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_type TEXT NOT NULL DEFAULT 'generate_notifications',
  run_date TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'running',
  total_generated INTEGER DEFAULT 0,
  total_inserted INTEGER DEFAULT 0,
  total_skipped INTEGER DEFAULT 0,
  summary_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== email_jobs: メール送信キュー/履歴 =====
CREATE TABLE IF NOT EXISTS email_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key TEXT NOT NULL,
  notification_id INTEGER NOT NULL REFERENCES notifications(id),
  event_id INTEGER,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  preview_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  send_type TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT
);

-- ===== users: ユーザー =====
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== sessions: セッション =====
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== daily_jobs: 日次ジョブ実行サマリー =====
CREATE TABLE IF NOT EXISTS daily_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_date TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'running',
  notifications_generated INTEGER DEFAULT 0,
  notifications_inserted INTEGER DEFAULT 0,
  email_jobs_generated INTEGER DEFAULT 0,
  email_jobs_inserted INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_failed INTEGER DEFAULT 0,
  with_email_send INTEGER NOT NULL DEFAULT 0,
  dry_run INTEGER NOT NULL DEFAULT 0,
  summary_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== marathon_details: 大会詳細情報（補助テーブル） =====
CREATE TABLE IF NOT EXISTS marathon_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  marathon_id INTEGER NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  tagline TEXT,
  summary TEXT,
  venue_name TEXT,
  venue_address TEXT,
  access_info TEXT,
  application_start_at TEXT,
  application_end_at TEXT,
  registration_start_time TEXT,
  payment_methods_json TEXT,
  agent_entry_allowed INTEGER,
  entry_url TEXT,
  official_url TEXT,
  cancellation_policy TEXT,
  event_scale_label TEXT,
  level_labels_json TEXT,
  features_json TEXT,
  sports_category TEXT,
  event_type_label TEXT,
  measurement_method TEXT,
  notes TEXT,
  faq_json TEXT,
  schedule_json TEXT,
  distances_json TEXT,
  pricing_json TEXT,
  time_limits_json TEXT,
  organizer_name TEXT,
  organizer_contact_name TEXT,
  organizer_email TEXT,
  organizer_phone TEXT,
  organizer_description TEXT,
  organizer_review_score REAL,
  organizer_review_count INTEGER,
  series_events_json TEXT,
  course_info TEXT,
  map_url TEXT,
  source_url TEXT,
  -- Phase55: 詳細ページ情報拡充
  registration_requirements_text TEXT,
  health_management_text TEXT,
  terms_text TEXT,
  pledge_text TEXT,
  refund_policy_text TEXT,
  reception_place TEXT,
  reception_time_text TEXT,
  transit_text TEXT,
  race_method_text TEXT,
  cutoff_text TEXT,
  timetable_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== Indexes =====
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_source
  ON events(source_site, source_event_id);
CREATE INDEX IF NOT EXISTS idx_events_sport_type
  ON events(sport_type);
CREATE INDEX IF NOT EXISTS idx_events_prefecture
  ON events(prefecture);
CREATE INDEX IF NOT EXISTS idx_events_event_date
  ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_entry_end_date
  ON events(entry_end_date);
CREATE INDEX IF NOT EXISTS idx_events_is_active
  ON events(is_active);
CREATE INDEX IF NOT EXISTS idx_event_races_event_id
  ON event_races(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_unique
  ON favorites(user_key, event_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user
  ON saved_searches(user_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_jobs_notification
  ON email_jobs(notification_id);
CREATE INDEX IF NOT EXISTS idx_email_jobs_status
  ON email_jobs(status);
CREATE INDEX IF NOT EXISTS idx_email_jobs_user
  ON email_jobs(user_key);
CREATE INDEX IF NOT EXISTS idx_daily_jobs_run_date
  ON daily_jobs(run_date);
CREATE INDEX IF NOT EXISTS idx_daily_jobs_status
  ON daily_jobs(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_marathon_details_marathon
  ON marathon_details(marathon_id);
-- ===== marathon_view_events: 大会詳細ページ閲覧ログ =====
CREATE TABLE IF NOT EXISTS marathon_view_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  marathon_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  referrer_marathon_id INTEGER,
  user_agent TEXT,
  viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mve_marathon_id
  ON marathon_view_events(marathon_id);
CREATE INDEX IF NOT EXISTS idx_mve_session_id
  ON marathon_view_events(session_id);
CREATE INDEX IF NOT EXISTS idx_mve_viewed_at
  ON marathon_view_events(viewed_at);
CREATE INDEX IF NOT EXISTS idx_mve_marathon_viewed
  ON marathon_view_events(marathon_id, viewed_at);
CREATE INDEX IF NOT EXISTS idx_mve_session_viewed
  ON marathon_view_events(session_id, viewed_at);
CREATE INDEX IF NOT EXISTS idx_mve_referrer
  ON marathon_view_events(referrer_marathon_id);

-- ===== event_entry_history: 受付状態の変化履歴 =====
CREATE TABLE IF NOT EXISTS event_entry_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'import',
  source_url TEXT,
  observed_status TEXT NOT NULL,
  entry_open_at TEXT,
  entry_close_at TEXT,
  event_date TEXT,
  close_reason TEXT,
  is_capacity_based INTEGER DEFAULT 0,
  detected_signals_json TEXT,
  first_detected_at TEXT,
  observed_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_eeh_event_id
  ON event_entry_history(event_id);
CREATE INDEX IF NOT EXISTS idx_eeh_observed_at
  ON event_entry_history(observed_at);
CREATE INDEX IF NOT EXISTS idx_eeh_event_status
  ON event_entry_history(event_id, observed_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token
  ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user
  ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires
  ON sessions(expires_at);

-- ===== event_notification_batches: 状態変化の通知生成単位 =====
CREATE TABLE IF NOT EXISTS event_notification_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL DEFAULT 'monitor',
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL,
  before_status TEXT,
  after_status TEXT,
  before_urgency TEXT,
  after_urgency TEXT,
  trigger_key TEXT NOT NULL UNIQUE,
  summary_text TEXT,
  total_targets INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  total_skipped INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_enb_event_id
  ON event_notification_batches(event_id);
CREATE INDEX IF NOT EXISTS idx_enb_created_at
  ON event_notification_batches(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_enb_trigger_key
  ON event_notification_batches(trigger_key);

-- ===== event_notifications: 個別通知候補・送信履歴 =====
CREATE TABLE IF NOT EXISTS event_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER REFERENCES event_notification_batches(id) ON DELETE SET NULL,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_key TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  trigger_key TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  payload_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  channel TEXT NOT NULL DEFAULT 'in_app',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_en_event_id
  ON event_notifications(event_id);
CREATE INDEX IF NOT EXISTS idx_en_user_key
  ON event_notifications(user_key);
CREATE INDEX IF NOT EXISTS idx_en_status
  ON event_notifications(status);
CREATE INDEX IF NOT EXISTS idx_en_created_at
  ON event_notifications(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_en_dedup
  ON event_notifications(user_key, trigger_key);

-- ===== event_source_links: 大会に紐づく外部ソース一覧 =====
CREATE TABLE IF NOT EXISTS event_source_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_event_id TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_esl_event_id
  ON event_source_links(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_esl_event_source
  ON event_source_links(event_id, source_url);
CREATE INDEX IF NOT EXISTS idx_esl_source_type
  ON event_source_links(source_type);

-- ===== event_source_snapshots: ソース単位の検証結果 =====
CREATE TABLE IF NOT EXISTS event_source_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  source_link_id INTEGER REFERENCES event_source_links(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  entry_status TEXT,
  entry_start_date TEXT,
  entry_end_date TEXT,
  event_date_text TEXT,
  status_text TEXT,
  urgency_label TEXT,
  freshness_level TEXT,
  is_success INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  raw_summary_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ess_event_id
  ON event_source_snapshots(event_id);
CREATE INDEX IF NOT EXISTS idx_ess_source_link
  ON event_source_snapshots(source_link_id);
CREATE INDEX IF NOT EXISTS idx_ess_checked_at
  ON event_source_snapshots(checked_at);

-- ============================================================
-- Phase45: 行動ログ（人気指数計算用）
-- ============================================================
CREATE TABLE IF NOT EXISTS event_activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  action_type TEXT NOT NULL,       -- detail_view, favorite_add, favorite_remove, entry_click
  user_key TEXT,                   -- ログインユーザー識別子（NULL可）
  session_id TEXT,                 -- セッション識別子（NULL可）
  source_page TEXT,                -- 記録元ページ（detail, list, top等）
  metadata_json TEXT,              -- 拡張用JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE INDEX IF NOT EXISTS idx_eal_event_id
  ON event_activity_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_eal_action_type
  ON event_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_eal_created_at
  ON event_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_eal_event_action_date
  ON event_activity_logs(event_id, action_type, created_at);
