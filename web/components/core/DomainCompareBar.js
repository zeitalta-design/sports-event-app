"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getCompareIds,
  getCompareCount,
  clearCompareIds,
  getMaxCompare,
} from "@/lib/core/compare-store";

/**
 * ドメイン対応の比較バー — 画面下部に固定表示
 *
 * 既存の CompareBar.js (sports 専用、localStorage key: taikai_compare_ids) は変更しない。
 * このコンポーネントは compare-store.js (ドメイン別 localStorage) を使用する。
 *
 * @param {Object} props
 * @param {string} props.domainId - ドメインID ("saas", etc.)
 * @param {string} props.comparePath - 比較ページパス ("/saas/compare")
 * @param {string} [props.label] - 比較対象の呼称（"ツール", "大会"）
 */
export default function DomainCompareBar({ domainId, comparePath, label = "件" }) {
  const [count, setCount] = useState(0);
  const max = getMaxCompare();

  useEffect(() => {
    function sync() {
      setCount(getCompareCount(domainId));
    }
    sync();

    function onCompareChange(e) {
      if (!e.detail || e.detail.domainId === domainId) {
        sync();
      }
    }
    window.addEventListener("compare-change", onCompareChange);
    return () => window.removeEventListener("compare-change", onCompareChange);
  }, [domainId]);

  if (count === 0) return null;

  const ids = getCompareIds(domainId);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {count} / {max}
          </span>
          <span className="text-sm text-gray-700">
            {count}{label}を比較中
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => clearCompareIds(domainId)}
            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
          >
            クリア
          </button>
          <Link
            href={`${comparePath}?ids=${ids.join(",")}`}
            className="btn-primary text-xs"
          >
            比較する
          </Link>
        </div>
      </div>
    </div>
  );
}
