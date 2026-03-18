/**
 * Sports Entry 検索結果HTMLから大会データを抽出
 */

const { inferSportType } = require("../sport-type-inference");

// 都道府県リスト
const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県",
  "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

const REGION_MAP = {
  "北海道": "hokkaido",
  "青森県": "tohoku", "岩手県": "tohoku", "宮城県": "tohoku", "秋田県": "tohoku", "山形県": "tohoku", "福島県": "tohoku",
  "茨城県": "kanto", "栃木県": "kanto", "群馬県": "kanto", "埼玉県": "kanto", "千葉県": "kanto", "東京都": "kanto", "神奈川県": "kanto",
  "新潟県": "hokuriku", "富山県": "hokuriku", "石川県": "hokuriku", "福井県": "hokuriku",
  "山梨県": "koshinetsu", "長野県": "koshinetsu",
  "岐阜県": "tokai", "静岡県": "tokai", "愛知県": "tokai", "三重県": "tokai",
  "滋賀県": "kinki", "京都府": "kinki", "大阪府": "kinki", "兵庫県": "kinki", "奈良県": "kinki", "和歌山県": "kinki",
  "鳥取県": "chugoku", "島根県": "chugoku", "岡山県": "chugoku", "広島県": "chugoku", "山口県": "chugoku",
  "徳島県": "shikoku", "香川県": "shikoku", "愛媛県": "shikoku", "高知県": "shikoku",
  "福岡県": "kyushu", "佐賀県": "kyushu", "長崎県": "kyushu", "熊本県": "kyushu", "大分県": "kyushu", "宮崎県": "kyushu", "鹿児島県": "kyushu", "沖縄県": "kyushu",
};

/**
 * 日本語日付 → YYYY-MM-DD
 */
function parseJapaneseDate(text) {
  if (!text) return null;
  const m = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

/**
 * 都道府県を抽出
 */
function extractPrefecture(text) {
  if (!text) return null;
  for (const p of PREFECTURES) {
    if (text.includes(p)) return p;
  }
  return null;
}

/**
 * HTMLエンティティをデコード
 */
function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * HTMLタグを除去
 */
function stripTags(html) {
  return html.replace(/<[^>]+>/g, "").trim();
}

/**
 * エントリー期間パース
 */
function parseEntryPeriod(text) {
  if (!text) return { start: null, end: null };
  // [エントリー]2026年1月9日（金）〜2026年4月21日（火）
  const m = text.match(/(\d{4}年\d{1,2}月\d{1,2}日)[^〜～]*[〜～](\d{4}年\d{1,2}月\d{1,2}日)/);
  if (!m) return { start: null, end: null };
  return {
    start: parseJapaneseDate(m[1]),
    end: parseJapaneseDate(m[2]),
  };
}

/**
 * detailSingleブロックをパースして1件のイベントオブジェクトを返す
 */
function parseEventBlock(block) {
  // イベントID + タイトル
  const linkMatch = block.match(/<a href="\/event\/t\/(\d+)"[^>]*>([^<]+)<\/a>/);
  if (!linkMatch) return null;

  const eventId = linkMatch[1];
  const title = decodeEntities(linkMatch[2]).trim();

  // 都道府県（detailSingle__Title--Place）
  const placeMatch = block.match(/detailSingle__Title--Place[^"]*"[^>]*>([^<]+)/);
  const prefectureRaw = placeMatch ? stripTags(placeMatch[1]).trim() : null;
  const prefecture = prefectureRaw ? extractPrefecture(prefectureRaw) : null;

  // 画像URL
  const imgMatch = block.match(/<img[^>]*(?:src|data-src)="(https:\/\/www\.sportsentry\.ne\.jp\/s3_files\/[^"]+)"/);
  const imageUrl = imgMatch ? imgMatch[1] : null;

  // textArea内の情報
  const textAreaMatch = block.match(/class="textArea">([\s\S]*?)<\/div>/);
  const textArea = textAreaMatch ? textAreaMatch[1] : "";

  // 開催日
  const dateTexts = textArea.match(/<p>(\d{4}年\d{1,2}月\d{1,2}日[^<]*)<\/p>/g) || [];
  const eventDateText = dateTexts[0] ? stripTags(dateTexts[0]) : null;
  const eventDate = parseJapaneseDate(eventDateText);
  const eventMonth = eventDate ? eventDate.split("-")[1].replace(/^0/, "") : null;

  // 会場
  const venueTexts = textArea.match(/<p>([^<]*(?:市|区|町|村|郡|県|府|都|道)[^<]*)<\/p>/g) || [];
  let city = null;
  let venueName = null;
  if (venueTexts.length > 0) {
    const venueRaw = stripTags(venueTexts[0]).replace(/<br\s*\/?>/g, " ").trim();
    // 都道府県を除いた部分を市区町村として使う
    if (prefecture && venueRaw.startsWith(prefecture)) {
      city = venueRaw.substring(prefecture.length).trim();
    } else {
      city = venueRaw;
    }
  }
  // 2番目のpが会場名の場合
  const placeLines = textArea.split(/<br\s*\/?>/g).map((s) => stripTags(s).replace(/[\r\n\s]+/g, " ").trim()).filter(Boolean);
  if (placeLines.length > 1) {
    // [エントリー]行を除外
    const venueLines = placeLines.filter((l) => !l.startsWith("[エントリー]") && !l.match(/^\d{4}年/));
    if (venueLines.length > 0) {
      venueName = venueLines.join(" ").substring(0, 100);
    }
  }

  // エントリー期間
  const entryMatch = textArea.match(/\[エントリー\]([^<]+)/);
  const entryPeriod = parseEntryPeriod(entryMatch ? entryMatch[1] : null);

  // エントリー状態判定
  let entryStatus = "unknown";
  if (block.includes("受付終了") || block.includes("締め切り")) {
    entryStatus = "closed";
  } else if (entryPeriod.end) {
    const endDate = new Date(entryPeriod.end);
    const now = new Date();
    if (endDate < now) entryStatus = "closed";
    else if (entryPeriod.start && new Date(entryPeriod.start) > now) entryStatus = "upcoming";
    else entryStatus = "open";
  }

  // タグ
  const tags = [];
  const tagMatches = block.match(/＃([^<,]+)/g) || [];
  tagMatches.forEach((t) => tags.push(t.replace("＃", "").trim()));

  // スポーツタイプ推定
  let sportType = "marathon";
  try {
    const result = inferSportType(title, tags.join(","));
    if (result && typeof result === "object") {
      sportType = result.sportType || "marathon";
    } else if (typeof result === "string") {
      sportType = result;
    }
  } catch {
    // fallback
  }

  // 説明文
  const descMatch = block.match(/class="mainText"[^>]*>([^<]*)/);
  const description = descMatch ? decodeEntities(descMatch[1]).trim() : "";

  return {
    source_site: "sportsentry",
    source_event_id: `SE${eventId}`,
    title,
    normalized_title: title.replace(/[　\s]+/g, " ").trim(),
    sport_type: sportType,
    sport_slug: sportType,
    area_region: prefecture ? REGION_MAP[prefecture] || null : null,
    prefecture,
    city,
    venue_name: venueName,
    event_date: eventDate,
    event_month: eventMonth,
    entry_start_date: entryPeriod.start,
    entry_end_date: entryPeriod.end,
    entry_status: entryStatus,
    source_url: `https://www.sportsentry.ne.jp/event/t/${eventId}`,
    official_url: null,
    hero_image_url: imageUrl,
    description,
    is_active: 1,
    tags,
  };
}

/**
 * 1ページ分のHTMLからイベント配列を抽出
 */
function parsePage(html) {
  if (!html || html.length < 1000) return [];

  // detailSingleブロックで分割
  const parts = html.split(/class="detailSingle">/);
  const events = [];

  for (let i = 1; i < parts.length; i++) {
    try {
      const ev = parseEventBlock(parts[i]);
      if (ev && ev.title) {
        events.push(ev);
      }
    } catch (err) {
      // skip broken block
    }
  }

  return events;
}

/**
 * 重複除去
 */
function deduplicateEvents(events) {
  const seen = new Set();
  return events.filter((ev) => {
    if (seen.has(ev.source_event_id)) return false;
    seen.add(ev.source_event_id);
    return true;
  });
}

module.exports = { parsePage, deduplicateEvents, parseJapaneseDate, extractPrefecture };
