/**
 * ユーザーseedスクリプト
 *
 * Usage:
 *   node scripts/seed-users.js
 */

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const webRequire = createRequire(
  path.join(__dirname, "..", "web", "package.json")
);
const Database = webRequire("better-sqlite3");
const bcrypt = webRequire("bcryptjs");

const DB_PATH = path.join(__dirname, "..", "web", "data", "sports-event.db");
const SCHEMA_PATH = path.join(__dirname, "..", "sql", "001_create_tables.sql");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

if (fs.existsSync(SCHEMA_PATH)) {
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf-8"));
}

const users = [
  {
    email: "admin@example.com",
    password: "admin123",
    name: "管理者",
    role: "admin",
  },
  {
    email: "user@example.com",
    password: "user1234",
    name: "テストユーザー",
    role: "user",
  },
];

console.log("=== ユーザーseed ===\n");

for (const u of users) {
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(u.email);
  if (existing) {
    console.log(`  スキップ: ${u.email} (既存 id=${existing.id})`);
    continue;
  }
  const hash = bcrypt.hashSync(u.password, 10);
  const result = db
    .prepare(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)"
    )
    .run(u.email, hash, u.name, u.role);
  console.log(
    `  作成: ${u.email} (id=${result.lastInsertRowid}, role=${u.role})`
  );
}

// 旧 demo-user-1 データを admin ユーザーに移行
const adminUser = db
  .prepare("SELECT id FROM users WHERE email = 'admin@example.com'")
  .get();
if (adminUser) {
  const adminKey = String(adminUser.id);
  const tables = ["favorites", "saved_searches", "notification_settings"];
  for (const table of tables) {
    const updated = db
      .prepare(`UPDATE ${table} SET user_key = ? WHERE user_key = 'demo-user-1'`)
      .run(adminKey);
    if (updated.changes > 0) {
      console.log(
        `  移行: ${table} demo-user-1 → ${adminKey} (${updated.changes}件)`
      );
    }
  }
  // notifications の user_key 移行（system以外）
  const notifUpdated = db
    .prepare(
      "UPDATE notifications SET user_key = ? WHERE user_key = 'demo-user-1'"
    )
    .run(adminKey);
  if (notifUpdated.changes > 0) {
    console.log(
      `  移行: notifications demo-user-1 → ${adminKey} (${notifUpdated.changes}件)`
    );
  }
  // demo-user-2 → user ユーザーに移行
  const normalUser = db
    .prepare("SELECT id FROM users WHERE email = 'user@example.com'")
    .get();
  if (normalUser) {
    const userKey = String(normalUser.id);
    for (const table of [
      "favorites",
      "saved_searches",
      "notification_settings",
      "notifications",
    ]) {
      const updated = db
        .prepare(
          `UPDATE ${table} SET user_key = ? WHERE user_key = 'demo-user-2'`
        )
        .run(userKey);
      if (updated.changes > 0) {
        console.log(
          `  移行: ${table} demo-user-2 → ${userKey} (${updated.changes}件)`
        );
      }
    }
  }
}

// email_jobs の user_key も移行
if (adminUser) {
  const adminKey = String(adminUser.id);
  const emailUpdated = db
    .prepare(
      "UPDATE email_jobs SET user_key = ? WHERE user_key = 'demo-user-1'"
    )
    .run(adminKey);
  if (emailUpdated.changes > 0) {
    console.log(
      `  移行: email_jobs demo-user-1 → ${adminKey} (${emailUpdated.changes}件)`
    );
  }
}

const allUsers = db.prepare("SELECT id, email, name, role FROM users").all();
console.log("\n--- 全ユーザー ---");
for (const u of allUsers) {
  console.log(`  #${u.id} ${u.email} (${u.name}) [${u.role}]`);
}

console.log("\n=== 完了 ===");
db.close();
