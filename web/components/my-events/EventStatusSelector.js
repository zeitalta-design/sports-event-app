"use client";

import { EVENT_STATUSES, STATUS_KEYS, STATUS_COLORS, setEventStatus } from "@/lib/my-events-manager";

/**
 * Phase100: ステータス変更セレクター
 * 横スクロール可能なピルUI。
 */
export default function EventStatusSelector({ eventId, currentStatus, onStatusChange }) {
  const handleClick = (status) => {
    setEventStatus(eventId, status);
    if (onStatusChange) onStatusChange(status);
  };

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
      {STATUS_KEYS.map((key) => {
        const def = EVENT_STATUSES[key];
        const colors = STATUS_COLORS[key];
        const isActive = currentStatus === key;

        return (
          <button
            key={key}
            onClick={() => handleClick(key)}
            className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              isActive
                ? `${colors.bg} ${colors.text} ${colors.border} ring-1 ring-current ring-opacity-30`
                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span className="text-sm">{def.icon}</span>
            <span>{def.label}</span>
          </button>
        );
      })}
    </div>
  );
}
