#!/usr/bin/env node
/**
 * 情報源台帳の全URL到達性監査（CLI 版）。
 *
 * 管理画面の「到達性監査」ボタンと同じロジックを呼び出し、
 * コンソール + GitHub Step Summary に結果を出力する。
 *
 * 使い方:
 *   node scripts/audit-sources.mjs [--only-errors]
 *
 * 動作:
 *   - registry の全有効ソースに対し HTTP GET → 状態判定
 *   - 結果を集計（ok / warn / error / 未設定）
 *   - error/warn のみリストアップ
 *   - GitHub Step Summary に markdown 出力
 *   - error が1件以上あれば exit code 1（workflow 失敗→Issue 起票）
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const onlyErrors = process.argv.includes("--only-errors");

// .env.local 読み込み
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);

const { SOURCE_REGISTRY, SECTORS, DISCOVERY_STATUS_LABELS } = await import("../lib/gyosei-shobun-source-registry.js");
const { auditAllSources } = await import("../lib/gyosei-shobun-source-audit.js");

const start = Date.now();
console.log(`[audit-sources] 監査開始: ${SOURCE_REGISTRY.length}件`);

const results = await auditAllSources(SOURCE_REGISTRY);
const elapsed = ((Date.now() - start) / 1000).toFixed(1);

const counts = { ok: 0, warn: 0, error: 0, unknown: 0 };
results.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });

console.log(`\n=== 監査結果（${elapsed}s） ===`);
console.log(`  到達OK    : ${counts.ok}`);
console.log(`  警告      : ${counts.warn}`);
console.log(`  エラー    : ${counts.error}`);
console.log(`  不明      : ${counts.unknown || 0}`);
console.log();

// エラー詳細
const errors = results.filter((r) => r.status === "error");
const warns = results.filter((r) => r.status === "warn");

if (errors.length > 0) {
  console.log(`=== エラー ${errors.length}件 ===`);
  for (const r of errors) {
    const src = SOURCE_REGISTRY.find((s) => s.id === r.sourceId);
    const sector = SECTORS[src?.sector]?.short || src?.sector || "?";
    const statusLabel = DISCOVERY_STATUS_LABELS[src?.discoveryStatus]?.label || src?.discoveryStatus;
    console.log(`  [${sector}][${statusLabel}] ${r.sourceId}`);
    console.log(`    URL: ${src?.url}`);
    console.log(`    note: ${r.note}`);
  }
  console.log();
}

if (warns.length > 0 && !onlyErrors) {
  console.log(`=== 警告 ${warns.length}件 ===`);
  for (const r of warns) {
    const src = SOURCE_REGISTRY.find((s) => s.id === r.sourceId);
    const sector = SECTORS[src?.sector]?.short || src?.sector || "?";
    console.log(`  [${sector}] ${r.sourceId}: ${r.note}`);
  }
  console.log();
}

// GitHub Step Summary
if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "## 📡 情報源台帳 到達性監査結果",
    "",
    `- 対象: **${SOURCE_REGISTRY.length}件**`,
    `- 所要時間: ${elapsed}s`,
    "",
    "| 状態 | 件数 |",
    "|------|------|",
    `| 🟢 到達OK | ${counts.ok} |`,
    `| 🟡 警告 | ${counts.warn} |`,
    `| 🔴 エラー | ${counts.error} |`,
    "",
  ];

  if (errors.length > 0) {
    lines.push(`### 🔴 エラー (${errors.length}件)`, "");
    lines.push("| セクター | 登録状態 | ID | 理由 | URL |", "|---|---|---|---|---|");
    for (const r of errors) {
      const src = SOURCE_REGISTRY.find((s) => s.id === r.sourceId);
      const sector = SECTORS[src?.sector]?.short || src?.sector || "?";
      const statusLabel = DISCOVERY_STATUS_LABELS[src?.discoveryStatus]?.label || src?.discoveryStatus;
      lines.push(`| ${sector} | ${statusLabel} | ${r.sourceId} | ${r.note} | ${src?.url || "-"} |`);
    }
    lines.push("");
  }

  if (warns.length > 0) {
    lines.push(`### 🟡 警告 (${warns.length}件)`, "");
    lines.push("| セクター | ID | 理由 |", "|---|---|---|");
    for (const r of warns) {
      const src = SOURCE_REGISTRY.find((s) => s.id === r.sourceId);
      const sector = SECTORS[src?.sector]?.short || src?.sector || "?";
      lines.push(`| ${sector} | ${r.sourceId} | ${r.note} |`);
    }
    lines.push("");
  }

  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

// エラー1件以上で失敗扱い（Issue 起票トリガ）
process.exit(errors.length > 0 ? 1 : 0);
