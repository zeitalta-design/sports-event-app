/**
 * Next.js Instrumentation — 無効化済み
 * Vercel環境でネイティブモジュール（libsql）の読み込みが
 * instrumentation hookの段階で失敗するため、空実装にしている。
 * seedAdmin等の初期化は必要に応じてAPIルートで実行する。
 */
export async function register() {
  // no-op
}
