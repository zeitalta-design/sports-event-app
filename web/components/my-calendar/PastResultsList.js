"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { saveResult, getReflection, saveReflection } from "@/lib/my-calendar-manager";

/**
 * 感情ラベルを判定
 */
function getEmotionalLabels(eventId, result, events, results) {
  const labels = [];
  if (!result) return labels;

  if (result.isPB) {
    labels.push({ text: "自己ベスト更新", emoji: "🏅", color: "bg-yellow-100 text-yellow-800 border-yellow-200" });
  }

  if (result.finishTime) {
    const currentEvent = events.find((e) => e.id === eventId);
    const currentDate = currentEvent?.event_date;
    const olderResults = events.filter((e) => {
      if (e.id === eventId) return false;
      const r = results[e.id];
      return r?.finishTime && e.event_date && e.event_date < currentDate;
    });
    if (olderResults.length === 0) {
      labels.push({ text: "初完走", emoji: "🎉", color: "bg-pink-100 text-pink-800 border-pink-200" });
    }
  }

  return labels;
}

/**
 * 過去の参加記録一覧 — 振り返りメモ付き
 */
export default function PastResultsList({ events, results, onResultsChange }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [reflectionEditId, setReflectionEditId] = useState(null);
  const [reflectionForm, setReflectionForm] = useState({});
  const [reflections, setReflections] = useState({});

  // 振り返りデータ読み込み
  useEffect(() => {
    const r = {};
    for (const ev of events || []) {
      const ref = getReflection(ev.id);
      if (ref) r[ev.id] = ref;
    }
    setReflections(r);
  }, [events]);

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        参加記録はまだありません。
      </div>
    );
  }

  function handleEdit(eventId) {
    const existing = results[eventId] || {};
    setEditForm({
      finishTime: existing.finishTime || "",
      overallRank: existing.overallRank || "",
      isPB: existing.isPB || false,
      memo: existing.memo || "",
    });
    setEditingId(eventId);
  }

  function handleSave(eventId) {
    saveResult(eventId, {
      finishTime: editForm.finishTime || null,
      overallRank: editForm.overallRank ? Number(editForm.overallRank) : null,
      isPB: editForm.isPB || false,
      memo: editForm.memo || null,
    });
    setEditingId(null);
    onResultsChange?.();
  }

  function handleCancel() {
    setEditingId(null);
    setEditForm({});
  }

  function handleReflectionEdit(eventId) {
    const existing = reflections[eventId] || {};
    setReflectionForm({
      reflection: existing.reflection || "",
      nextGoal: existing.nextGoal || "",
      whatWorked: existing.whatWorked || "",
      whatToImprove: existing.whatToImprove || "",
    });
    setReflectionEditId(eventId);
  }

  function handleReflectionSave(eventId) {
    saveReflection(eventId, reflectionForm);
    setReflections({ ...reflections, [eventId]: { ...reflectionForm } });
    setReflectionEditId(null);
  }

  return (
    <div className="space-y-3">
      {events.map((ev) => {
        const result = results[ev.id];
        const isEditing = editingId === ev.id;
        const emotionalLabels = getEmotionalLabels(ev.id, result, events, results);
        const reflection = reflections[ev.id];
        const isReflectionEditing = reflectionEditId === ev.id;

        const dateStr = ev.event_date
          ? new Date(ev.event_date).toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "不明";

        return (
          <div
            key={ev.id}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
          >
            {/* ヘッダー行 */}
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-gray-900 line-clamp-1">
                  {ev.title}
                </h3>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                  <span>{dateStr}</span>
                  {ev.prefecture && <span>{ev.prefecture}</span>}
                </div>
              </div>
              <Link
                href={`/marathon/${ev.id}`}
                className="shrink-0 text-xs text-blue-600 hover:text-blue-700 font-medium ml-2"
              >
                詳細
              </Link>
            </div>

            {/* 感情ラベル */}
            {emotionalLabels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {emotionalLabels.map((label) => (
                  <span
                    key={label.text}
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${label.color}`}
                  >
                    {label.emoji} {label.text}
                  </span>
                ))}
              </div>
            )}

            {/* 記録表示/編集 */}
            {isEditing ? (
              <div className="mt-3 space-y-2 bg-gray-50 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-500 font-medium mb-0.5">タイム</label>
                    <input
                      type="text"
                      placeholder="例: 3:45:30"
                      value={editForm.finishTime}
                      onChange={(e) => setEditForm({ ...editForm, finishTime: e.target.value })}
                      className="w-full text-sm border border-gray-200 rounded px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 font-medium mb-0.5">順位</label>
                    <input
                      type="number"
                      placeholder="例: 150"
                      value={editForm.overallRank}
                      onChange={(e) => setEditForm({ ...editForm, overallRank: e.target.value })}
                      className="w-full text-sm border border-gray-200 rounded px-2 py-1.5"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 font-medium mb-0.5">メモ</label>
                  <input
                    type="text"
                    placeholder="例: 前半飛ばしすぎた"
                    value={editForm.memo}
                    onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1.5"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={editForm.isPB}
                    onChange={(e) => setEditForm({ ...editForm, isPB: e.target.checked })}
                    className="rounded"
                  />
                  自己ベスト
                </label>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleSave(ev.id)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 transition-colors"
                  >
                    保存
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-3 py-1.5 border border-gray-200 rounded text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2">
                {result ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    {result.finishTime && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">タイム</span>
                        <span className="text-sm font-bold text-gray-800">{result.finishTime}</span>
                      </div>
                    )}
                    {result.overallRank && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">順位</span>
                        <span className="text-sm font-bold text-gray-800">{result.overallRank}位</span>
                      </div>
                    )}
                    {result.isPB && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                        PB 自己ベスト
                      </span>
                    )}
                    {result.memo && (
                      <span className="text-xs text-gray-500 italic">{result.memo}</span>
                    )}
                    <button
                      onClick={() => handleEdit(ev.id)}
                      className="text-[10px] text-blue-600 hover:underline ml-auto"
                    >
                      編集
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleEdit(ev.id)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    記録を入力する
                  </button>
                )}
              </div>
            )}

            {/* 振り返りメモ */}
            {isReflectionEditing ? (
              <div className="mt-3 space-y-2 bg-blue-50/50 rounded-lg p-3 border border-blue-100">
                <p className="text-xs font-bold text-gray-700">レース後の振り返り</p>
                <div>
                  <label className="block text-[10px] text-gray-500 font-medium mb-0.5">振り返り・感想</label>
                  <textarea
                    value={reflectionForm.reflection}
                    onChange={(e) => setReflectionForm({ ...reflectionForm, reflection: e.target.value })}
                    placeholder="レースの感想や気づき"
                    rows={2}
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-500 font-medium mb-0.5">準備で良かったこと</label>
                    <input
                      type="text"
                      value={reflectionForm.whatWorked}
                      onChange={(e) => setReflectionForm({ ...reflectionForm, whatWorked: e.target.value })}
                      placeholder="例: 前日カーボローディング"
                      className="w-full text-sm border border-gray-200 rounded px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 font-medium mb-0.5">次に改善したいこと</label>
                    <input
                      type="text"
                      value={reflectionForm.whatToImprove}
                      onChange={(e) => setReflectionForm({ ...reflectionForm, whatToImprove: e.target.value })}
                      placeholder="例: 補給タイミング"
                      className="w-full text-sm border border-gray-200 rounded px-2 py-1.5"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 font-medium mb-0.5">次の目標</label>
                  <input
                    type="text"
                    value={reflectionForm.nextGoal}
                    onChange={(e) => setReflectionForm({ ...reflectionForm, nextGoal: e.target.value })}
                    placeholder="例: サブ4達成"
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1.5"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleReflectionSave(ev.id)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 transition-colors"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setReflectionEditId(null)}
                    className="px-3 py-1.5 border border-gray-200 rounded text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : reflection ? (
              <div className="mt-3 bg-blue-50/30 rounded-lg p-3 border border-blue-100/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-blue-600">振り返り</span>
                  <button
                    onClick={() => handleReflectionEdit(ev.id)}
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    編集
                  </button>
                </div>
                {reflection.reflection && (
                  <p className="text-xs text-gray-700 mb-1">{reflection.reflection}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-gray-500">
                  {reflection.whatWorked && <span>Good: {reflection.whatWorked}</span>}
                  {reflection.whatToImprove && <span>改善: {reflection.whatToImprove}</span>}
                  {reflection.nextGoal && <span>目標: {reflection.nextGoal}</span>}
                </div>
              </div>
            ) : (
              <button
                onClick={() => handleReflectionEdit(ev.id)}
                className="mt-2 text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                </svg>
                振り返りを残す
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
