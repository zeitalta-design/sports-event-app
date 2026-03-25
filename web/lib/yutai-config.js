/**
 * 株主優待ナビ — 設定 + 仮データ
 *
 * 本番実装時は DB / 外部データソースに移行する。
 * skeleton 実証用の仮データを含む。
 */

export const yutaiConfig = {
  categories: [
    { slug: "food", label: "食品・飲料", icon: "🍽️" },
    { slug: "shopping", label: "買い物券・割引", icon: "🛒" },
    { slug: "leisure", label: "レジャー・旅行", icon: "✈️" },
    { slug: "daily", label: "日用品・生活", icon: "🏠" },
    { slug: "money", label: "金券・QUOカード", icon: "💰" },
    { slug: "other", label: "その他", icon: "📦" },
  ],

  confirmMonths: [
    { value: "3", label: "3月" },
    { value: "6", label: "6月" },
    { value: "9", label: "9月" },
    { value: "12", label: "12月" },
  ],

  sorts: [
    { key: "popular", label: "人気順" },
    { key: "min_investment_asc", label: "投資金額が安い順" },
    { key: "min_investment_desc", label: "投資金額が高い順" },
    { key: "newest", label: "新着順" },
  ],

  compareFields: [
    { key: "category_label", label: "優待カテゴリ" },
    { key: "confirm_month", label: "権利確定月" },
    { key: "min_investment", label: "最低投資金額" },
    { key: "benefit_summary", label: "優待内容" },
    { key: "dividend_yield", label: "配当利回り" },
    { key: "yutai_yield", label: "優待利回り" },
  ],

  terminology: {
    item: "銘柄",
    itemPlural: "銘柄",
    provider: "企業",
    category: "優待カテゴリ",
    favorite: "お気に入り",
  },

  seo: {
    titleTemplate: "%s | 株主優待ナビ",
    descriptionTemplate: "%s の株主優待情報。優待内容、権利確定月、最低投資金額を掲載。",
    jsonLdType: "Product",
  },
};

/**
 * 仮データ — skeleton 実証用
 * 本番では DB から取得する。id / slug は将来 DB の primary key に置き換える。
 */
export const YUTAI_SEED_DATA = [
  {
    id: 1,
    code: "2702",
    slug: "2702-mcdonalds",
    title: "日本マクドナルドHD",
    category: "food",
    confirm_months: [6, 12],
    min_investment: 67300,
    benefit_summary: "食事優待券（バーガー類・サイドメニュー・飲物の引換券6枚綴り）",
    dividend_yield: 0.74,
    yutai_yield: null,
    is_published: true,
  },
  {
    id: 2,
    code: "8267",
    slug: "8267-aeon",
    title: "イオン",
    category: "shopping",
    confirm_months: [2, 8],
    min_investment: 37600,
    benefit_summary: "オーナーズカード（買物金額のキャッシュバック3〜7%）",
    dividend_yield: 0.96,
    yutai_yield: null,
    is_published: true,
  },
  {
    id: 3,
    code: "9202",
    slug: "9202-ana",
    title: "ANAホールディングス",
    category: "leisure",
    confirm_months: [3, 9],
    min_investment: 29700,
    benefit_summary: "国内線片道1区間50%割引券",
    dividend_yield: 1.18,
    yutai_yield: null,
    is_published: true,
  },
  {
    id: 4,
    code: "7412",
    slug: "7412-aoki",
    title: "アオキホールディングス",
    category: "shopping",
    confirm_months: [3, 9],
    min_investment: 83200,
    benefit_summary: "AOKI 20%割引券5枚",
    dividend_yield: 2.16,
    yutai_yield: null,
    is_published: true,
  },
  {
    id: 5,
    code: "3197",
    slug: "3197-skylark",
    title: "すかいらーくHD",
    category: "food",
    confirm_months: [6, 12],
    min_investment: 21800,
    benefit_summary: "株主優待カード（年間4,000円分の食事券）",
    dividend_yield: 0.28,
    yutai_yield: 1.83,
    is_published: true,
  },
  {
    id: 6,
    code: "9861",
    slug: "9861-yoshinoya",
    title: "吉野家ホールディングス",
    category: "food",
    confirm_months: [2, 8],
    min_investment: 30100,
    benefit_summary: "食事券（年間4,000円分: 500円券×8枚）",
    dividend_yield: 0.5,
    yutai_yield: 1.33,
    is_published: true,
  },
  {
    id: 7,
    code: "4661",
    slug: "4661-olc",
    title: "オリエンタルランド",
    category: "leisure",
    confirm_months: [3, 9],
    min_investment: 353500,
    benefit_summary: "東京ディズニーリゾート1デーパスポート",
    dividend_yield: 0.15,
    yutai_yield: null,
    is_published: true,
  },
  {
    id: 8,
    code: "8591",
    slug: "8591-orix",
    title: "オリックス",
    category: "other",
    confirm_months: [3, 9],
    min_investment: 33600,
    benefit_summary: "カタログギフト（Bコース: ふるさと優待）",
    dividend_yield: 2.83,
    yutai_yield: null,
    is_published: true,
  },
];

// ─── ヘルパー ────────────────

export function getCategoryLabel(slug) {
  const cat = yutaiConfig.categories.find((c) => c.slug === slug);
  return cat ? cat.label : slug;
}

export function getCategoryIcon(slug) {
  const cat = yutaiConfig.categories.find((c) => c.slug === slug);
  return cat ? cat.icon : "📦";
}

export function getYutaiById(id) {
  return YUTAI_SEED_DATA.find((d) => d.id === id) || null;
}

export function getYutaiBySlug(slug) {
  return YUTAI_SEED_DATA.find((d) => d.slug === slug) || null;
}

export function formatCurrency(amount) {
  if (!amount && amount !== 0) return "—";
  return `${amount.toLocaleString()}円`;
}

export function formatMonths(months) {
  if (!months || months.length === 0) return "—";
  return months.map((m) => `${m}月`).join("・");
}
