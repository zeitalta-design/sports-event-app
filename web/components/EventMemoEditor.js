"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Phase171: サーバー連携メモエディタ
 *
 * ログインユーザー向け。API経由でDB保存。
 * 参加前/参加後カテゴリ対応。
 */

const MEMO_CATEGORIES = [
  { key: "持ち物",       icon: "🎒", placeholder: "ゼッケン、シューズ、ウェア...",     phase: "before" },
  { key: "当日の予定",    icon: "📅", placeholder: "受付時間、スタート時間...",        phase: "before" },
  { key: "交通・宿泊",    icon: "🚃", placeholder: "新幹線、ホテル、駐車場...",       phase: "before" },
  { key: "当日の気づき",   icon: "💡", placeholder: "コースの坂がきつかった、給水所が...", phase: "after" },
  { key: "来年の改善点",   icon: "📈", placeholder: "前半のペース配分、補給タイミング...", phase: "after" },
  { key: "アクセス注意点",  icon: "🚗", placeholder: "渋滞しやすいルート、穴場駐車場...", phase: "after" },
  { key: "家族向けメモ",   icon: "👨‍👩‍👧", placeholder: "応援スポット、子供の待機場所...",  phase: "after" },
  { key: "大会メモ",      icon: "📝", placeholder: "コース注意点、目標タイム...",      phase: "both" },
];

export default function EventMemoEditor({
  eventId,
  defaultOpen = false,
  phaseFilter = null, // "before" | "after" | null(all)
  compact = false,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeCategory, setActiveCategory] = useState(null);
  const [memoTexts, setMemoTexts] = useState({});
  const [memoCount, setMemoCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef(null);

  const categories = phaseFilter
    ? MEMO_CATEGORIES.filter((c) => c.phase === phaseFilter || c.phase === "both")
    : MEMO_CATEGORIES;

  // 初期化
  useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0].key);
    }
  }, [categories, activeCategory]);

  // APIからメモ取得
  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/memos?event_id=${eventId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.memos) {
          setMemoTexts(data.memos.items || {});
          setMemoCount(data.memos.count || 0);
        }
      })
      .catch(() => {});
  }, [eventId]);

  const handleSave = useCallback(
    async (category, text) => {
      setSaving(true);
      try {
        await fetch("/api/memos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_id: eventId, category, text }),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        // カウント更新
        const filledCount = Object.entries({ ...memoTexts, [category]: text })
          .filter(([, v]) => v && v.trim().length > 0).length;
        setMemoCount(filledCount);
      } catch (err) {
        console.error("Memo save failed:", err);
      } finally {
        setSaving(false);
      }
    },
    [eventId, memoTexts]
  );

  const handleChange = useCallback(
    (text) => {
      setMemoTexts((prev) => ({ ...prev, [activeCategory]: text }));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        handleSave(activeCategory, text);
      }, 800);
    },
    [activeCategory, handleSave]
  );

  const handleBlur = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    handleSave(activeCategory, memoTexts[activeCategory] || "");
  }, [activeCategory, memoTexts, handleSave]);

  const currentText = memoTexts[activeCategory] || "";
  const currentDef = categories.find((c) => c.key === activeCategory);

  return (
    <div className={compact ? "" : "mt-2"} data-track="memo_editor">
      {/* トグルボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors"
        data-track="memo_toggle"
      >
        <span>📝</span>
        <span>{isOpen ? "メモを閉じる" : "メモを書く"}</span>
        {memoCount > 0 && (
          <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 text-[10px] font-semibold rounded-full">
            {memoCount}
          </span>
        )}
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-2 bg-gray-50 rounded-lg border border-gray-200 p-3">
          {/* フェーズラベル */}
          {!phaseFilter && (
            <div className="flex gap-3 mb-2 text-[10px] text-gray-400">
              <span>参加前</span>
              <span>|</span>
              <span>参加後</span>
            </div>
          )}

          {/* カテゴリタブ */}
          <div className="flex gap-1 overflow-x-auto pb-2 mb-2 scrollbar-hide">
            {categories.map((cat) => {
              const hasContent = memoTexts[cat.key] && memoTexts[cat.key].trim().length > 0;
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
            maxLength={2000}
            rows={compact ? 2 : 3}
            className="w-full text-sm text-gray-700 bg-white border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 placeholder-gray-300"
          />

          {/* フッター */}
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-gray-400">
              {currentText.length}/2000
            </span>
            <div className="flex items-center gap-2">
              {saving && (
                <span className="text-[10px] text-gray-400">保存中...</span>
              )}
              {saved && !saving && (
                <span className="text-[10px] text-green-600 font-medium">保存しました</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
