#!/usr/bin/env node
/**
 * 行政処分DB — MLIT ネガティブ情報検索サイト自動取得スクリプト
 *
 * 国土交通省ネガティブ情報等検索サイトから建設業者の行政処分情報を
 * 全ページ巡回して取得し、正規化・重複排除・DB投入する。
 *
 * Usage:
 *   node scripts/fetch-gyosei-shobun-mlit.js --dry-run              # 取得のみ、DB書き込みなし
 *   node scripts/fetch-gyosei-shobun-mlit.js --dry-run --max-pages=3 # 3ページだけ試験取得
 *   node scripts/fetch-gyosei-shobun-mlit.js --limit=30             # 最大30件取得・投入
 *   node scripts/fetch-gyosei-shobun-mlit.js --max-pages=5          # 5ページ分投入
 *   node scripts/fetch-gyosei-shobun-mlit.js                        # 全件取得・投入（建設業）
 *   node scripts/fetch-gyosei-shobun-mlit.js --since=2026-01-01     # 指定日以降のみ
 *   node scripts/fetch-gyosei-shobun-mlit.js --sector=takuti        # 宅建業を取得
 *   node scripts/fetch-gyosei-shobun-mlit.js --sector=ikkyuu        # 一級建築士を取得
 */

const https = require("https");
const { URL, URLSearchParams } = require("url");

// ─── 設定 ───
const SEARCH_URL = "https://www.mlit.go.jp/nega-inf/cgi-bin/search.cgi";
const ITEMS_PER_PAGE = 10; // MLIT固定
const PAGE_DELAY_MS = 1500; // ページ間待機
const DETAIL_DELAY_MS = 1000; // 詳細取得間待機
const MAX_DETAIL_FETCH = 20; // 詳細取得上限（レート制限考慮）

// ─── CLI引数 ───
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const NO_DETAIL = args.includes("--no-detail");
const LIMIT = getArgInt("--limit");
const MAX_PAGES = getArgInt("--max-pages");
const SINCE = getArgStr("--since");
const SECTOR = getArgStr("--sector") || "kensetugyousya";

// ─── 業種別定義 ───
const SECTOR_DEFS = {
  kensetugyousya: {
    label: "建設業者",
    industry: "construction",
    // カラム順: 商号, 所在地, 処分日, 処分者, 処分内容, 詳細
    colMap: (cols) => ({
      nameRaw: cols[0], address: cols[1], dateRaw: cols[2],
      authority: cols[3], actionTypeRaw: cols[4], detailHtml: cols[5],
    }),
    headerSkip: (c) => c.includes("商号") || c.includes("名称"),
  },
  takuti: {
    label: "宅建業者",
    industry: "real_estate",
    // カラム順: 処分日, 処分者, 事業者名, 本社住所, 処分種類, 処分内容
    colMap: (cols) => ({
      dateRaw: cols[0], authority: cols[1], nameRaw: cols[2],
      address: cols[3], actionTypeRaw: cols[4], detailHtml: cols[5],
    }),
    headerSkip: (c) => c.includes("処分等年月日") || c.includes("処分年月日"),
  },
  ikkyuu: {
    label: "一級建築士",
    industry: "architecture",
    // 一級建築士も宅建業と同じカラム順
    colMap: (cols) => ({
      dateRaw: cols[0], authority: cols[1], nameRaw: cols[2],
      address: cols[3], actionTypeRaw: cols[4], detailHtml: cols[5],
    }),
    headerSkip: (c) => c.includes("処分等年月日") || c.includes("処分年月日"),
  },
  shimeiteishi: {
    label: "指名停止",
    industry: "construction",
    colMap: (cols) => ({
      dateRaw: cols[0], authority: cols[1], nameRaw: cols[2],
      address: cols[3], actionTypeRaw: cols[4], detailHtml: cols[5],
    }),
    headerSkip: (c) => c.includes("処分等年月日") || c.includes("処分年月日") || c.includes("指名停止"),
  },
};

const sectorDef = SECTOR_DEFS[SECTOR];
if (!sectorDef) {
  console.error("Unknown sector:", SECTOR, "Available:", Object.keys(SECTOR_DEFS).join(", "));
  process.exit(1);
}

function getArgInt(prefix) {
  const m = args.find((a) => a.startsWith(prefix + "="));
  return m ? parseInt(m.split("=")[1]) : null;
}
function getArgStr(prefix) {
  const m = args.find((a) => a.startsWith(prefix + "="));
  return m ? m.split("=")[1] : null;
}

// ─── HTTP ───
function httpGet(urlStr) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    https.get({
      hostname: u.hostname, path: u.pathname + u.search,
      headers: { "User-Agent": "TaikaiNavi-GyoseiShobun/1.0 (data aggregation)" },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    }).on("error", reject);
  });
}

function httpPost(url, formData) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(formData).toString();
    const u = new URL(url);
    https.request({
      hostname: u.hostname, port: 443, path: u.pathname, method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent": "TaikaiNavi-GyoseiShobun/1.0 (data aggregation)",
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    }).on("error", reject).end(body);
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ─── HTML パーサー ───
function parseResultsPage(html) {
  const items = [];

  const totalMatch = html.match(/検索結果：(\d+)件/);
  const totalCount = totalMatch ? parseInt(totalMatch[1]) : 0;

  // 最終ページ番号を取得
  const lastPageMatch = html.match(/page=(\d+)[^"]*">最後/);
  const lastPage = lastPageMatch ? parseInt(lastPageMatch[1]) : 1;

  // ページ2以降のベースURL抽出
  const pageUrlMatch = html.match(/href="(search\.cgi\?[^"]*page=)\d+/);
  const pageUrlBase = pageUrlMatch
    ? `https://www.mlit.go.jp/nega-inf/cgi-bin/${pageUrlMatch[1]}`
    : null;

  // テーブル行を解析
  const rowRegex = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;

  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const rawCols = [1, 2, 3, 4, 5, 6].map((i) => match[i]);
    const strippedCols = rawCols.map((c) => stripTags(c).trim());

    // ヘッダー行スキップ（業種別判定）
    if (sectorDef.headerSkip(strippedCols[0])) continue;

    // 業種別カラムマッピング
    const mapped = sectorDef.colMap(strippedCols);
    const nameRaw = mapped.nameRaw;
    const address = mapped.address;
    const dateRaw = mapped.dateRaw;
    const authority = mapped.authority;
    const actionTypeRaw = mapped.actionTypeRaw;
    // detailHtmlは生HTMLが必要（リンク抽出用）
    const detailHtml = sectorDef.colMap(rawCols).detailHtml;

    const corpNumMatch = nameRaw.match(/[（\(](\d{13})[）\)]/);
    const corporateNumber = corpNumMatch ? corpNumMatch[1] : null;
    const companyName = nameRaw.replace(/\s*[（\(]\d{13}[）\)]\s*/, "").trim();

    const linkMatch = detailHtml.match(/href="([^"]+)"/);
    const detailUrl = linkMatch
      ? new URL(linkMatch[1], SEARCH_URL).href
      : null;

    const normalizedDate = normalizeDate(dateRaw);
    const prefecture = extractPrefecture(address);

    if (companyName && normalizedDate) {
      items.push({
        company_name: companyName,
        corporate_number: corporateNumber,
        address,
        action_date: normalizedDate,
        authority,
        action_type_raw: actionTypeRaw,
        action_type: normalizeActionType(actionTypeRaw),
        prefecture,
        detail_url: detailUrl,
        source_url: SEARCH_URL,
        source_name: "国土交通省 ネガティブ情報等検索サイト",
      });
    }
  }

  return { totalCount, lastPage, pageUrlBase, items };
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

function normalizeDate(raw) {
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
    .trim().substring(0, 12);
  const typePart = item.action_type;
  return `${datePart}-${typePart}-${orgPart}`
    .replace(/\s+/g, "-")
    .replace(/[^\w\u3000-\u9FFF-]/g, "")
    .replace(/-+/g, "-").replace(/-$/, "")
    .substring(0, 80);
}

// ─── 詳細ページ取得 ───
async function fetchDetail(url) {
  if (!url) return null;
  try {
    const html = await httpGet(url);
    const summaryMatch = html.match(/処分の原因となった事実[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
    const legalMatch = html.match(/処分等の内容[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
    return {
      summary: summaryMatch ? stripTags(summaryMatch[1]).trim().substring(0, 500) : null,
      detail: legalMatch ? stripTags(legalMatch[1]).trim().substring(0, 500) : null,
    };
  } catch { return null; }
}

// ─── DB投入 ───
async function upsertItems(items) {
  const Database = require("better-sqlite3");
  const { join } = require("path");
  const db = new Database(join(__dirname, "..", "data", "sports-event.db"));
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
        industry: sectorDef.industry,
        summary: item.summary || `${item.action_type_raw}。${item.authority}による処分。`,
        detail: item.detail || null,
        legal_basis: null,
        source_url: item.detail_url || item.source_url,
        source_name: item.source_name,
        is_published: 1,
        review_status: "approved",
      });
      if (existing) updated++; else created++;
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
  console.log(`=== 行政処分DB — MLIT自動取得（${sectorDef.label}） ===`);
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "LIVE"} | Sector: ${SECTOR} (${sectorDef.label})`);
  if (MAX_PAGES) console.log(`Max pages: ${MAX_PAGES}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);
  if (SINCE) console.log(`Since: ${SINCE}`);
  if (NO_DETAIL) console.log(`Detail fetch: DISABLED`);

  const now = new Date();
  const startYear = SINCE ? SINCE.split("-")[0] : String(now.getFullYear() - 1);
  const startMonth = SINCE ? SINCE.split("-")[1] : "1";
  const endYear = String(now.getFullYear());
  const endMonth = String(now.getMonth() + 1);

  // ── ページ1: POST で検索実行 ──
  console.log(`\n[1] 検索実行: ${startYear}/${startMonth} ～ ${endYear}/${endMonth}`);

  const formData = {
    jigyoubunya: SECTOR, EID: "search", agency: "",
    start_year: startYear, start_month: startMonth,
    end_year: endYear, end_month: endMonth,
    disposal_name1: "", disposal_name2: "", address: "",
    shobun: "", reason1: "", reason2: "", reason3: "", radio1: "OR",
  };

  const page1Html = await httpPost(SEARCH_URL, formData);
  const page1 = parseResultsPage(page1Html);

  console.log(`  総件数: ${page1.totalCount}件, 全${page1.lastPage}ページ`);
  console.log(`  ページ1: ${page1.items.length}件取得`);

  if (page1.items.length === 0) {
    console.log("  ⚠️ ページ1で結果が取れません。HTML構造を確認してください。");
    return;
  }

  // ── ページ巡回 ──
  const allItems = [...page1.items];
  const pagesToFetch = MAX_PAGES ? Math.min(MAX_PAGES, page1.lastPage) : page1.lastPage;

  if (pagesToFetch > 1 && page1.pageUrlBase) {
    console.log(`\n[2] ページ巡回: ページ2〜${pagesToFetch}`);

    for (let p = 2; p <= pagesToFetch; p++) {
      if (LIMIT && allItems.length >= LIMIT) {
        console.log(`  → limit=${LIMIT} に到達、巡回停止`);
        break;
      }

      await sleep(PAGE_DELAY_MS);
      const pageUrl = `${page1.pageUrlBase}${p}`;

      try {
        const html = await httpGet(pageUrl);
        const result = parseResultsPage(html);
        allItems.push(...result.items);
        process.stdout.write(`  ページ${p}: +${result.items.length}件 (累計${allItems.length})\r\n`);
      } catch (e) {
        console.error(`  ❌ ページ${p}取得失敗: ${e.message}`);
      }
    }
  } else {
    console.log(`\n[2] 単一ページ（巡回不要）`);
  }

  // ── 日付フィルタ / 件数制限 ──
  let filtered = allItems;
  if (SINCE) {
    filtered = filtered.filter((i) => i.action_date >= SINCE);
    console.log(`\n  日付フィルタ後: ${filtered.length}件`);
  }
  if (LIMIT && filtered.length > LIMIT) {
    filtered = filtered.slice(0, LIMIT);
    console.log(`  制限適用: ${filtered.length}件`);
  }

  console.log(`\n[3] 取得結果: ${filtered.length}件（${pagesToFetch}ページ巡回）`);
  console.log(`  サンプル:`);
  for (const item of filtered.slice(0, 5)) {
    console.log(`    ${item.action_date} | ${item.company_name} | ${item.action_type_raw} | ${item.authority}`);
  }

  // ── 詳細ページ取得 ──
  if (!NO_DETAIL) {
    const detailCount = Math.min(MAX_DETAIL_FETCH, filtered.length);
    console.log(`\n[4] 詳細ページ取得（${detailCount}件）...`);
    let fetched = 0;
    for (let i = 0; i < detailCount; i++) {
      if (filtered[i].detail_url) {
        const detail = await fetchDetail(filtered[i].detail_url);
        if (detail) {
          filtered[i].summary = detail.summary || filtered[i].summary;
          filtered[i].detail = detail.detail || filtered[i].detail;
          fetched++;
        }
        await sleep(DETAIL_DELAY_MS);
      }
    }
    console.log(`  取得成功: ${fetched}件`);
  } else {
    console.log(`\n[4] 詳細取得スキップ（--no-detail）`);
  }

  // ── DB投入 or dry-run ──
  if (DRY_RUN) {
    console.log(`\n[5] DRY-RUN: DB書き込みスキップ`);
    console.log(`  投入候補: ${filtered.length}件`);
    if (filtered.length > 0) {
      console.log(`\n  最初の3件 JSON:`);
      console.log(JSON.stringify(filtered.slice(0, 3).map(i => ({
        company: i.company_name, date: i.action_date, type: i.action_type_raw,
        authority: i.authority, prefecture: i.prefecture, corp_num: i.corporate_number,
      })), null, 2));
    }
    return;
  }

  console.log(`\n[5] DB投入: ${filtered.length}件`);
  const result = await upsertItems(filtered);
  console.log(`  created: ${result.created}, updated: ${result.updated}, skipped: ${result.skipped}`);
  console.log(`  全公開件数: ${result.total}`);

  console.log("\n=== 完了 ===");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
