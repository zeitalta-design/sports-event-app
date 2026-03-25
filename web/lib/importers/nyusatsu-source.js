/**
 * 入札ナビ — 実データソース adapter
 */

const SOURCES = {
  primary: { name: "primary", label: "入札 主要データソース", envUrl: "NYUSATSU_SOURCE_PRIMARY_URL", envToken: "NYUSATSU_SOURCE_PRIMARY_TOKEN" },
};

export function getAvailableSources() { return Object.keys(SOURCES); }

export function resolveSourceConfig(sourceName) {
  const s = SOURCES[sourceName];
  if (!s) throw new Error(`不明な source: "${sourceName}"\n有効な source: ${Object.keys(SOURCES).join(", ")}`);
  const url = process.env[s.envUrl];
  if (!url) throw new Error(`環境変数 ${s.envUrl} が未設定です\n設定例: ${s.envUrl}=https://example.com/api/nyusatsu.json`);
  return { url, token: process.env[s.envToken] || null, label: s.label };
}

export async function fetchFromSource(sourceName) {
  const config = resolveSourceConfig(sourceName);
  const headers = {};
  if (config.token) headers["Authorization"] = `Bearer ${config.token}`;

  const res = await fetch(config.url, { headers });
  if (!res.ok) throw new Error(`source "${sourceName}" 取得失敗: ${res.status} ${res.statusText} (${config.url})`);

  let data;
  try { data = JSON.parse(await res.text()); }
  catch (e) { throw new Error(`source "${sourceName}" JSON パース失敗: ${e.message}`); }

  let rawItems;
  if (Array.isArray(data)) rawItems = data;
  else if (data.items && Array.isArray(data.items)) rawItems = data.items;
  else if (data.data && Array.isArray(data.data)) rawItems = data.data;
  else if (data.results && Array.isArray(data.results)) rawItems = data.results;
  else throw new Error(`source "${sourceName}": レスポンスから配列を抽出できません`);

  return rawItems.map(adaptFields);
}

function adaptFields(raw) {
  return {
    title: raw.title || raw.name || raw.project_name || raw.bid_title || null,
    slug: raw.slug || null,
    category: raw.category || raw.bid_category || raw.procurement_type || null,
    issuer_name: raw.issuer_name || raw.issuer || raw.contracting_authority || raw.organization || null,
    target_area: raw.target_area || raw.area || raw.region || raw.location || null,
    deadline: raw.deadline || raw.submission_deadline || raw.closing_date || raw.end_date || null,
    budget_amount: raw.budget_amount || raw.budget || raw.estimated_amount || raw.contract_amount || null,
    bidding_method: raw.bidding_method || raw.method || raw.procurement_method || raw.bid_type || null,
    summary: raw.summary || raw.description || raw.outline || null,
    status: raw.status || null,
    is_published: raw.is_published != null ? raw.is_published : true,
    qualification: raw.qualification || raw.eligibility || raw.requirements || null,
    announcement_url: raw.announcement_url || raw.notice_url || raw.url || null,
    contact_info: raw.contact_info || raw.contact || raw.inquiry || null,
    delivery_location: raw.delivery_location || raw.place || raw.delivery_place || null,
    has_attachment: raw.has_attachment || raw.attachment || false,
    announcement_date: raw.announcement_date || raw.notice_date || raw.published_date || null,
    contract_period: raw.contract_period || raw.period || raw.duration || null,
  };
}
