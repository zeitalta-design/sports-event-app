/**
 * サイト共通設定（ブランド定義）
 * サービス名やURLをここに集約し、各所から参照する
 *
 * Phase221: ブランド統一 — 「大会ナビ」→「スポ活」→「スポログ」
 */

export const siteConfig = {
  /** サービス名（日本語） */
  siteName: "スポログ",
  /** サービス名（英語） */
  siteNameEn: "SPORTLOG",
  /** サービス説明 */
  siteDescription: "全国のスポーツ大会を探せる検索・通知サービス",
  /** キャッチコピー */
  tagline: "全国のスポーツ大会を探す",
  /** サイトURL */
  siteUrl: process.env.APP_BASE_URL || "http://localhost:3001",
  /** ロゴ画像パス */
  logoImage: "/banner_logo.png",
  /** メール送信者名 */
  mailFrom: process.env.MAIL_FROM || "スポログ <noreply@sportlog.jp>",
  /** メール件名プレフィックス */
  emailPrefix: "【スポログ】",
  /** メールフッター署名 */
  emailSignature: "スポログ — スポーツ大会検索・通知サービス",
};
