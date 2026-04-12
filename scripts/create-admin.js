#!/usr/bin/env node
/**
 * 管理者アカウント作成 CLI
 *
 * 使い方:
 *   node scripts/create-admin.js --email admin@spokatsu.com --name "管理者" --password "YourSecurePass123"
 *   npm run admin:create -- --email admin@spokatsu.com --name "管理者" --password "YourSecurePass123"
 *
 * オプション:
 *   --email    (必須) メールアドレス
 *   --name     (必須) 表示名
 *   --password (必須) パスワード（8文字以上）
 *   --force    既存adminの重複チェックをスキップ（メール重複は常にブロック）
 *
 * セキュリティ:
 *   - パスワードは bcrypt でハッシュ化して保存
 *   - コードにパスワードをハードコードしない
 *   - 本番では環境変数やプロンプト入力を推奨
 */

const path = require("path");
const { createRequire } = require("module");
const { parseArgs } = require("util");

const webRequire = createRequire(
  path.join(__dirname, "..", "web", "package.json")
);
const Database = webRequire("better-sqlite3");
const bcrypt = webRequire("bcryptjs");

const DB_PATH = path.join(__dirname, "..", "web", "data", "risk-monitor.db");
const PASSWORD_MIN_LENGTH = 8;
const BCRYPT_ROUNDS = 10;

// --- 引数パース ---
let args;
try {
  const parsed = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      password: { type: "string" },
      force: { type: "boolean", default: false },
    },
    strict: true,
  });
  args = parsed.values;
} catch (err) {
  console.error(`[ERROR] 引数エラー: ${err.message}`);
  printUsage();
  process.exit(1);
}

function printUsage() {
  console.log(`
使い方:
  node scripts/create-admin.js --email <email> --name <name> --password <password>

オプション:
  --email      (必須) 管理者メールアドレス
  --name       (必須) 表示名
  --password   (必須) パスワード（${PASSWORD_MIN_LENGTH}文字以上）
  --force      既存admin有無チェックをスキップ

例:
  node scripts/create-admin.js --email admin@spokatsu.com --name "管理者" --password "SecurePass123"
  npm run admin:create -- --email admin@spokatsu.com --name "管理者" --password "SecurePass123"
`);
}

// --- バリデーション ---
const { email, name, password, force } = args;

if (!email || !name || !password) {
  console.error("[ERROR] --email, --name, --password はすべて必須です");
  printUsage();
  process.exit(1);
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("[ERROR] 無効なメールアドレス形式です");
  process.exit(1);
}

if (password.length < PASSWORD_MIN_LENGTH) {
  console.error(
    `[ERROR] パスワードは${PASSWORD_MIN_LENGTH}文字以上必要です（現在: ${password.length}文字）`
  );
  process.exit(1);
}

// --- DB接続 ---
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

try {
  // メール重複チェック
  const existing = db
    .prepare("SELECT id, email, role FROM users WHERE email = ?")
    .get(email);

  if (existing) {
    console.error(
      `[ERROR] このメールアドレスは既に登録されています: ${email} (id=${existing.id}, role=${existing.role})`
    );
    process.exit(1);
  }

  // 既存adminチェック（--force でスキップ可）
  if (!force) {
    const adminCount = db
      .prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'")
      .get();
    if (adminCount.cnt > 0) {
      console.warn(
        `[WARNING] 既に ${adminCount.cnt} 人の管理者が存在します。追加作成するには --force を指定してください。`
      );
      const admins = db
        .prepare("SELECT id, email, name FROM users WHERE role = 'admin'")
        .all();
      console.table(admins);
      process.exit(1);
    }
  }

  // パスワードハッシュ化
  const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);

  // admin 作成
  const result = db
    .prepare(
      `INSERT INTO users (email, password_hash, name, role, is_active)
       VALUES (?, ?, ?, 'admin', 1)`
    )
    .run(email, passwordHash, name);

  const userId = result.lastInsertRowid;

  // 監査ログ記録
  try {
    db.prepare(
      `INSERT INTO admin_audit_logs (user_id, action, target_type, target_id, details_json)
       VALUES (?, 'admin_created', 'user', ?, ?)`
    ).run(
      Number(userId),
      String(userId),
      JSON.stringify({ email, name, created_via: "cli" })
    );
  } catch {
    // admin_audit_logs がまだ無い場合はスキップ
  }

  console.log("");
  console.log("============================================");
  console.log("  管理者アカウントを作成しました");
  console.log("============================================");
  console.log(`  ID:    ${userId}`);
  console.log(`  Email: ${email}`);
  console.log(`  Name:  ${name}`);
  console.log(`  Role:  admin`);
  console.log("============================================");
  console.log("");
  console.log("ログイン: http://localhost:3001/login");
  console.log("");
} catch (err) {
  console.error(`[ERROR] 管理者作成に失敗しました: ${err.message}`);
  process.exit(1);
} finally {
  db.close();
}
