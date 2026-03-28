"use client";

import { useState } from "react";
import FavoriteButton from "@/components/FavoriteButton";
import CompareButton from "@/components/CompareButton";
import SaveButton from "@/components/SaveButton";
import SuitabilityBadge from "@/components/SuitabilityBadge";
import OfficialStatusBadge from "@/components/OfficialStatusBadge";
import MarathonDetailEntryButton from "./MarathonDetailEntryButton";
import { getOfficialStatusDef, UNKNOWN_REASONS } from "@/lib/official-status-defs";

function formatDate(dateStr) {
  if (!dateStr) return "未定";
  const d = new Date(dateStr);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${weekdays[d.getDay()]})`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDeadlineInfo(dateStr) {
  if (!dateStr) return null;
  const deadline = new Date(dateStr);
  if (isNaN(deadline.getTime())) return null;
  const now = new Date();
  const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: "締切済み", level: "ended" };
  if (diffDays === 0) return { text: "本日締切！", level: "danger" };
  if (diffDays <= 3) return { text: `あと${diffDays}日`, level: "danger" };
  if (diffDays <= 7) return { text: `あと${diffDays}日`, level: "warning" };
  if (diffDays <= 14) return { text: `あと${diffDays}日`, level: "normal" };
  return { text: `${deadline.getMonth() + 1}/${deadline.getDate()}まで`, level: "safe" };
}

const DEADLINE_BADGE = {
  danger: "bg-red-600 text-white",
  warning: "bg-amber-500 text-white",
  normal: "bg-blue-100 text-blue-700",
  safe: "text-gray-600",
  ended: "bg-gray-200 text-gray-500",
};

function formatConfidenceIcon(confidence) {
  if (!confidence && confidence !== 0) return "⚪";
  if (confidence >= 80) return "🟢";
  if (confidence >= 60) return "🟡";
  if (confidence >= 40) return "🟠";
  return "⚪";
}

function formatTimeAgo(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diffH = Math.floor((now - d) / (1000 * 60 * 60));
  if (diffH < 1) return "1時間以内に確認";
  if (diffH < 24) return `${diffH}時間前に確認`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}日前に確認`;
}

function formatSourceType(sourceType) {
  switch (sourceType) {
    case "official": return "公式サイト";
    case "runnet": return "RUNNET";
    case "moshicom": return "MOSHICOM";
    case "sportsentry": return "SPORTS ENTRY";
    default: return "その他";
  }
}

function getMinFee(races) {
  if (!races || races.length === 0) return null;
  const fees = races.map((r) => r.fee_min).filter((f) => f && f > 0);
  if (fees.length === 0) return null;
  return Math.min(...fees);
}

function getTotalCapacity(races) {
  if (!races || races.length === 0) return null;
  const caps = races.map((r) => r.capacity).filter(Boolean);
  if (caps.length === 0) return null;
  return caps.reduce((a, b) => a + b, 0);
}

function getDistanceLabels(races) {
  if (!races || races.length === 0) return [];
  return races
    .filter((r) => r.distance_km)
    .map((r) =>
      r.distance_km >= 42
        ? "フル"
        : r.distance_km >= 20
          ? "ハーフ"
          : `${r.distance_km}km`
    )
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 4);
}

/**
 * Phase98: 詳細ページヒーロー — リデザイン
 *
 * スポーツエントリー風の2カラム構成:
 * 左: ヒーロー画像（大きく表示）
 * 右: 大会名 + 基本情報テーブル + エントリーCTA
 */
export default function MarathonDetailHero({ data }) {
  const [imgError, setImgError] = useState(false);
  const deadlineInfo = formatDeadlineInfo(
    data.entry_end_date || data.application_end_at
  );
  const heroFeatures = data.features ? data.features.slice(0, 6) : [];
  const minFee = getMinFee(data.races);
  const totalCapacity = getTotalCapacity(data.races);
  const distanceLabels = getDistanceLabels(data.races);
  const hasEntryUrl =
    data.entry_url &&
    (data.entry_status === "open" ||
      ["open", "closing_soon", "capacity_warning"].includes(
        data.official_entry_status
      ));

  // Phase159: heroPhoto fallback — event_photosテーブルのヒーロー画像
  const heroPhotoUrl = data.heroPhoto?.image_url || null;
  const heroImageSrc = data.hero_image_url || heroPhotoUrl;
  const heroAlt = data.heroPhoto?.alt_text || data.title;
  // サムネイルストリップ用（最大4枚、ヒーロー除く）
  const thumbnailPhotos = (data.galleryPhotos || [])
    .filter((p) => p.image_url !== heroImageSrc)
    .slice(0, 4);

  return (
    <div className="mb-8">
      {/* メインヒーロー: 画像 + 情報 — 2カラム（モバイル縦/PC横） */}
      <style dangerouslySetInnerHTML={{ __html: `
        .mdh-layout { display: flex; flex-direction: column; }
        .mdh-img { width: 100%; position: relative; overflow: hidden; aspect-ratio: 16/9; max-height: 260px; }
        .mdh-info { width: 100%; }
        @media (min-width: 1024px) {
          .mdh-layout { flex-direction: row; }
          .mdh-img { width: 42%; flex-shrink: 0; aspect-ratio: auto; max-height: none; }
          .mdh-info { width: 58%; flex-shrink: 0; }
        }
      `}} />
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="mdh-layout">
          {/* 左: 画像エリア */}
          <div className="mdh-img bg-gray-100">
            {heroImageSrc && !imgError ? (
              <img
                src={heroImageSrc}
                alt={heroAlt}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                onError={() => setImgError(true)}
              />
            ) : (
              <div
                className="w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"
                style={{ height: "100%" }}
              >
                <div className="text-center">
                  <span className="text-5xl block mb-2">
                    {data.sport_type === "trail" ? "🏔️" : data.sport_type === "cycling" ? "🚴" : "🏃"}
                  </span>
                  <span className="text-sm text-gray-400">大会写真を準備中</span>
                </div>
              </div>
            )}
            {/* 距離バッジ — 画像上にオーバーレイ */}
            {distanceLabels.length > 0 && (
              <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                {distanceLabels.map((label) => (
                  <span
                    key={label}
                    className="px-2.5 py-1 text-xs font-bold bg-blue-600 text-white rounded-md shadow-sm"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
            {/* エントリー状況バッジ — 画像右上 */}
            <div className="absolute top-3 right-3">
              <OfficialStatusBadge event={data} variant="badge" />
            </div>
          </div>

          {/* 右: 情報エリア */}
          <div className="mdh-info p-5 lg:p-7 flex flex-col">
          {/* カテゴリ + スポーツタグ */}
          <div className="flex items-center gap-2 mb-2">
            {data.sport_type && (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                {data.sport_type === "marathon"
                  ? "マラソン"
                  : data.sport_type === "trail"
                    ? "トレイル"
                    : data.sport_type}
              </span>
            )}
            {data.event_type_label && (
              <span className="text-xs text-gray-500">
                {data.event_type_label}
              </span>
            )}
          </div>

          {/* 大会名 */}
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 leading-snug mb-1">
            {data.title}
          </h1>

          {/* キャッチコピー */}
          {data.tagline && (
            <p className="text-base text-blue-600 font-medium mb-3 leading-relaxed">
              {data.tagline}
            </p>
          )}

          {/* 基本情報テーブル */}
          <div className="flex-1 mt-2">
            <table className="w-full text-base">
              <tbody className="divide-y divide-gray-100">
                <InfoRow label="開催日" bold>
                  <span className="text-gray-900 font-bold">
                    {formatDate(data.event_date)}
                  </span>
                </InfoRow>
                <InfoRow label="申込期間">
                  <span className="text-gray-700">
                    {data.entry_start_date
                      ? formatShortDate(data.entry_start_date)
                      : "—"}
                    {" ～ "}
                    {data.entry_end_date
                      ? formatShortDate(data.entry_end_date)
                      : "—"}
                  </span>
                  {deadlineInfo &&
                    deadlineInfo.level !== "safe" &&
                    deadlineInfo.level !== "ended" && (
                      <span
                        className={`ml-2 inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full ${DEADLINE_BADGE[deadlineInfo.level]}`}
                      >
                        {deadlineInfo.level === "danger" && "🔥 "}
                        {deadlineInfo.text}
                      </span>
                    )}
                </InfoRow>
                <InfoRow label="開催場所">
                  <span className="text-gray-900">
                    {data.prefecture}
                    {data.city ? ` ${data.city}` : ""}
                    {data.venue_name ? ` — ${data.venue_name}` : ""}
                  </span>
                </InfoRow>
                {totalCapacity && (
                  <InfoRow label="定員">
                    <span className="text-gray-700">
                      {totalCapacity.toLocaleString()}人
                    </span>
                    {data.official_capacity_text && (
                      <span className="ml-2 text-xs text-orange-600 font-medium">
                        🔥 {data.official_capacity_text}
                      </span>
                    )}
                  </InfoRow>
                )}
                {minFee && (
                  <InfoRow label="参加費">
                    <span className="text-gray-700">
                      ¥{minFee.toLocaleString()}～
                    </span>
                  </InfoRow>
                )}
                {data.races && data.races.length > 0 && (
                  <InfoRow label="種目">
                    <span className="text-gray-700">
                      {data.races.length}種目
                    </span>
                  </InfoRow>
                )}
              </tbody>
            </table>
          </div>

          {/* 特徴チップ */}
          {heroFeatures.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
              {heroFeatures.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-bold bg-gray-50 text-gray-700 border border-gray-200 rounded-md"
                >
                  {f}
                </span>
              ))}
            </div>
          )}

          {/* 緊急度ラベル */}
          {data.urgency?.label &&
            data.urgency.level !== "low" &&
            data.urgency.level !== "none" &&
            data.entry_status !== "ended" &&
            data.entry_status !== "cancelled" && (
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-lg mt-3 ${data.urgency.labelDef?.className || "bg-amber-50 text-amber-700 border-amber-200"}`}
              >
                {data.urgency.level === "high" ? "⚠️" : "📋"}
                <span>{data.urgency.label}</span>
                {data.urgency.reasonText && (
                  <span className="text-xs opacity-75 ml-1">
                    — {data.urgency.reasonText}
                  </span>
                )}
              </div>
            )}

          {/* Phase91: 適性バッジ */}
          <SuitabilityBadge event={data} variant="detail" />

          {/* エントリーCTA */}
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            {/* 主CTA: エントリー or RUNNET */}
            <div className="flex flex-col sm:flex-row gap-2">
              {hasEntryUrl ? (
                <MarathonDetailEntryButton
                  entryUrl={data.entry_url}
                  eventId={data.id}
                  eventTitle={data.title}
                />
              ) : data.source_url ? (
                <a
                  href={data.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-base rounded-xl transition-colors shadow-md"
                >
                  {data.source_url.includes("sportsentry.ne.jp") ? "スポーツエントリーで見る"
                    : data.source_url.includes("moshicom.com") && !data.source_url.includes("runnet.jp") ? "MOSHICOMで見る"
                    : data.source_url.includes("runnet.jp") ? "RUNNETで見る"
                    : "公式サイトを見る"}（外部サイト）
                  <span className="text-sm">↗</span>
                </a>
              ) : null}
              {hasEntryUrl && data.source_url && (
                <a
                  href={data.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  {data.source_url.includes("sportsentry.ne.jp") ? "スポーツエントリー"
                    : data.source_url.includes("moshicom.com") && !data.source_url.includes("runnet.jp") ? "MOSHICOM"
                    : data.source_url.includes("runnet.jp") ? "RUNNET"
                    : "公式サイト"}で確認 ↗
                </a>
              )}
            </div>
            {/* 副アクション */}
            <div className="flex items-center gap-2">
              <SaveButton eventId={data.id} variant="compact" />
              <CompareButton
                eventId={data.id}
                eventTitle={data.title}
                variant="compact"
                sourcePage="detail"
              />
              <FavoriteButton eventId={data.id} />
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Phase159: サムネイルストリップ */}
      {thumbnailPhotos.length > 0 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto scrollbar-none px-1">
          {thumbnailPhotos.map((photo) => (
            <div key={photo.id} className="flex-shrink-0 w-16 h-12 rounded-md overflow-hidden bg-gray-100 border border-gray-200">
              <img
                src={photo.thumbnail_url || photo.image_url}
                alt={photo.alt_text || photo.caption || "大会写真"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
          {data.photoCount > thumbnailPhotos.length + 1 && (
            <div className="flex-shrink-0 w-16 h-12 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center">
              <span className="text-[10px] text-gray-400 font-medium">+{data.photoCount - thumbnailPhotos.length - 1}</span>
            </div>
          )}
        </div>
      )}

      {/* 募集状況詳細（公式ステータス） */}
      {data.official_entry_status && data.official_checked_at && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400 px-1">
          <span>
            {formatConfidenceIcon(data.official_status_confidence)}{" "}
            {formatTimeAgo(data.official_checked_at)}
          </span>
          {data.official_status_source_type && (
            <span>
              📡 {formatSourceType(data.official_status_source_type)}
            </span>
          )}
          {(data.official_entry_status === "unknown" ||
            data.official_entry_status === "awaiting_update") &&
            data.official_unknown_reason && (
              <span className="text-amber-600">
                💡{" "}
                {UNKNOWN_REASONS[data.official_unknown_reason]?.description ||
                  "公式サイトでご確認ください"}
              </span>
            )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, children, bold }) {
  return (
    <tr>
      <td className="py-3 pr-4 align-top whitespace-nowrap w-28">
        <span className="inline-block px-2.5 py-1 text-xs font-bold text-white bg-gray-700 rounded">
          {label}
        </span>
      </td>
      <td className={`py-3 text-gray-800 ${bold ? "font-bold" : "font-medium"}`}>{children}</td>
    </tr>
  );
}
