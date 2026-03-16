/**
 * サイト共通設定（ブランド定義）
 * サービス名やURLをここに集約し、各所から参照する
 */

export const siteConfig = {
  /** サービス名（日本語） */
  siteName: "大会ナビ",
  /** サービス名（英語） */
  siteNameEn: "TaikaiNavi",
  /** サービス説明 */
  siteDescription: "全国のスポーツ大会を探せる検索・通知サービス",
  /** キャッチコピー */
  tagline: "全国のスポーツ大会を探す",
  /** サイトURL */
  siteUrl: process.env.APP_BASE_URL || "http://localhost:3001",
  /** メール送信者名 */
  mailFrom: process.env.MAIL_FROM || "大会ナビ <noreply@taikainavi.com>",
  /** メール件名プレフィックス */
  emailPrefix: "【大会ナビ】",
  /** メールフッター署名 */
  emailSignature: "大会ナビ — スポーツ大会検索・通知サービス",
};
