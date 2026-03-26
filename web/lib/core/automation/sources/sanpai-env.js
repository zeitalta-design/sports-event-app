/**
 * sanpai Source Adapter — 環境省系産廃処理業者・行政処分情報
 *
 * Source:
 *   - さんぱいくん: https://www.sanpainet.or.jp/
 *   - 東京都環境局: https://www.kankyo.metro.tokyo.lg.jp/
 *
 * 取得方式:
 *   一覧ページ → テーブル/リスト形式で行政処分情報が並ぶ
 *   各行: 処分日, 事業者名, 所在地, 処分種別, 処分庁, 概要
 */

import { fetchHtml, extractTableRows, stripTags, resolveUrl, extractHrefs } from "../fetch-helper.js";

// ─── ソース定義 ─────────────────────

const SANPAI_SOURCES = [
  {
    id: "sanpainet",
    name: "さんぱいくん（環境省）",
    url: "https://www2.sanpainet.or.jp/shobun/",
    parser: "sanpainet",
  },
  {
    id: "tokyo_env",
    name: "東京都環境局",
    url: "https://www.kankyo.metro.tokyo.lg.jp/resource/industrial_waste/penalty/",
    prefecture: "東京都",
    parser: "prefecture_list",
  },
];

/**
 * 環境省系ソースから産廃処分情報を取得
 * @param {Object} options
 * @param {string[]} options.sourceIds - 取得対象のソースID（空なら全部）
 * @returns {{ items: Array, penalties: Array, errors: string[], sources: Object[] }}
 */
export async function fetchSanpaiFromEnvSources({ sourceIds = [] } = {}) {
  const targets = sourceIds.length > 0
    ? SANPAI_SOURCES.filter((s) => sourceIds.includes(s.id))
    : SANPAI_SOURCES;

  const allItems = [];
  const allPenalties = [];
  const allErrors = [];
  const sourcesUsed = [];

  for (const source of targets) {
    try {
      const result = await fetchHtml(source.url, { timeout: 20000 });
      if (!result.ok) {
        allErrors.push(`[${source.name}] 取得失敗: ${result.error}`);
        continue;
      }

      const { items, penalties } = parseSanpaiPage(result.html, source);
      allItems.push(...items);
      allPenalties.push(...penalties);
      sourcesUsed.push({ id: source.id, name: source.name, itemCount: items.length, penaltyCount: penalties.length });
    } catch (err) {
      allErrors.push(`[${source.name}] パース失敗: ${err.message}`);
    }
  }

  return { items: allItems, penalties: allPenalties, errors: allErrors, sources: sourcesUsed };
}

/**
 * ページのHTMLをパースして事業者+処分情報を返す
 */
function parseSanpaiPage(html, source) {
  switch (source.parser) {
    case "sanpainet":
      return parseSanpainetPage(html, source);
    case "prefecture_list":
      return parsePrefectureListPage(html, source);
    default:
      return { items: [], penalties: [] };
  }
}

/**
 * さんぱいくん形式のページをパース
 */
function parseSanpainetPage(html, source) {
  const items = [];
  const penalties = [];
  const rows = extractTableRows(html);

  for (const cells of rows) {
    if (cells.length < 3) continue;
    if (cells[0].includes("処分日") || cells[0].includes("日付") || cells[0].includes("No")) continue;

    const dateMatch = cells[0].match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    const penaltyDate = dateMatch
      ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
      : null;

    const companyName = cells.length > 1 ? cells[1].trim() : null;
    if (!companyName || companyName.length < 2) continue;

    const prefecture = cells.length > 2 ? guessPrefecture(cells[2]) : (source.prefecture || null);
    const penaltyTypeRaw = cells.length > 3 ? cells[3].trim() : null;
    const authorityName = cells.length > 4 ? cells[4].trim() : null;
    const summary = cells.length > 5 ? cells[5].trim() : null;

    // 事業者情報
    items.push({
      company_name: companyName,
      prefecture: prefecture,
      city: cells.length > 2 ? extractCity(cells[2]) : null,
      license_type: "other",
      waste_category: "industrial",
      status: guessPenaltyToStatus(penaltyTypeRaw),
      source_name: source.name,
      source_url: source.url,
    });

    // 処分情報
    penalties.push({
      _company_name: companyName,
      _prefecture: prefecture,
      penalty_date: penaltyDate,
      penalty_type: normalizePenaltyType(penaltyTypeRaw),
      authority_name: authorityName || source.name,
      summary: summary,
      source_url: source.url,
    });
  }

  return { items, penalties };
}

/**
 * 都道府県環境局形式のページをパース
 */
function parsePrefectureListPage(html, source) {
  const items = [];
  const penalties = [];

  // リンクベースで処分情報を抽出
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const text = stripTags(match[2]).trim();
    if (text.length < 5) continue;
    if (!text.match(/処分|取消|停止|命令|警告|指導|違反/)) continue;

    // テキストから事業者名と処分情報を抽出
    const companyMatch = text.match(/[（(]?([^（()）]+(?:株式会社|有限会社|合同会社|株\)|有\)))[）)]?/);
    const dateMatch = text.match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})[日]?/);

    const companyName = companyMatch ? companyMatch[1].trim() : extractCompanyFromText(text);
    if (!companyName || companyName.length < 2) continue;

    const penaltyDate = dateMatch
      ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
      : null;

    const detailUrl = resolveUrl(source.url, match[1]);

    items.push({
      company_name: companyName,
      prefecture: source.prefecture || null,
      license_type: "other",
      waste_category: "industrial",
      status: "active",
      source_name: source.name,
      source_url: source.url,
      detail_url: detailUrl,
    });

    penalties.push({
      _company_name: companyName,
      _prefecture: source.prefecture,
      penalty_date: penaltyDate,
      penalty_type: guessPenaltyTypeFromText(text),
      authority_name: source.name,
      summary: text.substring(0, 200),
      source_url: detailUrl,
    });
  }

  return { items, penalties };
}

// ─── ヘルパー関数 ─────────────────────

function guessPrefecture(text) {
  if (!text) return null;
  const prefectures = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"];
  for (const pref of prefectures) {
    if (text.includes(pref)) return pref;
  }
  return null;
}

function extractCity(text) {
  if (!text) return null;
  const cityMatch = text.match(/(?:県|都|府|道)\s*(.+?(?:市|区|町|村))/);
  return cityMatch ? cityMatch[1].trim() : null;
}

function extractCompanyFromText(text) {
  // 「〇〇株式会社に対する」等のパターンから社名を抽出
  const patterns = [
    /(.+?(?:株式会社|有限会社|合同会社))\s*(?:に対|への|の)/,
    /(.+?(?:株式会社|有限会社|合同会社))/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function normalizePenaltyType(raw) {
  if (!raw) return "other";
  const t = raw.trim();
  if (t.includes("取消")) return "license_revocation";
  if (t.includes("停止")) return "business_suspension";
  if (t.includes("改善")) return "improvement_order";
  if (t.includes("警告")) return "warning";
  if (t.includes("指導")) return "guidance";
  return "other";
}

function guessPenaltyTypeFromText(text) {
  if (!text) return "other";
  if (text.includes("取消")) return "license_revocation";
  if (text.includes("停止")) return "business_suspension";
  if (text.includes("改善命令")) return "improvement_order";
  if (text.includes("警告")) return "warning";
  if (text.includes("指導")) return "guidance";
  return "other";
}

function guessPenaltyToStatus(penaltyType) {
  if (!penaltyType) return "active";
  if (penaltyType.includes("取消")) return "revoked";
  if (penaltyType.includes("停止")) return "suspended";
  return "active";
}

// ─── サンプルデータ（フォールバック） ─────────────────────

export function getSampleSanpaiItems() {
  return [
    {
      company_name: "東日本産業廃棄物処理株式会社",
      corporate_number: "2010001234567",
      prefecture: "東京都",
      city: "足立区",
      license_type: "collection_transport",
      waste_category: "industrial",
      business_area: "関東一円",
      status: "suspended",
      risk_level: "high",
      source_name: "東京都環境局",
      notes: "マニフェスト虚偽記載により事業停止処分中。",
      _penalties: [
        { penalty_date: "2026-03-20", penalty_type: "business_suspension", authority_name: "東京都", summary: "マニフェスト（管理票）の虚偽記載が発覚。90日間の事業停止命令。", disposition_period: "90日間" },
        { penalty_date: "2025-10-15", penalty_type: "warning", authority_name: "東京都", summary: "収集運搬車両の表示義務違反に対する警告。" },
      ],
    },
    {
      company_name: "関西グリーンサービス株式会社",
      corporate_number: "5120001098765",
      prefecture: "大阪府",
      city: "東大阪市",
      license_type: "intermediate",
      waste_category: "industrial",
      business_area: "近畿一円",
      status: "active",
      risk_level: "medium",
      source_name: "大阪府環境農林水産部",
      notes: "改善命令後に是正措置完了。現在営業中。",
      _penalties: [
        { penalty_date: "2026-01-10", penalty_type: "improvement_order", authority_name: "大阪府", summary: "中間処理施設の排水基準超過に対する改善命令。是正措置完了。" },
      ],
    },
    {
      company_name: "九州エコリサイクル有限会社",
      prefecture: "福岡県",
      city: "久留米市",
      license_type: "collection_transport",
      waste_category: "special_industrial",
      business_area: "福岡県内",
      status: "revoked",
      risk_level: "critical",
      source_name: "福岡県環境部",
      notes: "不法投棄により許可取消処分。",
      _penalties: [
        { penalty_date: "2026-02-28", penalty_type: "license_revocation", authority_name: "福岡県", summary: "特別管理産業廃棄物の不法投棄が確認され、許可取消処分。", disposition_period: "許可取消" },
        { penalty_date: "2025-09-01", penalty_type: "business_suspension", authority_name: "福岡県", summary: "不法投棄の疑いによる事業停止命令（120日間）。", disposition_period: "120日間" },
      ],
    },
    {
      company_name: "中部環境テクノ株式会社",
      corporate_number: "7180001054321",
      prefecture: "愛知県",
      city: "豊田市",
      license_type: "final_disposal",
      waste_category: "industrial",
      business_area: "中部地方",
      status: "active",
      risk_level: "low",
      source_name: "愛知県環境局",
      notes: "行政指導あり。軽微な書類不備のみ。",
      _penalties: [
        { penalty_date: "2025-11-20", penalty_type: "guidance", authority_name: "愛知県", summary: "最終処分場の帳簿記載不備に対する行政指導。" },
      ],
    },
  ];
}
