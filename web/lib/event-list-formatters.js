/**
 * Phase41: 一覧カードUI用のデータ整形ユーティリティ
 * Phase52: trail タグ統合
 */

import { extractTrailTags } from "@/lib/trail-tags";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * 日付を「2026/4/5(日)」形式に整形
 */
export function formatEventDate(dateStr) {
  if (!dateStr) return "日程未定";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "日程未定";
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

/**
 * 場所を「都道府県 市区町村」形式に整形
 */
export function formatEventLocation(event) {
  const parts = [];
  if (event.prefecture) parts.push(event.prefecture);
  if (event.city) parts.push(event.city);
  if (parts.length === 0 && event.venue_name) return event.venue_name;
  return parts.join(" ") || "場所未定";
}

/**
 * 会場名を取得
 */
export function formatVenueName(event) {
  return event.venue_name || "";
}

/**
 * 距離リストを整形バッジ配列に変換
 */
export function formatDistanceBadges(distanceList) {
  if (!distanceList) return [];
  return [...new Set(
    distanceList.split(",").map((d) => {
      const km = parseFloat(d);
      if (isNaN(km)) return null;
      if (km > 42.5) return "ウルトラ";
      if (km >= 42 && km <= 42.5) return "フル";
      if (km >= 20 && km <= 22) return "ハーフ";
      const rounded = km % 1 === 0 ? km : Math.round(km * 10) / 10;
      return `${rounded}km`;
    }).filter(Boolean)
  )];
}

/**
 * ジャンル表示名を取得
 * @param {string} sportType - sport_type値
 * @param {object} [options] - オプション
 * @param {boolean} [options.listContext] - 一覧ページ文脈（marathon→マラソン表示）
 */
export function formatSportType(sportType, options = {}) {
  const listMap = {
    marathon: "マラソン",
    trail: "トレイル",
    triathlon: "トライアスロン",
    cycling: "自転車",
    walking: "ウォーキング",
    swimming: "水泳",
  };
  const defaultMap = {
    marathon: "ランニング",
    trail: "トレイル",
    triathlon: "トライアスロン",
    cycling: "自転車",
    walking: "ウォーキング",
    swimming: "水泳",
  };
  const map = options.listContext ? listMap : defaultMap;
  return map[sportType] || sportType || "";
}

/**
 * 難易度タグを推定（descriptionやrace情報から）
 */
export function extractDifficultyTag(event) {
  const desc = (event.description || "").toLowerCase();
  const title = (event.title || "").toLowerCase();
  const text = desc + " " + title;

  if (/初心者.*歓迎|ビギナー.*歓迎|初めて/.test(text)) return "初心者向け";
  if (/初心者.*ok|初心者.*可|初心者.*参加/.test(text)) return "初心者OK";
  if (/上級|エリート|サブ3|サブスリー/.test(text)) return "上級者向け";
  if (/中級/.test(text)) return "中級者向け";

  // 距離から推定
  const distances = formatDistanceBadges(event.distance_list);
  if (distances.length === 1) {
    const d = distances[0];
    if (d === "ウルトラ") return "上級者向け";
    if (d.match(/^[1-5](km)?$/)) return "初心者OK";
  }

  return null;
}

/**
 * イベント種別タグを推定
 */
export function extractEventTypeTag(event) {
  const title = (event.title || "") + " " + (event.description || "");
  if (/練習会|トレーニング/.test(title)) return "練習会";
  if (/講習会|セミナー|クリニック/.test(title)) return "講習会";
  if (/イベント|フェス|祭/.test(title)) return "イベント";
  return null;
}

/**
 * 参加規模タグを生成（capacityから）
 */
export function extractCapacityTag(totalCapacity) {
  if (!totalCapacity || totalCapacity <= 0) return null;
  if (totalCapacity < 30) return `${totalCapacity}人`;
  if (totalCapacity < 50) return "30〜49人";
  if (totalCapacity < 100) return "50〜99人";
  if (totalCapacity < 300) return "100〜299人";
  if (totalCapacity < 500) return "300〜499人";
  if (totalCapacity < 1000) return "500〜999人";
  if (totalCapacity < 5000) return "1,000人以上";
  return "5,000人以上";
}

/**
 * 概要文を整形（HTML除去、改行整理、長さ制限）
 */
export function formatDescription(event) {
  let desc = event.description || "";

  // HTML タグ除去
  desc = desc.replace(/<[^>]*>/g, "");
  // 連続改行を1つに
  desc = desc.replace(/[\r\n]+/g, " ");
  // 連続スペースを1つに
  desc = desc.replace(/\s+/g, " ").trim();

  if (desc.length > 120) {
    desc = desc.substring(0, 120) + "…";
  }

  if (!desc) {
    // 補助文生成
    const parts = [];
    if (event.prefecture) parts.push(event.prefecture);
    if (event.event_date) parts.push(formatEventDate(event.event_date) + "開催");
    const sport = formatSportType(event.sport_type);
    if (sport) parts.push(sport);
    if (parts.length > 0) {
      return parts.join("・") + "の大会です。詳細をご確認ください。";
    }
    return "大会詳細を確認してください";
  }

  return desc;
}

/**
 * 締切情報を整形
 */
export function formatDeadline(dateStr) {
  if (!dateStr) return null;
  const deadline = new Date(dateStr);
  if (isNaN(deadline.getTime())) return null;
  const now = new Date();
  const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return null;
  if (diffDays <= 7) return { text: `締切まであと${diffDays}日`, urgent: true };
  return { text: `締切: ${deadline.getMonth() + 1}/${deadline.getDate()}`, urgent: false };
}

/**
 * 全タグを一括生成
 */
export function extractAllTags(event) {
  const tags = [];

  // 距離バッジ
  const distances = formatDistanceBadges(event.distance_list);
  distances.forEach(d => tags.push({ label: d, type: "distance" }));

  // 難易度
  const diff = extractDifficultyTag(event);
  if (diff) tags.push({ label: diff, type: "difficulty" });

  // 種別
  const eventType = extractEventTypeTag(event);
  if (eventType) tags.push({ label: eventType, type: "event_type" });

  // 参加規模
  const cap = extractCapacityTag(event.total_capacity);
  if (cap) tags.push({ label: cap, type: "capacity" });

  // Phase52: trail 専用タグ
  if (event.sport_type === "trail") {
    const trailTags = extractTrailTags(event);
    tags.push(...trailTags);
  }

  return tags;
}
