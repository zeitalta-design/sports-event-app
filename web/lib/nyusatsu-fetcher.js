/**
 * 入札（nyusatsu）取得ロジック
 *
 * ソース:
 *   - maff:  農林水産省 入札公告・補助事業公募一覧
 *   - meti:  経済産業省 公募・入札情報
 *   - soumu: 総務省 入札・公募情報
 *   - mhlw:  厚生労働省 調達情報
 *   - mlit:  国土交通省 調達情報
 *   - env:   環境省 調達情報
 *
 * 【Phase 1 Step 2.5 以降】
 * このモジュールは「取得 + パースのみ」に特化（DB 書込みは pipeline の責務）。
 * 旧 fetchAndUpsertNyusatsu は削除。呼び出し側は
 *   collectCentralMinistriesRaw → processCentralMinistries（lib/agents/pipeline/nyusatsu.js）
 * の2段階で使う。
 */
import * as XLSX from "xlsx";

const UA = "Mozilla/5.0 (compatible; RiskMonitor/1.0)";
const FETCH_TIMEOUT_MS = 20000;

/** 6省庁の scrape 関数を束ねる定義（pipeline からも参照可能） */
export const CENTRAL_MINISTRY_SOURCES = [
  { name: "maff",  label: "農林水産省",   scrape: () => scrapeMaff() },
  { name: "meti",  label: "経済産業省",   scrape: () => scrapeMeti() },
  { name: "soumu", label: "総務省",       scrape: () => scrapeSoumu() },
  { name: "mhlw",  label: "厚生労働省",   scrape: () => scrapeMhlw() },
  { name: "mlit",  label: "国土交通省",   scrape: () => scrapeMlit() },
  { name: "env",   label: "環境省",       scrape: () => scrapeEnv() },
];

/**
 * 6省庁すべてから生レコードを取得（DB 書込みなし）。
 *
 * @param {Object}   [opts]
 * @param {function} [opts.logger]
 * @returns {Promise<{
 *   perSource: Array<{ name: string, label: string, items: Array, error?: string }>,
 *   totalFetched: number
 * }>}
 */
export async function collectCentralMinistriesRaw({ logger = console.log } = {}) {
  const log = (msg) => logger(`[nyusatsu-collect] ${msg}`);
  const perSource = [];
  let totalFetched = 0;

  for (const src of CENTRAL_MINISTRY_SOURCES) {
    try {
      const rows = await src.scrape();
      // ソース名・発注者名を各 row に付与（formatter がこれを利用する）
      const items = rows.map((r) => ({ ...r, source: src.name, issuer: src.label }));
      log(`${src.name}: ${items.length}件取得`);
      perSource.push({ name: src.name, label: src.label, items });
      totalFetched += items.length;
    } catch (e) {
      log(`${src.name} failed: ${e.message}`);
      perSource.push({ name: src.name, label: src.label, items: [], error: e.message });
    }
  }

  log(`合計 ${totalFetched} 件取得`);
  return { perSource, totalFetched };
}

// ─── 下位ヘルパー（pipeline から参照） ─────────────────────
export { toSlug, parseJaDate, inferCategory };

// （旧 fetchAndUpsertNyusatsu は削除。pipeline からは
//  collectCentralMinistriesRaw + processCentralMinistries を使う）

// ─── スクレイパー ────────────────────────────

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function clean(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractRows(html) {
  return [...(html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [])];
}

function extractCells(row) {
  return [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => clean(m[1]));
}

function firstHref(row, baseUrl) {
  const m = row.match(/href=["']([^"'\s>]+)/i);
  if (!m) return "";
  const h = m[1];
  if (h.startsWith("http")) return h;
  try {
    return new URL(h, baseUrl).href;
  } catch {
    return "";
  }
}

async function scrapeMaff() {
  const base = "https://www.maff.go.jp";
  const url = `${base}/j/supply/hozyo/index.html`;
  const html = await fetchText(url);
  const rows = extractRows(html);
  const results = [];
  const seen = new Set();
  for (const row of rows) {
    const cells = extractCells(row);
    if (cells.length < 3) continue;
    if (!/令和\d+年/.test(cells[0])) continue;
    const title = cells[2];
    if (!title || title.length < 5 || seen.has(title)) continue;
    seen.add(title);
    results.push({
      announce_date: cells[0],
      deadline: cells[1] || "",
      title,
      detail_url: firstHref(row, base),
    });
  }
  return results;
}

async function scrapeMeti() {
  // METI は入札情報一覧がリンク羅列形式
  const base = "https://www.meti.go.jp";
  const url = `${base}/information_2/publicoffer/00_bid_news_list.html`;
  const html = await fetchText(url);
  return extractAnnouncementLinks(html, base).slice(0, 80);
}

async function scrapeSoumu() {
  // 総務省: 公募公告 + 公募等（Shift_JIS配信のためバッファ→TextDecoderで対応）
  const base = "https://www.soumu.go.jp";
  const candidates = [
    `${base}/menu_sinsei/cyoutatsu/koubo.html`,
    `${base}/menu_sinsei/cyoutatsu/kikaku_koubo.html`,
  ];
  const all = [];
  for (const url of candidates) {
    try {
      const html = await fetchTextFlexible(url);
      all.push(...extractAnnouncementLinks(html, base));
    } catch { /* next */ }
  }
  // 重複除去
  const seen = new Set();
  const results = [];
  for (const r of all) {
    if (seen.has(r.title)) continue;
    seen.add(r.title);
    results.push(r);
  }
  return results.slice(0, 60);
}

async function scrapeMhlw() {
  // 厚生労働省: 地方厚生（支）局の入札公告（実案件PDFへのリンク）
  // 本省のページは「調達ポータル」に集約されておりAPI/RSSも無いため、
  // 地方厚生局の年度別サブページから PDF タイトルを案件として抽出する。
  const base = "https://kouseikyoku.mhlw.go.jp";
  const indexUrl = `${base}/kantoshinetsu/chotatsu/nyusatsu/index.html`;

  let indexHtml;
  try {
    indexHtml = await fetchTextFlexible(indexUrl);
  } catch {
    return [];
  }

  // 年度別ページ（令和X年度）のリンクを抽出
  const yearLinks = [];
  const yearPattern = /<a[^>]*href="([^"]+nyusatsur3[^"]*\.html)"[^>]*>[^<]*令和\d+年度[^<]*<\/a>/gi;
  let m;
  while ((m = yearPattern.exec(indexHtml)) !== null) {
    let href = m[1];
    if (href.startsWith("/")) href = `${base}${href}`;
    else if (!href.startsWith("http")) href = new URL(href, indexUrl).href;
    if (!yearLinks.includes(href)) yearLinks.push(href);
  }
  // 最新年度から2つだけ処理（件数制限）
  const targets = yearLinks.slice(-2);

  const results = [];
  const seen = new Set();
  for (const url of targets) {
    try {
      const html = await fetchTextFlexible(url);
      // PDFリンクのテキストを案件名として扱う
      const pdfPattern = /<a[^>]*href="([^"]+\.pdf)"[^>]*>([^<]{10,200})<\/a>/gi;
      let pm;
      while ((pm = pdfPattern.exec(html)) !== null) {
        const href = pm[1];
        const title = clean(pm[2]).replace(/[［\[][\d.,A-Z]+[］\]]$/, "").trim();
        if (!title || title.length < 10 || seen.has(title)) continue;
        seen.add(title);
        let detail = href;
        if (!detail.startsWith("http")) detail = new URL(href, url).href;
        results.push({
          announce_date: "",
          deadline: "",
          title,
          detail_url: detail,
        });
      }
    } catch { /* next */ }
  }
  return results.slice(0, 60);
}

async function scrapeEnv() {
  // 環境省: 物品/役務/工事/公募 のサブページに案件リンクが豊富
  const base = "https://www.env.go.jp";
  const subPages = [
    `${base}/kanbo/chotatsu/index_buppin.html`,    // 物品
    `${base}/kanbo/chotatsu/index_ekimu.html`,     // 役務
    `${base}/kanbo/chotatsu/index_koji.html`,      // 工事・建設コンサル
    `${base}/kanbo/chotatsu/index_sanka.html`,     // 参加者確認公募
  ];
  const all = [];
  const seen = new Set();
  for (const url of subPages) {
    try {
      const html = await fetchTextFlexible(url);
      // 環境省独自パターン: chotatsu_NNNNN.html へのリンクで案件名
      const pattern = /<a[^>]*href="([^"]*\/kanbo\/chotatsu\/[^"]+\.html)"[^>]*>([^<]{10,200})<\/a>/gi;
      let m;
      while ((m = pattern.exec(html)) !== null) {
        const href = m[1];
        const text = clean(m[2]);
        if (!text || text.length < 10 || seen.has(text)) continue;
        // ナビゲーション排除
        if (/^(調達情報|入札等情報|入札公告|公募情報|参加者確認公募|発注見通し)$/.test(text)) continue;
        // 「令和X年度...」「...業務」「...購入」「...製造」等の案件
        if (!/(令和\d+年度|業務|購入|製造|工事|調査|測定|調達|印刷|サービス|コンサル|改修|納入)/.test(text)) continue;
        seen.add(text);
        let detail = href;
        if (!detail.startsWith("http")) detail = new URL(href, url).href;
        const dateMatch = text.match(/令和\d+年度?/);
        all.push({
          announce_date: dateMatch ? dateMatch[0] : "",
          deadline: "",
          title: text,
          detail_url: detail,
        });
      }
    } catch { /* next */ }
  }
  return all.slice(0, 100);
}

async function scrapeMlit() {
  // 国土交通省: 官庁営繕の発注見通し（Excel）を案件リストとして取得
  // 旧 /page/chotatsu.html は GEPS に集約されてしまったため、
  // 官庁営繕部の Excel（発注見通し）をパースする代替手段を採用。
  const base = "https://www.mlit.go.jp";
  const indexUrl = `${base}/gobuild/gobuild_tk1_000007.html`;

  let indexHtml;
  try {
    indexHtml = await fetchTextFlexible(indexUrl);
  } catch {
    return [];
  }

  const xlsxPattern = /<a[^>]*href="([^"]+\.xlsx)"[^>]*>([^<]{5,150})<\/a>/gi;
  const xlsxLinks = [];
  let xm;
  while ((xm = xlsxPattern.exec(indexHtml)) !== null) {
    let href = xm[1];
    if (href.startsWith("/")) href = `${base}${href}`;
    else if (!href.startsWith("http")) href = new URL(href, indexUrl).href;
    xlsxLinks.push({ url: href, label: clean(xm[2]) });
  }

  const results = [];
  const seen = new Set();
  for (const { url, label } of xlsxLinks.slice(0, 3)) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const workbook = XLSX.read(buf, { type: "buffer", cellDates: true });
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
        // 案件名らしいセル（長い文字列）を抽出
        for (const row of aoa) {
          if (!Array.isArray(row)) continue;
          for (const cell of row) {
            const text = String(cell || "").trim().replace(/\s+/g, " ");
            if (text.length < 10 || text.length > 100) continue;
            if (seen.has(text)) continue;
            // ヘッダー／案内文を除外
            if (/発注見通し|工事名|業務名|件数|備考|工事区分|No\.?$|件名$/.test(text)) continue;
            if (!/工事|業務|補修|改修|整備|新築|改築|設計|監理|清掃|保守|調査/.test(text)) continue;
            seen.add(text);
            results.push({
              announce_date: "",
              deadline: "",
              title: text,
              detail_url: url,
              _source_excel: label,
            });
          }
        }
      }
    } catch { /* next */ }
  }
  return results.slice(0, 50);
}

/** Shift_JIS等にも対応した fetch（meta charset 検出） */
async function fetchTextFlexible(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  // HTTP ヘッダ or HTML meta から charset を検出
  const contentType = res.headers.get("content-type") || "";
  let charset = (contentType.match(/charset=([^\s;]+)/i) || [])[1];
  if (!charset) {
    const head = buf.slice(0, 2048).toString("ascii", 0, Math.min(buf.length, 2048));
    const m = head.match(/charset=["']?([a-zA-Z0-9_\-]+)/i);
    if (m) charset = m[1];
  }
  charset = (charset || "utf-8").toLowerCase();
  if (charset === "shift_jis" || charset === "sjis" || charset === "x-sjis") {
    charset = "shift-jis"; // Node.js の TextDecoder 対応名
  }
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return buf.toString("utf8");
  }
}

/** 入札・公募・公告キーワードを含む a タグを抽出して案件リストに変換 */
function extractAnnouncementLinks(html, baseUrl) {
  const aMatches = [...html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{5,200}?)<\/a>/gi)];
  const results = [];
  const seen = new Set();
  for (const m of aMatches) {
    const href = m[1];
    const text = clean(m[2]);
    if (!text || text.length < 8 || seen.has(text)) continue;
    // 案件タイトルらしいキーワード
    if (!/入札|公告|公募|調達|企画競争|プロポーザル|見積/.test(text)) continue;
    // ナビゲーション的な短文を除外
    if (/^(入札情報|公募情報|公告一覧|調達情報|調達予定|入札結果)(等|一覧)?$/.test(text)) continue;
    seen.add(text);

    let detail = href;
    if (!detail.startsWith("http")) {
      try { detail = new URL(href, baseUrl).href; } catch { detail = ""; }
    }

    // 日付を title から抽出
    const dateMatch = text.match(/令和\d+年\d+月(?:\d+日)?/);
    results.push({
      announce_date: dateMatch ? dateMatch[0] : "",
      deadline: "",
      title: text,
      detail_url: detail,
    });
  }
  return results;
}

// ─── ユーティリティ ────────────────────────────

function toSlug(prefix, title) {
  return (prefix + "-" + String(title)
    .replace(/[令和\d年度]/g, "")
    .replace(/[^\w\u3040-\u30FF\u3400-\u9FFF]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
  ).substring(0, 60) || `${prefix}-item`;
}

function parseJaDate(str) {
  if (!str) return null;
  const m = String(str).match(/令和(\d+)年(\d+)月(\d+)日/);
  if (m) {
    const y = 2018 + parseInt(m[1]);
    return `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  const m2 = String(str).match(/令和(\d+)年(\d+)月/);
  if (m2) {
    const y = 2018 + parseInt(m2[1]);
    return `${y}-${m2[2].padStart(2, "0")}-01`;
  }
  const m3 = String(str).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (m3) return `${m3[1]}-${m3[2].padStart(2, "0")}-${m3[3].padStart(2, "0")}`;
  return null;
}

function inferCategory(title) {
  const s = String(title || "");
  if (/IT|DX|デジタル|システム|情報|ソフト|セキュリティ|データ/.test(s)) return "it";
  if (/建設|工事|土木|整備|施工/.test(s)) return "construction";
  if (/調査|分析|研究|検討|実証|評価|モニタリング/.test(s)) return "consulting";
  if (/物品|購入|調達|供給|資材/.test(s)) return "goods";
  return "service";
}
