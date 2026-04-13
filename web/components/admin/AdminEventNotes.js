"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Phase132: 管理メモコンポーネント
 *
 * データごとの管理メモ表示・追加UI。
 * 管理画面内で埋め込みで使用。
 */

const NOTE_TYPES = [
  { value: "general", label: "一般メモ", color: "bg-gray-100 text-gray-600" },
  { value: "request_received", label: "依頼受付", color: "bg-blue-100 text-blue-700" },
  { value: "awaiting_reply", label: "返信待ち", color: "bg-amber-100 text-amber-700" },
  { value: "confirmed", label: "確認済み", color: "bg-green-100 text-green-700" },
  { value: "applied", label: "反映済み", color: "bg-emerald-100 text-emerald-700" },
  { value: "needs_recheck", label: "要再確認", color: "bg-red-100 text-red-700" },
];

function getNoteTypeInfo(type) {
  return NOTE_TYPES.find((t) => t.value === type) || NOTE_TYPES[0];
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AdminEventNotes({ eventId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteType, setNoteType] = useState("general");
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/event-notes?event_id=${eventId}`);
      const data = await res.json();
      setNotes(data.notes || []);
    } catch (err) {
      console.error("Failed to load notes:", err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  async function handleAdd() {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/event-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, note_type: noteType, note_text: noteText }),
      });
      if (res.ok) {
        setNoteText("");
        loadNotes();
      }
    } catch (err) {
      console.error("Failed to add note:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h4 className="text-xs font-bold text-gray-600 mb-3">管理メモ</h4>

      {/* 追加フォーム */}
      <div className="flex gap-2 mb-3">
        <select
          value={noteType}
          onChange={(e) => setNoteType(e.target.value)}
          className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg"
        >
          {NOTE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="メモを入力..."
          className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={saving || !noteText.trim()}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "..." : "追加"}
        </button>
      </div>

      {/* メモ一覧 */}
      {loading ? (
        <p className="text-xs text-gray-400">読み込み中...</p>
      ) : notes.length === 0 ? (
        <p className="text-xs text-gray-400">メモはありません</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {notes.map((note) => {
            const typeInfo = getNoteTypeInfo(note.note_type);
            return (
              <div key={note.id} className="flex items-start gap-2 text-xs">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${typeInfo.color}`}>
                  {typeInfo.label}
                </span>
                <span className="text-gray-700 flex-1">{note.note_text}</span>
                <span className="text-gray-400 whitespace-nowrap">{formatDate(note.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
