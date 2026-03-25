"use client";

import { useState, useEffect, useCallback } from "react";
import {
  toggleCompareId,
  getCompareIds,
  getMaxCompare,
} from "@/lib/core/compare-store";

/**
 * ドメイン対応の比較追加/削除ボタン
 *
 * @param {Object} props
 * @param {string} props.domainId - ドメインID ("saas", etc.)
 * @param {number} props.itemId - 対象アイテムID
 * @param {"icon"|"compact"|"full"} [props.variant="compact"]
 * @param {string} [props.className]
 */
export default function DomainCompareButton({
  domainId,
  itemId,
  variant = "compact",
  className = "",
}) {
  const [isCompared, setIsCompared] = useState(false);

  useEffect(() => {
    setIsCompared(getCompareIds(domainId).includes(itemId));

    function onCompareChange(e) {
      if (!e.detail || e.detail.domainId === domainId) {
        setIsCompared(getCompareIds(domainId).includes(itemId));
      }
    }
    window.addEventListener("compare-change", onCompareChange);
    return () => window.removeEventListener("compare-change", onCompareChange);
  }, [domainId, itemId]);

  const handleClick = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const result = toggleCompareId(domainId, itemId);
      if (result.full) {
        // max reached
      }
      setIsCompared(getCompareIds(domainId).includes(itemId));
    },
    [domainId, itemId]
  );

  if (variant === "icon") {
    return (
      <button
        onClick={handleClick}
        className={`p-1.5 rounded transition-colors ${
          isCompared
            ? "bg-blue-100 text-blue-600"
            : "bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
        } ${className}`}
        title={isCompared ? "比較から外す" : "比較に追加"}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
        isCompared
          ? "bg-blue-600 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      } ${className}`}
    >
      {isCompared ? "比較中" : "比較"}
    </button>
  );
}
