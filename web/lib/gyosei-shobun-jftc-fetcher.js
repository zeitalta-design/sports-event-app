/**
 * 公正取引委員会 排除措置命令一覧 取得
 *
 * https://www.jftc.go.jp/dk/ichiran/index.html から年度別ページを辿り、
 * テーブル構造（事件番号/件名/内容/違反法条/措置年月日）を抽出。
 *
 * 件名は「〇〇に対する件」形式で、事業者名／対象名を抽出する。
 */
import { getDb } from "@/lib/db";
import { shouldSkipAsCompanyName } from "@/lib/company-name-validator";

const UA = "Mozilla/5.0 (compatible; RiskMonitor/1.0)";
const FETCH_TIMEOUT_MS = 30000;

// 取得対象の年度別ページ（直近6年度）
const YEAR_PAGES = [
  { year: "令和6年度", url: "https://www.jftc.go.jp/dk/ichiran/dkhaijo_R6.html" },
  { year: "令和5年度", url: "https://www.jftc.go.jp/dk/ichiran/dkhaijo_R5.html" },
  { year: "令和4年度", url: "https://www.jftc.go.jp/dk/ichiran/dkhaijo_R4.html" },
  { year: "令和3年度", url: "https://www.jftc.go.jp/dk/ichiran/dkhaijo_R3.html" },
  { year: "令和2年度", url: "https://www.jftc.go.jp/dk/ichiran/dkhaijo_R2.html" },
  { year: "令和元年度", url: "https://www.jftc.go.jp/dk/ichiran/dkhaijo_R1.html" },
];

export async function fetchAndUpsertJftcOrders({ dryRun = false, logger = console.log } = {}) {
  const start = Date.now();
  const log = (msg) => logger(`[jftc] ${msg}`);
  const db = getDb();

  const upsertStmt = db.prepare(`
    INSERT INTO administrative_actions
      (slug, organization_name_raw, action_type, action_date,
       authority_name, authority_level, prefecture, industry,
       summary, legal_basis, source_name, source_url,
       is_published, review_status, created_at, updated_at)
    VALUES
      (@slug, @org, @action_type, @action_date,
       '公正取引委員会', 'national', NULL, 'antitrust',
       @summary, @legal_basis, '公正取引委員会 排除措置命令一覧', @source_url,
       1, 'approved', datetime('now'), datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      organization_name_raw = @org,
      action_type           = @action_type,
      action_date           = @action_date,
      summary               = @summary,
      legal_basis           = @legal_basis,
      updated_at            = datetime('now')
  `);

  let totalProcessed = 0, totalCreated = 0, totalUpdated = 0;
  const perYear = [];

  for (const page of YEAR_PAGES) {
    try {
      const r = await processYearPage({ page, db, upsertStmt, dryRun, log });
      perYear.push({ year: page.year, ...r });
      totalProcessed += r.processed;
      totalCreated += r.created;
      totalUpdated += r.updated;
      await sleep(1000);
    } catch (e) {
      log(`  ! ${page.year}: ${e.message}`);
      perYear.push({ year: page.year, error: e.message, processed: 0, created: 0, updated: 0 });
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log(`Done: processed=${totalProcessed} created=${totalCreated} updated=${totalUpdated} (${elapsed}s)`);

  if (!dryRun) {
    try {
      db.prepare(`
        INSERT INTO sync_runs (domain_id, run_type, run_status, fetched_count, created_count, updated_count, started_at, finished_at)
        VALUES ('gyosei-shobun-jftc', 'scheduled', 'completed', ?, ?, ?, datetime('now'), datetime('now'))
      `).run(totalProcessed, totalCreated, totalUpdated);
    } catch { /* ignore */ }
  }

  return { ok: true, perYear, totalProcessed, totalCreated, totalUpdated, elapsed };
}

async function processYearPage({ page, db, upsertStmt, dryRun, log }) {
  log(`📍 ${page.year}: ${page.url}`);
  const res = await fetch(page.url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const trs = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  let processed = 0, created = 0, updated = 0;

  for (const tr of trs) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim());
    if (cells.length < 6) continue;
    if (cells[0] === "一連 番号" || cells[0] === "一連番号" || /^[ぁ-ん]/.test(cells[0])) continue;

    // 列: [0]連番 [1]事件番号 [2]件名 [3]内容 [4]違反法条 [5]措置年月日
    const caseNo = cells[1];
    const title = cells[2];
    const content = cells[3];
    const lawArticle = cells[4];
    const dateRaw = cells[5];

    if (!title || title.length < 4) continue;

    // 件名から事業者名を抽出: 「〇〇に対する件」「〇〇及び○○に対する件」
    const orgs = extractOrgsFromTitle(title);
    if (orgs.length === 0) continue;

    const action_date = parseJaDate(dateRaw);
    const action_type = inferActionType(caseNo);

    for (const org of orgs) {
      if (shouldSkipAsCompanyName(org)) continue;
      processed++;

      const slug = `jftc-${(action_date || "nodate").replace(/-/g, "")}-${slugify(org)}-${slugify(caseNo).slice(0, 10)}`;
      if (dryRun) continue;
      try {
        const before = db.prepare("SELECT id FROM administrative_actions WHERE slug = ?").get(slug);
        upsertStmt.run({
          slug,
          org: org.slice(0, 100),
          action_type,
          action_date,
          legal_basis: lawArticle ? `独占禁止法 ${lawArticle}` : "独占禁止法",
          summary: `${caseNo} ${title} / ${content}`.slice(0, 500),
          source_url: page.url,
        });
        before ? updated++ : created++;
      } catch { /* ignore */ }
    }
  }
  log(`  → processed=${processed} created=${created} updated=${updated}`);
  return { processed, created, updated };
}

function extractOrgsFromTitle(title) {
  // 「〇〇に対する件」を除去
  let s = String(title).replace(/に対する件$/, "").trim();
  // 「〇〇発注の」「〇〇市が発注する」等の修飾を除く
  s = s.replace(/^.+?が?発注(する|の)?/, "");
  s = s.replace(/^.+?の?入札参加業者(ら)?$/, "$&");

  // 「及び」「並びに」「・」「，」で複数事業者を分割
  const parts = s.split(/(?:及び|並びに|、|，|・)/).map((p) => p.trim()).filter(Boolean);
  // 各 part が事業者名らしいか軽くチェック
  const filtered = parts.filter((p) => {
    if (p.length < 3) return false;
    if (/(発注|入札|案件|事案)/.test(p)) return false;
    return true;
  });
  return filtered.length > 0 ? filtered : [s].filter(Boolean);
}

function inferActionType(caseNo) {
  const s = String(caseNo || "");
  if (/措/.test(s)) return "exclusion_order"; // 排除措置命令
  if (/課/.test(s)) return "surcharge_order"; // 課徴金納付命令
  if (/警/.test(s)) return "warning";          // 警告
  if (/確/.test(s)) return "commitment_plan";  // 確約計画認定
  return "other";
}

function parseJaDate(s) {
  if (!s) return null;
  const m = String(s).match(/令和(\d+)年(\d+)月(\d+)日/);
  if (m) {
    const y = 2018 + parseInt(m[1]);
    return `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  const m2 = String(s).match(/平成(\d+)年(\d+)月(\d+)日/);
  if (m2) {
    const y = 1988 + parseInt(m2[1]);
    return `${y}-${m2[2].padStart(2, "0")}-${m2[3].padStart(2, "0")}`;
  }
  return null;
}

function slugify(s) {
  return String(s)
    .replace(/株式会社|有限会社|合同会社/g, "")
    .replace(/[（(].*?[）)]/g, "")
    .replace(/[^\w\u3040-\u30FF\u3400-\u9FFF]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .substring(0, 40) || "item";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
