import { notFound } from "next/navigation";
import Link from "next/link";
import { getSportBySlug } from "@/lib/sport-config";
import { siteConfig } from "@/lib/site-config";
import { PREFECTURE_NAME_TO_SLUG } from "@/lib/seo-mappings";
import { getMarathonDetailPageData } from "@/lib/marathon-detail-service";
import { extractTrailTags } from "@/lib/trail-tags";
import {
  buildEventQuickFacts,
  buildEventHighlights,
  buildEventComparisonSummary,
} from "@/lib/event-detail-highlights";
import {
  getRelatedEvents,
  getAlternativeEvents,
  buildSearchLinksFromEvent,
} from "@/lib/event-related";
import {
  buildDecisionSignals,
  buildDecisionSummary,
} from "@/lib/event-decision-signals";
import Breadcrumbs from "@/components/Breadcrumbs";
import ExternalLinkCard from "@/components/ExternalLinkCard";
import {
  MarathonDetailHero,
  MarathonDetailSummary,
  MarathonDetailOverview,
  MarathonDetailFeatures,
  MarathonDetailServices,
  MarathonDetailPricing,
  MarathonDetailSchedule,
  MarathonDetailTimeLimits,
  MarathonDetailFaq,
  MarathonDetailOrganizer,
  MarathonDetailUrgency,
  MarathonDetailPopularity,
  MarathonViewTracker,
} from "@/components/marathon-detail";
import { ConflictDetailBanner } from "@/components/VerificationConflictBadge";
import {
  EventCommentsSection,
  EventTermsSection,
  EventCourseSection,
  EventDayGuideSection,
  EventQuickFactsCard,
  EventHighlightBadges,
  EventComparisonCard,
  RelatedEventsSection,
  AlternativeEventsSection,
  EventSearchLinksSection,
  EventCompareActions,
  EventSaveActions,
  EventDecisionSignalsCard,
} from "@/components/event-detail";

/**
 * Phase49→Phase55: 汎用スポーツ詳細ページ（大幅情報強化）
 *
 * /[sportSlug]/[id] にマッチ。
 * /marathon/[id] は既存ルートが優先されるため、ここに来るのは他スポーツのみ。
 *
 * Phase55: getMarathonDetailPageData() を利用し、marathon_details テーブルの
 * 全フィールドを活用した情報量の多い詳細ページへ進化。
 */

// --- Helpers ---

function formatShortDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function buildEventJsonLd(data, sport) {
  const baseUrl = siteConfig.siteUrl;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: data.title,
    url: `${baseUrl}/${sport.slug}/${data.id}`,
  };

  if (data.event_date) jsonLd.startDate = data.event_date;

  const desc = data.summary || data.description;
  if (desc) jsonLd.description = desc.slice(0, 300);

  const placeName = data.venue_name || `${data.prefecture || ""}${data.city || ""}`;
  if (placeName) {
    jsonLd.location = {
      "@type": "Place",
      name: placeName,
      address: {
        "@type": "PostalAddress",
        streetAddress: data.venue_address || undefined,
        addressRegion: data.prefecture || undefined,
        addressLocality: data.city || undefined,
        addressCountry: "JP",
      },
    };
  }

  if (data.organizer) {
    jsonLd.organizer = {
      "@type": "Organization",
      name: data.organizer.name,
      ...(data.organizer.email && { email: data.organizer.email }),
      ...(data.organizer.phone && { telephone: data.organizer.phone }),
    };
  }

  if (data.races && data.races.length > 0) {
    const fees = data.races.map((r) => r.fee_min).filter((f) => f && f > 0);
    if (fees.length > 0) {
      jsonLd.offers = {
        "@type": "Offer",
        priceCurrency: "JPY",
        price: Math.min(...fees),
        availability:
          data.entry_status === "open"
            ? "https://schema.org/InStock"
            : data.entry_status === "closed"
              ? "https://schema.org/SoldOut"
              : undefined,
        validThrough: data.entry_end_date || undefined,
        url: data.entry_url || data.source_url || undefined,
      };
    }
  }

  const sameAs = [];
  if (data.source_url) sameAs.push(data.source_url);
  if (data.official_url && data.official_url !== data.source_url)
    sameAs.push(data.official_url);
  if (sameAs.length > 0) jsonLd.sameAs = sameAs;

  if (data.entry_status === "cancelled") {
    jsonLd.eventStatus = "https://schema.org/EventCancelled";
  }
  jsonLd.eventAttendanceMode = "https://schema.org/OfflineEventAttendanceMode";

  return jsonLd;
}

// --- Metadata ---

export async function generateMetadata({ params }) {
  const { sportSlug, id } = await params;
  const sport = getSportBySlug(sportSlug);
  if (!sport || !sport.enabled) return {};

  try {
    const data = getMarathonDetailPageData(id);
    if (!data || data.sport_type !== sport.sportTypeForDb) return {};

    const datePart = data.event_date
      ? `（${formatShortDate(data.event_date)}開催）`
      : "";
    const locationPart = data.prefecture || "";
    const entryPart = data.entry_status === "open" ? "エントリー受付中。" : "";

    const description = `${data.title}${datePart}の開催日、開催地、種目、エントリー情報を確認できます。${locationPart ? `${locationPart}で開催。` : ""}${entryPart}`;

    return {
      title: data.title,
      description,
      openGraph: {
        title: `${data.title} | ${siteConfig.siteName}`,
        description,
        type: "website",
      },
    };
  } catch {
    return {};
  }
}

// --- Page ---

export default async function SportDetailPage({ params }) {
  const { sportSlug, id } = await params;
  const sport = getSportBySlug(sportSlug);
  if (!sport || !sport.enabled) notFound();

  let data;
  try {
    data = getMarathonDetailPageData(id);
  } catch {
    notFound();
  }
  if (!data) notFound();

  // sport_type ガード: /trail/123 で marathon イベントが表示されるのを防ぐ
  if (data.sport_type !== sport.sportTypeForDb) notFound();

  const prefectureSlug = data.prefecture
    ? PREFECTURE_NAME_TO_SLUG[data.prefecture]
    : null;
  const eventMonth = data.event_month ? parseInt(data.event_month) : null;

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: sport.label, href: `/${sport.slug}` },
    { label: data.title },
  ];

  const eventJsonLd = buildEventJsonLd(data, sport);

  // Phase52: trail タグ抽出
  const trailTags = sport.slug === "trail" ? extractTrailTags(data) : [];

  // Phase57: 要点・ハイライト・比較UI
  const quickFacts = buildEventQuickFacts(data);
  const highlights = buildEventHighlights(data);
  const comparison = buildEventComparisonSummary(data);

  // Phase58: 回遊強化
  const p58RelatedEvents = getRelatedEvents(data, { limit: 6 });
  const p58ExcludeIds = new Set(p58RelatedEvents.map((e) => e.id));
  const p58AlternativeEvents = getAlternativeEvents(data, {
    limit: 4,
    excludeIds: p58ExcludeIds,
  });
  const p58SearchLinks = buildSearchLinksFromEvent(data, {
    sportSlug: sport.slug,
  });

  // Phase59: 判断シグナル
  const { signals: decisionSignals } = buildDecisionSignals(data);
  const decisionSummary = buildDecisionSummary(data);

  // 関連リンク
  const relatedLinks = [];
  if (prefectureSlug) {
    relatedLinks.push({
      label: `${data.prefecture}の${sport.label}大会`,
      href: `/${sport.slug}/prefecture/${prefectureSlug}`,
    });
  }
  if (eventMonth && eventMonth >= 1 && eventMonth <= 12) {
    relatedLinks.push({
      label: `${eventMonth}月開催の${sport.label}大会`,
      href: `/${sport.slug}/month/${eventMonth}`,
    });
  }
  if (sport.slug === "trail") {
    relatedLinks.push({
      label: "🔥 トレイル人気ランキング",
      href: "/trail/ranking",
    });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />

      {/* パンくず */}
      <Breadcrumbs items={breadcrumbs} />

      {/* A. Hero */}
      <MarathonDetailHero data={data} />

      {/* Phase52: trail 専用タグチップ */}
      {trailTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6 -mt-4">
          <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg">
            ⛰️ トレイルラン
          </span>
          {trailTags.map((tag) => (
            <span
              key={tag.label}
              className="inline-flex items-center px-3 py-1 text-sm font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg"
            >
              {tag.label}
            </span>
          ))}
        </div>
      )}

      {/* Phase39: 相互検証の矛盾警告 */}
      {data.verification_conflict_level >= 2 && (
        <div className="mt-2">
          <ConflictDetailBanner
            level={data.verification_conflict_level}
            summary={data.verification_conflict_summary}
          />
        </div>
      )}

      {/* Phase59: アクションバー（比較・あとで見る） */}
      <div className="flex items-center gap-3 mt-3">
        <EventCompareActions
          eventId={data.id}
          eventTitle={data.title}
          sourcePage={`${sport.slug}_detail`}
        />
        <EventSaveActions
          eventId={data.id}
          eventTitle={data.title}
          sourcePage={`${sport.slug}_detail`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-2">
        {/* メインカラム */}
        <div className="lg:col-span-2 space-y-6">
          {/* Phase59: 検討時のポイント */}
          <EventDecisionSignalsCard
            signals={decisionSignals}
            summary={decisionSummary}
          />

          {/* Phase57: この大会の要点 */}
          <EventQuickFactsCard quickFacts={quickFacts} />

          {/* Phase57: この大会の特徴 */}
          <EventHighlightBadges highlights={highlights} />

          {/* B. 基本情報サマリー */}
          <MarathonDetailSummary data={data} />

          {/* B2. 締切傾向・緊急度 */}
          <MarathonDetailUrgency
            urgency={data.urgency}
            entryHistory={data.entryHistory}
            entryStatus={data.entry_status}
          />

          {/* C. 大会概要 */}
          <MarathonDetailOverview data={data} />

          {/* Phase57: 比較メモ */}
          <EventComparisonCard comparison={comparison} />

          {/* Phase58: この条件でもっと探す */}
          <EventSearchLinksSection searchLinks={p58SearchLinks} />

          {/* Phase58: 似た条件の大会 */}
          <RelatedEventsSection
            events={p58RelatedEvents}
            sportSlug={sport.slug}
          />

          {/* Phase58: 代わりに検討しやすい大会 */}
          <AlternativeEventsSection
            events={p58AlternativeEvents}
            sportSlug={sport.slug}
          />

          {/* D. 特徴 */}
          <MarathonDetailFeatures features={data.features} />

          {/* D2. サービス・設備 */}
          <MarathonDetailServices
            services={data.services}
            parkingInfo={data.parking_info}
          />

          {/* E. 種目・参加費 */}
          <MarathonDetailPricing pricing={data.pricing} races={data.races} />

          {/* F. コース・競技情報 */}
          <EventCourseSection
            courseInfo={data.course_info}
            raceMethodText={data.race_method_text}
            cutoffText={data.cutoff_text}
            timeLimits={data.time_limits}
            races={data.races}
          />

          {/* G. タイムスケジュール */}
          <MarathonDetailSchedule schedule={data.schedule} />

          {/* H. 当日ガイド */}
          <EventDayGuideSection
            receptionPlace={data.reception_place}
            receptionTimeText={data.reception_time_text}
            transitText={data.transit_text}
            parkingInfo={data.parking_info}
            accessInfo={data.access_info}
            venueName={data.venue_name}
            venueAddress={data.venue_address}
            mapUrl={data.map_url}
            eventId={data.id}
            eventTitle={data.title}
          />

          {/* I. FAQ */}
          <MarathonDetailFaq faq={data.faq} />

          {/* J. 主催者 */}
          <MarathonDetailOrganizer organizer={data.organizer} />

          {/* K. 規約・注意事項 */}
          <EventTermsSection
            cancellationPolicy={data.cancellation_policy}
            notes={data.notes}
            termsText={data.terms_text}
            pledgeText={data.pledge_text}
            refundPolicyText={data.refund_policy_text}
            registrationRequirementsText={data.registration_requirements_text}
            healthManagementText={data.health_management_text}
          />

          {/* L. 口コミ・レビュー */}
          <EventCommentsSection reviews={data.reviews} eventId={data.id} />

          {/* 掲載情報に関する注意 */}
          <p className="text-xs text-gray-400 mt-4 leading-relaxed">
            ※
            掲載情報は外部サイトより取得したものです。最新の情報・申込条件は掲載元ページでご確認ください。
            大会ナビは大会情報の検索・比較・通知を支援するサービスです。
          </p>
        </div>

        {/* サイドバー */}
        <div className="space-y-6">
          {/* 外部リンク（計測付き） */}
          <ExternalLinkCard
            sourceUrl={data.source_url}
            officialUrl={data.official_url}
            eventId={data.id}
            eventTitle={data.title}
          />

          {/* Phase46: 人気指数 */}
          <MarathonDetailPopularity eventId={data.id} />

          {/* 開催地情報 */}
          {(data.prefecture || data.city || data.venue_name) && (
            <div className="card p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">開催地</h3>
              <dl className="space-y-2 text-sm">
                {data.prefecture && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">都道府県</dt>
                    <dd className="text-gray-900">
                      {prefectureSlug ? (
                        <Link
                          href={`/${sport.slug}/prefecture/${prefectureSlug}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {data.prefecture}
                        </Link>
                      ) : (
                        data.prefecture
                      )}
                    </dd>
                  </div>
                )}
                {data.city && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">市区町村</dt>
                    <dd className="text-gray-900">{data.city}</dd>
                  </div>
                )}
                {data.venue_name && (
                  <div>
                    <dt className="text-gray-500 mb-1">会場</dt>
                    <dd className="text-gray-900">{data.venue_name}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* データ鮮度 */}
          {data.freshness && (
            <div className="text-center space-y-1">
              <p className={`text-xs ${data.freshness.className || "text-gray-400"}`}>
                {data.freshness.displayText}
              </p>
              {data.freshness.cautionText && (
                <p className="text-xs text-amber-600 leading-relaxed">
                  ※ {data.freshness.cautionText}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 閲覧ログ記録 */}
      <MarathonViewTracker marathonId={data.id} />

      {/* 関連する条件で探す */}
      {relatedLinks.length > 0 && (
        <div className="mt-10 pt-8 border-t border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 mb-3">
            関連する条件で探す
          </h2>
          <div className="flex flex-wrap gap-2">
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200
                           rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
