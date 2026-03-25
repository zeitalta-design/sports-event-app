#!/usr/bin/env node

/**
 * 比較サイト OS — 全ドメイン import 一括実行 CLI
 *
 * scheduler / cron から安全に起動するための共通エントリポイント。
 * 各ドメインの既存 import script を子プロセスで実行する。
 *
 * Usage:
 *   node scripts/run-imports.js --all [options]
 *   node scripts/run-imports.js --domain <name> [options]
 *
 * Options:
 *   --all                全ドメイン実行
 *   --domain <name>      単一ドメイン実行
 *   --source <name>      source adapter 経由で実行 (primary)
 *   --dry-run            DB を更新しない
 *   --verbose            詳細ログ
 *   --limit <N>          先頭 N 件のみ
 *   --fail-fast          最初の失敗で停止（デフォルト: continue-on-error）
 *
 * Modes:
 *   --source primary     → 各ドメインの {KEY}_SOURCE_PRIMARY_URL を使用
 *   (source なし)        → 各ドメインの {KEY}_IMPORT_URL を使用（既存 remote）
 *
 * Examples:
 *   node scripts/run-imports.js --all --source primary --dry-run
 *   node scripts/run-imports.js --domain yutai --source primary --verbose
 *   node scripts/run-imports.js --all --dry-run
 */

import "dotenv/config";
import { execFile } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── ドメイン定義 ───────────────────────

const DOMAINS = {
  yutai: {
    name: "株主優待ナビ",
    script: resolve(__dirname, "import-yutai.js"),
    envKey: "YUTAI_IMPORT_URL",
    sourceSupported: true,
  },
  hojokin: {
    name: "補助金ナビ",
    script: resolve(__dirname, "import-hojokin.js"),
    envKey: "HOJOKIN_IMPORT_URL",
    sourceSupported: true,
  },
  nyusatsu: {
    name: "入札ナビ",
    script: resolve(__dirname, "import-nyusatsu.js"),
    envKey: "NYUSATSU_IMPORT_URL",
    sourceSupported: true,
  },
  minpaku: {
    name: "民泊ナビ",
    script: resolve(__dirname, "import-minpaku.js"),
    envKey: "MINPAKU_IMPORT_URL",
    sourceSupported: true,
  },
};

// ─── 引数パース ─────────────────────────

const args = process.argv.slice(2);
let all = false;
let domainKey = null;
let sourceName = null;
let dryRun = false;
let verbose = false;
let limit = 0;
let failFast = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--all") all = true;
  else if (args[i] === "--domain" && args[i + 1]) domainKey = args[++i];
  else if (args[i] === "--source" && args[i + 1]) sourceName = args[++i];
  else if (args[i] === "--dry-run") dryRun = true;
  else if (args[i] === "--verbose") verbose = true;
  else if (args[i] === "--limit" && args[i + 1]) limit = parseInt(args[++i], 10);
  else if (args[i] === "--fail-fast") failFast = true;
}

if (!all && !domainKey) {
  console.error(`
Usage:
  node scripts/run-imports.js --all [options]
  node scripts/run-imports.js --domain <name> [options]

Options:
  --all              全ドメイン実行
  --domain <name>    単一ドメイン (${Object.keys(DOMAINS).join("|")})
  --source <name>    source adapter (primary)
  --dry-run          DB を更新しない
  --verbose          詳細ログ
  --limit <N>        先頭 N 件のみ
  --fail-fast        最初の失敗で停止
`);
  process.exit(1);
}

if (all && domainKey) {
  console.error("❌ --all と --domain は同時に指定できません");
  process.exit(1);
}

if (domainKey && !DOMAINS[domainKey]) {
  console.error(`❌ 不明なドメイン: ${domainKey}\n   有効なドメイン: ${Object.keys(DOMAINS).join(", ")}`);
  process.exit(1);
}

const targetDomains = all ? Object.keys(DOMAINS) : [domainKey];
const useSource = !!sourceName;

// ─── 子プロセス実行 ─────────────────────

function runImportScript(domain) {
  return new Promise((resolveP) => {
    const config = DOMAINS[domain];

    // source モード
    if (useSource) {
      if (!config.sourceSupported) {
        resolveP({ domain, status: "skipped", error: `source モード未対応` });
        return;
      }
      // source では env チェックは import script 側で行うため、ここでは --source を渡すだけ
      const scriptArgs = ["--source", sourceName];
      if (dryRun) scriptArgs.push("--dry-run");
      if (verbose) scriptArgs.push("--verbose");
      if (limit > 0) scriptArgs.push("--limit", String(limit));

      execFile("node", [config.script, ...scriptArgs], {
        env: { ...process.env },
        timeout: 120000,
      }, (error, stdout) => {
        if (error) {
          resolveP({ domain, status: "error", error: error.message, stdout: stdout || "" });
        } else {
          resolveP({ domain, status: "success", report: parseReport(stdout), stdout });
        }
      });
      return;
    }

    // remote モード（既存）
    const url = process.env[config.envKey];
    if (!url) {
      resolveP({ domain, status: "error", error: `環境変数 ${config.envKey} が未設定です` });
      return;
    }

    const scriptArgs = ["--remote", url];
    if (dryRun) scriptArgs.push("--dry-run");
    if (verbose) scriptArgs.push("--verbose");
    if (limit > 0) scriptArgs.push("--limit", String(limit));

    execFile("node", [config.script, ...scriptArgs], {
      env: { ...process.env },
      timeout: 120000,
    }, (error, stdout) => {
      if (error) {
        resolveP({ domain, status: "error", error: error.message, stdout: stdout || "" });
      } else {
        resolveP({ domain, status: "success", report: parseReport(stdout), stdout });
      }
    });
  });
}

function parseReport(stdout) {
  const match = (key) => {
    const m = stdout.match(new RegExp(`${key}:\\s*(\\d+)`));
    return m ? parseInt(m[1], 10) : 0;
  };
  return {
    total: match("入力件数"),
    valid: match("有効件数"),
    inserted: match("INSERT"),
    updated: match("UPDATE"),
    skipped: match("スキップ"),
    errors: match("エラー"),
  };
}

// ─── メイン実行 ──────────────────────────

const modeLabel = useSource ? `source:${sourceName}` : "remote (env)";

console.log(`\n🚀 比較サイト OS — 一括 import`);
console.log(`   対象: ${targetDomains.map((d) => DOMAINS[d].name).join(", ")}`);
console.log(`   実行モード: ${modeLabel}`);
console.log(`   dry-run: ${dryRun ? "ON" : "OFF"}`);
if (failFast) console.log(`   fail-fast: ON`);
console.log(`   ${new Date().toISOString()}`);
console.log("─".repeat(50));

const results = [];

for (const domain of targetDomains) {
  const config = DOMAINS[domain];
  console.log(`\n▶ ${config.name} (${domain})...`);

  const result = await runImportScript(domain);
  results.push(result);

  if (result.status === "success") {
    const r = result.report;
    if (dryRun) {
      console.log(`  ✅ dry-run 完了 (valid=${r.valid}, skipped=${r.skipped})`);
    } else {
      console.log(`  ✅ 完了 (inserted=${r.inserted}, updated=${r.updated}, skipped=${r.skipped})`);
    }
  } else if (result.status === "skipped") {
    console.log(`  ⏭️  スキップ: ${result.error}`);
  } else {
    console.log(`  ❌ エラー: ${result.error}`);
    if (failFast) {
      console.log(`\n⚠️  --fail-fast: 残りのドメインをスキップします`);
      break;
    }
  }
}

// ─── サマリー ────────────────────────────

console.log("\n" + "═".repeat(50));
console.log("📋 Summary");
console.log("═".repeat(50));

let hasError = false;
for (const r of results) {
  const config = DOMAINS[r.domain];
  const prefix = useSource ? `source=${sourceName} ` : "";
  if (r.status === "success") {
    const rp = r.report;
    if (dryRun) {
      console.log(`  ${config.name}: ${prefix}dry-run success (valid=${rp.valid}, skipped=${rp.skipped})`);
    } else {
      console.log(`  ${config.name}: ${prefix}success (inserted=${rp.inserted}, updated=${rp.updated}, skipped=${rp.skipped})`);
    }
  } else if (r.status === "skipped") {
    console.log(`  ${config.name}: SKIPPED (${r.error})`);
  } else {
    hasError = true;
    console.log(`  ${config.name}: FAILED (${r.error})`);
  }
}

// fail-fast でスキップされたドメイン
const executed = new Set(results.map((r) => r.domain));
for (const domain of targetDomains) {
  if (!executed.has(domain)) {
    console.log(`  ${DOMAINS[domain].name}: SKIPPED (fail-fast)`);
  }
}

console.log();
if (hasError) process.exit(1);
