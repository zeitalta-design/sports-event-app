/**
 * 旧 demo-user / system 前提のデータをクリーンアップ
 */
const path = require("path");
const { createRequire } = require("module");
const webRequire = createRequire(
  path.join(__dirname, "..", "web", "package.json")
);
const Database = webRequire("better-sqlite3");

const dbPath = path.join(__dirname, "..", "web", "data", "sports-event.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log("=== 旧データクリーンアップ ===\n");

// 1. user_key = "system" の notifications を削除
const systemNotifs = db.prepare(
  "SELECT COUNT(*) as count FROM notifications WHERE user_key = 'system'"
).get();
console.log(`  system通知: ${systemNotifs.count}件`);
if (systemNotifs.count > 0) {
  // system通知に紐づくemail_jobsも削除
  const systemEmailJobs = db.prepare(`
    DELETE FROM email_jobs WHERE notification_id IN (
      SELECT id FROM notifications WHERE user_key = 'system'
    )
  `).run();
  console.log(`    → 関連email_jobs削除: ${systemEmailJobs.changes}件`);

  const delSystem = db.prepare(
    "DELETE FROM notifications WHERE user_key = 'system'"
  ).run();
  console.log(`    → system通知削除: ${delSystem.changes}件`);
}

// 2. to_email = "demo@example.com" の email_jobs を削除
const demoEmails = db.prepare(
  "SELECT COUNT(*) as count FROM email_jobs WHERE to_email = 'demo@example.com'"
).get();
console.log(`\n  demo@example.com宛メール: ${demoEmails.count}件`);
if (demoEmails.count > 0) {
  const delDemo = db.prepare(
    "DELETE FROM email_jobs WHERE to_email = 'demo@example.com'"
  ).run();
  console.log(`    → 削除: ${delDemo.changes}件`);
}

// 3. 残留 demo-user-* データ確認
const demoUserNotifs = db.prepare(
  "SELECT COUNT(*) as count FROM notifications WHERE user_key LIKE 'demo-user-%'"
).get();
console.log(`\n  demo-user-*通知: ${demoUserNotifs.count}件`);
if (demoUserNotifs.count > 0) {
  const delDemoNotifs = db.prepare(
    "DELETE FROM notifications WHERE user_key LIKE 'demo-user-%'"
  ).run();
  console.log(`    → 削除: ${delDemoNotifs.changes}件`);
}

// 4. 現在の状態レポート
console.log("\n--- 現在の状態 ---");
const notifCount = db.prepare("SELECT COUNT(*) as count FROM notifications").get();
const emailCount = db.prepare("SELECT COUNT(*) as count FROM email_jobs").get();
const userCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE is_active = 1").get();
console.log(`  通知: ${notifCount.count}件`);
console.log(`  メールキュー: ${emailCount.count}件`);
console.log(`  アクティブユーザー: ${userCount.count}人`);

// ユーザー別通知件数
const userNotifs = db.prepare(`
  SELECT n.user_key, u.email, COUNT(*) as count
  FROM notifications n
  LEFT JOIN users u ON n.user_key = CAST(u.id AS TEXT)
  GROUP BY n.user_key
`).all();
if (userNotifs.length > 0) {
  console.log("\n  ユーザー別通知:");
  for (const row of userNotifs) {
    console.log(`    user_key=${row.user_key} (${row.email || "不明"}): ${row.count}件`);
  }
}

console.log("\n=== 完了 ===");
db.close();
