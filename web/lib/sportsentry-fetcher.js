/**
 * スポーツエントリー サーバーサイド取得・パース
 *
 * HTML取得 → cheerio解析 → イベント情報/レース情報/全文テキスト抽出
 * moshicom-fetcher.js / runnet-fetcher.js と同じシグネチャで統一。
 */

import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

// ─── URL解析 ────────────────────────────

/**
 * sportsentry URLかどうか判定
 * https://www.sportsentry.ne.jp/event/t/12345
 */
export function isSportsentryUrl(url) {
  return /^https?:\/\/(www\.)?sportsentry\.ne\.jp\//.test(url);
}

/**
 * sportsentry URLからイベントIDを抽出
 * "https://www.sportsentry.ne.jp/event/t/100390" → "SE100390"
 * 既存スクレイパー（scraper/sportsentry/parse-list.js）と同じ SE プレフィックス形式
 */
export function extractSportsentryId(url) {
  const m = url.match(/sportsentry\.ne\.jp\/event\/t\/(\d+)/);
  return m ? `SE${m[1]}` : null;
}

// ─── HTML取得 ────────────────────────────

/**
 * sportsentry のHTMLを取得
 * @param {string} url - sportsentry URL
 * @returns {Promise<string>} HTML文字列
 */
export async function fetchSportsentryHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ja,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

// ─── イベント情報抽出 ────────────────────────

/**
 * sportsentry HTMLからイベント情報を抽出
 */
export function extractEventInfo($, url) {
  const info = {
    source_site: "sportsentry",
    source_event_id: extractSportsentryId(url),
    source_url: url,
    title: null,
    event_date: null,
    event_month: null,
    prefecture: null,
    city: null,
    venue_name: null,
    entry_status: "unknown",
    hero_image_url: null,
    official_url: null,
    description: null,
    entry_start_date: null,
    entry_end_date: null,
  };

  // title: <title> or og:title
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const pageTitle = $("title").text();
  let title = ogTitle || pageTitle || "";
  // タイトルから場所部分を除去（括弧内）
  title = title.replace(/\(.*?\)\s*$/, "").trim();
  // サフィックス除去
  title = title.replace(/\s*-\s*スポーツ大会.*$/, "").trim();
  info.title = title;

  // hero image
  info.hero_image_url =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[property="og:image:secure_url"]').attr("content") || null;

  // description
  info.description =
    $('meta[name="description"]').attr("content") || null;

  // 会場・都道府県をtitleの括弧内から抽出
  const titleFull = ogTitle || pageTitle || "";
  const venueMatch = titleFull.match(/\((.+?)\)\s*$/);
  if (venueMatch) {
    const venueStr = venueMatch[1];
    info.venue_name = venueStr;
    // 都道府県を抽出
    for (const pref of PREFECTURES) {
      if (venueStr.includes(pref)) {
        info.prefecture = pref;
        // 市区町村を都道府県の後から抽出
        const afterPref = venueStr.split(pref)[1] || "";
        const cityMatch = afterPref.match(/^[\s　]*([^\s　]{2,}?[市区町村郡])/);
        if (cityMatch) {
          info.city = cityMatch[1];
        }
        break;
      }
    }
  }

  // 開催日をページ本文から抽出
  const bodyText = $.text();
  // 「開催日」「日程」「開催日時」に続く日付パターン
  const datePatterns = [
    /(\d{4})\s*[\/年]\s*(\d{1,2})\s*[\/月]\s*(\d{1,2})\s*日?/,
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/,
  ];
  for (const pat of datePatterns) {
    const dm = bodyText.match(pat);
    if (dm) {
      const y = dm[1];
      const m = dm[2].padStart(2, "0");
      const d = dm[3].padStart(2, "0");
      info.event_date = `${y}-${m}-${d}`;
      info.event_month = `${y}-${m}`;
      break;
    }
  }

  // エントリー状況
  const statusText = bodyText;
  if (/受付終了|締め切り|定員に達し/.test(statusText)) {
    info.entry_status = "closed";
  } else if (/受付中|エントリー受付|申込受付/.test(statusText)) {
    info.entry_status = "open";
  }

  return info;
}

// ─── 統合関数 ────────────────────────────

/**
 * sportsentry URLから一括取得・パースする統合関数
 * moshicom-fetcher / runnet-fetcher と同じ返却形式
 *
 * @param {string} url
 * @returns {Promise<{eventInfo, races, pageText}>}
 */
export async function fetchAndParseSportsentry(url) {
  const html = await fetchSportsentryHtml(url);
  const $ = cheerio.load(html);

  const eventInfo = extractEventInfo($, url);

  // レース情報はLLMに任せるため空配列
  const races = [];

  // ページ全文テキスト（LLM構造化用）
  // メインコンテンツのテキストを取得
  let pageText = "";
  const mainContent = $("#mainContents, .event-detail, .eventDetail, article, main");
  if (mainContent.length > 0) {
    pageText = mainContent.text();
  } else {
    pageText = $("body").text();
  }
  // 余分な空白を圧縮
  pageText = pageText.replace(/[\s\n\r\t]+/g, " ").trim();
  // 長すぎる場合は切り詰め（LLMトークン制限対策）
  if (pageText.length > 15000) {
    pageText = pageText.substring(0, 15000);
  }

  return { eventInfo, races, pageText };
}
