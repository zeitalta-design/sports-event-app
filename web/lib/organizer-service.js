/**
 * Phase137: 運営関連ロジック統合サービス
 *
 * Phase 128-136 で作成した運営向け機能を統合re-export。
 * 将来の運営向けSaaS拡張を見据えた構造整理。
 *
 * ─────────────────────────────────────────────
 * 現在の機能
 * ─────────────────────────────────────────────
 *
 * 1. 運営確認ステータス管理
 *    - organizer_verified カラム（events テーブル）
 *    - 5段階ステータス: unconfirmed → taikainavi_verified → official_site_verified → organizer_confirmed → needs_review
 *    - getOrganizerVerificationDisplay() / shouldShowVerificationBadge()
 *
 * 2. 修正依頼フォーム＆管理
 *    - organizer_update_requests テーブル
 *    - POST /api/organizers/request-update — 公開フォーム送信
 *    - GET/PATCH /api/admin/organizer-requests — 管理側一覧・ステータス更新
 *
 * 3. 管理メモ
 *    - admin_event_notes テーブル
 *    - GET/POST /api/admin/event-notes — イベント単位のメモ管理
 *
 * 4. 価値指標
 *    - event_activity_logs から集計
 *    - getEventValueMetrics() / getTopEventsByEngagement()
 *    - GET /api/admin/event-metrics — 管理側指標API
 *
 * ─────────────────────────────────────────────
 * 将来の拡張ポイント（SaaS構想）
 * ─────────────────────────────────────────────
 *
 * @future 運営者認証
 *   - メール + マジックリンク方式（パスワードレス）
 *   - organizer_accounts テーブル新設
 *   - メール認証 → event_id との紐付け（クレーム）
 *   - JWT セッショントークン管理
 *
 * @future 運営ダッシュボード
 *   - /organizers/dashboard — 認証後ページ
 *   - 自分が管理するイベント一覧
 *   - PV / お気に入り / エントリークリック等のグラフ表示
 *   - 掲載情報の直接編集フォーム
 *   - 更新履歴・差分表示
 *
 * @future イベントクレーム（所有証明）
 *   - 運営者がイベントの所有を主張する仕組み
 *   - 認証方法: 公式サイトメタタグ / メール認証 / 手動承認
 *   - event_claims テーブル: event_id, organizer_id, method, status, verified_at
 *   - 承認後: organizer_verified → 'organizer_confirmed' 自動更新
 *
 * @future 運営向け分析API
 *   - GET /api/organizers/analytics/:eventId — 認証必須
 *   - 時系列データ: 日次PV / 週次お気に入り推移
 *   - ユーザー属性: 地域別・デバイス別
 *   - 競合比較: 同地域・同時期の大会との相対指標
 *   - CSVダウンロード機能
 *
 * @future 有料掲載プラン管理
 *   - プラン定義: free / basic / premium
 *   - free: 自動掲載（現状）
 *   - basic: 公式バッジ + 情報直接編集 + 基本分析
 *   - premium: 優先表示 + 詳細分析 + 広告枠 + カスタムCTA
 *   - Stripe 連携 / 請求書払い
 *   - organizer_subscriptions テーブル: plan, starts_at, expires_at, stripe_id
 *
 * @future 運営向けメッセージ
 *   - 管理者 → 運営者への通知・確認依頼
 *   - organizer_messages テーブル
 *   - メール送信統合（SendGrid等）
 */

// ── 運営確認ステータス ──
export {
  ORGANIZER_VERIFICATION_STATUSES,
  getOrganizerVerificationDisplay,
  shouldShowVerificationBadge,
  getVerificationStatusOptions,
} from "./organizer-verification";

// ── 価値指標 ──
export {
  getEventValueMetrics,
  getTopEventsByEngagement,
} from "./event-value-metrics";
