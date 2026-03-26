/**
 * shitei Source Adapter — 自治体公募情報サイト
 *
 * 複数自治体のHTML公募一覧ページからデータを取得する。
 * 自治体ごとにparserが異なるため、source定義にparser種別を持つ。
 *
 * 対象自治体（MVP）:
 *   - 横浜市（スポーツ・文化施設中心）
 *   - 大阪市（指定管理者公募）
 *   - 世田谷区（公園・コミュニティ施設）
 */

import { fetchHtml, extractTableRows, stripTags, resolveUrl, extractHrefs, extractAllBetween } from "../fetch-helper.js";

// ─── 自治体別ソース定義 ─────────────────────

const MUNICIPALITY_SOURCES = [
  {
    id: "yokohama",
    name: "横浜市",
    prefecture: "神奈川県",
    url: "https://www.city.yokohama.lg.jp/business/kyoso/public-facility/shiteikanri/syousai/boshujoho.html",
    parser: "generic_list",
  },
  {
    id: "osaka",
    name: "大阪市",
    prefecture: "大阪府",
    url: "https://www.city.osaka.lg.jp/keiyakukanzai/page/0000181355.html",
    parser: "generic_table",
  },
  {
    id: "setagaya",
    name: "世田谷区",
    prefecture: "東京都",
    url: "https://www.city.setagaya.lg.jp/mokuji/kusei/002/003/",
    parser: "generic_list",
  },
];

/**
 * 全自治体ソースから公募情報を取得
 * @param {Object} options
 * @param {string[]} options.municipalityIds - 取得対象の自治体ID（空なら全部）
 * @returns {{ items: Array, errors: string[], sources: Object[] }}
 */
export async function fetchShiteiFromMunicipalities({ municipalityIds = [] } = {}) {
  const targets = municipalityIds.length > 0
    ? MUNICIPALITY_SOURCES.filter((s) => municipalityIds.includes(s.id))
    : MUNICIPALITY_SOURCES;

  const allItems = [];
  const allErrors = [];
  const sourcesUsed = [];

  for (const source of targets) {
    try {
      const result = await fetchHtml(source.url, { timeout: 20000 });
      if (!result.ok) {
        allErrors.push(`[${source.name}] 取得失敗: ${result.error}`);
        continue;
      }

      const items = parseShiteiListPage(result.html, source);
      allItems.push(...items);
      sourcesUsed.push({ id: source.id, name: source.name, count: items.length });
    } catch (err) {
      allErrors.push(`[${source.name}] パース失敗: ${err.message}`);
    }
  }

  return { items: allItems, errors: allErrors, sources: sourcesUsed };
}

/**
 * 自治体の公募一覧ページをパース
 */
function parseShiteiListPage(html, source) {
  const items = [];

  switch (source.parser) {
    case "generic_table":
      items.push(...parseGenericTable(html, source));
      break;
    case "generic_list":
    default:
      items.push(...parseGenericList(html, source));
      break;
  }

  return items;
}

/**
 * テーブル形式の一覧ページをパース
 */
function parseGenericTable(html, source) {
  const items = [];
  const rows = extractTableRows(html);

  for (const cells of rows) {
    if (cells.length < 2) continue;
    if (cells[0].includes("施設名") || cells[0].includes("件名") || cells[0].includes("No")) continue;

    const title = cells[0].trim() || cells[1]?.trim();
    if (!title || title.length < 3) continue;

    // 日付の検出
    const deadlineMatch = findDate(cells.join(" "));

    items.push({
      title: title.substring(0, 200),
      municipality_name: source.name,
      prefecture: source.prefecture,
      facility_category: guessFacilityCategory(title),
      facility_name: cells.length > 1 ? cells[1].trim().substring(0, 100) : null,
      application_deadline: deadlineMatch,
      source_name: source.name,
      source_url: source.url,
    });
  }

  return items;
}

/**
 * リンクリスト形式の一覧ページをパース
 */
function parseGenericList(html, source) {
  const items = [];

  // リンクテキストから案件を抽出
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = stripTags(match[2]).trim();

    // 指定管理者/公募/募集 を含むリンクを抽出
    if (text.length < 5) continue;
    if (!text.match(/指定管理|公募|募集|委託|選定/)) continue;

    const detailUrl = resolveUrl(source.url, href);

    items.push({
      title: text.substring(0, 200),
      municipality_name: source.name,
      prefecture: source.prefecture,
      facility_category: guessFacilityCategory(text),
      detail_url: detailUrl,
      source_name: source.name,
      source_url: source.url,
    });
  }

  return items;
}

/**
 * テキストから日付を検出
 */
function findDate(text) {
  if (!text) return null;
  // YYYY年MM月DD日 or YYYY/MM/DD or YYYY-MM-DD
  const patterns = [
    /(\d{4})年(\d{1,2})月(\d{1,2})日/,
    /(\d{4})[/-](\d{1,2})[/-](\d{1,2})/,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return null;
}

/**
 * テキストから施設カテゴリを推測
 */
function guessFacilityCategory(text) {
  if (!text) return "other";
  if (text.match(/スポーツ|体育|プール|競技|運動/)) return "sports";
  if (text.match(/文化|ホール|美術|博物|図書/)) return "culture";
  if (text.match(/福祉|介護|障害|高齢|保育|児童/)) return "welfare";
  if (text.match(/公園|緑地|庭園/)) return "park";
  if (text.match(/住宅|駐車|駐輪/)) return "housing";
  if (text.match(/教育|学習|学校|研修/)) return "education";
  if (text.match(/コミュニティ|集会|市民|公民/)) return "community";
  if (text.match(/観光|宿泊|キャンプ|温泉/)) return "tourism";
  if (text.match(/環境|廃棄|清掃|リサイクル/)) return "waste";
  return "other";
}

// ─── テスト/フォールバック用サンプルデータ ─────────────────────

export function getSampleShiteiItems() {
  return [
    {
      title: "川崎市総合体育館の指定管理者募集",
      municipality_name: "川崎市",
      prefecture: "神奈川県",
      facility_category: "sports",
      facility_name: "川崎市総合体育館",
      recruitment_status: "open",
      application_start_date: "2026-03-15",
      application_deadline: "2026-05-10",
      opening_date: "2026-04-01",
      contract_start_date: "2027-04-01",
      contract_end_date: "2032-03-31",
      summary: "川崎市総合体育館（メインアリーナ、サブアリーナ、トレーニング室）の管理運営業務。",
      eligibility: "法人格を有し、スポーツ施設の管理運営実績を有すること。",
      application_method: "川崎市市民文化局に持参または郵送",
      source_name: "川崎市",
      detail_url: "https://www.city.kawasaki.jp/250/page/0000000001.html",
    },
    {
      title: "さいたま市立図書館（3館）の指定管理者公募",
      municipality_name: "さいたま市",
      prefecture: "埼玉県",
      facility_category: "culture",
      facility_name: "さいたま市立図書館（中央・北・南の3館）",
      recruitment_status: "open",
      application_start_date: "2026-03-20",
      application_deadline: "2026-04-25",
      contract_start_date: "2027-04-01",
      contract_end_date: "2032-03-31",
      summary: "さいたま市立図書館3館の管理運営。蔵書管理、読書推進イベントの企画・実施を含む。",
      eligibility: "図書館運営実績を有する法人。",
      application_method: "さいたま市教育委員会に電子申請",
      source_name: "さいたま市",
    },
    {
      title: "神戸市灘区地域福祉センター管理運営業務委託",
      municipality_name: "神戸市",
      prefecture: "兵庫県",
      facility_category: "welfare",
      facility_name: "灘区地域福祉センター",
      recruitment_status: "upcoming",
      application_start_date: "2026-04-10",
      application_deadline: "2026-05-30",
      contract_start_date: "2027-04-01",
      contract_end_date: "2030-03-31",
      summary: "高齢者向けデイサービス、地域交流スペース、相談窓口の運営。",
      eligibility: "社会福祉法人または NPO法人であること。",
      source_name: "神戸市",
    },
    {
      title: "千代田区立公園（4公園）指定管理者の選定",
      municipality_name: "千代田区",
      prefecture: "東京都",
      facility_category: "park",
      facility_name: "千代田区立公園（日比谷公園他4公園）",
      recruitment_status: "open",
      application_start_date: "2026-03-01",
      application_deadline: "2026-04-15",
      opening_date: "2026-03-10",
      contract_start_date: "2026-10-01",
      contract_end_date: "2031-09-30",
      summary: "千代田区立4公園の維持管理・イベント企画・地域連携業務。",
      eligibility: "公園管理の3年以上の実績を有する法人。",
      application_method: "千代田区環境まちづくり部に持参",
      source_name: "千代田区",
    },
  ];
}
