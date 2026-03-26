/**
 * 自動化共通基盤 — DB アクセサー
 *
 * Next.js 内（@/lib/db）とスタンドアロンスクリプトの両方で動作する
 * DB アクセスのラッパー。
 */

let _getDbFn = null;

export function getAutomationDb() {
  if (_getDbFn) return _getDbFn();

  // スタンドアロンスクリプト用: 相対パスで直接 import
  try {
    // Dynamic require for Node.js standalone
    const path = await import("path");
    const { fileURLToPath } = await import("url");
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const dbPath = path.resolve(__dirname, "../../db.js");
    const dbModule = await import(dbPath);
    _getDbFn = dbModule.getDb;
    return _getDbFn();
  } catch {
    throw new Error("DB接続不可: @/lib/db も相対パスも解決できません");
  }
}

/**
 * 初期化: getDb関数を注入する
 * cron-sync.js 等のエントリポイントから呼ぶ
 */
export function setDbAccessor(getDbFn) {
  _getDbFn = getDbFn;
}
