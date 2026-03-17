/**
 * ログイン試行レート制限モジュール
 * DB ベースの簡易レート制限（login_attempts テーブル）
 * - 連続失敗でアカウントを一時ロック
 * - 成功時にカウンタリセット
 */

import { getDb } from "./db";

// 設定定数
const MAX_ATTEMPTS = 5; // ロックまでの失敗回数
const LOCKOUT_MINUTES = 15; // ロック時間（分）
const ATTEMPT_WINDOW_MINUTES = 30; // 失敗カウントウィンドウ（分）

/**
 * ログイン試行が許可されるか確認
 * @param {string} email - メールアドレス
 * @returns {{ allowed: boolean, remainingAttempts: number, lockedUntil: string|null }}
 */
export function checkLoginAllowed(email) {
  const db = getDb();
  const normalizedEmail = email.toLowerCase().trim();

  const row = db
    .prepare(
      `SELECT fail_count, locked_until, last_attempt_at
       FROM login_attempts WHERE email = ?`
    )
    .get(normalizedEmail);

  if (!row) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, lockedUntil: null };
  }

  // ロック中か確認
  if (row.locked_until) {
    const lockedUntil = new Date(row.locked_until + "Z");
    if (lockedUntil > new Date()) {
      return {
        allowed: false,
        remainingAttempts: 0,
        lockedUntil: row.locked_until,
      };
    }
    // ロック期限切れ → リセット
    db.prepare(
      `UPDATE login_attempts SET fail_count = 0, locked_until = NULL WHERE email = ?`
    ).run(normalizedEmail);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, lockedUntil: null };
  }

  // ウィンドウ外の古い試行はリセット
  const windowStart = new Date(
    Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000
  )
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  if (row.last_attempt_at && row.last_attempt_at < windowStart) {
    db.prepare(
      `UPDATE login_attempts SET fail_count = 0 WHERE email = ?`
    ).run(normalizedEmail);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, lockedUntil: null };
  }

  const remaining = MAX_ATTEMPTS - row.fail_count;
  return {
    allowed: remaining > 0,
    remainingAttempts: Math.max(0, remaining),
    lockedUntil: null,
  };
}

/**
 * ログイン失敗を記録
 * @param {string} email
 * @returns {{ locked: boolean, lockedUntil: string|null }}
 */
export function recordLoginFailure(email) {
  const db = getDb();
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  // upsert
  db.prepare(
    `INSERT INTO login_attempts (email, fail_count, last_attempt_at)
     VALUES (?, 1, ?)
     ON CONFLICT(email) DO UPDATE SET
       fail_count = fail_count + 1,
       last_attempt_at = ?`
  ).run(normalizedEmail, now, now);

  // 失敗回数を確認しロック判定
  const row = db
    .prepare(`SELECT fail_count FROM login_attempts WHERE email = ?`)
    .get(normalizedEmail);

  if (row && row.fail_count >= MAX_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    db.prepare(
      `UPDATE login_attempts SET locked_until = ? WHERE email = ?`
    ).run(lockedUntil, normalizedEmail);

    return { locked: true, lockedUntil };
  }

  return { locked: false, lockedUntil: null };
}

/**
 * ログイン成功時にカウンタリセット
 * @param {string} email
 */
export function resetLoginAttempts(email) {
  const db = getDb();
  const normalizedEmail = email.toLowerCase().trim();
  db.prepare(
    `DELETE FROM login_attempts WHERE email = ?`
  ).run(normalizedEmail);
}

/**
 * エクスポート用定数
 */
export const RATE_LIMIT_CONFIG = {
  maxAttempts: MAX_ATTEMPTS,
  lockoutMinutes: LOCKOUT_MINUTES,
  windowMinutes: ATTEMPT_WINDOW_MINUTES,
};
