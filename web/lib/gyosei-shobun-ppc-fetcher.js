/**
 * 個人情報保護委員会（PPC）行政処分・勧告 取得
 *
 * PPC の新着情報・報道発表ページから「〇〇に対する個人情報の保護に関する
 * 法律に基づく行政上の対応について」というタイトルのリンクを抽出し、
 * 事業者名・日付を administrative_actions に upsert。
 *
 * 対象ページ:
 *   - /information/ : 新着情報一覧
 *   - /news/press/YYYY/ : 年別報道発表
 */
import { getDb } from "@/lib/db";
import { shouldSkipAsCompanyName } from "@/lib/company-name-validator";

const UA = "Mozilla/5.0 (compatible; RiskMonitor/1.0)";
const FETCH_TIMEOUT_MS = 30000;

export async function fetchAndUpsertPpcActions({ dryRun = false, years = 4, logger = console.log } = {}) {
  const start = Date.now();
  const log = (msg) => logger(`[ppc] ${msg}`);
  const db = getDb();

  // 新着情報＋過去年別ページを組み合わせて対象リンクを集める
  const pages = [
    "https://www.ppc.go.jp/information/",
  ];
  const currentYear = new Date().getFullYear();
  for (let y = 0; y < years; y++) {
    pages.push(`https://www.ppc.go.jp/news/press/${currentYear - y}/`);
  }

  const collected = new Map(); // url → { title, date }
  for (const pageUrl of pages) {
    try {
      log(`📍 ${pageUrl}`);
      const res = await fetch(pageUrl, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) { log(`  - HTTP ${res.status}`); continue; }
      const html = await res.text();

      // a タグで 行政上の対応 / 勧告 を含むもの
      const linkPattern = /<a[^>]*href="([^"]+)"[^>]*>([^<]{15,400})<\/a>/gi;
      let m;
      while ((m = linkPattern.exec(html)) !== null) {
        const href = m[1];
        const text = m[2].replace(/\s+/g, " ").trim();
        if (!/行政上の対応|勧告|指導|命令|行政処分/.test(text)) continue;
        if (!/個人情報の保護|個人情報保護法|特定の個人を識別/.test(text)) continue;

        let url = href;
        if (url.startsWith("/")) url = `https://www.ppc.go.jp${url}`;
        else if (!url.startsWith("http")) url = new URL(href, pageUrl).href;

        // URL から日付を抽出: /news/press/2025/250910 → 2025-09-10
        const dateMatch = url.match(/\/news\/press\/(\d{4})\/(\d{2})(\d{2})(\d{2})/);
        const date = dateMatch ? `${dateMatch[1]}-${dateMatch[3]}-${dateMatch[4]}` : null;

        if (!collected.has(url)) {
          collected.set(url, { title: text, date });
        }
      }
      await sleep(800);
    } catch (e) {
      log(`  ! ${pageUrl}: ${e.message}`);
    }
  }
  log(`  collected: ${collected.size} unique press items`);

  const upsertStmt = db.prepare(`
    INSERT INTO administrative_actions
      (slug, organization_name_raw, action_type, action_date,
       authority_name, authority_level, prefecture, industry,
       summary, source_name, source_url, is_published, review_status,
       created_at, updated_at)
    VALUES
      (@slug, @org, @action_type, @action_date,
       '個人情報保護委員会', 'national', NULL, 'personal_info',
       @summary, '個人情報保護委員会 行政上の対応', @source_url,
       1, 'approved', datetime('now'), datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      organization_name_raw = @org,
      action_type           = @action_type,
      action_date           = @action_date,
      summary               = @summary,
      updated_at            = datetime('now')
  `);

  let processed = 0, created = 0, updated = 0, skipped = 0;
  for (const [url, meta] of collected) {
    // タイトルから事業者名を抽出: 「〇〇に対する個人情報の保護...」「〇〇への勧告...」
    const orgs = extractOrgsFromPpcTitle(meta.title);
    if (orgs.length === 0) { skipped++; continue; }
    const action_type = inferActionType(meta.title);

    for (const org of orgs) {
      if (shouldSkipAsCompanyName(org)) { skipped++; continue; }
      processed++;
      const slug = `ppc-${(meta.date || "nodate").replace(/-/g, "")}-${slugify(org)}`;
      if (dryRun) continue;
      try {
        const before = db.prepare("SELECT id FROM administrative_actions WHERE slug = ?").get(slug);
        upsertStmt.run({
          slug,
          org: org.slice(0, 100),
          action_type,
          action_date: meta.date,
          summary: meta.title.slice(0, 500),
          source_url: url,
        });
        before ? updated++ : created++;
      } catch { skipped++; }
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log(`Done: processed=${processed} created=${created} updated=${updated} skipped=${skipped} (${elapsed}s)`);

  if (!dryRun) {
    try {
      db.prepare(`
        INSERT INTO sync_runs (domain_id, run_type, run_status, fetched_count, created_count, updated_count, started_at, finished_at)
        VALUES ('gyosei-shobun-ppc', 'scheduled', 'completed', ?, ?, ?, datetime('now'), datetime('now'))
      `).run(processed, created, updated);
    } catch { /* ignore */ }
  }

  return { ok: true, processed, created, updated, skipped, collected: collected.size, elapsed };
}

function extractOrgsFromPpcTitle(title) {
  const s = String(title || "");
  // パターン1: 「〇〇に対する」
  let m = s.match(/「?(.+?)に対する(?:個人情報|行政手続)/);
  if (m) return splitMultipleOrgs(m[1]);
  // パターン2: 「〇〇への勧告」
  m = s.match(/「?(.+?)への勧告/);
  if (m) return splitMultipleOrgs(m[1]);
  // パターン3: 「〇〇における」
  m = s.match(/「?(.+?)における/);
  if (m) return splitMultipleOrgs(m[1]);
  return [];
}

function splitMultipleOrgs(raw) {
  // 「〇〇及び〇〇」「〇〇等」に対応
  const cleaned = raw.replace(/等$/, "").trim();
  const parts = cleaned.split(/(?:及び|並びに)/).map((p) => p.trim()).filter(Boolean);
  return parts.filter((p) => p.length >= 2);
}

function inferActionType(title) {
  const s = String(title || "");
  if (/命令/.test(s)) return "order";
  if (/勧告/.test(s)) return "recommendation";
  if (/指導/.test(s)) return "directive";
  if (/改善/.test(s)) return "improvement_order";
  return "administrative_response";
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
