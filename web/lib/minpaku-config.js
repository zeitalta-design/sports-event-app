/**
 * 民泊ナビ — 設定 + ヘルパー
 */

export const minpakuConfig = {
  categories: [
    { slug: "city", label: "都市型", icon: "🏙️" },
    { slug: "resort", label: "リゾート", icon: "🏖️" },
    { slug: "family", label: "ファミリー", icon: "👨‍👩‍👧‍👦" },
    { slug: "business", label: "ビジネス", icon: "💼" },
    { slug: "luxury", label: "高級", icon: "✨" },
    { slug: "budget", label: "格安", icon: "💴" },
    { slug: "other", label: "その他", icon: "🏠" },
  ],

  propertyTypes: [
    { value: "entire", label: "一棟貸し" },
    { value: "private_room", label: "個室" },
    { value: "shared_room", label: "シェアルーム" },
  ],

  statusOptions: [
    { value: "active", label: "掲載中" },
    { value: "inactive", label: "休止中" },
    { value: "closed", label: "掲載終了" },
  ],

  sorts: [
    { key: "popular", label: "人気順" },
    { key: "price_asc", label: "料金が安い順" },
    { key: "price_desc", label: "料金が高い順" },
    { key: "rating_desc", label: "評価が高い順" },
    { key: "newest", label: "新着順" },
  ],

  compareFields: [
    { key: "area", label: "エリア" },
    { key: "property_type_label", label: "物件タイプ" },
    { key: "capacity", label: "定員" },
    { key: "price_per_night", label: "1泊料金" },
    { key: "min_nights", label: "最低宿泊日数" },
    { key: "host_name", label: "ホスト名" },
    { key: "rating", label: "評価" },
    { key: "review_count", label: "レビュー数" },
  ],

  terminology: {
    item: "物件",
    itemPlural: "物件",
    provider: "ホスト",
    category: "カテゴリ",
    favorite: "お気に入り",
  },

  seo: {
    titleTemplate: "%s | 民泊ナビ",
    descriptionTemplate: "%s の民泊・宿泊施設情報。料金、定員、評価を掲載。",
    jsonLdType: "LodgingBusiness",
  },
};

export function getCategoryLabel(slug) {
  return minpakuConfig.categories.find((c) => c.slug === slug)?.label || slug;
}

export function getCategoryIcon(slug) {
  return minpakuConfig.categories.find((c) => c.slug === slug)?.icon || "🏠";
}

export function getPropertyTypeLabel(type) {
  return minpakuConfig.propertyTypes.find((t) => t.value === type)?.label || type;
}

export function getStatusLabel(status) {
  return minpakuConfig.statusOptions.find((s) => s.value === status)?.label || status;
}

export function formatPrice(amount) {
  if (!amount && amount !== 0) return "—";
  return `¥${amount.toLocaleString()}`;
}
