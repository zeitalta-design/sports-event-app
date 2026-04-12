/**
 * 行政処分DB — MLIT自動取得モジュール（Cron/API用軽量版）
 *
 * Vercelのサーバーレス環境（最大60秒タイムアウト）を考慮し、
 * 1回の実行で最大3ページ（30件）まで取得する。
 */

import { getDb } from "@/lib/db";

const SEARCH_URL = "https://www.mlit.go.jp/nega-inf/cgi-bin/search.cgi";
const PAGE_DELAY_MS = 1500;
const MAX_PAGES_PER_RUN = 3; // Vercelタイムアウト考慮

const SECTOR_DEFS = {
  kensetugyousya: {
    searchParam: "kensetugyousya",
    industry: "construction",
    sourceName: "国土交通省ネガティブ情報",
  },
  takuti: {
    searchParam: "takuti",
    industry: "real_estate",
    sourceName: "国土交通省ネガティブ情報（宅建）",
  },
};

const ACTION_TYPE_MAP = {
  "許可の取消": "license_revocation",
  "取消": "license_revocation",
  "営業の停止": "business_suspension",
  "営業停止": "business_suspension",
  "指示": "warning",
  "指示処分": "warning",
  "勧告": "guidance",
  "改善命令": "improvement_order",
};

function normalizeActionType(raw) {
  if (!raw) return "other";
  for (const [key, val] of Object.entries(ACTION_TYPE_MAP)) {
    if (raw.includes(key)) return val;
  }
  return "other";
}

function generateSlug(item, sector) {
  const name = (item.company_name || "unknown").replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "").slice(0, 30);
  const date = (item.action_date || "").replace(/-/g, "");
  const type = item.action_type_raw?.slice(0, 10) || "other";
  return `mlit-${sector}-${name}-${date}-${type}`.toLowerCase().replace(/\s+/g, "-").slice(0, 80);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(sector, page) {
  const sectorDef = SECTOR_DEFS[sector];
  if (!sectorDef) throw new Error(`Unknown sector: ${sector}`);

  const params = new URLSearchParams({
    jigyou: sectorDef.searchParam,
    p: String(page),
  });

  const url = `${SEARCH_URL}?${params.toString()}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "RiskMonitor/1.0 (administrative-data-collection)" },
  });
  if (!res.ok) throw new Error(`MLIT responded ${res.status}`);

  const html = await res.text();

  // 簡易HTMLパース（cheerioなしでサーバーレス対応）
  const items = [];
  const rows = html.split(/<tr[^>]*>/i).slice(1);

  for (const row of rows) {
    const cells = row.split(/<td[^>]*>/i).slice(1).map((c) =>
      c.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim()
    );
    if (cells.length < 4) continue;

    const company_name = cells[0]?.trim();
    const action_type_raw = cells[1]?.trim();
    const action_date_raw = cells[2]?.trim();
    const authority = cells[3]?.trim();

    if (!company_name || company_name === "事業者名称") continue;

    // 日付正規化
    let action_date = null;
    if (action_date_raw) {
      const m = action_date_raw.match(/(\d{4})[年/](\d{1,2})[月/](\d{1,2})/);
      if (m) action_date = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    }

    items.push({
      company_name,
      action_type_raw,
      action_type: normalizeActionType(action_type_raw),
      action_date,
      authority: authority || "国土交通大臣",
      prefecture: null,
    });
  }

  // 次ページがあるかチェック
  const hasNext = html.includes(`p=${page + 1}`) || html.includes(`"次の`);

  return { items, hasNext };
}

/**
 * MLITからデータを取得してDBに投入（Cron用）
 */
export async function runFetch({ sector = "kensetugyousya", maxPages = MAX_PAGES_PER_RUN, dryRun = false } = {}) {
  const sectorDef = SECTOR_DEFS[sector];
  if (!sectorDef) return { ok: false, error: `Unknown sector: ${sector}` };

  const startTime = Date.now();
  const log = [];
  let totalFetched = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  log.push(`[fetch-gyosei-shobun] Start: sector=${sector}, maxPages=${maxPages}, dryRun=${dryRun}`);

  for (let page = 1; page <= maxPages; page++) {
    try {
      log.push(`  Page ${page}...`);
      const { items, hasNext } = await fetchPage(sector, page);
      totalFetched += items.length;
      log.push(`  → ${items.length} items found`);

      if (!dryRun && items.length > 0) {
        const result = upsertItems(items, sector, sectorDef);
        created += result.created;
        updated += result.updated;
        skipped += result.skipped;
      }

      if (!hasNext) {
        log.push(`  → No more pages.`);
        break;
      }

      if (page < maxPages) await sleep(PAGE_DELAY_MS);
    } catch (e) {
      log.push(`  ❌ Page ${page} error: ${e.message}`);
      break;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log.push(`[fetch-gyosei-shobun] Done: ${totalFetched} fetched, ${created} created, ${updated} updated, ${skipped} skipped (${elapsed}s)`);

  // 最終更新日時を記録
  if (!dryRun) {
    try {
      recordLastSync(sector, { totalFetched, created, updated, skipped, elapsed });
    } catch { /* ignore */ }
  }

  return {
    ok: true,
    sector,
    totalFetched,
    created,
    updated,
    skipped,
    elapsed,
    log,
  };
}

function upsertItems(items, sector, sectorDef) {
  const db = getDb();
  let created = 0, updated = 0, skipped = 0;

  const upsertStmt = db.prepare(`
    INSERT INTO administrative_actions (
      slug, organization_name_raw, action_type, action_date,
      authority_name, authority_level, prefecture, industry,
      summary, source_name, is_published, review_status
    ) VALUES (
      @slug, @org, @action_type, @action_date,
      @authority, 'national', @prefecture, @industry,
      @summary, @source_name, 1, 'approved'
    )
    ON CONFLICT(slug) DO UPDATE SET
      organization_name_raw=@org, action_type=@action_type,
      action_date=@action_date, authority_name=@authority,
      summary=@summary, updated_at=datetime('now')
  `);

  for (const item of items) {
    const slug = generateSlug(item, sector);
    const existing = db.prepare("SELECT id FROM administrative_actions WHERE slug = ?").get(slug);
    try {
      upsertStmt.run({
        slug,
        org: item.company_name,
        action_type: item.action_type,
        action_date: item.action_date,
        authority: item.authority,
        prefecture: item.prefecture,
        industry: sectorDef.industry,
        summary: `${item.action_type_raw || item.action_type}。${item.authority}による処分。`,
        source_name: sectorDef.sourceName,
      });
      if (existing) updated++; else created++;
    } catch {
      skipped++;
    }
  }

  return { created, updated, skipped };
}

function recordLastSync(sector, stats) {
  const db = getDb();
  // sync_runs テーブルがあれば記録
  try {
    db.prepare(`
      INSERT INTO sync_runs (source_key, status, stats_json, started_at, finished_at)
      VALUES (?, 'completed', ?, datetime('now'), datetime('now'))
    `).run(`gyosei-shobun-mlit-${sector}`, JSON.stringify(stats));
  } catch {
    // sync_runs テーブルが存在しない場合は無視
  }
}
