/**
 * SEOページ用のslug⇔日本語マッピング
 * 都道府県・距離・月のslugと表示名を管理
 */

// 都道府県slug → 日本語名
export const PREFECTURE_SLUGS = {
  hokkaido: "北海道",
  aomori: "青森県",
  iwate: "岩手県",
  miyagi: "宮城県",
  akita: "秋田県",
  yamagata: "山形県",
  fukushima: "福島県",
  ibaraki: "茨城県",
  tochigi: "栃木県",
  gunma: "群馬県",
  saitama: "埼玉県",
  chiba: "千葉県",
  tokyo: "東京都",
  kanagawa: "神奈川県",
  niigata: "新潟県",
  toyama: "富山県",
  ishikawa: "石川県",
  fukui: "福井県",
  yamanashi: "山梨県",
  nagano: "長野県",
  gifu: "岐阜県",
  shizuoka: "静岡県",
  aichi: "愛知県",
  mie: "三重県",
  shiga: "滋賀県",
  kyoto: "京都府",
  osaka: "大阪府",
  hyogo: "兵庫県",
  nara: "奈良県",
  wakayama: "和歌山県",
  tottori: "鳥取県",
  shimane: "島根県",
  okayama: "岡山県",
  hiroshima: "広島県",
  yamaguchi: "山口県",
  tokushima: "徳島県",
  kagawa: "香川県",
  ehime: "愛媛県",
  kochi: "高知県",
  fukuoka: "福岡県",
  saga: "佐賀県",
  nagasaki: "長崎県",
  kumamoto: "熊本県",
  oita: "大分県",
  miyazaki: "宮崎県",
  kagoshima: "鹿児島県",
  okinawa: "沖縄県",
};

// 日本語名 → slug の逆引き
export const PREFECTURE_NAME_TO_SLUG = Object.fromEntries(
  Object.entries(PREFECTURE_SLUGS).map(([slug, name]) => [name, slug])
);

// 距離slug → 表示情報
export const DISTANCE_SLUGS = {
  full: {
    label: "フルマラソン",
    shortLabel: "フル",
    description: "全国のフルマラソン大会を検索できます。締切や開催地を比較して自分に合う大会を探せます。",
    range: [42, 43],
  },
  half: {
    label: "ハーフマラソン",
    shortLabel: "ハーフ",
    description: "全国のハーフマラソン大会を検索できます。初心者にも人気の距離です。",
    range: [20, 22],
  },
  "10km": {
    label: "10kmマラソン",
    shortLabel: "10km",
    description: "全国の10kmマラソン大会を検索できます。気軽に参加できる距離です。",
    range: [5.1, 10],
  },
  "5km": {
    label: "5km以下のマラソン",
    shortLabel: "5km以下",
    description: "全国の5km以下のマラソン大会を検索できます。ファンランや初心者の方にもおすすめです。",
    range: [0, 5],
  },
  ultra: {
    label: "ウルトラマラソン",
    shortLabel: "ウルトラ",
    description: "全国のウルトラマラソン大会を検索できます。42.195kmを超える本格派向けです。",
    range: [43.1, 999],
  },
};

// API用の距離key変換（既存APIとの整合）
export const DISTANCE_TO_API_KEY = {
  full: "full",
  half: "half",
  "10km": "10",
  "5km": "5",
  ultra: "ultra",
};

// 月 → 表示用
export function getMonthLabel(month) {
  const m = parseInt(month);
  if (m < 1 || m > 12 || isNaN(m)) return null;
  return `${m}月`;
}

export function getMonthDescription(month, sportType = "marathon") {
  const m = parseInt(month);
  if (m < 1 || m > 12 || isNaN(m)) return "";
  if (sportType === "trail") {
    return `${m}月に開催されるトレイルランニング大会を検索できます。開催地や距離を比較して大会を見つけられます。`;
  }
  return `${m}月に開催されるマラソン大会を検索できます。開催地や距離を比較して大会を見つけられます。`;
}

/**
 * Phase53: スポーツ別のラベル取得ヘルパー
 */
export function getSportLabel(sportType) {
  const labels = {
    marathon: "マラソン",
    trail: "トレイルラン",
  };
  return labels[sportType] || "マラソン";
}

export function getSportEventLabel(sportType) {
  const labels = {
    marathon: "マラソン大会",
    trail: "トレイルラン大会",
  };
  return labels[sportType] || "マラソン大会";
}

// 地方ごとの都道府県（内部リンク用）
export const REGION_GROUPS = [
  { label: "北海道・東北", slugs: ["hokkaido", "aomori", "iwate", "miyagi", "akita", "yamagata", "fukushima"] },
  { label: "関東", slugs: ["tokyo", "kanagawa", "saitama", "chiba", "ibaraki", "tochigi", "gunma"] },
  { label: "中部", slugs: ["niigata", "toyama", "ishikawa", "fukui", "yamanashi", "nagano", "gifu", "shizuoka", "aichi"] },
  { label: "近畿", slugs: ["mie", "shiga", "kyoto", "osaka", "hyogo", "nara", "wakayama"] },
  { label: "中国・四国", slugs: ["tottori", "shimane", "okayama", "hiroshima", "yamaguchi", "tokushima", "kagawa", "ehime", "kochi"] },
  { label: "九州・沖縄", slugs: ["fukuoka", "saga", "nagasaki", "kumamoto", "oita", "miyazaki", "kagoshima", "okinawa"] },
];
