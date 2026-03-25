/**
 * 入札ナビ — 設定 + ヘルパー
 * DB 移行済み。カテゴリ定義・compareFields・ヘルパー関数を提供する。
 */

export const nyusatsuConfig = {
  categories: [
    { slug: "it", label: "IT・システム", icon: "💻" },
    { slug: "construction", label: "建設・土木", icon: "🏗️" },
    { slug: "consulting", label: "コンサル・調査", icon: "📊" },
    { slug: "goods", label: "物品調達", icon: "📦" },
    { slug: "service", label: "業務委託", icon: "🤝" },
    { slug: "other", label: "その他", icon: "📋" },
  ],

  biddingMethods: [
    { value: "open", label: "一般競争入札" },
    { value: "designated", label: "指名競争入札" },
    { value: "proposal", label: "企画競争（プロポーザル）" },
    { value: "negotiated", label: "随意契約" },
  ],

  sorts: [
    { key: "deadline", label: "締切が近い順" },
    { key: "budget_desc", label: "予算が大きい順" },
    { key: "newest", label: "新着順" },
    { key: "popular", label: "人気順" },
  ],

  compareFields: [
    { key: "category_label", label: "カテゴリ" },
    { key: "issuer_name", label: "発注機関" },
    { key: "target_area", label: "対象地域" },
    { key: "budget_amount", label: "予算規模" },
    { key: "bidding_method", label: "入札方式" },
    { key: "deadline", label: "締切日" },
  ],

  terminology: {
    item: "案件",
    itemPlural: "案件",
    provider: "発注機関",
    category: "カテゴリ",
    favorite: "お気に入り",
  },

  seo: {
    titleTemplate: "%s | 入札ナビ",
    descriptionTemplate: "%s の入札・公募情報。発注機関、予算規模、締切日を掲載。",
    jsonLdType: "Service",
  },
};

// ─── ヘルパー ────────────────

export function getCategoryLabel(slug) {
  return nyusatsuConfig.categories.find((c) => c.slug === slug)?.label || slug;
}

export function getCategoryIcon(slug) {
  return nyusatsuConfig.categories.find((c) => c.slug === slug)?.icon || "📋";
}

export function getBiddingMethodLabel(method) {
  return nyusatsuConfig.biddingMethods.find((m) => m.value === method)?.label || method;
}

export function formatBudget(amount) {
  if (!amount && amount !== 0) return "—";
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(amount % 100000000 === 0 ? 0 : 1)}億円`;
  if (amount >= 10000) return `${Math.floor(amount / 10000)}万円`;
  return `${amount.toLocaleString()}円`;
}

export function formatDeadline(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
