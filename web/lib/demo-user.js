/**
 * ユーザーキー取得（後方互換）
 * 認証実装により getCurrentUser() / getUserKeyFromSession() を推奨
 * このファイルは既存APIとの互換性のために残す
 */

// 旧定数（migration用の参照として残す）
export const DEMO_USER_KEY = "demo-user-1";

export function getUserKey() {
  // 注意: この関数は同期的なため、セッションからは取得できない
  // 各APIで直接 getCurrentUser() を使うこと
  return DEMO_USER_KEY;
}
