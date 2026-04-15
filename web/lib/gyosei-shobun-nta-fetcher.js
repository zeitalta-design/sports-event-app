/**
 * 国税庁 税理士・税理士法人に対する懲戒処分 取得
 *
 * 2ページから取得:
 *  - https://www.nta.go.jp/taxes/zeirishi/chokai/shobun/list.htm (〜令和6年3月 官報掲載)
 *  - https://www.nta.go.jp/taxes/zeirishi/chokai/shobun/240401.htm (令和6年4月〜 公告)
 *
 * いずれも Shift_JIS 配信、テーブル形式。
 */
import { getDb } from "@/lib/db";
import { shouldSkipAsCompanyName } from "@/lib/company-name-validator";
import iconv from "iconv-lite";

const UA = "Mozilla/5.0 (compatible; RiskMonitor/1.0)";
const FETCH_TIMEOUT_MS = 30000;

const SOURCES = [
  {
    url: "https://www.nta.go.jp/taxes/zeirishi/chokai/shobun/list.htm",
    label: "官報掲載 (〜令和6年3月)",
    variant: "list",
  },
  {
    url: "https://www.nta.go.jp/taxes/zeirishi/chokai/shobun/240401.htm",
    label: "公告 (令和6年4月〜)",
    variant: "koukoku",
  },
];

export async function fetchAndUpsertNtaZeirishi({ dryRun = false, logger = console.log } = {}) {
  const start = Date.now();
  const log = (msg) => logger(`[nta-zeirishi] ${msg}`);
  const db = getDb();

  const upsertStmt = db.prepare(`
    INSERT INTO administrative_actions
      (slug, organization_name_raw, action_type, action_date,
       authority_name, authority_level, prefecture, industry,
       summary, source_name, source_url, is_published, review_status,
       created_at, updated_at)
    VALUES
      (@slug, @org, @action_type, @action_date,
       '国税庁 財務大臣', 'national', @prefecture, 'tax_advisor',
       @summary, '国税庁 税理士等懲戒処分', @source_url,
       1, 'approved', datetime('now'), datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      organization_name_raw = @org,
      action_type           = @action_type,
      action_date           = @action_date,
      summary               = @summary,
      updated_at            = datetime('now')
  `);

  let totalProcessed = 0, totalCreated = 0, totalUpdated = 0;
  const perSource = [];

  for (const src of SOURCES) {
    try {
      const r = await processSource({ src, db, upsertStmt, dryRun, log });
      perSource.push({ label: src.label, ...r });
      totalProcessed += r.processed;
      totalCreated += r.created;
      totalUpdated += r.updated;
    } catch (e) {
      log(`  ! ${src.label}: ${e.message}`);
      perSource.push({ label: src.label, error: e.message, processed: 0, created: 0, updated: 0 });
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log(`Done: processed=${totalProcessed} created=${totalCreated} updated=${totalUpdated} (${elapsed}s)`);

  if (!dryRun) {
    try {
      db.prepare(`
        INSERT INTO sync_runs (domain_id, run_type, run_status, fetched_count, created_count, updated_count, started_at, finished_at)
        VALUES ('gyosei-shobun-nta', 'scheduled', 'completed', ?, ?, ?, datetime('now'), datetime('now'))
      `).run(totalProcessed, totalCreated, totalUpdated);
    } catch { /* ignore */ }
  }

  return { ok: true, perSource, totalProcessed, totalCreated, totalUpdated, elapsed };
}

async function processSource({ src, db, upsertStmt, dryRun, log }) {
  log(`📍 ${src.label}: ${src.url}`);
  const res = await fetch(src.url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const html = iconv.decode(buf, "Shift_JIS");

  const trs = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  let processed = 0, created = 0, updated = 0;

  for (const tr of trs) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim());
    if (cells.length < 4) continue;
    if (/氏名/.test(cells[0])) continue; // ヘッダー

    let org, registrationNo, address, content, koukokuDate;
    if (src.variant === "list") {
      // 列: [0]氏名 [1]登録番号 [2]事務所 [3]処分内容 [4]官報掲載日
      org = cells[0];
      registrationNo = cells[1];
      address = cells[2];
      content = cells[3];
      koukokuDate = cells[4];
    } else {
      // 240401 系: [0]処分内容等 [1]氏名 [2]登録番号 [3]事務所
      content = cells[0];
      org = cells[1];
      registrationNo = cells[2];
      address = cells[3];
      // 公告日付は content 内に記載（全角数字を半角に正規化してからマッチ）
      const contentNorm = toHalfWidthDigits(content);
      const dateMatch = contentNorm.match(/令和(\d+)年(\d+)月(\d+)日.*?公告/);
      if (dateMatch) {
        const y = 2018 + parseInt(dateMatch[1]);
        koukokuDate = `${y}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
      }
    }

    if (!org || org.length < 2) continue;
    if (shouldSkipAsCompanyName(org)) continue;

    // 処分発効日を抽出（content内から、全角数字も対応）
    const contentNorm = toHalfWidthDigits(content);
    const effMatch = contentNorm.match(/令和(\d+)年(\d+)月(\d+)日から/);
    let action_date;
    if (effMatch) {
      const y = 2018 + parseInt(effMatch[1]);
      action_date = `${y}-${effMatch[2].padStart(2, "0")}-${effMatch[3].padStart(2, "0")}`;
    } else {
      action_date = parseJaDate(koukokuDate);
    }

    const action_type = inferActionType(content);
    const prefecture = extractPrefecture(address);

    const summaryParts = [];
    if (registrationNo) summaryParts.push(`登録番号: ${registrationNo}`);
    if (address) summaryParts.push(`事務所: ${address}`);
    if (content) summaryParts.push(content);
    const summary = summaryParts.join(" / ").slice(0, 500);

    const slug = `nta-zeirishi-${(action_date || "nodate").replace(/-/g, "")}-${slugify(org)}`;
    processed++;
    if (dryRun) continue;
    try {
      const before = db.prepare("SELECT id FROM administrative_actions WHERE slug = ?").get(slug);
      upsertStmt.run({
        slug,
        org: org.slice(0, 100),
        action_type,
        action_date,
        prefecture,
        summary,
        source_url: src.url,
      });
      before ? updated++ : created++;
    } catch { /* ignore */ }
  }

  log(`  → processed=${processed} created=${created} updated=${updated}`);
  return { processed, created, updated };
}

function inferActionType(content) {
  const s = String(content || "");
  if (/業務の禁止/.test(s)) return "business_prohibition";
  if (/業務の停止/.test(s)) return "business_suspension";
  if (/戒告/.test(s)) return "admonishment";
  return "other";
}

function parseJaDate(s) {
  if (!s) return null;
  const normalized = toHalfWidthDigits(String(s));
  const m = normalized.match(/令和(\d+)年(\d+)月(\d+)日/);
  if (m) {
    const y = 2018 + parseInt(m[1]);
    return `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return null;
}

function toHalfWidthDigits(s) {
  return String(s || "").replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

function extractPrefecture(address) {
  if (!address) return null;
  const m = String(address).match(/^(東京都|北海道|(?:大阪|京都)府|.+?県)/);
  return m ? m[1] : null;
}

function slugify(s) {
  return String(s)
    .replace(/[（(].*?[）)]/g, "")
    .replace(/[^\w\u3040-\u30FF\u3400-\u9FFF]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .substring(0, 40) || "item";
}
