/**
 * 鮮度バッジ（一覧カード用）
 *
 * stale / very_stale の場合のみ表示する。
 * fresh / normal は一覧では非表示（情報過多防止）。
 */
import { getFreshnessLabel } from "@/lib/freshness";

export default function FreshnessBadge({ event }) {
  if (!event) return null;

  const info = getFreshnessLabel({
    lastVerifiedAt: event.last_verified_at,
    scrapedAt: event.scraped_at,
  });

  if (!info) return null;

  return (
    <span className={`text-[10px] ${info.className}`}>
      {info.text}
    </span>
  );
}
