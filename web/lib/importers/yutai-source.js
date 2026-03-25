/**
 * 株主優待ナビ — 実データソース adapter
 *
 * source 名に応じて外部データソースからデータを取得し、
 * 既存 normalize() が受け付ける形に変換して返す。
 *
 * 責務:
 *   1. source 設定の解決（env から URL 等を取得）
 *   2. HTTP fetch
 *   3. レスポンスから配列を抽出
 *   4. source 固有のフィールド名を normalize() 互換に変換
 *
 * 現在対応 source:
 *   - primary: YUTAI_SOURCE_PRIMARY_URL から JSON 取得
 */

// ─── source 定義 ─────────────────────

const SOURCES = {
  primary: {
    name: "primary",
    label: "株主優待 主要データソース",
    envUrl: "YUTAI_SOURCE_PRIMARY_URL",
    envToken: "YUTAI_SOURCE_PRIMARY_TOKEN", // 将来用
  },
};

/**
 * 利用可能な source 名一覧
 */
export function getAvailableSources() {
  return Object.keys(SOURCES);
}

/**
 * source 設定を取得
 * @param {string} sourceName
 * @returns {{ url: string, token?: string, label: string }}
 */
export function resolveSourceConfig(sourceName) {
  const source = SOURCES[sourceName];
  if (!source) {
    throw new Error(
      `不明な source: "${sourceName}"\n有効な source: ${Object.keys(SOURCES).join(", ")}`
    );
  }

  const url = process.env[source.envUrl];
  if (!url) {
    throw new Error(
      `環境変数 ${source.envUrl} が未設定です\n設定例: ${source.envUrl}=https://example.com/api/yutai.json`
    );
  }

  const token = process.env[source.envToken] || null;

  return { url, token, label: source.label };
}

/**
 * source からデータを取得し、normalize() 互換の raw item 配列を返す
 *
 * @param {string} sourceName
 * @returns {Promise<object[]>}
 */
export async function fetchFromSource(sourceName) {
  const config = resolveSourceConfig(sourceName);

  // ─── fetch ─────
  const headers = {};
  if (config.token) {
    headers["Authorization"] = `Bearer ${config.token}`;
  }

  const res = await fetch(config.url, { headers });
  if (!res.ok) {
    throw new Error(
      `source "${sourceName}" 取得失敗: ${res.status} ${res.statusText} (${config.url})`
    );
  }

  let data;
  try {
    data = JSON.parse(await res.text());
  } catch (e) {
    throw new Error(`source "${sourceName}" JSON パース失敗: ${e.message}`);
  }

  // ─── 配列抽出 ─────
  let rawItems;
  if (Array.isArray(data)) {
    rawItems = data;
  } else if (data.items && Array.isArray(data.items)) {
    rawItems = data.items;
  } else if (data.data && Array.isArray(data.data)) {
    rawItems = data.data;
  } else if (data.results && Array.isArray(data.results)) {
    rawItems = data.results;
  } else {
    throw new Error(
      `source "${sourceName}": レスポンスから配列を抽出できません`
    );
  }

  // ─── フィールド変換 ─────
  // source 固有のフィールド名を normalize() 互換に寄せる
  return rawItems.map((raw) => adaptFields(raw));
}

/**
 * source 固有フィールドを normalize() 互換に変換
 *
 * normalize() が期待するフィールド:
 *   code, title, category, confirm_months, min_investment,
 *   benefit_summary, dividend_yield, benefit_yield, is_published, slug
 *
 * source 側でよくある別名を吸収する
 */
function adaptFields(raw) {
  return {
    // code: 証券コード
    code: raw.code || raw.stock_code || raw.ticker || raw.security_code || null,

    // title: 銘柄名
    title: raw.title || raw.name || raw.company_name || raw.stock_name || null,

    // slug: URL パス（あれば）
    slug: raw.slug || null,

    // category: 優待カテゴリ
    category: raw.category || raw.benefit_category || raw.yutai_category || null,

    // confirm_months: 権利確定月
    confirm_months:
      raw.confirm_months || raw.confirmMonths || raw.record_month ||
      raw.record_months || raw.rights_month || null,

    // min_investment: 最低投資金額
    min_investment:
      raw.min_investment || raw.minInvestment || raw.minimum_investment ||
      raw.min_amount || null,

    // benefit_summary: 優待内容
    benefit_summary:
      raw.benefit_summary || raw.benefitSummary || raw.benefit_detail ||
      raw.yutai_content || raw.description || null,

    // dividend_yield: 配当利回り
    dividend_yield:
      raw.dividend_yield || raw.dividendYield || raw.div_yield || null,

    // benefit_yield: 優待利回り
    benefit_yield:
      raw.benefit_yield || raw.benefitYield || raw.yutai_yield || null,

    // is_published
    is_published: raw.is_published != null ? raw.is_published : true,
  };
}
