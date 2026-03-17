"use client";

import { useState } from "react";
import { useAuthStatus } from "@/lib/use-auth-status";

/**
 * Phase200: 写真投稿導線
 *
 * 大会詳細ページで写真投稿を促すCTA。
 * 投稿タイプ: コース、スタート、ゴール、景色、会場
 */

const PHOTO_TYPES = [
  { value: "course", label: "コース", icon: "🛣️" },
  { value: "start", label: "スタート", icon: "🏁" },
  { value: "finish", label: "ゴール", icon: "🎉" },
  { value: "scenery", label: "景色", icon: "🏔️" },
  { value: "venue", label: "会場", icon: "🏟️" },
  { value: "other", label: "その他", icon: "📷" },
];

export default function PhotoUploadCTA({ eventId, eventTitle, sportType }) {
  const { isLoggedIn } = useAuthStatus();
  const [expanded, setExpanded] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!isLoggedIn) {
    return (
      <div className="card p-4 text-center" data-track="photo_upload_cta_view">
        <p className="text-sm text-gray-600 mb-2">📷 この大会の写真を共有しませんか？</p>
        <a
          href={`/login?redirect=${encodeURIComponent(`/marathon/${eventId}`)}`}
          className="inline-flex items-center gap-1 px-4 py-2 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          data-track="photo_upload_login"
        >
          ログインして写真を投稿
        </a>
      </div>
    );
  }

  if (success) {
    return (
      <div className="card p-4 text-center bg-green-50 border-green-200">
        <p className="text-sm text-green-700 font-medium">✅ 写真を投稿しました！確認後に公開されます。</p>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const fileInput = e.target.querySelector('input[type="file"]');
    const file = fileInput?.files?.[0];
    if (!file) { setError("写真を選択してください"); return; }
    if (!selectedType) { setError("写真タイプを選択してください"); return; }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("event_id", eventId);
      formData.append("sport_type", sportType || "marathon");
      formData.append("image_type", selectedType);
      formData.append("caption", caption);

      const res = await fetch("/api/photos/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "投稿に失敗しました");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setUploading(false);
    }
  }

  if (!expanded) {
    return (
      <div className="card p-4" data-track="photo_upload_cta_view">
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          data-track="photo_upload_expand"
        >
          <span>📷</span>
          写真を投稿する
        </button>
      </div>
    );
  }

  return (
    <div className="card p-5" data-track="photo_upload_form_view">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <span>📷</span>
          写真を投稿
        </h3>
        <button
          onClick={() => setExpanded(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          閉じる
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 写真タイプ */}
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">写真タイプ *</p>
          <div className="flex flex-wrap gap-2">
            {PHOTO_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setSelectedType(type.value)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  selectedType === type.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                }`}
              >
                {type.icon} {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* ファイル */}
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">写真ファイル *</p>
          <input
            type="file"
            accept="image/*"
            className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
        </div>

        {/* キャプション */}
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">コメント（任意）</p>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={200}
            placeholder="例: ゴール手前の景色が最高でした"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={uploading}
          className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {uploading ? "アップロード中..." : "投稿する"}
        </button>
      </form>
    </div>
  );
}
