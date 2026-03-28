/**
 * 失敗巡回の自動再試行スクリプト
 *
 * 毎朝 cron で実行し、直近の巡回が失敗したソースのみ再試行する。
 *
 * ルール:
 * - 直近の scheduled/retry ログが failed のソースだけ対象
 * - 最大2回まで retry（retry_count >= 2 なら打ち切り）
 * - retry 成功 → 完了
 * - retry 失敗 → ログに記録、次回の retry で再試行（上限まで）
 *
 * Usage:
 *   node scripts/retry-failed-scrapes.js
 *   node scripts/retry-failed-scrapes.js --dry-run
 *   node scripts/retry-failed-scrapes.js --verbose
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");

const webRequire = createRequire(
  path.join(__dirname, "..", "web", "package.json")
);
const Database = webRequire("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "web", "data", "sports-event.db");
const SCHEMA_PATH = path.join(__dirname, "..", "sql", "001_create_tables.sql");

const MAX_RETRIES = 2;

const SCRAPE_COMMANDS = {
  runnet: { script: "scripts/scrape-runnet-list.js", args: ["--pages", "all"] },
  sportsentry: { script: "scripts/scrape-sportsentry-list.js", args: ["--pages", "all"] },
  moshicom: { script: "scripts/scrape-moshicom-list.js", args: ["--pages", "all"] },
};

function getDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);
  return db;
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
    verbose: args.includes("--verbose") || args.includes("-v"),
  };
}

function main() {
  const opts = parseArgs();
  const db = getDb();
  const now = new Date().toISOString();

  console.log("=== Retry Failed Scrapes ===");
  console.log(`  ${now}`);
  if (opts.dryRun) console.log("  *** DRY RUN ***");

  const sources = Object.keys(SCRAPE_COMMANDS);
  let retried = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const source of sources) {
    // 直近のログを取得
    const lastLog = db.prepare(
      `SELECT * FROM scraping_logs WHERE source_name = ? ORDER BY created_at DESC LIMIT 1`
    ).get(source);

    // 直近ログが failed でなければスキップ
    if (!lastLog || lastLog.status !== "failed") {
      if (opts.verbose) console.log(`  [${source}] OK or no logs — skip`);
      skipped++;
      continue;
    }

    // retry 回数をカウント（直近の scheduled 以降の retry 数）
    const lastScheduled = db.prepare(
      `SELECT created_at FROM scraping_logs WHERE source_name = ? AND job_type = 'scheduled' ORDER BY created_at DESC LIMIT 1`
    ).get(source);

    const retryCount = lastScheduled
      ? db.prepare(
          `SELECT COUNT(*) as c FROM scraping_logs WHERE source_name = ? AND job_type = 'retry' AND created_at > ?`
        ).get(source, lastScheduled.created_at)?.c || 0
      : db.prepare(
          `SELECT COUNT(*) as c FROM scraping_logs WHERE source_name = ? AND job_type = 'retry'`
        ).get(source)?.c || 0;

    if (retryCount >= MAX_RETRIES) {
      console.log(`  [${source}] 最大再試行回数 (${MAX_RETRIES}) に到達 — 手動確認が必要`);
      skipped++;
      continue;
    }

    console.log(`  [${source}] 失敗検出 — 再試行 ${retryCount + 1}/${MAX_RETRIES}`);

    if (opts.dryRun) {
      console.log(`    (dry-run: skipped)`);
      skipped++;
      continue;
    }

    // 再試行実行
    const cmd = SCRAPE_COMMANDS[source];
    const scriptPath = path.join(__dirname, "..", cmd.script);
    const startedAt = new Date().toISOString();

    try {
      const output = execSync(`node ${scriptPath} ${cmd.args.join(" ")}`, {
        cwd: path.join(__dirname, ".."),
        encoding: "utf-8",
        timeout: 600_000,
        stdio: ["ignore", "pipe", "pipe"],
      });

      // 結果パース
      const insertedMatch = output.match(/Inserted:\s*(\d+)/);
      const updatedMatch = output.match(/Updated:\s*(\d+)/);
      const totalMatch = output.match(/Total.*?:\s*(\d+)/);
      const inserted = insertedMatch ? parseInt(insertedMatch[1]) : 0;
      const updated = updatedMatch ? parseInt(updatedMatch[1]) : 0;

      // 0件でも成功扱い（soft-fail判定は別途）
      const finishedAt = new Date().toISOString();

      db.prepare(`
        INSERT INTO scraping_logs (source_name, job_type, status, success_count, fail_count, new_count, update_count, error_summary, started_at, finished_at, created_at)
        VALUES (?, 'retry', 'success', 1, 0, ?, ?, NULL, ?, ?, ?)
      `).run(source, inserted, updated, startedAt, finishedAt, finishedAt);

      console.log(`    ✅ 再試行成功: inserted=${inserted}, updated=${updated}`);
      retried++;
      succeeded++;
    } catch (err) {
      const finishedAt = new Date().toISOString();
      const errorMsg = (err.message || "").substring(0, 500);

      db.prepare(`
        INSERT INTO scraping_logs (source_name, job_type, status, success_count, fail_count, new_count, update_count, error_summary, started_at, finished_at, created_at)
        VALUES (?, 'retry', 'failed', 0, 1, 0, 0, ?, ?, ?, ?)
      `).run(source, errorMsg, startedAt, finishedAt, finishedAt);

      console.log(`    ❌ 再試行失敗: ${errorMsg.substring(0, 100)}`);
      retried++;
      failed++;
    }
  }

  db.close();

  console.log(`\n=== 完了 ===`);
  console.log(`  再試行: ${retried}, 成功: ${succeeded}, 失敗: ${failed}, スキップ: ${skipped}`);
}

main();
