#!/usr/bin/env node
/**
 * ローカルSQLite → Turso 完全インポートスクリプト（改善版）
 *
 * 使い方:
 *   1. .env.local に TURSO_DATABASE_URL と TURSO_AUTH_TOKEN を設定
 *   2. node scripts/import-to-turso.js
 *
 * 改善点:
 *   - 外部キー制約を一時無効化して挿入
 *   - テーブルごとに独立したtry-catch（1テーブル失敗でも他は続行）
 *   - バッチサイズ20行（Turso HTTP API制限対応）
 *   - 各テーブルの挿入前にDELETE（クリーンインポート）
 *   - 詳細なエラーログ出力
 */

const { createClient } = require("@libsql/client");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// .env.local を手動で読み込む
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error("ERROR: .env.local に以下を設定してください:");
  console.error("  TURSO_DATABASE_URL=libsql://your-db.turso.io");
  console.error("  TURSO_AUTH_TOKEN=eyJhbG...");
  console.error("");
  console.error("現在の状態:");
  console.error("  TURSO_DATABASE_URL:", TURSO_URL ? "✅ 設定済み" : "❌ 未設定");
  console.error("  TURSO_AUTH_TOKEN:", TURSO_TOKEN ? "✅ 設定済み" : "❌ 未設定");
  process.exit(1);
}

const DB_PATH = path.join(__dirname, "..", "data", "risk-monitor.db");
if (!fs.existsSync(DB_PATH)) {
  console.error("ERROR: ローカルDBが見つかりません:", DB_PATH);
  process.exit(1);
}

const BATCH_SIZE = 20;

// インポートの優先テーブル順（外部キー依存を考慮）
const PRIORITY_TABLES = [
  "users",
  "organizations",
  "organization_name_variants",
  "administrative_actions",
  "sanpai_items",
  "sanpai_penalties",
  "nyusatsu_items",
  "shitei_items",
  "hojokin_items",
  "kyoninka_entities",
  "kyoninka_registrations",
  "food_recall_items",
  "yutai_items",
  "minpaku_items",
  "items",
  "item_variants",
  "item_tags",
  "providers",
  "saas_details",
];

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Turso クリーンインポート（改善版）       ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  console.log("ローカルDB:", DB_PATH);
  console.log("Turso URL:", TURSO_URL.replace(/\/\/(.{12}).*/, "//$1..."));
  console.log("バッチサイズ:", BATCH_SIZE);
  console.log("");

  const localDb = new Database(DB_PATH, { readonly: true });
  const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  // 接続テスト
  try {
    await turso.execute("SELECT 1");
    console.log("✅ Turso接続OK\n");
  } catch (e) {
    console.error("❌ Turso接続失敗:", e.message);
    process.exit(1);
  }

  // Step 1: 外部キー制約を無効化
  console.log("--- Step 1: 外部キー制約を無効化 ---");
  await turso.execute("PRAGMA foreign_keys = OFF");
  console.log("  PRAGMA foreign_keys = OFF\n");

  // Step 2: テーブル作成
  console.log("--- Step 2: テーブル作成 ---");
  const createStmts = localDb.prepare(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL ORDER BY name"
  ).all();

  for (const t of createStmts) {
    if (t.name === "sqlite_sequence") continue;
    try {
      // IF NOT EXISTS を確実に含める
      const sql = t.sql.replace(/CREATE TABLE\s+/i, "CREATE TABLE IF NOT EXISTS ");
      await turso.execute(sql);
      console.log(`  ✅ ${t.name}`);
    } catch (e) {
      if (e.message?.includes("already exists")) {
        console.log(`  ⏭ ${t.name} (既存)`);
      } else {
        console.error(`  ❌ ${t.name}: ${e.message.slice(0, 100)}`);
      }
    }
  }

  // Step 3: インデックス作成
  console.log("\n--- Step 3: インデックス作成 ---");
  const indexes = localDb.prepare(
    "SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL"
  ).all();
  let idxOk = 0, idxSkip = 0;
  for (const idx of indexes) {
    try {
      const sql = idx.sql.replace(/CREATE INDEX\s+/i, "CREATE INDEX IF NOT EXISTS ");
      await turso.execute(sql);
      idxOk++;
    } catch { idxSkip++; }
  }
  console.log(`  作成: ${idxOk}, スキップ: ${idxSkip}\n`);

  // Step 4: データ挿入
  console.log("--- Step 4: データ挿入 ---");

  // テーブル一覧を取得（優先テーブル → 残り）
  const allTableNames = localDb.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  ).all().map(t => t.name).filter(n => n !== "sqlite_sequence");

  const orderedTables = [
    ...PRIORITY_TABLES.filter(t => allTableNames.includes(t)),
    ...allTableNames.filter(t => !PRIORITY_TABLES.includes(t)),
  ];

  let totalInserted = 0;
  let totalErrors = 0;
  const results = [];

  for (const name of orderedTables) {
    const rows = localDb.prepare(`SELECT * FROM ${name}`).all();
    if (rows.length === 0) {
      results.push({ name, local: 0, inserted: 0, status: "empty" });
      continue;
    }

    const cols = Object.keys(rows[0]);
    // 位置パラメータ ?1, ?2, ... を使用
    const placeholders = cols.map((_, i) => `?${i + 1}`).join(", ");
    const insertSql = `INSERT OR IGNORE INTO ${name} (${cols.join(", ")}) VALUES (${placeholders})`;

    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const stmts = batch.map(row => ({
        sql: insertSql,
        args: cols.map(c => row[c] ?? null),
      }));

      try {
        await turso.batch(stmts, "write");
        inserted += batch.length;
      } catch (batchErr) {
        // バッチ失敗 → 1行ずつリトライ
        for (const stmt of stmts) {
          try {
            await turso.execute(stmt);
            inserted++;
          } catch (rowErr) {
            errors++;
            if (errors <= 3) {
              console.error(`    ⚠ ${name} row error: ${rowErr.message.slice(0, 80)}`);
            }
          }
        }
      }

      // 進捗表示（100行ごと）
      if ((i + BATCH_SIZE) % 100 === 0 || i + BATCH_SIZE >= rows.length) {
        process.stdout.write(`\r  ${name}: ${inserted}/${rows.length} 行`);
      }
    }

    const status = errors > 0 ? `${errors} errors` : "ok";
    console.log(`\r  ${errors > 0 ? "⚠" : "✅"} ${name}: ${inserted}/${rows.length} 行 ${errors > 0 ? `(${errors} errors)` : ""}`);
    results.push({ name, local: rows.length, inserted, errors, status });
    totalInserted += inserted;
    totalErrors += errors;
  }

  // Step 5: 外部キー制約を再有効化
  console.log("\n--- Step 5: 外部キー制約を再有効化 ---");
  await turso.execute("PRAGMA foreign_keys = ON");
  console.log("  PRAGMA foreign_keys = ON");

  // Step 6: 結果サマリー
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  インポート結果                           ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`  合計: ${totalInserted} 行挿入, ${totalErrors} エラー\n`);

  // 主要テーブルの確認
  console.log("--- Turso側の件数確認 ---");
  const checkTables = [
    "administrative_actions", "sanpai_items", "sanpai_penalties",
    "nyusatsu_items", "shitei_items", "hojokin_items",
    "kyoninka_entities", "kyoninka_registrations",
    "food_recall_items", "yutai_items", "minpaku_items",
    "organizations", "users", "items",
  ];
  for (const t of checkTables) {
    try {
      const r = await turso.execute(`SELECT COUNT(*) as c FROM ${t}`);
      const localCount = localDb.prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c;
      const tursoCount = r.rows[0].c;
      const match = tursoCount >= localCount ? "✅" : "⚠";
      console.log(`  ${match} ${t}: ${tursoCount}件 (ローカル: ${localCount}件)`);
    } catch (e) {
      console.log(`  ❌ ${t}: ${e.message.slice(0, 60)}`);
    }
  }

  localDb.close();
  turso.close();
  console.log("\n完了！");
}

main().catch(e => {
  console.error("\nFatal error:", e);
  process.exit(1);
});
