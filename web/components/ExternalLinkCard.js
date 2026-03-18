"use client";

import { trackEvent, EVENTS } from "@/lib/analytics";

const SOURCE_LABELS = {
  runnet: "RUNNET",
  sportsentry: "スポーツエントリー",
  moshicom: "MOSHICOM",
};

/**
 * 外部リンクカード（GA4計測 + 人気指数ログ付き）
 * 複数ソース統合対応: canonicalSources があれば追加リンクを表示
 */
export default function ExternalLinkCard({
  sourceUrl,
  officialUrl,
  moshicomUrl,
  sourcePriority,
  eventId,
  eventTitle,
  canonicalSources = [],
}) {
  const isMoshicom = officialUrl?.includes("moshicom") || !!moshicomUrl;

  // データ出典ラベル構築
  const sources = ["RUNNET"];
  if (isMoshicom || moshicomUrl) sources.push("moshicom");
  canonicalSources.forEach((s) => {
    const label = SOURCE_LABELS[s.source_site] || s.source_site;
    if (!sources.includes(label)) sources.push(label);
  });
  const sourceLabel = `データ出典: ${sources.join(" / ")}`;

  function logEntryClick(url, clickSourceSite = null) {
    try {
      const sessionId =
        typeof window !== "undefined"
          ? localStorage.getItem("taikainaviSessionId") || ""
          : "";
      fetch("/api/events/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          action_type: "external_link_click",
          session_id: sessionId,
          source_page: "detail",
          source_site: clickSourceSite,
          metadata: { url, target_site: clickSourceSite },
        }),
      }).catch(() => {});
    } catch {}
  }

  function handleSourceClick() {
    trackEvent(EVENTS.EXTERNAL_RUNNET, {
      event_id: eventId,
      event_title: eventTitle,
      url: sourceUrl,
    });
    logEntryClick(sourceUrl, "runnet");
  }

  function handleOfficialClick() {
    const eventName = isMoshicom ? EVENTS.EXTERNAL_MOSHICOM : EVENTS.EXTERNAL_OFFICIAL;
    trackEvent(eventName, {
      event_id: eventId,
      event_title: eventTitle,
      url: officialUrl,
    });
    logEntryClick(officialUrl, isMoshicom ? "moshicom" : "official");
  }

  return (
    <div className="card p-5 space-y-3">
      {/* メインソース: RUNNET */}
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleSourceClick}
          className="block w-full text-center px-4 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors text-sm"
        >
          RUNNETで見る（外部サイト） ↗
        </a>
      )}

      {/* 公式サイト / moshicom */}
      {officialUrl && (
        <a
          href={officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleOfficialClick}
          className="block w-full text-center btn-secondary"
        >
          {isMoshicom
            ? "moshicomで見る（外部サイト） ↗"
            : "公式サイトを見る（外部サイト） ↗"}
        </a>
      )}
      {moshicomUrl && !officialUrl?.includes("moshicom") && (
        <a
          href={moshicomUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            trackEvent(EVENTS.EXTERNAL_MOSHICOM, { event_id: eventId, event_title: eventTitle, url: moshicomUrl });
            logEntryClick(moshicomUrl, "moshicom");
          }}
          className="block w-full text-center btn-secondary"
        >
          moshicomで見る（外部サイト） ↗
        </a>
      )}

      {/* 統合ソースの追加リンク */}
      {canonicalSources.map((s) => {
        if (!s.source_url) return null;
        const label = SOURCE_LABELS[s.source_site] || s.source_site;
        return (
          <a
            key={s.id}
            href={s.source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => logEntryClick(s.source_url, s.source_site)}
            className="block w-full text-center px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {label}で見る（外部サイト） ↗
          </a>
        );
      })}

      <p className="text-xs text-gray-400 text-center">{sourceLabel}</p>
    </div>
  );
}
