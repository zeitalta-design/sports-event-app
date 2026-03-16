/**
 * Phase104: プレミアム機能バッジ
 *
 * プレミアム限定機能の横に「PRO」バッジを表示。
 */

export default function PremiumBadge({ size = "sm" }) {
  const sizeClasses = size === "xs"
    ? "text-[8px] px-1 py-px"
    : "text-[10px] px-1.5 py-0.5";

  return (
    <span
      className={`inline-flex items-center ${sizeClasses} font-bold text-purple-700 bg-purple-100 border border-purple-200 rounded`}
    >
      PRO
    </span>
  );
}
