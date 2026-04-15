/**
 * 消費者庁 特定商取引法違反 行政処分 取得（CSV出力経由）
 *
 * https://www.no-trouble.caa.go.jp/search/ の CSV 出力機能を利用。
 * 1. GET /search/ で CSRF token と PHPSESSID Cookie を取得
 * 2. POST /search/csv.html で各ページの CSV をダウンロード
 * 3. CSV を結合してパース → administrative_actions に upsert
 *
 * CSV列構造:
 *   事業者名 / 処分内容 / 取引類型 / 取扱商品・役務 /
 *   違反行為 / 適用条項 / 処分日 / 処分行政庁
 */
import { getDb } from "@/lib/db";
import { shouldSkipAsCompanyName } from "@/lib/company-name-validator";
import iconv from "iconv-lite";

const UA = "Mozilla/5.0 (compatible; RiskMonitor/1.0)";
const FETCH_TIMEOUT_MS = 30000;
const SEARCH_URL = "https://www.no-trouble.caa.go.jp/search/";
const CSV_URL = "https://www.no-trouble.caa.go.jp/search/csv.html";

export async function fetchAndUpsertCaaShobun({ dryRun = false, maxPages = 30, logger = console.log } = {}) {
  const start = Date.now();
  const log = (msg) => logger(`[caa-shobun] ${msg}`);
  const db = getDb();

  // Step 1: GET /search/ で token + Cookie 取得
  log(`📍 ${SEARCH_URL}`);
  const idxRes = await fetch(SEARCH_URL, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!idxRes.ok) throw new Error(`index HTTP ${idxRes.status}`);
  const cookie = (idxRes.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
  const idxHtml = await idxRes.text();
  const tokenMatch = idxHtml.match(/name="token"\s+value="([^"]+)"/);
  if (!tokenMatch) throw new Error("CSRF token not found");
  const token = tokenMatch[1];
  // 結果ページ件数を取得（pager_last の form action から推定）
  const lastMatch = idxHtml.match(/action="\/search\/result(\d+)\.html"\s+method="post"\s+id="pager_last"/);
  const lastPage = lastMatch ? Math.min(parseInt(lastMatch[1], 10), maxPages) : maxPages;
  log(`  pages: 1..${lastPage}, token: ${token.slice(0, 16)}...`);

  // Step 2: 各ページのCSVを取得して結合
  const allRows = [];
  for (let p = 1; p <= lastPage; p++) {
    const body = `token=${encodeURIComponent(token)}&person=&atext=&type=&item=&action=&disposal_admin=&provision=&disposal_start_y=&disposal_start_m=&disposal_start_d=&disposal_end_y=&disposal_end_m=&disposal_end_d=&p=${p}&search=`;
    try {
      const res = await fetch(CSV_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": UA,
          "Cookie": cookie,
          "Referer": SEARCH_URL,
        },
        body,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        log(`  ! page ${p}: HTTP ${res.status}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const text = iconv.decode(buf, "Shift_JIS");
      const rows = parseCsv(text);
      // 1行目はヘッダー（p=1のときのみ）
      const dataRows = p === 1 ? rows.slice(1) : rows.slice(1);
      allRows.push(...dataRows);
      log(`  page ${p}: +${dataRows.length} rows`);
      await sleep(500);
    } catch (e) {
      log(`  ! page ${p}: ${e.message}`);
    }
  }
  log(`  total rows: ${allRows.length}`);

  // Step 3: upsert
  const upsertStmt = db.prepare(`
    INSERT INTO administrative_actions
      (slug, organization_name_raw, action_type, action_date,
       authority_name, authority_level, prefecture, industry,
       summary, legal_basis, source_name, source_url,
       is_published, review_status, created_at, updated_at)
    VALUES
      (@slug, @org, @action_type, @action_date,
       @authority, @authority_level, @prefecture, 'consumer_business',
       @summary, @legal_basis, '消費者庁 特商法違反 行政処分',
       'https://www.no-trouble.caa.go.jp/search/',
       1, 'approved', datetime('now'), datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      organization_name_raw = @org,
      action_type           = @action_type,
      action_date           = @action_date,
      summary               = @summary,
      legal_basis           = @legal_basis,
      updated_at            = datetime('now')
  `);

  let processed = 0, created = 0, updated = 0, skipped = 0;
  for (const row of allRows) {
    if (!row || row.length < 7) continue;
    const [orgRaw, dispContent, transType, goods, violation, provision, dispDateRaw, authority] = row;
    const org = String(orgRaw || "").trim();
    if (!org) continue;
    if (shouldSkipAsCompanyName(org)) { skipped++; continue; }

    const action_date = parseJaDate(dispDateRaw);
    const action_type = inferActionType(dispContent);
    const prefecture = extractPrefecture(authority);
    const authority_level = String(authority || "").includes("都道府県") ? "prefectural" : "national";

    const summaryParts = [];
    if (dispContent) summaryParts.push(`【${dispContent}】`);
    if (transType) summaryParts.push(`類型: ${transType}`);
    if (goods) summaryParts.push(`商品: ${goods}`);
    if (violation) summaryParts.push(`違反: ${violation}`);
    const summary = summaryParts.join(" ").slice(0, 500);

    const slug = `caa-${(action_date || "nodate").replace(/-/g, "")}-${slugify(org)}-${slugify(dispContent).slice(0, 8)}`;
    processed++;
    if (dryRun) continue;
    try {
      const before = db.prepare("SELECT id FROM administrative_actions WHERE slug = ?").get(slug);
      upsertStmt.run({
        slug,
        org: org.slice(0, 100),
        action_type,
        action_date,
        authority: String(authority || "消費者庁").slice(0, 50),
        authority_level,
        prefecture,
        legal_basis: provision ? `特定商取引法 ${provision}`.slice(0, 200) : "特定商取引法",
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
        VALUES ('gyosei-shobun-caa', 'scheduled', 'completed', ?, ?, ?, datetime('now'), datetime('now'))
      `).run(processed, created, updated);
    } catch { /* ignore */ }
  }

  return { ok: true, processed, created, updated, skipped, totalPages: lastPage, elapsed };
}

/** CSV パーサー（ダブルクォート対応） */
function parseCsv(text) {
  const rows = [];
  let cur = [];
  let field = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuote = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuote = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field || cur.length) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.some((c) => c && c.trim()));
}

function inferActionType(s) {
  const t = String(s || "");
  if (/業務停止命令/.test(t)) return "business_suspension";
  if (/業務禁止命令/.test(t)) return "business_prohibition";
  if (/指示/.test(t)) return "directive";
  if (/取消/.test(t)) return "license_revocation";
  if (/警告/.test(t)) return "warning";
  return "other";
}

function parseJaDate(s) {
  if (!s) return null;
  const t = String(s);
  const m = t.match(/(\d{4})年(\d+)月(\d+)日/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return null;
}

function extractPrefecture(authority) {
  if (!authority) return null;
  const m = String(authority).match(/^(東京都|北海道|(?:大阪|京都)府|.+?県)/);
  return m ? m[1] : null;
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
