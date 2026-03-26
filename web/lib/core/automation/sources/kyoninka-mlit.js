/**
 * kyoninka Source Adapter — 国交省系許認可検索 + 法人番号API
 *
 * Source:
 *   - 国交省建設業者検索: https://etsuran.mlit.go.jp/TAKKEN/
 *   - 法人番号公表サイトAPI: https://api.houjin-bangou.nta.go.jp/
 *
 * 取得方式:
 *   建設業者検索 → フォーム送信 → 結果HTMLパース → 事業者+許可情報
 *   法人番号API → REST API → corporate_number 照合
 */

import { fetchHtml, extractTableRows, stripTags, resolveUrl } from "../fetch-helper.js";

// ─── ソース定義 ─────────────────────

const KYONINKA_SOURCES = [
  {
    id: "mlit_construction",
    name: "国土交通省建設業者検索",
    url: "https://etsuran2.mlit.go.jp/TAKKEN/kensetuKensaku.do?outPutKbn=1",
    parser: "mlit_construction",
    licenseFamily: "construction",
  },
  {
    id: "mlit_takken",
    name: "宅建業者等企業情報検索",
    url: "https://etsuran2.mlit.go.jp/TAKKEN/",
    parser: "mlit_takken",
    licenseFamily: "real_estate",
  },
];

/**
 * 国交省系ソースから許認可情報を取得
 */
export async function fetchKyoninkaFromMlit({ sourceIds = [] } = {}) {
  const targets = sourceIds.length > 0
    ? KYONINKA_SOURCES.filter((s) => sourceIds.includes(s.id))
    : KYONINKA_SOURCES;

  const allItems = [];
  const allRegistrations = [];
  const allErrors = [];
  const sourcesUsed = [];

  for (const source of targets) {
    try {
      let html;
      if (source.parser === "mlit_construction") {
        // POST フォーム送信で検索結果を取得
        const postResult = await fetchMlitConstructionSearch(source.url);
        if (!postResult.ok) {
          allErrors.push(`[${source.name}] 取得失敗: ${postResult.error}`);
          continue;
        }
        html = postResult.html;
      } else {
        const result = await fetchHtml(source.url, { timeout: 20000 });
        if (!result.ok) {
          allErrors.push(`[${source.name}] 取得失敗: ${result.error}`);
          continue;
        }
        html = result.html;
      }

      const { items, registrations } = parseMlitPage(html, source);
      allItems.push(...items);
      allRegistrations.push(...registrations);
      sourcesUsed.push({ id: source.id, name: source.name, itemCount: items.length, regCount: registrations.length });
    } catch (err) {
      allErrors.push(`[${source.name}] パース失敗: ${err.message}`);
    }
  }

  return { items: allItems, registrations: allRegistrations, errors: allErrors, sources: sourcesUsed };
}

/**
 * 国交省ページをパース
 */
function parseMlitPage(html, source) {
  const items = [];
  const registrations = [];
  const rows = extractTableRows(html);

  for (const cells of rows) {
    if (cells.length < 3) continue;
    if (cells[0].includes("商号") || cells[0].includes("事業者") || cells[0].includes("No")) continue;

    const entityName = cells[0]?.trim();
    if (!entityName || entityName.length < 2) continue;

    const prefecture = cells.length > 1 ? guessPrefecture(cells[1]) : null;
    const regNumber = cells.length > 2 ? cells[2]?.trim() : null;

    items.push({
      entity_name: entityName,
      prefecture,
      city: cells.length > 1 ? extractCity(cells[1]) : null,
      address: cells.length > 1 ? cells[1]?.trim() : null,
      entity_status: "active",
      primary_license_family: source.licenseFamily,
      source_name: source.name,
      source_url: source.url,
    });

    registrations.push({
      _entity_name: entityName,
      _prefecture: prefecture,
      license_family: source.licenseFamily,
      license_type: source.licenseFamily === "construction" ? "general_construction" : "real_estate_broker",
      registration_number: regNumber,
      authority_name: source.name,
      prefecture,
      registration_status: "active",
      disciplinary_flag: 0,
      source_name: source.name,
      source_url: source.url,
    });
  }

  return { items, registrations };
}

function guessPrefecture(text) {
  if (!text) return null;
  const prefectures = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"];
  for (const p of prefectures) { if (text.includes(p)) return p; }
  return null;
}

function extractCity(text) {
  if (!text) return null;
  const m = text.match(/(?:県|都|府|道)\s*(.+?(?:市|区|町|村))/);
  return m ? m[1].trim() : null;
}

// ─── 国交省 POST 送信 ─────────────────────

/**
 * 国交省建設業者検索にPOST送信して検索結果を取得
 * 都道府県コード13（東京都）で検索し、最初のページ結果を返す
 */
async function fetchMlitConstructionSearch(baseUrl) {
  try {
    // Step 1: GET で session を確立（Cookie取得）
    const formPageUrl = baseUrl.replace(/kensetuKensaku\.do.*/, "kensetuKensaku.do?outPutKbn=1");
    const controller1 = new AbortController();
    const timer1 = setTimeout(() => controller1.abort(), 15000);

    const formRes = await fetch(formPageUrl, {
      headers: { "User-Agent": "SportsEventApp-DataCollector/1.0" },
      signal: controller1.signal,
      redirect: "follow",
    });
    clearTimeout(timer1);

    if (!formRes.ok) {
      return { ok: false, error: `Session取得失敗: HTTP ${formRes.status}` };
    }

    // Cookie を取得
    const cookies = formRes.headers.getSetCookie?.() || [];
    const cookieHeader = cookies.map(c => c.split(";")[0]).join("; ");

    if (!cookieHeader) {
      // getSetCookie が使えない環境向けのフォールバック
      const rawCookie = formRes.headers.get("set-cookie") || "";
      if (rawCookie) {
        // 単純にフォームHTMLからパースしてみる
      }
    }

    // Step 2: Cookie 付きで POST 送信
    const formData = new URLSearchParams({
      CMD: "search",
      kenCode: "13",  // 東京都
      comNameKanjiOnly: "",
      comNameKanaOnly: "",
      licenseNoKbn: "",
      licenseNoFrom: "",
      licenseNoTo: "",
      gyosyu: "",
      gyosyuType: "",
      keyWord: "",
      rdoSelectJoken: "1",
      outPutKbn: "1",
    });

    const actionUrl = baseUrl.replace(/kensetuKensaku\.do.*/, "kensetuKensaku.do");
    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), 20000);

    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "SportsEventApp-DataCollector/1.0",
      "Referer": formPageUrl,
    };
    if (cookieHeader) headers["Cookie"] = cookieHeader;

    const res = await fetch(actionUrl, {
      method: "POST",
      headers,
      body: formData.toString(),
      signal: controller2.signal,
      redirect: "follow",
    });
    clearTimeout(timer2);

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} ${res.statusText}` };
    }

    const html = await res.text();

    // 検索結果が含まれるか簡易チェック
    const hasResults = html.includes("kensetuDetail") || html.includes("業者名") || html.includes("許可番号");
    if (!hasResults) {
      return { ok: false, error: "Cookie維持POST: 検索結果テーブルが見つからない（session不足の可能性）" };
    }

    return { ok: true, html };
  } catch (err) {
    return { ok: false, error: err.name === "AbortError" ? "Timeout" : err.message };
  }
}

// ─── 法人番号API クライアント ─────────────────────

const HOUJIN_API_BASE = "https://api.houjin-bangou.nta.go.jp/4";
const HOUJIN_API_ID = process.env.HOUJIN_API_ID || ""; // アプリケーションID

/**
 * 法人名から法人番号を検索（名寄せ補助）
 * @param {string} name - 法人名
 * @param {Object} options
 * @returns {{ corporateNumber: string|null, confidence: number, candidates: Array }}
 */
export async function searchCorporateNumber(name, { prefecture = null } = {}) {
  if (!HOUJIN_API_ID) {
    return { corporateNumber: null, confidence: 0, candidates: [], error: "HOUJIN_API_ID 未設定" };
  }

  try {
    const params = new URLSearchParams({
      id: HOUJIN_API_ID,
      name: name,
      type: "12", // JSON
      mode: "2",  // 前方一致
    });
    if (prefecture) params.set("address", prefecture);

    const url = `${HOUJIN_API_BASE}/name?${params}`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) return { corporateNumber: null, confidence: 0, candidates: [], error: `API ${res.status}` };

    const data = await res.json();
    const corps = data.corporations || [];

    if (corps.length === 0) return { corporateNumber: null, confidence: 0, candidates: [] };
    if (corps.length === 1) return { corporateNumber: corps[0].corporateNumber, confidence: 0.9, candidates: corps };

    // 複数候補がある場合は最初の1件を返すが confidence を下げる
    return { corporateNumber: corps[0].corporateNumber, confidence: 0.5, candidates: corps.slice(0, 5) };
  } catch (err) {
    return { corporateNumber: null, confidence: 0, candidates: [], error: err.message };
  }
}

/**
 * 法人番号から法人情報を取得
 */
export async function fetchCorporateInfo(corporateNumber) {
  if (!HOUJIN_API_ID || !corporateNumber) return null;

  try {
    const params = new URLSearchParams({
      id: HOUJIN_API_ID,
      number: corporateNumber,
      type: "12",
    });
    const url = `${HOUJIN_API_BASE}/num?${params}`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) return null;

    const data = await res.json();
    const corps = data.corporations || [];
    return corps.length > 0 ? corps[0] : null;
  } catch {
    return null;
  }
}

// ─── サンプルデータ（フォールバック） ─────────────────────

export function getSampleKyoninkaItems() {
  return [
    {
      entity_name: "大成建設株式会社",
      normalized_name: "(株)大成建設",
      corporate_number: "7010001008771",
      prefecture: "東京都",
      city: "新宿区",
      address: "新宿区西新宿一丁目25番1号",
      entity_status: "active",
      primary_license_family: "construction",
      source_name: "国土交通省建設業者検索",
      notes: "特定建設業・一般建設業の許可を保有する大手総合建設会社。",
      _registrations: [
        { license_family: "construction", license_type: "special_construction", registration_number: "国土交通大臣許可（特-4）第3000号", authority_name: "国土交通省", valid_from: "2023-04-01", valid_to: "2028-03-31", registration_status: "active", disciplinary_flag: 0 },
        { license_family: "construction", license_type: "general_construction", registration_number: "国土交通大臣許可（般-4）第3000号", authority_name: "国土交通省", valid_from: "2023-04-01", valid_to: "2028-03-31", registration_status: "active", disciplinary_flag: 0 },
        { license_family: "real_estate", license_type: "real_estate_broker", registration_number: "国土交通大臣（15）第1234号", authority_name: "国土交通省", valid_from: "2022-06-01", valid_to: "2027-05-31", registration_status: "active", disciplinary_flag: 0 },
      ],
    },
    {
      entity_name: "野村不動産株式会社",
      normalized_name: "(株)野村不動産",
      corporate_number: "6010001060498",
      prefecture: "東京都",
      city: "新宿区",
      address: "新宿区西新宿一丁目26番2号",
      entity_status: "active",
      primary_license_family: "real_estate",
      source_name: "宅建業者等企業情報検索",
      notes: "宅地建物取引業・賃貸住宅管理業を保有。マンション分譲大手。",
      _registrations: [
        { license_family: "real_estate", license_type: "real_estate_broker", registration_number: "国土交通大臣（14）第5678号", authority_name: "国土交通省", valid_from: "2021-12-01", valid_to: "2026-11-30", registration_status: "active", disciplinary_flag: 0 },
        { license_family: "real_estate", license_type: "real_estate_management", registration_number: "国土交通大臣（2）第009876号", authority_name: "国土交通省", valid_from: "2024-01-15", registration_status: "active", disciplinary_flag: 0 },
      ],
    },
    {
      entity_name: "清水建設株式会社",
      normalized_name: "(株)清水建設",
      corporate_number: "9010001008774",
      prefecture: "東京都",
      city: "中央区",
      address: "中央区京橋二丁目16番1号",
      entity_status: "active",
      primary_license_family: "construction",
      source_name: "国土交通省建設業者検索",
      notes: "特定建設業の許可を保有するスーパーゼネコン。行政処分歴あり（是正済み）。",
      _registrations: [
        { license_family: "construction", license_type: "special_construction", registration_number: "国土交通大臣許可（特-4）第2500号", authority_name: "国土交通省", valid_from: "2022-10-01", valid_to: "2027-09-30", registration_status: "active", disciplinary_flag: 1 },
      ],
    },
    {
      entity_name: "住友不動産販売株式会社",
      normalized_name: "(株)住友不動産販売",
      corporate_number: "4010001034628",
      prefecture: "東京都",
      city: "新宿区",
      address: "新宿区西新宿二丁目4番1号",
      entity_status: "active",
      primary_license_family: "real_estate",
      source_name: "宅建業者等企業情報検索",
      _registrations: [
        { license_family: "real_estate", license_type: "real_estate_broker", registration_number: "国土交通大臣（9）第3459号", authority_name: "国土交通省", valid_from: "2020-04-01", valid_to: "2025-03-31", registration_status: "active", disciplinary_flag: 0 },
      ],
    },
    {
      entity_name: "地方建設工業有限会社",
      normalized_name: "(有)地方建設工業",
      prefecture: "北海道",
      city: "旭川市",
      address: "旭川市永山2条10丁目",
      entity_status: "closed",
      primary_license_family: "construction",
      source_name: "国土交通省建設業者検索",
      notes: "建設業許可失効。廃業。",
      _registrations: [
        { license_family: "construction", license_type: "general_construction", registration_number: "北海道知事許可（般-25）第001234号", authority_name: "北海道", prefecture: "北海道", valid_from: "2015-04-01", valid_to: "2020-03-31", registration_status: "expired", disciplinary_flag: 0 },
      ],
    },
  ];
}
