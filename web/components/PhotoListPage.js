"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SnsShareButtons from "@/components/SnsShareButtons";

/**
 * Phase161: 写真一覧ページコンポーネント
 *
 * /marathon/[id]/photos, /[sportSlug]/[id]/photos 共通。
 * グリッド表示 + カテゴリ/年絞り込み + ライトボックス風拡大。
 */

const TYPE_LABELS = {
  hero: "メイン",
  course: "コース",
  venue: "会場",
  start: "スタート",
  finish: "フィニッシュ",
  crowd: "盛り上がり",
  scenery: "景色",
  other: "その他",
};

export default function PhotoListPage({ eventId, eventTitle, backPath }) {
  const [photos, setPhotos] = useState([]);
  const [total, setTotal] = useState(0);
  const [types, setTypes] = useState([]);
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState("");
  const [offset, setOffset] = useState(0);
  const [expandedPhoto, setExpandedPhoto] = useState(null);
  const LIMIT = 30;

  useEffect(() => {
    loadPhotos();
  }, [selectedType, offset]);

  async function loadPhotos() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ event_id: String(eventId), limit: String(LIMIT), offset: String(offset) });
      if (selectedType) params.set("image_type", selectedType);
      const res = await fetch(`/api/photos?${params}`);
      const data = await res.json();
      setPhotos(data.photos || []);
      setTotal(data.total || 0);
      setTypes(data.types || []);
      setYears(data.years || []);
    } catch (err) {
      console.error("Failed to load photos:", err);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="mb-6">
        <Link href={backPath} className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block">
          ← 大会ページに戻る
        </Link>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-gray-900">
            {eventTitle ? `${eventTitle} の写真` : "大会写真"}
          </h1>
          <SnsShareButtons url={typeof window !== "undefined" ? window.location.href : ""} title={eventTitle ? `${eventTitle} の写真` : "大会写真"} compact />
        </div>
        {total > 0 && (
          <p className="text-sm text-gray-500 mt-1">{total}枚の写真</p>
        )}
      </div>

      {/* フィルタ */}
      {types.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={() => { setSelectedType(""); setOffset(0); }}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              !selectedType ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            すべて
          </button>
          {types.map((t) => (
            <button
              key={t.image_type}
              onClick={() => { setSelectedType(t.image_type); setOffset(0); }}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                selectedType === t.image_type ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {TYPE_LABELS[t.image_type] || t.image_type} ({t.count})
            </button>
          ))}
        </div>
      )}

      {/* グリッド */}
      {loading ? (
        <p className="text-sm text-gray-400 py-12 text-center">読み込み中...</p>
      ) : photos.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-3xl mb-2">📷</p>
          <p className="text-sm text-gray-400">写真はまだありません</p>
          <p className="text-xs text-gray-300 mt-1">大会の雰囲気を伝える写真を準備中です</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => setExpandedPhoto(photo)}
                className="relative rounded-lg overflow-hidden bg-gray-100 group focus:outline-none focus:ring-2 focus:ring-blue-400"
                style={{ aspectRatio: "4/3" }}
              >
                <img
                  src={photo.thumbnail_url || photo.image_url}
                  alt={photo.alt_text || photo.caption || "大会写真"}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                {/* オーバーレイ情報 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    {photo.caption && (
                      <p className="text-white text-xs line-clamp-2">{photo.caption}</p>
                    )}
                    {photo.image_type && TYPE_LABELS[photo.image_type] && (
                      <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.5 rounded mt-1 inline-block">
                        {TYPE_LABELS[photo.image_type]}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                disabled={offset === 0}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                前へ
              </button>
              <span className="text-xs text-gray-500">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setOffset(offset + LIMIT)}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                次へ
              </button>
            </div>
          )}
        </>
      )}

      {/* ライトボックス */}
      {expandedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpandedPhoto(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setExpandedPhoto(null)}
              className="absolute -top-10 right-0 text-white text-sm hover:text-gray-300 transition-colors"
            >
              ✕ 閉じる
            </button>
            <img
              src={expandedPhoto.image_url}
              alt={expandedPhoto.alt_text || expandedPhoto.caption || "大会写真"}
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />
            {(expandedPhoto.caption || expandedPhoto.image_type) && (
              <div className="mt-3 text-center">
                {expandedPhoto.caption && (
                  <p className="text-white text-sm">{expandedPhoto.caption}</p>
                )}
                <div className="flex items-center justify-center gap-3 mt-1 text-xs text-gray-400">
                  {expandedPhoto.image_type && TYPE_LABELS[expandedPhoto.image_type] && (
                    <span>{TYPE_LABELS[expandedPhoto.image_type]}</span>
                  )}
                  {expandedPhoto.taken_year && (
                    <span>{expandedPhoto.taken_year}年撮影</span>
                  )}
                  {expandedPhoto.source_type && (
                    <span>
                      提供: {expandedPhoto.source_type === "official" ? "公式" :
                             expandedPhoto.source_type === "organizer" ? "運営" :
                             expandedPhoto.source_type === "user" ? "参加者" : "編集部"}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
