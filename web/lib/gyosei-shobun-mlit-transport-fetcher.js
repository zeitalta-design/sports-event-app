/**
 * 国土交通省 自動車運送事業者 行政処分 取得
 *
 * https://www.mlit.go.jp/jidosha/anzen/03punishment/cgi-bin/list.cgi
 * から POST で全件取得（過去5年分、約9000件）。EUC-JP 配信。
 *
 * テーブル列:
 *   詳細 / 処分年月日 / 事業者の氏名・名称（法人番号・代表者付き） /
 *   事業者の所在地 / 違反点数（事業者）/ 違反点数（営業所）
 */
import { getDb } from "@/lib/db";
import { shouldSkipAsCompanyName } from "@/lib/company-name-validator";
import iconv from "iconv-lite";

const UA = "Mozilla/5.0 (compatible; RiskMonitor/1.0)";
const FETCH_TIMEOUT_MS = 60000;
const LIST_URL = "https://www.mlit.go.jp/jidosha/anzen/03punishment/cgi-bin/list.cgi";

export async function fetchAndUpsertMlitTransport({ dryRun = false, limit = 0, logger = console.log } = {}) {
  const start = Date.now();
  const log = (msg) => logger(`[mlit-transport] ${msg}`);
  const db = getDb();

  log(`📍 ${LIST_URL}`);
  const res = await fetch(LIST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
    },
    body: "mode=newer&rui=&ken=&gyosya=&year=&month=&day=&tensu=",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const html = iconv.decode(buf, "EUC-JP");
  log(`  downloaded: ${buf.length} bytes`);

  const trs = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  log(`  rows: ${trs.length}`);

  const upsertStmt = db.prepare(`
    INSERT INTO administrative_actions
      (slug, organization_name_raw, action_type, action_date,
       authority_name, authority_level, prefecture, city, industry,
       summary, source_name, source_url, is_published, review_status,
       created_at, updated_at)
    VALUES
      (@slug, @org, @action_type, @action_date,
       @authority, 'national', @prefecture, @city, 'transport',
       @summary, '国土交通省 自動車運送事業者行政処分',
       'https://www.mlit.go.jp/jidosha/anzen/03punishment/cgi-bin/search.cgi',
       1, 'approved', datetime('now'), datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      organization_name_raw = @org,
      action_type           = @action_type,
      action_date           = @action_date,
      summary               = @summary,
      updated_at            = datetime('now')
  `);

  let processed = 0, created = 0, updated = 0, skipped = 0;
  let cnt = 0;
  for (const tr of trs) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim());
    // ヘッダー行・サブヘッダー行は除外（cells[0]が「詳細」でない）
    if (cells.length < 6 || cells[0] !== "詳細") continue;

    const dateRaw = cells[1];
    const orgRaw = cells[2];
    const address = cells[3];
    const violationPointBusiness = cells[4];
    const violationPointBranch = cells[5];

    // 事業者名を抽出: 「株式会社XXX（法人番号NNNN）代表者YYY」→「株式会社XXX」
    const orgMatch = orgRaw.match(/^(.+?)[（(]法人番号/);
    const org = orgMatch ? orgMatch[1].trim() : orgRaw.split(/[（(]/)[0].trim();
    if (!org || org.length < 2) { skipped++; continue; }
    if (shouldSkipAsCompanyName(org)) { skipped++; continue; }

    // 法人番号
    const corpNumMatch = orgRaw.match(/法人番号(\d{13})/);
    const corporateNumber = corpNumMatch ? corpNumMatch[1] : null;

    const action_date = parseJaDate(dateRaw);
    const prefecture = extractPrefecture(address);
    const city = extractCity(address);
    const action_type = inferActionType(violationPointBusiness, violationPointBranch);

    const summaryParts = [];
    summaryParts.push(`違反点数（事業者）: ${violationPointBusiness}`);
    summaryParts.push(`違反点数（営業所）: ${violationPointBranch}`);
    if (corporateNumber) summaryParts.push(`法人番号: ${corporateNumber}`);
    const summary = summaryParts.join(" / ").slice(0, 500);

    const slug = `mlit-trans-${(action_date || "nodate").replace(/-/g, "")}-${slugify(org)}-${corporateNumber || cnt}`;
    cnt++;
    processed++;
    if (limit > 0 && processed > limit) break;
    if (dryRun) continue;

    try {
      const before = db.prepare("SELECT id FROM administrative_actions WHERE slug = ?").get(slug);
      upsertStmt.run({
        slug,
        org: org.slice(0, 100),
        action_type,
        action_date,
        authority: "国土交通省 各地方運輸局",
        prefecture,
        city,
        summary,
      });
      before ? updated++ : created++;
    } catch {
      skipped++;
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log(`Done: processed=${processed} created=${created} updated=${updated} skipped=${skipped} (${elapsed}s)`);

  if (!dryRun) {
    try {
      db.prepare(`
        INSERT INTO sync_runs (domain_id, run_type, run_status, fetched_count, created_count, updated_count, started_at, finished_at)
        VALUES ('gyosei-shobun-mlit-transport', 'scheduled', 'completed', ?, ?, ?, datetime('now'), datetime('now'))
      `).run(processed, created, updated);
    } catch { /* ignore */ }
  }

  return { ok: true, processed, created, updated, skipped, elapsed };
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

function inferActionType(pointBiz, pointBranch) {
  const pb = parseInt(pointBiz, 10);
  const pbr = parseInt(pointBranch, 10);
  if (pb >= 100 || pbr >= 100) return "license_revocation";
  if (pb >= 50 || pbr >= 50) return "business_suspension";
  if (pb >= 10 || pbr >= 10) return "warning";
  return "other";
}

function extractPrefecture(address) {
  if (!address) return null;
  const m = String(address).match(/^(東京都|北海道|(?:大阪|京都)府|.+?県)/);
  return m ? m[1] : null;
}

function extractCity(address) {
  if (!address) return null;
  const m = String(address).match(/^(?:東京都|北海道|(?:\S+?)府|(?:\S+?)県)(.+?(?:市|区|町|村))/);
  return m ? m[1].trim() : null;
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
