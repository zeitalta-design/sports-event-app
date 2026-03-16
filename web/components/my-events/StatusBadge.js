"use client";

import { EVENT_STATUSES, STATUS_COLORS } from "@/lib/my-events-manager";

/**
 * Phase100: ステータスバッジ
 * 大会のマイイベントステータスをバッジ表示する。
 */
export default function StatusBadge({ status, size = "sm" }) {
  if (!status || !EVENT_STATUSES[status]) return null;

  const def = EVENT_STATUSES[status];
  const colors = STATUS_COLORS[status];

  const sizeClass = size === "xs"
    ? "text-[10px] px-1.5 py-0.5"
    : "text-xs px-2 py-0.5";

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded ${sizeClass} ${colors.badge}`}
    >
      <span>{def.icon}</span>
      <span>{def.label}</span>
    </span>
  );
}
