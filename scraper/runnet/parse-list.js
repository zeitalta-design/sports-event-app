/**
 * RUNNET 一覧ページ HTML パーサー
 * cheerio で li.item から大会情報を抽出
 */

const path = require("path");
const { createRequire } = require("module");
const webRequire = createRequire(
  path.join(__dirname, "..", "..", "web", "package.json")
);
const cheerio = webRequire("cheerio");
const { inferSportType } = require("../sport-type-inference");

/**
 * 日付文字列 "2026年6月7日(日)" → "2026-06-07"
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
}

/**
 * 都道府県を抽出 "山梨県（富士吉田市…）" → { prefecture: "山梨県", city: "富士吉田市" }
 */
function parsePlace(placeStr) {
  if (!placeStr) return { prefecture: null, city: null };
  // "山梨県（富士吉田市）" or "東京都（新宿区）" or "北海道（札幌市）"
  const m = placeStr.match(/^(.+?[都道府県])(?:[（(](.+?)[）)])?/);
  if (m) {
    return { prefecture: m[1], city: m[2] || null };
  }
  return { prefecture: placeStr.trim(), city: null };
}

/**
 * 地域キーを都道府県から推定
 */
const PREF_TO_REGION = {
  北海道: "hokkaido",
  青森県: "tohoku", 岩手県: "tohoku", 宮城県: "tohoku", 秋田県: "tohoku", 山形県: "tohoku", 福島県: "tohoku",
  茨城県: "kanto", 栃木県: "kanto", 群馬県: "kanto", 埼玉県: "kanto", 千葉県: "kanto", 東京都: "kanto", 神奈川県: "kanto",
  新潟県: "chubu", 富山県: "chubu", 石川県: "chubu", 福井県: "chubu", 山梨県: "chubu", 長野県: "chubu", 岐阜県: "chubu", 静岡県: "chubu", 愛知県: "chubu",
  三重県: "kinki", 滋賀県: "kinki", 京都府: "kinki", 大阪府: "kinki", 兵庫県: "kinki", 奈良県: "kinki", 和歌山県: "kinki",
  鳥取県: "chugoku", 島根県: "chugoku", 岡山県: "chugoku", 広島県: "chugoku", 山口県: "chugoku",
  徳島県: "shikoku", 香川県: "shikoku", 愛媛県: "shikoku", 高知県: "shikoku",
  福岡県: "kyushu", 佐賀県: "kyushu", 長崎県: "kyushu", 熊本県: "kyushu", 大分県: "kyushu", 宮崎県: "kyushu", 鹿児島県: "kyushu", 沖縄県: "kyushu",
};

function getRegion(prefecture) {
  return PREF_TO_REGION[prefecture] || null;
}

/**
 * エントリーステータスを判定
 */
function parseEntryStatus(item, $) {
  const btnText = item.find("p.entryBtns").text().trim();
  const btnHtml = item.find("p.entryBtns").html() || "";

  if (btnText.includes("エントリー") || btnHtml.includes("btnEntry")) return "open";
  if (btnText.includes("受付予定") || btnText.includes("まもなく")) return "upcoming";
  if (btnText.includes("締切") || btnText.includes("定員")) return "closed";
  if (btnText.includes("中止")) return "cancelled";
  return "unknown";
}

/**
 * 1ページ分のHTMLをパースしてイベント配列を返す
 * @param {string} html - HTML文字列
 * @returns {object[]} イベントオブジェクト配列
 */
function parsePage(html) {
  const $ = cheerio.load(html);
  const events = [];

  $("#listGroup > li.item").each((i, el) => {
    const item = $(el);

    // タイトルとURL
    const titleLink = item.find(".item-title a");
    const title = titleLink.text().trim();
    if (!title) return; // 広告などスキップ

    const href = titleLink.attr("href") || "";
    const raceIdMatch = href.match(/raceId=(\d+)/);
    const raceId = raceIdMatch ? raceIdMatch[1] : null;
    if (!raceId) return; // raceIdがないものはスキップ

    // 場所
    const placeText = item.find("p.place").text().trim();
    const { prefecture, city } = parsePlace(placeText);

    // 日付
    const dateText = item.find("p.date").text().trim();
    const eventDate = parseDate(dateText);
    const eventMonth = eventDate ? String(parseInt(eventDate.split("-")[1])) : null;

    // 説明
    const description = item.find("p.tourDetail").text().trim() || null;

    // 画像
    const imgSrc = item.find(".photo img").attr("src") || null;

    // エントリーステータス
    const entryStatus = parseEntryStatus(item, $);

    // ソースURL
    const sourceUrl = href.startsWith("http")
      ? href
      : href
        ? `https://runnet.jp${href.startsWith("/") ? "" : "/"}${href}`
        : null;

    // Phase51: sport_type を自動推定
    const { sportType, sportSlug } = inferSportType(title, description);

    events.push({
      source_site: "runnet",
      source_event_id: raceId,
      title,
      normalized_title: title,
      sport_type: sportType,
      sport_slug: sportSlug,
      area_region: getRegion(prefecture),
      prefecture,
      city,
      venue_name: placeText || null,
      event_date: eventDate,
      event_month: eventMonth,
      entry_status: entryStatus,
      source_url: sourceUrl,
      official_url: null,
      description,
      image_url: imgSrc,
      is_active: 1,
    });
  });

  return events;
}

/**
 * 複数ページのHTMLをパース
 * @param {string[]} htmlPages
 * @returns {object[]}
 */
function parsePages(htmlPages) {
  const allEvents = [];
  for (const html of htmlPages) {
    const events = parsePage(html);
    allEvents.push(...events);
  }
  // raceId で重複排除
  const seen = new Set();
  return allEvents.filter((ev) => {
    if (seen.has(ev.source_event_id)) return false;
    seen.add(ev.source_event_id);
    return true;
  });
}

module.exports = { parsePage, parsePages, parseDate, parsePlace };
