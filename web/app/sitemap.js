import { getDb } from "@/lib/db";
import { siteConfig } from "@/lib/site-config";
import { PREFECTURE_NAME_TO_SLUG, DISTANCE_SLUGS } from "@/lib/seo-mappings";
import { SPORT_CONFIGS } from "@/lib/sport-config";

export default function sitemap() {
  const baseUrl = siteConfig.siteUrl;

  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/marathon`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/marathon/prefecture`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/marathon/distance`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/marathon/month`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    // Phase53: trail 静的ページ
    { url: `${baseUrl}/trail`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    // Phase54: trail ランキング
    { url: `${baseUrl}/trail/ranking`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/terms`, lastModified: new Date("2026-03-15"), changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: new Date("2026-03-15"), changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/about-data`, lastModified: new Date("2026-03-15"), changeFrequency: "monthly", priority: 0.3 },
  ];

  // 距離別ページ（固定・marathon用）
  const distancePages = Object.keys(DISTANCE_SLUGS).map((slug) => ({
    url: `${baseUrl}/marathon/distance/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  let eventPages = [];
  let prefecturePages = [];
  let monthPages = [];
  let trailPrefecturePages = [];
  let trailMonthPages = [];

  try {
    const db = getDb();

    // 大会詳細ページ（sport_typeに応じたslugを使用）
    const sportTypeToSlug = Object.fromEntries(
      SPORT_CONFIGS.map((s) => [s.sportTypeForDb, s.slug])
    );
    const events = db
      .prepare("SELECT id, sport_type, updated_at FROM events WHERE is_active = 1 ORDER BY id")
      .all();
    eventPages = events.map((event) => ({
      url: `${baseUrl}/${sportTypeToSlug[event.sport_type] || "marathon"}/${event.id}`,
      lastModified: event.updated_at ? new Date(event.updated_at) : new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    // marathon: 実データのある都道府県ページ
    const prefectures = db.prepare(`
      SELECT DISTINCT prefecture FROM events
      WHERE is_active = 1 AND sport_type = 'marathon' AND prefecture IS NOT NULL AND prefecture != ''
    `).all();
    prefecturePages = prefectures
      .map((r) => {
        const slug = PREFECTURE_NAME_TO_SLUG[r.prefecture];
        if (!slug) return null;
        return {
          url: `${baseUrl}/marathon/prefecture/${slug}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.6,
        };
      })
      .filter(Boolean);

    // marathon: 実データのある月ページ
    const months = db.prepare(`
      SELECT DISTINCT event_month FROM events
      WHERE is_active = 1 AND sport_type = 'marathon' AND event_month IS NOT NULL AND event_month != ''
    `).all();
    monthPages = months.map((r) => ({
      url: `${baseUrl}/marathon/month/${r.event_month}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    // Phase53: trail — 実データのある都道府県ページ
    const trailPrefectures = db.prepare(`
      SELECT DISTINCT prefecture FROM events
      WHERE is_active = 1 AND sport_type = 'trail' AND prefecture IS NOT NULL AND prefecture != ''
    `).all();
    trailPrefecturePages = trailPrefectures
      .map((r) => {
        const slug = PREFECTURE_NAME_TO_SLUG[r.prefecture];
        if (!slug) return null;
        return {
          url: `${baseUrl}/trail/prefecture/${slug}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.6,
        };
      })
      .filter(Boolean);

    // Phase53: trail — 実データのある月ページ
    const trailMonths = db.prepare(`
      SELECT DISTINCT event_month FROM events
      WHERE is_active = 1 AND sport_type = 'trail' AND event_month IS NOT NULL AND event_month != ''
    `).all();
    trailMonthPages = trailMonths.map((r) => ({
      url: `${baseUrl}/trail/month/${r.event_month}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    }));
  } catch {
    // DB unavailable during build — return static pages only
  }

  return [
    ...staticPages,
    ...distancePages,
    ...prefecturePages,
    ...monthPages,
    ...trailPrefecturePages,
    ...trailMonthPages,
    ...eventPages,
  ];
}
