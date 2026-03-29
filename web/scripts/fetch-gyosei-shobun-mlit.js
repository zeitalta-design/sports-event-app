#!/usr/bin/env node
/**
 * 行政処分DB — MLIT ネガティブ情報検索サイト自動取得スクリプト
 *
 * 国土交通省ネガティブ情報等検索サイトから建設業者の行政処分情報を取得し、
 * 正規化して DB に投入する。
 *
 * Usage:
 *   node scripts/fetch-gyosei-shobun-mlit.js --dry-run          # 取得のみ、DB書き込みなし
 *   node scripts/fetch-gyosei-shobun-mlit.js --limit=10         # 最大10件取得
 *   node scripts/fetch-gyosei-shobun-mlit.js                    # 全件取得・投入
 *   node scripts/fetch-gyosei-shobun-mlit.js --since=2026-01-01 # 指定日以降のみ
 */

const https = require("https");
const { URL, URLSearchParams } = require("url");

// ─── 設定 ───
const SEARCH_URL = "https://www.mlit.go.jp/nega-inf/cgi-bin/search.cgi";
const RESULTS_PER_PAGE = 100; // MLIT default

// ─── CLI引数 ───
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = (() => {
  const m = args.find((a) => a.startsWith("--limit="));
  return m ? parseInt(m.split("=")[1]) : null;
})();
const SINCE = (() => {
  const m = args.find((a) => a.startsWith("--since="));
  return m ? m.split("=")[1] : null;
})();

// ─── HTTP POST ───
function postForm(url, formData) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(formData).toString();
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent": "TaikaiNavi-GyoseiShobun/1.0 (data aggregation)",
      },
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─── HTML パーサー（正規表現ベース、軽量） ───
function parseResultsPage(html) {
  const items = [];

  // 検索結果件数
  const totalMatch = html.match(/検索結果：(\d+)件/);
  const totalCount = totalMatch ? parseInt(totalMatch[1]) : 0;

  // テーブル行を解析
  // 各結果行は <tr> 内に <td> が6個（商号、所在地、処分日、処分者、処分内容、詳細リンク）
  const rowRegex = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;

  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const nameRaw = stripTags(match[1]).trim();
    const address = stripTags(match[2]).trim();
    const dateRaw = stripTags(match[3]).trim();
    const authority = stripTags(match[4]).trim();
    const actionType = stripTags(match[5]).trim();
    const detailHtml = match[6];

    // ヘッダー行をスキップ
    if (nameRaw.includes("商号") || nameRaw.includes("名称")) continue;

    // 法人番号を抽出（半角・全角括弧対応）
    const corpNumMatch = nameRaw.match(/[（\(](\d{13})[）\)]/);
    const corporateNumber = corpNumMatch ? corpNumMatch[1] : null;
    const companyName = nameRaw.replace(/\s*[（\(]\d{13}[）\)]\s*/, "").trim();

    // 詳細リンクを抽出
    const linkMatch = detailHtml.match(/href="([^"]+)"/);
    const detailUrl = linkMatch ? new URL(linkMatch[1], SEARCH_URL).href : null;

    // 日付を正規化
    const normalizedDate = normalizeDate(dateRaw);

    // 都道府県を住所から抽出
    const prefecture = extractPrefecture(address);

    if (companyName && normalizedDate) {
      items.push({
        company_name: companyName,
        corporate_number: corporateNumber,
        address,
        action_date: normalizedDate,
        authority,
        action_type_raw: actionType,
        action_type: normalizeActionType(actionType),
        prefecture,
        detail_url: detailUrl,
        source_url: SEARCH_URL,
        source_name: "国土交通省 ネガティブ情報等検索サイト",
      });
    }
  }

  return { totalCount, items };
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

function normalizeDate(raw) {
  // "2026年3月26日" → "2026-03-26"
  const m = raw.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  return null;
}

function extractPrefecture(address) {
  const m = address.match(/^(北海道|東京都|大阪府|京都府|.{2,3}県)/);
  return m ? m[1] : null;
}

function normalizeActionType(raw) {
  if (!raw) return "other";
  if (raw.includes("取消")) return "license_revocation";
  if (raw.includes("営業停止") || raw.includes("事業停止")) return "business_suspension";
  if (raw.includes("改善")) return "improvement_order";
  if (raw.includes("指示") || raw.includes("警告")) return "warning";
  if (raw.includes("指導") || raw.includes("勧告")) return "guidance";
  return "other";
}

function generateSlug(item) {
  const datePart = (item.action_date || "unknown").replace(/-/g, "");
  const orgPart = item.company_name
    .replace(/株式会社|有限会社|合同会社|（株）|\(株\)/g, "")
    .trim()
    .substring(0, 12);
  const typePart = item.action_type;
  return `${datePart}-${typePart}-${orgPart}`
    .replace(/\s+/g, "-")
    .replace(/[^\w\u3000-\u9FFF-]/g, "")
    .replace(/-+/g, "-")
    .replace(/-$/, "")
    .substring(0, 80);
}

// ─── 詳細ページ取得（オプション） ───
async function fetchDetail(url) {
  if (!url) return null;
  try {
    const html = await new Promise((resolve, reject) => {
      https.get(url, { headers: { "User-Agent": "TaikaiNavi-GyoseiShobun/1.0" } }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      }).on("error", reject);
    });

    // summary / legal_basis / penalty_period を抽出
    const summaryMatch = html.match(/処分の原因となった事実[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
    const legalMatch = html.match(/処分等の内容[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);

    return {
      summary: summaryMatch ? stripTags(summaryMatch[1]).trim().substring(0, 500) : null,
      detail: legalMatch ? stripTags(legalMatch[1]).trim().substring(0, 500) : null,
    };
  } catch {
    return null;
  }
}

// ─── DB投入 ───
async function upsertItems(items) {
  const Database = require("better-sqlite3");
  const { join } = require("path");
  const dbPath = join(__dirname, "..", "data", "sports-event.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  let created = 0, updated = 0, skipped = 0;

  const upsertStmt = db.prepare(`
    INSERT INTO administrative_actions (
      slug, organization_name_raw, action_type, action_date,
      authority_name, authority_level, prefecture, industry,
      summary, detail, legal_basis, source_url, source_name,
      is_published, review_status
    ) VALUES (
      @slug, @organization_name_raw, @action_type, @action_date,
      @authority_name, @authority_level, @prefecture, @industry,
      @summary, @detail, @legal_basis, @source_url, @source_name,
      @is_published, @review_status
    )
    ON CONFLICT(slug) DO UPDATE SET
      organization_name_raw=@organization_name_raw, action_type=@action_type,
      action_date=@action_date, authority_name=@authority_name,
      prefecture=@prefecture, summary=@summary, detail=@detail,
      source_url=@source_url, updated_at=datetime('now')
  `);

  for (const item of items) {
    const slug = generateSlug(item);
    const existing = db.prepare("SELECT id FROM administrative_actions WHERE slug = ?").get(slug);

    try {
      upsertStmt.run({
        slug,
        organization_name_raw: item.company_name,
        action_type: item.action_type,
        action_date: item.action_date,
        authority_name: item.authority,
        authority_level: "national",
        prefecture: item.prefecture,
        industry: "construction",
        summary: item.summary || `${item.action_type_raw}。${item.authority}による処分。`,
        detail: item.detail || null,
        legal_basis: null,
        source_url: item.detail_url || item.source_url,
        source_name: item.source_name,
        is_published: 1,
        review_status: "approved",
      });

      if (existing) { updated++; } else { created++; }
    } catch (e) {
      console.error(`  ❌ ${slug}: ${e.message}`);
      skipped++;
    }
  }

  const total = db.prepare("SELECT COUNT(*) as c FROM administrative_actions WHERE is_published = 1").get().c;
  db.close();

  return { created, updated, skipped, total };
}

// ─── メイン処理 ───
async function main() {
  console.log("=== 行政処分DB — MLIT自動取得 ===");
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "LIVE"}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);
  if (SINCE) console.log(`Since: ${SINCE}`);

  // 検索期間の設定
  const now = new Date();
  const startYear = SINCE ? SINCE.split("-")[0] : String(now.getFullYear() - 1);
  const startMonth = SINCE ? SINCE.split("-")[1] : "1";
  const endYear = String(now.getFullYear());
  const endMonth = String(now.getMonth() + 1);

  console.log(`\n[1/4] MLIT検索実行: ${startYear}/${startMonth} ～ ${endYear}/${endMonth}`);

  const formData = {
    jigyoubunya: "kensetugyousya",
    EID: "search",
    agency: "",
    start_year: startYear,
    start_month: startMonth,
    end_year: endYear,
    end_month: endMonth,
    disposal_name1: "",
    disposal_name2: "",
    address: "",
    shobun: "",
    reason1: "",
    reason2: "",
    reason3: "",
    radio1: "OR",
  };

  const html = await postForm(SEARCH_URL, formData);
  const { totalCount, items } = parseResultsPage(html);
  console.log(`  検索結果: ${totalCount}件（ページ1取得: ${items.length}件）`);

  if (items.length === 0) {
    console.log("  ⚠️ 結果が取得できませんでした。HTMLパースを確認してください。");
    if (html.includes("検索結果")) {
      console.log("  HTML内に '検索結果' は存在します。テーブル構造が変更された可能性があります。");
    }
    return;
  }

  // 日付フィルタ
  let filtered = items;
  if (SINCE) {
    filtered = items.filter((i) => i.action_date >= SINCE);
    console.log(`  日付フィルタ後: ${filtered.length}件`);
  }

  // 件数制限
  if (LIMIT && filtered.length > LIMIT) {
    filtered = filtered.slice(0, LIMIT);
    console.log(`  制限適用: ${filtered.length}件`);
  }

  console.log(`\n[2/4] パース結果サンプル:`);
  for (const item of filtered.slice(0, 5)) {
    console.log(`  ${item.action_date} | ${item.company_name} | ${item.action_type_raw} | ${item.authority} | ${item.prefecture || "?"}`);
  }

  // 詳細ページ取得（最初の数件のみ、レート制限考慮）
  console.log(`\n[3/4] 詳細ページ取得（最大5件）...`);
  const DETAIL_LIMIT = Math.min(5, filtered.length);
  for (let i = 0; i < DETAIL_LIMIT; i++) {
    if (filtered[i].detail_url) {
      const detail = await fetchDetail(filtered[i].detail_url);
      if (detail) {
        filtered[i].summary = detail.summary || filtered[i].summary;
        filtered[i].detail = detail.detail || filtered[i].detail;
        console.log(`  ✅ ${filtered[i].company_name}: summary取得`);
      }
      // レート制限: 1秒待機
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  if (DRY_RUN) {
    console.log(`\n[4/4] DRY-RUN: DB書き込みスキップ`);
    console.log(`  投入候補: ${filtered.length}件`);
    console.log(`\n--- JSON出力 ---`);
    console.log(JSON.stringify(filtered.slice(0, 3), null, 2));
    return;
  }

  console.log(`\n[4/4] DB投入: ${filtered.length}件`);
  const result = await upsertItems(filtered);
  console.log(`  created: ${result.created}, updated: ${result.updated}, skipped: ${result.skipped}`);
  console.log(`  全公開件数: ${result.total}`);

  console.log("\n=== 完了 ===");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
