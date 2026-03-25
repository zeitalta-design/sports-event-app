/**
 * 民泊ナビ — 実データソース adapter
 */

const SOURCES = {
  primary: { name: "primary", label: "民泊 主要データソース", envUrl: "MINPAKU_SOURCE_PRIMARY_URL", envToken: "MINPAKU_SOURCE_PRIMARY_TOKEN" },
};

export function getAvailableSources() { return Object.keys(SOURCES); }

export function resolveSourceConfig(sourceName) {
  const s = SOURCES[sourceName];
  if (!s) throw new Error(`不明な source: "${sourceName}"\n有効な source: ${Object.keys(SOURCES).join(", ")}`);
  const url = process.env[s.envUrl];
  if (!url) throw new Error(`環境変数 ${s.envUrl} が未設定です\n設定例: ${s.envUrl}=https://example.com/api/minpaku.json`);
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
    title: raw.title || raw.name || raw.listing_name || raw.property_name || null,
    slug: raw.slug || null,
    category: raw.category || raw.listing_type || raw.property_category || null,
    area: raw.area || raw.location || raw.address || raw.region || null,
    property_type: raw.property_type || raw.room_type || raw.accommodation_type || null,
    capacity: raw.capacity || raw.max_guests || raw.guests || null,
    price_per_night: raw.price_per_night || raw.price || raw.nightly_rate || raw.rate || null,
    min_nights: raw.min_nights || raw.minimum_nights || raw.min_stay || null,
    host_name: raw.host_name || raw.host || raw.owner || raw.owner_name || null,
    rating: raw.rating || raw.review_score || raw.score || null,
    review_count: raw.review_count || raw.reviews || raw.num_reviews || null,
    summary: raw.summary || raw.description || raw.overview || null,
    status: raw.status || null,
    is_published: raw.is_published != null ? raw.is_published : true,
  };
}
