/**
 * Next.js Instrumentation — サーバー起動時の初期化・検証
 *
 * Phase232: 本番環境バリデーション
 * production で SESSION_SECRET が未設定なら起動を中止する
 */

export async function register() {
  if (process.env.NODE_ENV === "production") {
    validateProductionEnv();
  }

  // 管理者アカウントの自動シード（admin が 0 人の場合のみ、Node.js ランタイムでのみ実行）
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { seedAdmin } = await import("./lib/admin-seed.js");
      seedAdmin();
    } catch (err) {
      console.warn("[startup] admin-seed skipped:", err.message);
    }
  }
}

/**
 * 本番環境の必須環境変数を検証
 * 不足があればプロセスを即座に終了させる
 */
function validateProductionEnv() {
  const errors = [];

  // SESSION_SECRET: セッションセキュリティの基盤
  if (!process.env.SESSION_SECRET) {
    errors.push(
      "SESSION_SECRET が設定されていません。" +
        "生成コマンド: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  } else if (process.env.SESSION_SECRET.length < 32) {
    errors.push(
      "SESSION_SECRET は32文字以上のランダム文字列を設定してください。"
    );
  }

  // APP_BASE_URL: パスワードリセットURL等に必須
  if (!process.env.APP_BASE_URL) {
    errors.push(
      "APP_BASE_URL が設定されていません。" +
        "例: APP_BASE_URL=https://your-domain.com"
    );
  } else if (process.env.APP_BASE_URL.startsWith("http://localhost")) {
    errors.push(
      "APP_BASE_URL が localhost を指しています。" +
        "本番ドメインを設定してください。"
    );
  }

  if (errors.length > 0) {
    const msg = [
      "",
      "=".repeat(60),
      "❌ 本番環境の起動に必要な環境変数が不足しています:",
      "=".repeat(60),
      ...errors.map((e, i) => `  ${i + 1}. ${e}`),
      "=".repeat(60),
      "詳細は DEPLOYMENT.md を参照してください。",
      "",
    ].join("\n");
    throw new Error(msg);
  }

  console.log("[startup] ✅ 本番環境変数の検証完了");
}
