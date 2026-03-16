/**
 * Phase46: 人気指数バッジ共通コンポーネント
 *
 * 使い方:
 *   <PopularityBadge score={80} label="人気大会" />
 *   <PopularityBadge score={65} label="注目大会" size="sm" />
 *   <PopularityBadge score={45} label="関心上昇" size="lg" />
 */

const BADGE_STYLES = {
  popular: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    icon: "🔥",
  },
  featured: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    icon: "⭐",
  },
  rising: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: "📈",
  },
};

function resolveKey(score) {
  if (score >= 80) return "popular";
  if (score >= 60) return "featured";
  if (score >= 40) return "rising";
  return null;
}

/**
 * @param {{ score: number, label?: string, popularityKey?: string, size?: "sm"|"md"|"lg" }} props
 */
export default function PopularityBadge({
  score,
  label,
  popularityKey,
  size = "md",
}) {
  const key = popularityKey || resolveKey(score);
  if (!key) return null;

  const style = BADGE_STYLES[key];
  if (!style) return null;

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-0.5 text-xs",
    lg: "px-2.5 py-1 text-sm",
  };

  const displayLabel =
    label ||
    (key === "popular"
      ? "人気大会"
      : key === "featured"
        ? "注目大会"
        : "関心上昇");

  return (
    <span
      className={`inline-flex items-center gap-0.5 font-semibold rounded border ${style.bg} ${style.text} ${style.border} ${sizeClasses[size]}`}
    >
      <span>{style.icon}</span>
      <span>{displayLabel}</span>
    </span>
  );
}
