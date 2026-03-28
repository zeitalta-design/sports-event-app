/**
 * 管理者アカウントの自動シード
 *
 * サーバー起動時に呼ばれ、adminユーザーが0人なら自動作成する。
 * 既にadminが存在する場合は何もしない。
 *
 * 環境変数:
 *   ADMIN_EMAIL    — 管理者メールアドレス（必須: 本番ではデフォルト値を禁止）
 *   ADMIN_PASSWORD — 管理者パスワード（必須: 本番では8文字以上、デフォルト値を禁止）
 */

import { getDb } from "./db";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;
const FORBIDDEN_DEFAULTS = ["admin@example.com", "admin123", "password", "admin", "test"];
const MIN_PASSWORD_LENGTH = 8;

/**
 * adminユーザーが存在しなければ自動作成する
 * @returns {{ action: string, email?: string }} 実行結果
 */
export function seedAdmin() {
  const db = getDb();
  const isProduction = process.env.NODE_ENV === "production";

  // 既にadminが存在するならスキップ
  const adminCount = db
    .prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin' AND is_active = 1")
    .get();

  if (adminCount.cnt > 0) {
    return { action: "skipped", reason: `${adminCount.cnt} admin(s) already exist` };
  }

  // 環境変数の取得
  const email = process.env.ADMIN_EMAIL || "";
  const password = process.env.ADMIN_PASSWORD || "";

  // 未設定チェック
  if (!email || !password) {
    const missing = [];
    if (!email) missing.push("ADMIN_EMAIL");
    if (!password) missing.push("ADMIN_PASSWORD");
    console.warn(
      `[admin-seed] ⚠️  管理者が0人ですが、${missing.join(" / ")} が未設定のため自動作成をスキップしました。` +
      "\n  .env に ADMIN_EMAIL と ADMIN_PASSWORD を設定して再起動してください。"
    );
    return { action: "skipped", reason: `env not set: ${missing.join(", ")}` };
  }

  // 本番ではデフォルト値・弱いパスワードを禁止
  if (isProduction) {
    if (FORBIDDEN_DEFAULTS.includes(email.toLowerCase())) {
      console.error(
        `[admin-seed] ❌ 本番環境では ADMIN_EMAIL にデフォルト値 (${email}) を使用できません。` +
        "\n  実際の管理者メールアドレスを設定してください。"
      );
      return { action: "blocked", reason: "default email in production" };
    }
    if (FORBIDDEN_DEFAULTS.includes(password) || password.length < MIN_PASSWORD_LENGTH) {
      console.error(
        "[admin-seed] ❌ 本番環境では ADMIN_PASSWORD に弱いパスワードを使用できません。" +
        `\n  ${MIN_PASSWORD_LENGTH}文字以上の強固なパスワードを設定してください。`
      );
      return { action: "blocked", reason: "weak password in production" };
    }
  }

  // メール形式チェック
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`[admin-seed] ❌ ADMIN_EMAIL の形式が不正です: ${email}`);
    return { action: "blocked", reason: "invalid email format" };
  }

  // 同一メールの既存ユーザーがいれば admin に昇格＆パスワードリセット
  const existing = db
    .prepare("SELECT id, role FROM users WHERE email = ?")
    .get(email);

  const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);

  if (existing) {
    db.prepare(
      "UPDATE users SET password_hash = ?, role = 'admin', is_active = 1 WHERE id = ?"
    ).run(passwordHash, existing.id);

    console.log(`[admin-seed] ✅ 既存ユーザー (id=${existing.id}) を管理者に昇格しました: ${email}`);
    return { action: "promoted", email, id: existing.id };
  }

  // 新規作成
  const result = db
    .prepare(
      "INSERT INTO users (email, password_hash, name, role, is_active) VALUES (?, ?, ?, 'admin', 1)"
    )
    .run(email, passwordHash, "管理者");

  const userId = result.lastInsertRowid;

  // 監査ログ（テーブルがなくても安全に）
  try {
    db.prepare(
      `INSERT INTO admin_audit_logs (user_id, action, target_type, target_id, details_json)
       VALUES (?, 'admin_created', 'user', ?, ?)`
    ).run(Number(userId), String(userId), JSON.stringify({ email, created_via: "auto_seed" }));
  } catch {
    // admin_audit_logs が無い場合はスキップ
  }

  console.log(`[admin-seed] ✅ 管理者アカウントを作成しました (id=${userId}): ${email}`);
  return { action: "created", email, id: Number(userId) };
}
