"use client";

import { trackEvent, EVENTS } from "@/lib/analytics";

/**
 * URL → サイト種別を判定
 * 遷移先URLに基づいてボタン文言を100%正確に決定する
 */
function detectSiteType(url) {
  if (!url) return null;
  const u = url.toLowerCase();
  // RUNNET経由のMOSHICOMリダイレクト（moshicomDetailAction）はRUNNET扱い
  if (u.includes("sportsentry.ne.jp")) return "sportsentry";
  if ((u.includes("moshicom.com") || u.includes("e-moshicom.com")) && !u.includes("runnet.jp")) return "moshicom";
  if (u.includes("runnet.jp")) return "runnet";
  return "official";
}

const SITE_CONFIG = {
  runnet: {
    label: "RUNNET",
    buttonText: "RUNNETで見る",
    gaEvent: "EXTERNAL_RUNNET",
    order: 2,
  },
  sportsentry: {
    label: "スポーツエントリー",
    buttonText: "スポーツエントリーで見る",
    gaEvent: "EXTERNAL_SPORTSENTRY",
    order: 3,
  },
  moshicom: {
    label: "MOSHICOM",
    buttonText: "MOSHICOMで見る",
    gaEvent: "EXTERNAL_MOSHICOM",
    order: 4,
  },
  official: {
    label: "公式サイト",
    buttonText: "公式サイトを見る",
    gaEvent: "EXTERNAL_OFFICIAL",
    order: 1,
  },
};

/**
 * 外部リンクカード（GA4計測 + 人気指数ログ付き）
 * URL判定ベースで文言を動的決定。複数ソース統合対応。
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
  // ── 全リンクを { url, siteType, config } に統合 ──
  const linkMap = new Map(); // url → { siteType, config }

  function addLink(url) {
    if (!url) return;
    const normalized = url.trim();
    if (!normalized || linkMap.has(normalized)) return;
    const siteType = detectSiteType(normalized);
    const config = SITE_CONFIG[siteType] || SITE_CONFIG.official;
    linkMap.set(normalized, { url: normalized, siteType, config });
  }

  // メインソース
  addLink(sourceUrl);
  // 公式URL
  addLink(officialUrl);
  // MOSHICOM URL
  addLink(moshicomUrl);
  // 統合ソース
  canonicalSources.forEach((s) => {
    addLink(s.source_url);
    addLink(s.official_url);
  });

  // 優先順位でソート: official(1) → runnet(2) → sportsentry(3) → moshicom(4)
  const links = Array.from(linkMap.values()).sort(
    (a, b) => a.config.order - b.config.order
  );

  // データ出典ラベル
  const sourceNames = [...new Set(links.map((l) => l.config.label))];
  const sourceLabel = sourceNames.length > 0
    ? `データ出典: ${sourceNames.join(" / ")}`
    : "";

  // ── クリック計測 ──
  function handleClick(link) {
    const gaEventName = EVENTS[link.config.gaEvent] || link.config.gaEvent;
    trackEvent(gaEventName, {
      event_id: eventId,
      event_title: eventTitle,
      url: link.url,
      source_site: link.siteType,
    });
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
          source_site: link.siteType,
          metadata: { url: link.url, target_site: link.siteType },
        }),
      }).catch(() => {});
    } catch {}
  }

  if (links.length === 0) return null;

  // ── 描画 ──
  const isSingle = links.length === 1;

  return (
    <div className="card p-5 space-y-3">
      {links.map((link, i) => {
        // 1本目は主CTA（大きめ）、2本目以降はセカンダリ
        const isPrimary = i === 0;
        const className = isPrimary
          ? "block w-full text-center px-4 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors text-sm"
          : "block w-full text-center px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors";

        return (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleClick(link)}
            className={className}
            data-source={link.siteType}
          >
            {link.config.buttonText}（外部サイト） ↗
          </a>
        );
      })}

      {sourceLabel && (
        <p className="text-xs text-gray-400 text-center">{sourceLabel}</p>
      )}
    </div>
  );
}
