#!/usr/bin/env node
/**
 * Analyzer CLI — 入札落札結果の集計
 *
 * サブコマンド:
 *   ranking   落札ランキング（entity/cluster/issuer × count/amount）
 *   timeline  月別/年別の落札推移
 *   buyers    特定落札者の発注機関内訳 + concentration_score
 *
 * 使い方:
 *   node scripts/analyze-nyusatsu.mjs ranking [--by entity|cluster|issuer]
 *                                             [--metric count|amount] [--limit 20]
 *                                             [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *                                             [--category CAT] [--local]
 *
 *   node scripts/analyze-nyusatsu.mjs timeline [--granularity month|year]
 *                                              [--entity-id N | --cluster-id N | --issuer NAME]
 *                                              [--from ...] [--to ...] [--local]
 *
 *   node scripts/analyze-nyusatsu.mjs buyers   (--entity-id N | --cluster-id N)
 *                                              [--limit 20] [--from ...] [--to ...] [--local]
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const cmd = argv[0];
const opts = argv.slice(1);
const argVal = (name) => {
  const i = opts.indexOf(`--${name}`);
  return i >= 0 ? opts[i + 1] : null;
};
const hasFlag = (name) => opts.includes(`--${name}`);

const useLocal = hasFlag("local");

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (useLocal) {
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
}
if (!useLocal && (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)) {
  console.error("[analyze-nyusatsu] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");
const { getAwardRanking, getAwardTimeline, getBuyerRelations } = await import(
  "../lib/agents/analyzer/nyusatsu/index.js"
);
const db = getDb();

const fmtNum = (n) => (typeof n === "number" ? n.toLocaleString() : String(n ?? "-"));
const fmtAmount = (n) => (n ? "¥" + Math.round(n).toLocaleString() : "-");

switch (cmd) {
  case "ranking": {
    const by = argVal("by") || "entity";
    const metric = argVal("metric") || "count";
    const limit = parseInt(argVal("limit") || "20", 10);
    const r = getAwardRanking({
      db, by, metric, limit,
      dateFrom: argVal("from") || undefined,
      dateTo:   argVal("to")   || undefined,
      category: argVal("category") || undefined,
    });
    console.log(`\n=== Ranking: by=${by} metric=${metric} limit=${limit} (${r.length}件) ===`);
    console.log("rank\tcount\tamount\t\tbuyers\tmonths\tname");
    r.forEach((row, i) => {
      console.log(
        `${i + 1}\t${fmtNum(row.total_awards)}\t${fmtAmount(row.total_amount)}\t${fmtNum(row.unique_buyers)}\t${row.active_months}\t${row.group_name ?? "(unnamed)"}`
      );
    });
    break;
  }

  case "timeline": {
    const granularity = argVal("granularity") || "month";
    const entityId  = argVal("entity-id")  ? parseInt(argVal("entity-id"), 10)  : undefined;
    const clusterId = argVal("cluster-id") ? parseInt(argVal("cluster-id"), 10) : undefined;
    const issuerName = argVal("issuer") || undefined;
    const r = getAwardTimeline({
      db, granularity, entityId, clusterId, issuerName,
      dateFrom: argVal("from") || undefined,
      dateTo:   argVal("to")   || undefined,
      category: argVal("category") || undefined,
    });
    console.log(`\n=== Timeline: granularity=${granularity} target=${entityId ? `entity#${entityId}` : clusterId ? `cluster#${clusterId}` : issuerName || "all"} (${r.length}期間) ===`);
    console.log("period\tcount\tamount\t\tbuyers\twinners");
    for (const row of r) {
      console.log(
        `${row.period}\t${fmtNum(row.total_awards)}\t${fmtAmount(row.total_amount)}\t${fmtNum(row.unique_buyers)}\t${fmtNum(row.unique_winners)}`
      );
    }
    break;
  }

  case "buyers": {
    const entityId  = argVal("entity-id")  ? parseInt(argVal("entity-id"), 10)  : undefined;
    const clusterId = argVal("cluster-id") ? parseInt(argVal("cluster-id"), 10) : undefined;
    if (entityId == null && clusterId == null) {
      console.error("[buyers] --entity-id または --cluster-id を指定してください");
      process.exit(1);
    }
    const limit = parseInt(argVal("limit") || "20", 10);
    const r = getBuyerRelations({
      db, entityId, clusterId, limit,
      dateFrom: argVal("from") || undefined,
      dateTo:   argVal("to")   || undefined,
      category: argVal("category") || undefined,
    });
    console.log(`\n=== Buyer Relations: ${entityId ? `entity#${entityId}` : `cluster#${clusterId}`} ===`);
    console.log(`  total_awards:         ${fmtNum(r.total_awards)}`);
    console.log(`  total_amount:         ${fmtAmount(r.total_amount)}`);
    console.log(`  concentration_count:  ${r.concentration_count}  (1.0=完全1機関依存)`);
    console.log(`  concentration_amount: ${r.concentration_amount}`);
    console.log(`  top_issuer:           ${r.top_issuer || "-"}`);
    console.log(`\n  --- 上位 ${r.items.length} 発注機関 ---`);
    console.log("  share_c\tshare_a\tcount\tamount\t\tissuer");
    for (const it of r.items) {
      console.log(
        `  ${(it.share_count * 100).toFixed(1)}%\t${(it.share_amount * 100).toFixed(1)}%\t${fmtNum(it.count)}\t${fmtAmount(it.total_amount)}\t${it.issuer_name}`
      );
    }
    break;
  }

  default:
    console.error("Usage: analyze-nyusatsu.mjs <ranking|timeline|buyers> [options]");
    console.error("例:");
    console.error("  analyze-nyusatsu.mjs ranking --by entity --metric count --limit 10 --local");
    console.error("  analyze-nyusatsu.mjs timeline --granularity month --entity-id 42 --local");
    console.error("  analyze-nyusatsu.mjs buyers --entity-id 42 --local");
    process.exit(1);
}
