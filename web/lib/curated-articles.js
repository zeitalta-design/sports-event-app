/**
 * Phase204: 大会まとめ記事データ定義
 *
 * SEO用ランキング型記事ページのデータソース。
 * 各記事はクエリ条件+コピーで構成。
 */

export const CURATED_ARTICLES = [
  {
    slug: "beginner-marathon-2026",
    title: "【2026年】初心者におすすめのマラソン大会ランキング",
    description: "マラソン初心者でも安心して参加できる大会を厳選。制限時間が長く、サポートが充実した大会を紹介します。",
    intro: "初めてのマラソン大会選びは大切です。制限時間にゆとりがあり、コースが走りやすく、運営がしっかりした大会を選べば、完走の喜びを味わえます。",
    query: { type: "beginner", sportType: "marathon", limit: 10 },
    tags: ["初心者", "マラソン", "おすすめ"],
    sportType: "marathon",
  },
  {
    slug: "review-top-marathon",
    title: "【口コミ高評価】参加者満足度が高いマラソン大会",
    description: "実際の参加者の口コミ評価が高い大会を集めました。リアルな声から大会選びのヒントが見つかります。",
    intro: "参加した人の評価は大会選びの一番の参考になります。総合評価・コース・会場運営・アクセスの口コミ平均が高い大会をランキング形式で紹介します。",
    query: { type: "review_top", sportType: "marathon", limit: 10 },
    tags: ["口コミ", "高評価", "満足度"],
    sportType: "marathon",
  },
  {
    slug: "flat-course-marathon",
    title: "自己ベストを狙える！フラットコースのマラソン大会",
    description: "高低差が少なくタイムが出やすいフラットコースのマラソン大会を厳選。PB更新を目指すランナー必見。",
    intro: "自己ベスト更新を目指すなら、コース選びが重要です。高低差が少なく、路面が走りやすいフラットコースの大会を紹介します。",
    query: { type: "flat", sportType: "marathon", limit: 10 },
    tags: ["フラット", "自己ベスト", "記録"],
    sportType: "marathon",
  },
  {
    slug: "scenic-trail-running",
    title: "絶景が楽しめるトレイルランニング大会",
    description: "走りながら絶景を楽しめるトレイルラン大会を厳選。山岳、海岸、高原など、自然を満喫できるコースが揃っています。",
    intro: "トレイルランの醍醐味は、走りながら見る絶景。山頂からの眺望、海沿いの景色、森林の中を駆け抜ける爽快感。走ることをもっと楽しめる大会を紹介します。",
    query: { type: "scenic", sportType: "trail", limit: 10 },
    tags: ["絶景", "トレイル", "自然"],
    sportType: "trail",
  },
  {
    slug: "photo-rich-events",
    title: "写真で雰囲気がわかる！大会写真が充実しているイベント",
    description: "参加前に大会の雰囲気を知りたい方へ。写真が豊富に掲載されている大会を集めました。",
    intro: "大会の雰囲気は実際の写真が一番伝わります。コース風景、会場の様子、参加者の表情など、写真が充実している大会を紹介します。",
    query: { type: "photo_rich", limit: 10 },
    tags: ["写真", "ギャラリー", "雰囲気"],
    sportType: null,
  },
];

export function getArticleBySlug(slug) {
  return CURATED_ARTICLES.find((a) => a.slug === slug) || null;
}

export function getAllArticleSlugs() {
  return CURATED_ARTICLES.map((a) => a.slug);
}
