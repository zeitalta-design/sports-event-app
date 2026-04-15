/**
 * 厚労省 労働基準関係法令違反 公表事案（通称ブラック企業リスト）取得
 *
 * 各都道府県労働局のサイトから「労働基準関係法令違反に係る公表事案」
 * PDFを取得・パースして administrative_actions に upsert する。
 *
 * - jsite.mhlw.go.jp/{prefSlug}-roudoukyoku/jirei_toukei/ から PDF リンク追従
 * - PDF は「企業名 / 所在地 / 公表日 / 違反法条 / 事案概要」の表形式
 * - 都道府県ごとに最終更新日・URLが違うため、各局ページを動的に解析
 */
import { getDb } from "@/lib/db";
import { shouldSkipAsCompanyName } from "@/lib/company-name-validator";

const UA = "Mozilla/5.0 (compatible; RiskMonitor/1.0)";
const FETCH_TIMEOUT_MS = 30000;

// 47都道府県労働局のスラッグ
// 公表事案ページのURLは局によって違うため、トップから動的に辿る
const LABOR_BUREAUS = [
  { pref: "北海道", slug: "hokkaido" },
  { pref: "青森県", slug: "aomori" },
  { pref: "岩手県", slug: "iwate" },
  { pref: "宮城県", slug: "miyagi" },
  { pref: "秋田県", slug: "akita" },
  { pref: "山形県", slug: "yamagata" },
  { pref: "福島県", slug: "fukushima" },
  { pref: "茨城県", slug: "ibaraki" },
  { pref: "栃木県", slug: "tochigi" },
  { pref: "群馬県", slug: "gunma" },
  { pref: "埼玉県", slug: "saitama" },
  { pref: "千葉県", slug: "chiba" },
  { pref: "東京都", slug: "tokyo" },
  { pref: "神奈川県", slug: "kanagawa" },
  { pref: "新潟県", slug: "niigata" },
  { pref: "富山県", slug: "toyama" },
  { pref: "石川県", slug: "ishikawa" },
  { pref: "福井県", slug: "fukui" },
  { pref: "山梨県", slug: "yamanashi" },
  { pref: "長野県", slug: "nagano" },
  { pref: "岐阜県", slug: "gifu" },
  { pref: "静岡県", slug: "shizuoka" },
  { pref: "愛知県", slug: "aichi" },
  { pref: "三重県", slug: "mie" },
  { pref: "滋賀県", slug: "shiga" },
  { pref: "京都府", slug: "kyoto" },
  { pref: "大阪府", slug: "osaka" },
  { pref: "兵庫県", slug: "hyogo" },
  { pref: "奈良県", slug: "nara" },
  { pref: "和歌山県", slug: "wakayama" },
  { pref: "鳥取県", slug: "tottori" },
  { pref: "島根県", slug: "shimane" },
  { pref: "岡山県", slug: "okayama" },
  { pref: "広島県", slug: "hiroshima" },
  { pref: "山口県", slug: "yamaguchi" },
  { pref: "徳島県", slug: "tokushima" },
  { pref: "香川県", slug: "kagawa" },
  { pref: "愛媛県", slug: "ehime" },
  { pref: "高知県", slug: "kochi" },
  { pref: "福岡県", slug: "fukuoka" },
  { pref: "佐賀県", slug: "saga" },
  { pref: "長崎県", slug: "nagasaki" },
  { pref: "熊本県", slug: "kumamoto" },
  { pref: "大分県", slug: "oita" },
  { pref: "宮崎県", slug: "miyazaki" },
  { pref: "鹿児島県", slug: "kagoshima" },
  { pref: "沖縄県", slug: "okinawa" },
];

/**
 * 労働局トップから「公表事案」ページのURLを動的に解決する。
 * トップ → /jirei_toukei/ ディレクトリ内の「公表事案」リンクを探す。
 */
async function resolveAnnouncementUrl(slug) {
  const candidates = [
    `https://jsite.mhlw.go.jp/${slug}-roudoukyoku/jirei_toukei/`,
    `https://jsite.mhlw.go.jp/${slug}-roudoukyoku/`,
  ];
  for (const tryUrl of candidates) {
    try {
      const res = await fetch(tryUrl, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: "follow",
      });
      if (!res.ok) continue;
      const html = await res.text();
      // 「公表事案」「労働基準関係法令違反」を含むリンクを探す
      const linkPattern = /<a[^>]*href="([^"]+)"[^>]*>([^<]{4,200})<\/a>/gi;
      let m;
      while ((m = linkPattern.exec(html)) !== null) {
        const text = m[2].replace(/\s+/g, "");
        if (/公表事案|労働基準関係法令違反/.test(text)) {
          let href = m[1];
          if (href.startsWith("/")) href = `https://jsite.mhlw.go.jp${href}`;
          else if (!href.startsWith("http")) href = new URL(href, tryUrl).href;
          return href;
        }
      }
    } catch { /* try next */ }
  }
  return null;
}

export async function fetchAndUpsertMhlwBlackList({ dryRun = false, maxBureaus = 10, logger = console.log } = {}) {
  const start = Date.now();
  const log = (msg) => logger(`[mhlw-black] ${msg}`);
  const db = getDb();

  const upsertStmt = db.prepare(`
    INSERT INTO administrative_actions
      (slug, organization_name_raw, action_type, action_date,
       authority_name, authority_level, prefecture, city, industry,
       summary, source_name, source_url, is_published, review_status,
       created_at, updated_at)
    VALUES
      (@slug, @org, @action_type, @action_date,
       @authority, 'national', @prefecture, @city, @industry,
       @summary, @source_name, @source_url, 1, 'approved',
       datetime('now'), datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      organization_name_raw = @org,
      action_type           = @action_type,
      action_date           = @action_date,
      summary               = @summary,
      updated_at            = datetime('now')
  `);

  // ローテーションで毎回 maxBureaus 件処理
  let offset = 0;
  try {
    const lastRun = db.prepare(
      "SELECT error_summary FROM sync_runs WHERE domain_id = 'gyosei-shobun-mhlw' ORDER BY finished_at DESC LIMIT 1"
    ).get();
    if (lastRun?.error_summary) {
      const lastSlug = lastRun.error_summary;
      const idx = LABOR_BUREAUS.findIndex((b) => b.slug === lastSlug);
      if (idx >= 0) offset = (idx + 1) % LABOR_BUREAUS.length;
    }
  } catch { /* ignore */ }

  const rotated = [...LABOR_BUREAUS.slice(offset), ...LABOR_BUREAUS.slice(0, offset)];
  const targets = rotated.slice(0, maxBureaus);
  log(`Start: ${targets.length} bureaus from offset=${offset}`);

  const perBureau = [];
  let totalEntries = 0;
  let totalCreated = 0;
  let totalUpdated = 0;

  for (const bureau of targets) {
    try {
      const r = await processBureau({ bureau, db, upsertStmt, dryRun, log });
      perBureau.push({ pref: bureau.pref, ...r });
      totalEntries += r.entries || 0;
      totalCreated += r.created || 0;
      totalUpdated += r.updated || 0;
      await sleep(1500);
    } catch (e) {
      log(`  ! ${bureau.pref}: ${e.message}`);
      perBureau.push({ pref: bureau.pref, error: e.message, entries: 0, created: 0, updated: 0 });
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log(`Done: entries=${totalEntries} created=${totalCreated} updated=${totalUpdated} (${elapsed}s)`);

  if (!dryRun) {
    try {
      const lastSlug = targets.length > 0 ? targets[targets.length - 1].slug : null;
      db.prepare(`
        INSERT INTO sync_runs (domain_id, run_type, run_status, fetched_count, created_count, updated_count, error_summary, started_at, finished_at)
        VALUES ('gyosei-shobun-mhlw', 'scheduled', 'completed', ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(totalEntries, totalCreated, totalUpdated, lastSlug);
    } catch { /* ignore */ }
  }

  return { ok: true, perBureau, totalEntries, totalCreated, totalUpdated, elapsed };
}

async function processBureau({ bureau, db, upsertStmt, dryRun, log }) {
  log(`📍 ${bureau.pref}`);

  // トップから動的に公表事案ページを探す
  const indexUrl = await resolveAnnouncementUrl(bureau.slug);
  if (!indexUrl) {
    log(`  - 公表事案ページが見つからない`);
    return { entries: 0, created: 0, updated: 0 };
  }
  log(`  → index: ${indexUrl}`);

  let indexHtml;
  try {
    const indexRes = await fetch(indexUrl, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!indexRes.ok) throw new Error(`index HTTP ${indexRes.status}`);
    indexHtml = await indexRes.text();
  } catch (e) {
    return { entries: 0, created: 0, updated: 0, error: e.message };
  }

  // PDF リンクを抽出
  const pdfPattern = /<a[^>]*href="([^"]+\.pdf)"[^>]*>([^<]{3,200})<\/a>/gi;
  const pdfLinks = [];
  let m;
  while ((m = pdfPattern.exec(indexHtml)) !== null) {
    let href = m[1];
    if (href.startsWith("/")) href = `https://jsite.mhlw.go.jp${href}`;
    else if (!href.startsWith("http")) href = new URL(href, indexUrl).href;
    pdfLinks.push({ url: href, label: m[2].trim() });
  }
  if (pdfLinks.length === 0) {
    log(`  - no PDF found`);
    return { entries: 0, created: 0, updated: 0 };
  }
  // 最も該当しそうな1〜2 PDF を選定（「公表事案」「労働基準」を含むもの優先）
  const sorted = pdfLinks.sort((a, b) => {
    const sa = (/公表事案|労働基準|送検|公表|違反/.test(a.label) ? 1 : 0);
    const sb = (/公表事案|労働基準|送検|公表|違反/.test(b.label) ? 1 : 0);
    return sb - sa;
  });
  const targets = sorted.slice(0, 2);

  let entries = 0, created = 0, updated = 0;
  for (const { url } of targets) {
    try {
      const pdfRes = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!pdfRes.ok) continue;
      const buf = Buffer.from(await pdfRes.arrayBuffer());

      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buf });
      const result = await parser.getText();
      const text = result.text || "";

      const items = parsePdfTextToEntries(text, bureau.pref);
      for (const item of items) {
        if (shouldSkipAsCompanyName(item.org)) continue;
        entries++;
        if (dryRun) continue;
        try {
          const slug = `mhlw-black-${bureau.slug}-${slugify(item.org)}-${(item.action_date || "").replace(/-/g, "")}`;
          const before = db.prepare("SELECT id FROM administrative_actions WHERE slug = ?").get(slug);
          upsertStmt.run({
            slug,
            org: item.org.slice(0, 100),
            action_type: "labor_violation",
            action_date: item.action_date || null,
            authority: bureau.pref + "労働局",
            prefecture: bureau.pref,
            city: item.city || null,
            industry: "labor",
            summary: item.summary ? item.summary.slice(0, 500) : null,
            source_name: "労働基準関係法令違反公表事案",
            source_url: url,
          });
          before ? updated++ : created++;
        } catch { /* ignore */ }
      }
      await sleep(800);
    } catch (e) {
      log(`  ! pdf ${url.slice(-30)}: ${e.message}`);
    }
  }
  log(`  → entries=${entries} created=${created} updated=${updated}`);
  return { entries, created, updated };
}

/** PDFのテキストから企業ごとのエントリを抽出 */
function parsePdfTextToEntries(text, prefecture) {
  const entries = [];
  // 行ベースに分割（スペース＋改行） — PDFは複数列のためテーブル列を再構成
  // PDFテキスト形式の典型: "企業名 所在地 公表日 違反法条 事案概要 ..."
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // 公表日らしき "R[78]\.\d{1,2}\.\d{1,2}" を持つ行を起点にする
    const dateMatch = line.match(/R(\d+)\.(\d{1,2})\.(\d{1,2})/);
    if (!dateMatch) { i++; continue; }

    // この行を解析: 企業名 所在地 R7.X.X 違反法条
    // 構造例: "青南建設（株） 東京都八王子市 R7.6.17 労働安全衛生法第45条"
    // 正規表現で構造を抽出
    const segMatch = line.match(/^(.+?)\s+([^\s]+(?:都|道|府|県)[^\s]*)\s+R(\d+)\.(\d{1,2})\.(\d{1,2})\s*(.*)$/);
    let org, city, action_date, lawText = "";
    if (segMatch) {
      org = segMatch[1].trim();
      city = segMatch[2].trim();
      const y = 2018 + parseInt(segMatch[3]);
      action_date = `${y}-${segMatch[4].padStart(2, "0")}-${segMatch[5].padStart(2, "0")}`;
      lawText = segMatch[6].trim();
    } else {
      // フォールバック: 日付の前後を切り出す
      const before = line.slice(0, dateMatch.index).trim();
      const parts = before.split(/\s+/);
      city = parts[parts.length - 1] || null;
      org = parts.slice(0, -1).join(" ").trim();
      const y = 2018 + parseInt(dateMatch[1]);
      action_date = `${y}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
      lawText = line.slice(dateMatch.index + dateMatch[0].length).trim();
    }

    // 次の数行を summary として連結（次の日付行まで）
    const summaryLines = [lawText];
    let j = i + 1;
    while (j < lines.length && j < i + 6) {
      const next = lines[j];
      if (/R\d+\.\d{1,2}\.\d{1,2}/.test(next)) break;
      summaryLines.push(next);
      j++;
    }

    if (org && org.length >= 2) {
      entries.push({
        org,
        city,
        action_date,
        summary: summaryLines.join(" / ").slice(0, 500),
      });
    }
    i = j;
  }
  return entries;
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
