/**
 * Phase41: 大会画像のURL解決・フォールバックロジック
 */

/**
 * 大会画像のURLを取得（フォールバック付き）
 * @param {object} event - イベントオブジェクト
 * @returns {string} 画像URL
 */
export function getEventImageUrl(event) {
  // 既存の hero_image_url があればそれを使用
  if (event?.hero_image_url) return event.hero_image_url;
  // プレースホルダーSVGを返す
  return null;
}

/**
 * プレースホルダーSVGをインラインで生成
 * ジャンルに応じたアイコンと色を返す
 */
export function getPlaceholderProps(event) {
  const sport = event?.sport_type || "marathon";
  const config = {
    marathon: { color: "#3b82f6", bgColor: "#eff6ff", icon: "🏃", label: "マラソン" },
    trail: { color: "#16a34a", bgColor: "#f0fdf4", icon: "⛰️", label: "トレイル" },
    cycling: { color: "#f59e0b", bgColor: "#fffbeb", icon: "🚴", label: "自転車" },
    walking: { color: "#8b5cf6", bgColor: "#f5f3ff", icon: "🚶", label: "ウォーキング" },
    swimming: { color: "#06b6d4", bgColor: "#ecfeff", icon: "🏊", label: "水泳" },
    triathlon: { color: "#ef4444", bgColor: "#fef2f2", icon: "🏅", label: "トライアスロン" },
  };
  return config[sport] || config.marathon;
}
