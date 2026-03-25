/**
 * SaaSナビ サイト設定
 *
 * カテゴリ、フィルタ、ステータス、比較項目、レビュー軸、SEO等を定義。
 * lib/core のモジュールはこの設定を参照してSaaS固有の振る舞いを実現する。
 */

export const saasConfig = {
  site: {
    id: "saas-navi",
    name: "SaaSナビ",
    tagline: "ビジネスSaaSを比較・検討",
    themeColor: "#2563eb",
  },

  terminology: {
    item: "SaaSツール",
    itemPlural: "SaaSツール",
    provider: "ベンダー",
    variant: "プラン",
    category: "カテゴリ",
  },

  categories: [
    { slug: "crm", label: "CRM・SFA", icon: "📊" },
    { slug: "accounting", label: "会計・経理", icon: "💰" },
    { slug: "hr", label: "人事・労務", icon: "👥" },
    { slug: "ma", label: "MA・マーケ", icon: "📢" },
    { slug: "project", label: "プロジェクト管理", icon: "📋" },
    { slug: "communication", label: "コミュニケーション", icon: "💬" },
    { slug: "security", label: "セキュリティ", icon: "🔒" },
    { slug: "infra", label: "インフラ・DevOps", icon: "🖥️" },
  ],

  statuses: [
    { key: "active", label: "提供中", color: "green" },
    { key: "beta", label: "ベータ版", color: "blue" },
    { key: "discontinued", label: "提供終了", color: "gray" },
  ],

  priceRanges: [
    { value: "0", label: "無料" },
    { value: "0-1000", label: "〜1,000円" },
    { value: "1000-5000", label: "1,000〜5,000円" },
    { value: "5000-20000", label: "5,000〜20,000円" },
    { value: "20000-", label: "20,000円〜" },
  ],

  companySizes: [
    { value: "1-10", label: "〜10名", min: 1, max: 10 },
    { value: "11-50", label: "11〜50名", min: 11, max: 50 },
    { value: "51-300", label: "51〜300名", min: 51, max: 300 },
    { value: "301-", label: "301名〜", min: 301, max: null },
  ],

  sorts: [
    { key: "popularity", label: "人気順" },
    { key: "newest", label: "新着順" },
    { key: "price_asc", label: "価格が安い順" },
    { key: "price_desc", label: "価格が高い順" },
  ],

  compareFields: [
    { key: "category", label: "カテゴリ" },
    { key: "price_display", label: "月額料金" },
    { key: "has_free_plan", label: "無料プラン", format: "boolean" },
    { key: "has_free_trial", label: "無料トライアル", format: "trial" },
    { key: "company_size_label", label: "対象企業規模" },
    { key: "api_available", label: "API連携", format: "boolean" },
    { key: "mobile_app", label: "モバイル対応", format: "boolean" },
    { key: "support_type", label: "サポート体制" },
  ],

  supportTypes: {
    email: "メール",
    chat: "チャット",
    phone: "電話",
    dedicated: "専任担当",
  },

  reviewAxes: [
    { key: "usability", label: "使いやすさ" },
    { key: "features", label: "機能充実度" },
    { key: "support", label: "サポート品質" },
    { key: "cost_performance", label: "コスパ" },
    { key: "stability", label: "安定性" },
  ],

  seo: {
    jsonLdType: "SoftwareApplication",
    titleTemplate: "{title} | SaaSナビ",
    descriptionTemplate:
      "{title}の料金・機能・評判を比較。{category}のSaaSツールを探すならSaaSナビ。",
  },
};

/**
 * カテゴリ slug → label のマップ
 */
export function getCategoryLabel(slug) {
  const cat = saasConfig.categories.find((c) => c.slug === slug);
  return cat ? cat.label : slug;
}

/**
 * カテゴリ slug → icon のマップ
 */
export function getCategoryIcon(slug) {
  const cat = saasConfig.categories.find((c) => c.slug === slug);
  return cat ? cat.icon : "📦";
}

/**
 * ステータス key → label, color のマップ
 */
export function getStatusInfo(key) {
  const s = saasConfig.statuses.find((st) => st.key === key);
  return s || { key, label: key, color: "gray" };
}

/**
 * サポート種別 key → label
 */
export function getSupportLabel(key) {
  return saasConfig.supportTypes[key] || key || "—";
}
