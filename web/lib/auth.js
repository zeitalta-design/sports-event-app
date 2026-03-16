/**
 * 認証ライブラリ
 * Cookie/Session ベースの最小認証
 */

import { getDb } from "./db";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const SESSION_COOKIE = "mvp_session";
const SESSION_MAX_AGE_DAYS = 30;

/**
 * パスワードハッシュ生成
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

/**
 * パスワード検証
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * セッショントークン生成
 */
function generateSessionToken() {
  return crypto.randomUUID() + "-" + crypto.randomBytes(16).toString("hex");
}

/**
 * セッション作成
 */
export function createSession(userId) {
  const db = getDb();
  const token = generateSessionToken();
  const expiresAt = new Date(
    Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  db.prepare(
    "INSERT INTO sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)"
  ).run(token, userId, expiresAt);

  return { token, expiresAt };
}

/**
 * セッションCookieを設定
 */
export async function setSessionCookie(token) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: false, // 開発環境: localhost
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_DAYS * 24 * 60 * 60,
  });
}

/**
 * セッションCookieを削除
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * 現在のユーザーを取得（nullならログインしていない）
 * Server Components / Route Handlers 共通
 */
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE);
    if (!sessionCookie?.value) return null;

    const db = getDb();
    const row = db
      .prepare(
        `SELECT u.id, u.email, u.name, u.role, u.is_active, s.expires_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.session_token = ? AND u.is_active = 1`
      )
      .get(sessionCookie.value);

    if (!row) return null;

    // 期限チェック
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    if (row.expires_at < now) {
      db.prepare("DELETE FROM sessions WHERE session_token = ?").run(
        sessionCookie.value
      );
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      userKey: String(row.id),
    };
  } catch {
    return null;
  }
}

/**
 * ログインユーザーの user_key を取得
 * 未ログイン時は null
 */
export async function getUserKeyFromSession() {
  const user = await getCurrentUser();
  return user ? user.userKey : null;
}

/**
 * admin ロール確認
 * @returns {object|null} admin ユーザーまたは null
 */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

/**
 * ユーザー登録
 */
export async function signupUser({ email, password, name }) {
  const db = getDb();

  // 重複チェック
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return { error: "このメールアドレスは既に登録されています" };
  }

  const passwordHash = await hashPassword(password);
  const result = db
    .prepare(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'user')"
    )
    .run(email, passwordHash, name || "");

  const userId = result.lastInsertRowid;
  const session = createSession(Number(userId));
  await setSessionCookie(session.token);

  return {
    user: { id: Number(userId), email, name: name || "", role: "user" },
  };
}

/**
 * ログイン
 */
export async function loginUser({ email, password }) {
  const db = getDb();

  const user = db
    .prepare(
      "SELECT id, email, name, role, password_hash, is_active FROM users WHERE email = ?"
    )
    .get(email);

  if (!user) {
    return { error: "メールアドレスまたはパスワードが正しくありません" };
  }

  if (!user.is_active) {
    return { error: "このアカウントは無効です" };
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return { error: "メールアドレスまたはパスワードが正しくありません" };
  }

  const session = createSession(user.id);
  await setSessionCookie(session.token);

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

/**
 * ログアウト
 */
export async function logoutUser() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE);
    if (sessionCookie?.value) {
      const db = getDb();
      db.prepare("DELETE FROM sessions WHERE session_token = ?").run(
        sessionCookie.value
      );
    }
  } catch {}
  await clearSessionCookie();
}
