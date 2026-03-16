import { notFound } from "next/navigation";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { PREFECTURE_NAME_TO_SLUG, DISTANCE_SLUGS } from "@/lib/seo-mappings";
import { getRelatedMarathons, getSeriesMarathons } from "@/lib/related-marathons";
import { getCooccurrenceMarathons } from "@/lib/cooccurrence-recommendation";
import { toSlug } from "@/lib/slug";
import { getMarathonDetailPageData } from "@/lib/marathon-detail-service";
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
  MarathonRelatedMarathons,
  MarathonSeriesMarathons,
  MarathonDetailUrgency,
  MarathonDetailPopularity,
  MarathonViewTracker,
  EventLocationMap,
  StickyEntryCTA,
  DetailSectionNav,
} from "@/components/marathon-detail";
import { ConflictDetailBanner } from "@/components/VerificationConflictBadge";
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
import {
  EventCommentsSection,
  EventTermsSection,
  EventCourseSection,
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

// --- Helpers ---

function formatShortDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 主要距離を判定して対応するSEOページslugを返す */
function getPrimaryDistanceSlugs(races) {
  if (!races || races.length === 0) return [];
  const slugs = new Set();
  for (const race of races) {
    const km = race.distance_km;
    if (!km) continue;
    if (km >= 42 && km <= 43) slugs.add("full");
    else if (km >= 20 && km <= 22) slugs.add("half");
    else if (km > 5 && km <= 10) slugs.add("10km");
    else if (km > 0 && km <= 5) slugs.add("5km");
    else if (km > 43) slugs.add("ultra");
  }
  return [...slugs];
}

// --- Metadata ---

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const data = getMarathonDetailPageData(id);
    if (!data) return {};

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

// --- JSON-LD ---

function buildEventJsonLd(data) {
  const baseUrl = siteConfig.siteUrl;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: data.title,
    url: `${baseUrl}/marathon/${data.id}`,
  };

  if (data.event_date) {
    jsonLd.startDate = data.event_date;
  }

  const desc = data.summary || data.description;
  if (desc) {
    jsonLd.description = desc.slice(0, 300);
  }

  const placeName =
    data.venue_name || `${data.prefecture || ""}${data.city || ""}`;
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
    const fees = data.races
      .map((r) => r.fee_min)
      .filter((f) => f && f > 0);
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

  jsonLd.eventAttendanceMode =
    "https://schema.org/OfflineEventAttendanceMode";

  return jsonLd;
}

// --- Page ---

export default async function MarathonDetailPage({ params }) {
  const { id } = await params;

  let data;
  try {
    data = getMarathonDetailPageData(id);
  } catch {
    notFound();
  }
  if (!data) notFound();

  const prefectureSlug = data.prefecture
    ? PREFECTURE_NAME_TO_SLUG[data.prefecture]
    : null;
  const distanceSlugs = getPrimaryDistanceSlugs(data.races);
  const eventMonth = data.event_month ? parseInt(data.event_month) : null;

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "マラソン", href: "/marathon" },
    { label: data.title },
  ];

  const eventJsonLd = buildEventJsonLd(data);

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
    sportSlug: "marathon",
  });

  // Phase59: 判断シグナル
  const { signals: decisionSignals } = buildDecisionSignals(data);
  const decisionSummary = buildDecisionSummary(data);

  // 共起推薦 + 属性推薦のハイブリッド
  let relatedMarathons = [];
  let recommendationSource = "attribute";
  try {
    const coResult = getCooccurrenceMarathons(data.id, { limit: 6 });
    const coMarathons = coResult.cooccurrences;

    if (coMarathons.length >= 3) {
      relatedMarathons = coMarathons.slice(0, 6).map((m) => ({
        ...m,
        related_reason_labels: ["よく一緒に見られています"],
        related_score: m.view_count,
      }));
      recommendationSource = "cooccurrence";
    } else if (coMarathons.length >= 1) {
      const attrResult = getRelatedMarathons(data.id, { limit: 6 });
      const coIds = new Set(coMarathons.map((m) => m.id));
      const attrFiltered = attrResult.related.filter((m) => !coIds.has(m.id));
      const coFormatted = coMarathons.map((m) => ({
        ...m,
        related_reason_labels: ["よく一緒に見られています"],
        related_score: m.view_count + 100,
      }));
      relatedMarathons = [...coFormatted, ...attrFiltered].slice(0, 6);
      recommendationSource = "hybrid";
    } else {
      const attrResult = getRelatedMarathons(data.id, { limit: 6 });
      relatedMarathons = attrResult.related;
      recommendationSource = "attribute";
    }
  } catch {
    try {
      const result = getRelatedMarathons(data.id, { limit: 6 });
      relatedMarathons = result.related;
    } catch {}
  }

  // 系列大会 / 同主催者大会
  let seriesMarathons = [];
  let seriesOrganizerName = null;
  let seriesKeyword = null;
  try {
    const result = getSeriesMarathons(data.id, { limit: 6 });
    seriesMarathons = result.series;
    seriesOrganizerName = result.organizerName || null;
    seriesKeyword = result.seriesKeyword || null;
    const relatedIds = new Set(relatedMarathons.map((r) => r.id));
    seriesMarathons = seriesMarathons.filter((s) => !relatedIds.has(s.id));
  } catch {}

  // 関連リンク
  const relatedLinks = [];
  if (prefectureSlug) {
    relatedLinks.push({
      label: `${data.prefecture}のマラソン大会`,
      href: `/marathon/prefecture/${prefectureSlug}`,
    });
  }
  if (eventMonth && eventMonth >= 1 && eventMonth <= 12) {
    relatedLinks.push({
      label: `${eventMonth}月開催のマラソン大会`,
      href: `/marathon/month/${eventMonth}`,
    });
  }
  for (const slug of distanceSlugs) {
    const info = DISTANCE_SLUGS[slug];
    if (info) {
      relatedLinks.push({
        label: `${info.label}大会`,
        href: `/marathon/distance/${slug}`,
      });
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />

      {/* パンくず */}
      <Breadcrumbs items={breadcrumbs} />

      {/* A. ヒーロー: 画像 + 基本情報 */}
      <MarathonDetailHero data={data} />

      {/* Phase39: 相互検証の矛盾警告 */}
      {data.verification_conflict_level >= 2 && (
        <div className="mb-4">
          <ConflictDetailBanner
            level={data.verification_conflict_level}
            summary={data.verification_conflict_summary}
          />
        </div>
      )}

      {/* B. セクションナビゲーション */}
      <DetailSectionNav />

      {/* C. メインコンテンツ: 2カラム（メイン + サイドバー） */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* メインカラム — 連続スクロール */}
        <div className="lg:col-span-2 space-y-8">

          {/* セクション1: 概要 */}
          <section id="section-overview" className="scroll-mt-20 space-y-6">
            <EventDecisionSignalsCard
              signals={decisionSignals}
              summary={decisionSummary}
            />
            <EventQuickFactsCard quickFacts={quickFacts} />
            <EventHighlightBadges highlights={highlights} />
            <MarathonDetailOverview data={data} />
            <MarathonDetailUrgency
              urgency={data.urgency}
              entryHistory={data.entryHistory}
              entryStatus={data.entry_status}
            />
            <EventComparisonCard comparison={comparison} />
          </section>

          {/* セクション2: 種目・参加費 */}
          <section id="section-races" className="scroll-mt-20 space-y-6">
            <MarathonDetailPricing pricing={data.pricing} races={data.races} />
            <MarathonDetailTimeLimits
              timeLimits={data.time_limits}
              races={data.races}
            />
            <EventCourseSection
              courseInfo={data.course_info}
              raceMethodText={data.race_method_text}
              cutoffText={data.cutoff_text}
              timeLimits={[]}
              races={[]}
            />
            <MarathonDetailFeatures features={data.features} />
          </section>

          {/* セクション3: 大会情報 */}
          <section id="section-info" className="scroll-mt-20 space-y-6">
            <MarathonDetailSummary data={data} />
            <MarathonDetailServices
              services={data.services}
              parkingInfo={data.parking_info}
            />
            <MarathonDetailSchedule schedule={data.schedule} />
            <MarathonDetailFaq faq={data.faq} />
            <MarathonDetailOrganizer organizer={data.organizer} />
          </section>

          {/* セクション4: 参加方法 */}
          <section id="section-entry" className="scroll-mt-20 space-y-6">
            <EventTermsSection
              cancellationPolicy={data.cancellation_policy}
              notes={data.notes}
              termsText={data.terms_text}
              pledgeText={data.pledge_text}
              refundPolicyText={data.refund_policy_text}
              registrationRequirementsText={data.registration_requirements_text}
              healthManagementText={data.health_management_text}
            />
            <EventCommentsSection reviews={data.reviews} eventId={data.id} />
          </section>

          {/* セクション5: 会場・アクセス + マップ */}
          <EventLocationMap
            venueName={data.venue_name}
            venueAddress={data.venue_address}
            accessInfo={data.access_info}
            prefecture={data.prefecture}
            city={data.city}
            mapUrl={data.map_url}
            latitude={data.latitude}
            longitude={data.longitude}
            eventId={data.id}
            eventTitle={data.title}
          />

          {/* 掲載情報に関する注意 */}
          <p className="text-xs text-gray-400 leading-relaxed">
            ※
            掲載情報は外部サイトより取得したものです。最新の情報・申込条件は掲載元ページでご確認ください。
            大会ナビは大会情報の検索・比較・通知を支援するサービスです。
          </p>
        </div>

        {/* サイドバー */}
        <div className="space-y-6">
          {/* 外部リンク */}
          <ExternalLinkCard
            sourceUrl={data.source_url}
            officialUrl={data.official_url}
            eventId={data.id}
            eventTitle={data.title}
          />

          {/* アクション */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-700 mb-2">この大会を</h3>
            <div className="flex items-center gap-3">
              <EventCompareActions
                eventId={data.id}
                eventTitle={data.title}
                sourcePage="marathon_detail"
              />
              <EventSaveActions
                eventId={data.id}
                eventTitle={data.title}
                sourcePage="marathon_detail"
              />
            </div>
          </div>

          {/* 人気度 */}
          <MarathonDetailPopularity eventId={data.id} />

          {/* 開催地サマリー */}
          <div className="card p-6">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
              <span>📍</span> 開催地
            </h3>
            <dl className="space-y-2 text-sm">
              {data.prefecture && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">都道府県</dt>
                  <dd className="text-gray-900">
                    {prefectureSlug ? (
                      <Link
                        href={`/marathon/prefecture/${prefectureSlug}`}
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
                  <dd className="text-gray-900 font-medium">{data.venue_name}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* 回遊導線 */}
          <EventSearchLinksSection searchLinks={p58SearchLinks} />

          {/* データ鮮度 */}
          {data.freshness && (
            <div className="text-center space-y-1">
              <p
                className={`text-xs ${data.freshness.className || "text-gray-400"}`}
              >
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

      {/* 系列大会 */}
      <MarathonSeriesMarathons
        currentEventId={data.id}
        currentEventTitle={data.title}
        events={seriesMarathons}
        seriesSlug={seriesKeyword ? toSlug(seriesKeyword) : null}
        seriesName={seriesKeyword || null}
        organizerSlug={
          seriesOrganizerName ? toSlug(seriesOrganizerName) : null
        }
        organizerName={seriesOrganizerName || null}
      />

      {/* 関連大会 */}
      <MarathonRelatedMarathons
        currentEventId={data.id}
        currentEventTitle={data.title}
        events={relatedMarathons}
        recommendationSource={recommendationSource}
      />

      {/* 類似 / 代替大会 */}
      <div className="mt-8 space-y-6">
        <RelatedEventsSection
          events={p58RelatedEvents}
          sportSlug="marathon"
        />
        <AlternativeEventsSection
          events={p58AlternativeEvents}
          sportSlug="marathon"
        />
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

      {/* スティッキーCTAバー（モバイル固定） */}
      <StickyEntryCTA
        entryUrl={data.entry_url}
        sourceUrl={data.source_url}
        eventId={data.id}
        eventTitle={data.title}
        officialEntryStatus={data.official_entry_status}
        entryStatus={data.entry_status}
      />
    </div>
  );
}
