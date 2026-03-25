/**
 * 補助金ナビ — 設定 + 仮データ
 * skeleton 実証用。本番実装時は DB / 外部データソースに移行する。
 */

export const hojokinConfig = {
  categories: [
    { slug: "it", label: "IT導入・デジタル化", icon: "💻" },
    { slug: "startup", label: "創業・起業", icon: "🚀" },
    { slug: "equipment", label: "設備投資", icon: "🏭" },
    { slug: "rd", label: "研究開発", icon: "🔬" },
    { slug: "employment", label: "雇用・人材", icon: "👥" },
    { slug: "export", label: "海外展開", icon: "🌍" },
    { slug: "other", label: "その他", icon: "📋" },
  ],

  targetTypes: [
    { value: "corp", label: "中小企業" },
    { value: "sole", label: "個人事業主" },
    { value: "startup", label: "スタートアップ" },
    { value: "npo", label: "NPO・団体" },
  ],

  statusOptions: [
    { value: "open", label: "募集中" },
    { value: "upcoming", label: "募集予定" },
    { value: "closed", label: "募集終了" },
  ],

  sorts: [
    { key: "deadline", label: "締切が近い順" },
    { key: "amount_desc", label: "補助上限が高い順" },
    { key: "newest", label: "新着順" },
    { key: "popular", label: "人気順" },
  ],

  compareFields: [
    { key: "category_label", label: "支援カテゴリ" },
    { key: "target_label", label: "対象者" },
    { key: "max_amount", label: "補助上限額" },
    { key: "subsidy_rate", label: "補助率" },
    { key: "deadline", label: "公募締切" },
    { key: "provider_name", label: "提供主体" },
  ],

  terminology: {
    item: "制度",
    itemPlural: "制度",
    provider: "提供主体",
    category: "支援カテゴリ",
    favorite: "お気に入り",
  },

  seo: {
    titleTemplate: "%s | 補助金ナビ",
    descriptionTemplate: "%s の補助金・助成金情報。対象者、補助上限額、公募締切を掲載。",
    jsonLdType: "GovernmentService",
  },
};

/**
 * 仮データ — skeleton 実証用
 */
export const HOJOKIN_SEED_DATA = [
  {
    id: 1,
    slug: "it-hojo-2026",
    title: "IT導入補助金2026",
    category: "it",
    target: "corp",
    provider_name: "中小企業庁",
    max_amount: 4500000,
    subsidy_rate: "1/2〜2/3",
    deadline: "2026-06-30",
    status: "open",
    summary: "中小企業・小規模事業者がITツールを導入する際の費用を一部補助。会計ソフト、受発注、決済、ECなど幅広いカテゴリが対象。",
    is_published: true,
  },
  {
    id: 2,
    slug: "mono-hojo-2026",
    title: "ものづくり補助金（第20次）",
    category: "equipment",
    target: "corp",
    provider_name: "中小企業庁",
    max_amount: 12500000,
    subsidy_rate: "1/2〜2/3",
    deadline: "2026-09-30",
    status: "open",
    summary: "革新的な製品・サービスの開発や生産プロセスの改善に必要な設備投資を支援。",
    is_published: true,
  },
  {
    id: 3,
    slug: "shokibo-jizoku-2026",
    title: "小規模事業者持続化補助金",
    category: "other",
    target: "sole",
    provider_name: "日本商工会議所",
    max_amount: 2000000,
    subsidy_rate: "2/3",
    deadline: "2026-05-15",
    status: "open",
    summary: "小規模事業者の販路開拓や業務効率化の取り組みを支援する補助金。広報費、ウェブサイト関連費、展示会出展費などが対象。",
    is_published: true,
  },
  {
    id: 4,
    slug: "jigyo-saikouchiku-2026",
    title: "事業再構築補助金（第12回）",
    category: "startup",
    target: "corp",
    provider_name: "中小企業庁",
    max_amount: 75000000,
    subsidy_rate: "1/2〜3/4",
    deadline: "2026-07-31",
    status: "open",
    summary: "新分野展開、事業転換、業種転換、業態転換、事業再編を行う中小企業を支援。",
    is_published: true,
  },
  {
    id: 5,
    slug: "career-up-josei",
    title: "キャリアアップ助成金",
    category: "employment",
    target: "corp",
    provider_name: "厚生労働省",
    max_amount: 800000,
    subsidy_rate: null,
    deadline: null,
    status: "open",
    summary: "非正規雇用労働者の正社員化、処遇改善の取り組みを行う事業主に対する助成金。通年で申請可能。",
    is_published: true,
  },
  {
    id: 6,
    slug: "kenkyu-kaihatsu-josei",
    title: "成長型中小企業等研究開発支援事業",
    category: "rd",
    target: "corp",
    provider_name: "中小企業庁",
    max_amount: 45000000,
    subsidy_rate: "2/3",
    deadline: "2026-04-30",
    status: "open",
    summary: "中小企業が大学・公設試験研究機関と連携して行う研究開発や試作品開発を支援。",
    is_published: true,
  },
  {
    id: 7,
    slug: "kaigai-tenkai-hojo",
    title: "海外ビジネス戦略推進支援事業",
    category: "export",
    target: "corp",
    provider_name: "JETRO",
    max_amount: 5000000,
    subsidy_rate: "1/2",
    deadline: "2026-08-31",
    status: "upcoming",
    summary: "海外市場への新規参入や販路拡大を目指す中小企業の海外展開を支援。市場調査、展示会出展、商談等が対象。",
    is_published: true,
  },
  {
    id: 8,
    slug: "startup-sogyou-hojo",
    title: "創業助成金（東京都）",
    category: "startup",
    target: "startup",
    provider_name: "東京都中小企業振興公社",
    max_amount: 4000000,
    subsidy_rate: "2/3",
    deadline: "2026-04-15",
    status: "closed",
    summary: "都内で創業予定の個人または創業から5年未満の中小企業者を対象とした助成金。賃借料、広告費、従業員人件費等が対象。",
    is_published: true,
  },
];

// ─── ヘルパー ────────────────

export function getCategoryLabel(slug) {
  return hojokinConfig.categories.find((c) => c.slug === slug)?.label || slug;
}

export function getCategoryIcon(slug) {
  return hojokinConfig.categories.find((c) => c.slug === slug)?.icon || "📋";
}

export function getTargetLabel(target) {
  return hojokinConfig.targetTypes.find((t) => t.value === target)?.label || target;
}

export function getStatusLabel(status) {
  return hojokinConfig.statusOptions.find((s) => s.value === status)?.label || status;
}

export function getStatusColor(status) {
  switch (status) {
    case "open": return "badge-green";
    case "upcoming": return "badge-amber";
    case "closed": return "badge-gray";
    default: return "badge-gray";
  }
}

export function formatAmount(amount) {
  if (!amount && amount !== 0) return "—";
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(amount % 10000000 === 0 ? 0 : 1)}千万円`;
  if (amount >= 10000) return `${Math.floor(amount / 10000)}万円`;
  return `${amount.toLocaleString()}円`;
}

export function formatDeadline(dateStr) {
  if (!dateStr) return "通年";
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function getHojokinById(id) {
  return HOJOKIN_SEED_DATA.find((d) => d.id === id) || null;
}

export function getHojokinBySlug(slug) {
  return HOJOKIN_SEED_DATA.find((d) => d.slug === slug) || null;
}
