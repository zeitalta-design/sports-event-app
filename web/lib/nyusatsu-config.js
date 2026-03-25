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

  areas: [
    { value: "全国", label: "全国" },
    { value: "北海道", label: "北海道" },
    { value: "東北", label: "東北" },
    { value: "関東", label: "関東" },
    { value: "中部", label: "中部" },
    { value: "近畿", label: "近畿" },
    { value: "中国", label: "中国" },
    { value: "四国", label: "四国" },
    { value: "九州", label: "九州" },
    { value: "沖縄", label: "沖縄" },
  ],

  budgetRanges: [
    { value: "under1m", label: "〜100万円", max: 1000000 },
    { value: "under10m", label: "〜1,000万円", max: 10000000 },
    { value: "under100m", label: "〜1億円", max: 100000000 },
    { value: "over100m", label: "1億円超", min: 100000000 },
  ],

  deadlineOptions: [
    { value: "this_week", label: "今週中", days: 7 },
    { value: "this_month", label: "今月中", days: 30 },
    { value: "3months", label: "3ヶ月以内", days: 90 },
  ],

  statusOptions: [
    { value: "open", label: "募集中" },
    { value: "upcoming", label: "募集予定" },
    { value: "closed", label: "終了" },
  ],

  sorts: [
    { key: "deadline", label: "締切が近い順" },
    { key: "budget_desc", label: "予算が大きい順" },
    { key: "budget_asc", label: "予算が小さい順" },
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

export function getStatusBadge(status) {
  switch (status) {
    case "open": return { label: "募集中", color: "badge-green" };
    case "upcoming": return { label: "募集予定", color: "badge-amber" };
    case "closed": return { label: "終了", color: "badge-gray" };
    default: return { label: status || "—", color: "badge-gray" };
  }
}

export function getDeadlineRemaining(dateStr) {
  if (!dateStr) return null;
  const deadline = new Date(dateStr + "T23:59:59");
  const now = new Date();
  const diffMs = deadline - now;
  const diffDays = Math.ceil(diffMs / 86400000);
  if (diffDays < 0) return { text: "終了", urgent: false, expired: true };
  if (diffDays === 0) return { text: "今日締切", urgent: true, expired: false };
  if (diffDays <= 3) return { text: `あと${diffDays}日`, urgent: true, expired: false };
  if (diffDays <= 7) return { text: `あと${diffDays}日`, urgent: false, expired: false };
  return { text: `あと${diffDays}日`, urgent: false, expired: false };
}
