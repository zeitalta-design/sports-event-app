"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MEMO_CATEGORIES,
  getEventMemos,
  setEventMemo,
  getMemoCount,
} from "@/lib/event-memos-storage";

/**
 * Phase101: 大会メモパネル
 *
 * カテゴリタブ切替のテキストエリア。
 * 自動保存（blur + 500msデバウンス）。
 */
export default function EventMemoPanel({ eventId, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeCategory, setActiveCategory] = useState(MEMO_CATEGORIES[0].key);
  const [memoTexts, setMemoTexts] = useState({});
  const [memoCount, setMemoCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef(null);

  // 初期読み込み
  useEffect(() => {
    const data = getEventMemos(eventId);
    if (data?.items) {
      setMemoTexts(data.items);
    }
    setMemoCount(getMemoCount(eventId));
  }, [eventId]);

  // メモ変更時の外部同期
  useEffect(() => {
    function onMemoChange() {
      setMemoCount(getMemoCount(eventId));
    }
    window.addEventListener("event-memos-change", onMemoChange);
    return () => window.removeEventListener("event-memos-change", onMemoChange);
  }, [eventId]);

  const handleSave = useCallback(
    (category, text) => {
      setEventMemo(eventId, category, text);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
    [eventId]
  );

  const handleChange = useCallback(
    (text) => {
      setMemoTexts((prev) => ({ ...prev, [activeCategory]: text }));

      // デバウンス保存
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        handleSave(activeCategory, text);
      }, 500);
    },
    [activeCategory, handleSave]
  );

  const handleBlur = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    handleSave(activeCategory, memoTexts[activeCategory] || "");
  }, [activeCategory, memoTexts, handleSave]);

  const currentText = memoTexts[activeCategory] || "";
  const currentDef = MEMO_CATEGORIES.find((c) => c.key === activeCategory);

  return (
    <div className="mt-2">
      {/* トグルボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors"
      >
        <span>📝</span>
        <span>{isOpen ? "メモを閉じる" : "準備メモ"}</span>
        {memoCount > 0 && (
          <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 text-[10px] font-semibold rounded-full">
            {memoCount}
          </span>
        )}
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* メモ本体 */}
      {isOpen && (
        <div className="mt-2 bg-gray-50 rounded-lg border border-gray-200 p-3">
          {/* カテゴリタブ */}
          <div className="flex gap-1 overflow-x-auto pb-2 mb-2 scrollbar-hide">
            {MEMO_CATEGORIES.map((cat) => {
              const hasContent =
                memoTexts[cat.key] && memoTexts[cat.key].trim().length > 0;
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border transition-colors ${
                    activeCategory === cat.key
                      ? "bg-blue-600 text-white border-blue-600"
                      : hasContent
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.key}</span>
                </button>
              );
            })}
          </div>

          {/* テキストエリア */}
          <textarea
            value={currentText}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={currentDef?.placeholder || "メモを入力..."}
            maxLength={1000}
            rows={3}
            className="w-full text-sm text-gray-700 bg-white border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 placeholder-gray-300"
          />

          {/* フッター */}
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-gray-400">
              {currentText.length}/1000
            </span>
            {saved && (
              <span className="text-[10px] text-green-600 font-medium">
                ✓ 保存しました
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
