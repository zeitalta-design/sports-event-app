"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  getPrepProgress,
  togglePrepItem,
  addCustomPrepItem,
  removeCustomPrepItem,
  saveItemNote,
  getNote,
  saveNote,
  daysUntil,
} from "@/lib/my-calendar-manager";

/** メモのプレースホルダー例 */
const NOTE_PLACEHOLDERS = {
  entry: "例: 支払い済み、ゼッケン番号 1234",
  venue: "例: スタートは○○公園、駐車場あり",
  gear: "例: シューズ、補給ジェル3個、帽子、ワセリン",
  hotel: "例: ○○ホテル 予約済み、チェックイン15時",
  transport: "例: 新幹線 8:20 東京発、最寄り駅から徒歩10分",
  reception: "例: 前日受付のみ 14:00-17:00",
  goal: "例: サブ4、前半は抑えて後半上げる",
};

/**
 * 準備チェックリスト — 大会ごとの準備管理
 *
 * mode:
 *   "full"    — 全項目表示（モーダル/セクション用）
 *   "summary" — 要約表示（NextEventCard内用）
 *
 * 設計思想:
 *   - チェック/メモは即時自動保存（localStorageへ）
 *   - 0件チェックでも問題なし
 *   - 途中状態が当たり前
 *   - 保存フィードバックで安心感を出す
 */
export default function PrepChecklist({ eventId, eventTitle, eventDate, mode = "full", onClose, onChange }) {
  const [progress, setProgress] = useState(null);
  const [note, setNote] = useState("");
  const [newItem, setNewItem] = useState("");
  const [expandedNotes, setExpandedNotes] = useState(new Set());
  const [editingNotes, setEditingNotes] = useState({}); // { [itemId]: text }
  const [savedFeedback, setSavedFeedback] = useState(null); // { itemId, type }
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const feedbackTimer = useRef(null);

  const days = daysUntil(eventDate);

  const reload = useCallback(() => {
    const p = getPrepProgress(eventId);
    setProgress(p);
    setNote(getNote(eventId));
    // editingNotes を最新の保存済みメモで初期化
    const notes = {};
    for (const item of p.items) {
      if (item.note) notes[item.id] = item.note;
    }
    setEditingNotes((prev) => {
      // 既に編集中のものは上書きしない
      const merged = { ...notes };
      for (const [k, v] of Object.entries(prev)) {
        if (v !== undefined) merged[k] = v;
      }
      return merged;
    });
  }, [eventId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // 保存フィードバック表示
  function showFeedback(itemId, type = "saved") {
    setSavedFeedback({ itemId, type });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setSavedFeedback(null), 1500);
  }

  function handleToggle(itemId) {
    togglePrepItem(eventId, itemId);
    showFeedback(itemId, "check");
    reload();
    onChange?.();
  }

  function handleAddItem() {
    const label = newItem.trim();
    if (!label) return;
    const newId = addCustomPrepItem(eventId, label);
    setNewItem("");
    showFeedback(newId, "added");
    reload();
    onChange?.();
  }

  function handleRemoveItem(itemId) {
    removeCustomPrepItem(eventId, itemId);
    setExpandedNotes((prev) => { const s = new Set(prev); s.delete(itemId); return s; });
    setEditingNotes((prev) => { const n = { ...prev }; delete n[itemId]; return n; });
    reload();
    onChange?.();
  }

  function toggleNoteExpand(itemId) {
    setExpandedNotes((prev) => {
      const s = new Set(prev);
      if (s.has(itemId)) {
        s.delete(itemId);
      } else {
        s.add(itemId);
        // 展開時、保存済みメモをeditingNotesに反映
        const item = progress?.items.find((i) => i.id === itemId);
        if (item?.note && !editingNotes[itemId]) {
          setEditingNotes((p) => ({ ...p, [itemId]: item.note }));
        }
      }
      return s;
    });
  }

  function handleSaveItemNote(itemId) {
    const text = editingNotes[itemId] || "";
    saveItemNote(eventId, itemId, text);
    showFeedback(itemId, "note");
    reload();
    onChange?.();
  }

  function handleSaveNote() {
    saveNote(eventId, note);
    setNoteEditing(false);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 1500);
    onChange?.();
  }

  if (!progress) return null;

  // 緊急度判定
  const urgency = days !== null && days <= 3 ? "critical" : days !== null && days <= 7 ? "high" : "normal";

  // ── summary モード ──
  if (mode === "summary") {
    const unchecked = progress.items.filter((i) => !i.checked);
    return (
      <div className="mt-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                progress.percent === 100
                  ? "bg-green-500"
                  : urgency === "critical"
                  ? "bg-red-500"
                  : urgency === "high"
                  ? "bg-amber-500"
                  : "bg-blue-500"
              }`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span className="text-xs font-bold text-gray-600 shrink-0">
            {progress.done}/{progress.total}
          </span>
        </div>

        {progress.remaining > 0 && (
          <div className={`text-xs ${urgency === "critical" ? "text-red-600 font-bold" : "text-gray-500"}`}>
            {urgency === "critical" && progress.remaining > 0
              ? `残り${progress.remaining}件`
              : `残り${progress.remaining}件`}
            {unchecked.length > 0 && (
              <span className="text-gray-400 ml-1">
                — {unchecked.slice(0, 2).map((i) => i.label).join(", ")}
                {unchecked.length > 2 && ` 他${unchecked.length - 2}件`}
              </span>
            )}
          </div>
        )}
        {progress.percent === 100 && (
          <div className="text-xs text-green-600 font-bold">準備完了</div>
        )}
      </div>
    );
  }

  // ── full モード ──
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* ヘッダー */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-800">準備チェックリスト</h3>
            {eventTitle && (
              <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{eventTitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              progress.percent === 100
                ? "bg-green-100 text-green-700"
                : urgency === "critical"
                ? "bg-red-100 text-red-700"
                : "bg-blue-100 text-blue-700"
            }`}>
              {progress.done}/{progress.total} 完了
            </span>
            {onClose && (
              <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-lg transition-colors">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* プログレスバー */}
        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progress.percent === 100
                ? "bg-green-500"
                : urgency === "critical"
                ? "bg-red-500"
                : urgency === "high"
                ? "bg-amber-500"
                : "bg-blue-500"
            }`}
            style={{ width: `${progress.percent}%` }}
          />
        </div>

        {/* 安心メッセージ */}
        <p className="text-[11px] text-gray-400 mt-1.5">
          {progress.percent === 100
            ? "準備完了！あとは本番を楽しむだけです"
            : progress.done === 0
            ? "少しずつ準備を進めましょう。途中で保存されます"
            : `${progress.done}件完了。チェック・メモは自動保存されます`}
        </p>

        {/* 緊急度メッセージ */}
        {urgency === "critical" && progress.remaining > 0 && (
          <p className="text-xs text-red-600 font-bold mt-1">
            大会まであと{days}日 — まだ{progress.remaining}件未準備
          </p>
        )}
        {urgency === "high" && progress.remaining > 0 && (
          <p className="text-xs text-amber-600 font-medium mt-1">
            大会まであと{days}日 — 未完了: {progress.remaining}件
          </p>
        )}
      </div>

      {/* チェック項目 */}
      <div className="divide-y divide-gray-50">
        {progress.items.map((item) => {
          const isCustom = item.id.startsWith("custom_");
          const isUrgentUnchecked = !item.checked && urgency !== "normal";
          const isExpanded = expandedNotes.has(item.id);
          const hasNote = item.note && item.note.trim();
          const fb = savedFeedback?.itemId === item.id ? savedFeedback : null;

          return (
            <div
              key={item.id}
              className={`px-4 py-2.5 transition-colors ${
                fb ? "bg-green-50/50" :
                isUrgentUnchecked ? "bg-amber-50/50" : "hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* チェックボックス */}
                <button
                  onClick={() => handleToggle(item.id)}
                  className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    item.checked
                      ? "bg-blue-600 border-blue-600 text-white scale-105"
                      : isUrgentUnchecked
                      ? "border-amber-400 hover:border-amber-500"
                      : "border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {item.checked && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </button>

                {/* ラベル */}
                <span className={`flex-1 text-sm ${
                  item.checked ? "text-gray-400 line-through" : "text-gray-800"
                }`}>
                  {item.label}
                </span>

                {/* メモアイコン（メモがある時 or 展開時） */}
                {hasNote && !isExpanded && (
                  <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                    メモあり
                  </span>
                )}

                {/* カテゴリ */}
                <span className="text-[10px] text-gray-400 shrink-0">{item.category}</span>

                {/* メモ展開ボタン */}
                <button
                  onClick={() => toggleNoteExpand(item.id)}
                  className={`shrink-0 p-1 rounded transition-colors ${
                    isExpanded
                      ? "bg-blue-100 text-blue-600"
                      : "text-gray-300 hover:text-blue-500 hover:bg-blue-50"
                  }`}
                  title="メモを編集"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                  </svg>
                </button>

                {/* カスタム項目削除 */}
                {isCustom && (
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="shrink-0 p-0.5 text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}

                {/* 保存フィードバック */}
                {fb && (
                  <span className="text-[10px] text-green-600 font-bold shrink-0 animate-pulse">
                    {fb.type === "check" ? "保存" :
                     fb.type === "note" ? "メモ保存" :
                     fb.type === "added" ? "追加" : "保存"}
                  </span>
                )}
              </div>

              {/* 項目別メモ（展開時） */}
              {isExpanded && (
                <div className="mt-2 ml-8 space-y-1.5">
                  <input
                    type="text"
                    value={editingNotes[item.id] || ""}
                    onChange={(e) => setEditingNotes((p) => ({ ...p, [item.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { handleSaveItemNote(item.id); }
                    }}
                    onBlur={() => handleSaveItemNote(item.id)}
                    placeholder={NOTE_PLACEHOLDERS[item.id] || "例: メモを入力..."}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-gray-50"
                  />
                  <p className="text-[10px] text-gray-400">
                    Enterキーまたはフォーカスを外すと自動保存
                  </p>
                </div>
              )}

              {/* 項目メモ表示（非展開時にメモがある場合） */}
              {!isExpanded && hasNote && (
                <button
                  onClick={() => toggleNoteExpand(item.id)}
                  className="mt-1 ml-8 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 hover:bg-blue-50 hover:text-blue-600 transition-colors text-left w-fit max-w-full truncate"
                >
                  {item.note}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* カスタム項目追加 */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
            placeholder="項目を追加... (例: 補給食購入、雨天対策)"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={handleAddItem}
            disabled={!newItem.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            追加
          </button>
        </div>
      </div>

      {/* 大会全体メモ */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            大会メモ
          </span>
          <div className="flex items-center gap-2">
            {noteSaved && (
              <span className="text-[10px] text-green-600 font-bold animate-pulse">保存しました</span>
            )}
            {!noteEditing && (
              <button onClick={() => setNoteEditing(true)} className="text-[10px] text-blue-600 hover:underline">
                {note ? "編集" : "追加"}
              </button>
            )}
          </div>
        </div>
        {noteEditing ? (
          <div className="space-y-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="全体の注意事項、当日の流れ、家族への共有事項など..."
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveNote}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
              >
                保存する
              </button>
              <button
                onClick={() => { setNote(getNote(eventId)); setNoteEditing(false); }}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors"
              >
                キャンセル
              </button>
              <span className="text-[10px] text-gray-400">途中まででも保存できます</span>
            </div>
          </div>
        ) : note ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2">
            {note}
          </p>
        ) : (
          <p className="text-xs text-gray-400 py-1">メモはまだありません</p>
        )}
      </div>

      {/* フッター安心メッセージ */}
      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 text-center">
          チェックと項目メモは自動保存されます。大会メモは「保存する」ボタンで保存できます。
        </p>
      </div>
    </div>
  );
}
