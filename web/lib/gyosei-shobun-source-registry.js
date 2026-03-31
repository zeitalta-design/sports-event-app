/**
 * 行政処分DB — 情報源台帳
 *
 * 行政処分情報の収集元を台帳管理する。
 * v1 はコードベース管理。将来的に DB 化しやすい構造。
 */

import { REGIONS } from "@/lib/constants";

// ─── 全都道府県リスト ─────────────────────

export const ALL_PREFECTURES = REGIONS.flatMap((r) => r.prefectures);

// ─── 分野定義 ─────────────────────

export const SECTORS = {
  takken: { label: "宅地建物取引業", short: "宅建" },
  kensetsu: { label: "建設業", short: "建設" },
};

// ─── ソース種別ラベル ─────────────────────

export const SOURCE_TYPE_LABELS = {
  aggregated_search: "集約検索",
  official_list: "公式一覧",
  official_detail: "公式詳細",
  pdf_notice: "PDF公表",
  press_release_only: "報道発表のみ",
  manual_review: "手動確認",
};

// ─── カバレッジラベル ─────────────────────

export const COVERAGE_LABELS = {
  full: "全件",
  partial: "一部",
  complementary: "補完",
};

// ─── 情報源台帳 ─────────────────────

export const SOURCE_REGISTRY = [
  // ─── 国交省系（全国集約） ───
  {
    id: "mlit_nega_inf_top",
    sector: "kensetsu",
    authorityLevel: "national",
    authorityName: "国土交通省",
    prefecture: null,
    sourceName: "ネガティブ情報等検索サイト（トップ）",
    url: "https://www.mlit.go.jp/nega-inf/",
    sourceType: "aggregated_search",
    coverageScope: "full",
    complements: "建設業・宅建業・運送業等の全分野の入口。5年分。月1回更新。",
    publicationWindow: "5 years",
    updateFrequency: "monthly",
    acquisitionMethod: "html",
    active: true,
    notes: "CGI形式。fetch-gyosei-shobun-mlit.js で sector=kensetugyousya として自動取得対応済み。",
  },
  {
    id: "mlit_nega_inf_kensetsu",
    sector: "kensetsu",
    authorityLevel: "national",
    authorityName: "国土交通省",
    prefecture: null,
    sourceName: "ネガティブ情報等検索サイト（建設業者）",
    url: "https://www.mlit.go.jp/nega-inf/cgi-bin/searchmenu.cgi?jigyoubunya=kensetugyousya",
    sourceType: "aggregated_search",
    coverageScope: "full",
    complements: "建設業の主ソース。全国の建設業監督処分を網羅。",
    publicationWindow: "5 years",
    updateFrequency: "monthly",
    acquisitionMethod: "html",
    active: true,
    notes: "自動取得対応済み（sector=kensetugyousya）。国交省・都道府県の処分を集約。",
  },
  {
    id: "mlit_nega_inf_takken",
    sector: "takken",
    authorityLevel: "national",
    authorityName: "国土交通省",
    prefecture: null,
    sourceName: "ネガティブ情報等検索サイト（宅建業者）",
    url: "https://www.mlit.go.jp/nega-inf/cgi-bin/searchmenu.cgi?jigyoubunya=takuti",
    sourceType: "aggregated_search",
    coverageScope: "full",
    complements: "宅建業の主ソース。全国の宅建業監督処分を網羅。",
    publicationWindow: "5 years",
    updateFrequency: "monthly",
    acquisitionMethod: "html",
    active: true,
    notes: "自動取得対応済み（sector=takuti）。国交省・都道府県の処分を集約。",
  },
  {
    id: "mlit_kanto_kensetsu",
    sector: "kensetsu",
    authorityLevel: "national",
    authorityName: "関東地方整備局",
    prefecture: null,
    sourceName: "関東地方整備局 建設業監督処分",
    url: "https://www.ktr.mlit.go.jp/kensan/index00000006.html",
    sourceType: "pdf_notice",
    coverageScope: "complementary",
    complements: "個別処分ごとにPDF記者発表。MLIT集約の補完。",
    publicationWindow: "unknown",
    updateFrequency: "as_needed",
    acquisitionMethod: "pdf",
    active: true,
    notes: "テーブル形式の一覧なし。PDF個別確認が必要。",
  },
];

// ─── ヘルパー ─────────────────────

export function getSourcesBySector(sector) {
  return SOURCE_REGISTRY.filter((s) => s.sector === sector);
}

export function getActiveSources() {
  return SOURCE_REGISTRY.filter((s) => s.active);
}

export function getRegisteredPrefectures(sector) {
  return [
    ...new Set(
      SOURCE_REGISTRY.filter((s) => s.sector === sector && s.prefecture)
        .map((s) => s.prefecture)
    ),
  ];
}

export function getMissingPrefectures(sector) {
  const registered = getRegisteredPrefectures(sector);
  return ALL_PREFECTURES.filter((p) => !registered.includes(p));
}

/**
 * カバレッジマトリクスを生成
 * @returns {{ prefecture, takken: "registered"|"missing"|"complemented", kensetsu: ... }[]}
 */
export function getCoverageMatrix() {
  return ALL_PREFECTURES.map((pref) => {
    const result = { prefecture: pref };
    for (const sector of Object.keys(SECTORS)) {
      const directSources = SOURCE_REGISTRY.filter(
        (s) => s.sector === sector && s.prefecture === pref && s.active
      );
      const nationalSources = SOURCE_REGISTRY.filter(
        (s) => s.sector === sector && s.authorityLevel === "national" && s.coverageScope === "full" && s.active
      );
      if (directSources.length > 0) {
        result[sector] = "registered";
      } else if (nationalSources.length > 0) {
        result[sector] = "complemented";
      } else {
        result[sector] = "missing";
      }
    }
    return result;
  });
}
