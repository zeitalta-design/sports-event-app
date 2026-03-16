/**
 * moshicom.com サーバーサイド取得・パース
 *
 * HTML取得 → cheerio解析 → イベント情報/レース情報/全文テキスト抽出
 * 既存 scraper/moshicom のロジックをESM化して web/lib に移植。
 */

import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// 都道府県リスト
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
 * moshicom URLからイベントIDを抽出
 * "https://moshicom.com/123456" → "123456"
 */
export function extractMoshicomId(url) {
  const m = url.match(/moshicom\.com\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * moshicom URLかどうか判定
 */
export function isMoshicomUrl(url) {
  return /^https?:\/\/(www\.)?moshicom\.com\/\d+/.test(url);
}

// ─── HTML取得 ────────────────────────────

/**
 * moshicom.com のHTMLを取得
 * @param {string} url - moshicom URL
 * @returns {Promise<string>} HTML文字列
 */
export async function fetchMoshicomHtml(url) {
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

// ─── race_type / distance 正規化（scraper/runnet/parse-detail.js 移植）──

function normalizeRaceType(raceName) {
  const name = raceName.toLowerCase();
  if (/リレー|駅伝|relay/.test(name)) return "relay";
  if (
    /フル|full|42\.195|マラソン(?!.*ハーフ)/.test(name) &&
    !/ハーフ|half|ウルトラ|ultra/.test(name)
  ) {
    if (/ウルトラ|ultra|100km|100k|50km|50k|70km|60km/.test(name))
      return "ultra";
    return "full_marathon";
  }
  if (/ハーフ|half|21\.0975/.test(name)) return "half_marathon";
  if (/10\s*k|１０.*キロ|10.*キロ|10km/.test(name)) return "10km";
  if (/5\s*k|５.*キロ|5.*キロ|5km/.test(name)) return "5km";
  if (/3\s*k|３.*キロ|3.*キロ|3km/.test(name)) return "3km";
  if (/2\s*k|２.*キロ|2.*キロ|2km/.test(name)) return "2km";
  if (/1\s*k|１.*キロ|1.*キロ|1km/.test(name)) return "1km";
  if (/ファンラン|fun|親子|キッズ|kids/.test(name)) return "fun_run";
  if (/ウォーク|walk/.test(name)) return "walk";
  return "other";
}

function parseDistance(raceName) {
  if (/フルマラソン|フル（|フル\s|^フル$/.test(raceName)) return 42.195;
  if (/ハーフマラソン|ハーフ（|ハーフ\s|^ハーフ$/.test(raceName))
    return 21.0975;

  const kmMatch = raceName.match(
    /(\d+(?:\.\d+)?)\s*(?:km|キロ|k(?:ilo)?)/i
  );
  if (kmMatch) return parseFloat(kmMatch[1]);

  const numMatch = raceName.match(/(\d+(?:\.\d+)?)\s*(?:ｋｍ|ＫＭ)/);
  if (numMatch) return parseFloat(numMatch[1]);

  const mMatch = raceName.match(/(\d+)\s*(?:m|ｍ|メートル)/i);
  if (mMatch) return parseInt(mMatch[1]) / 1000;

  return null;
}

// ─── 金額/人数パーサー（scraper/moshicom/parse-detail.js 移植）──

function parseFee(feeStr) {
  if (!feeStr) return null;
  const m = feeStr.replace(/\s/g, "").match(/([\d,]+)円/);
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ""), 10);
}

function parseCapacity(capStr) {
  if (!capStr) return null;
  const m = capStr.replace(/\s/g, "").match(/([\d,]+)人/);
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ""), 10);
}

// ─── レース抽出（scraper/moshicom/parse-detail.js 移植）──

/**
 * テーブル形式のrace情報をパース
 */
function parseRaceTable($, table) {
  const races = [];
  const rows = [];

  $(table)
    .find("tr")
    .each((i, tr) => {
      const cells = [];
      $(tr)
        .find("td, th")
        .each((j, td) => {
          cells.push($(td).text().trim());
        });
      if (cells.length >= 2) rows.push(cells);
    });

  if (rows.length < 2) return races;

  const headerRow = rows[0];
  const colMap = {};
  headerRow.forEach((h, i) => {
    const key = h.replace(/\s/g, "");
    if (key.includes("種目")) colMap.name = i;
    if (key.includes("参加費") || key.includes("料金")) colMap.fee = i;
    if (key.includes("制限時間")) colMap.timeLimit = i;
    if (key.includes("募集人数") || key.includes("定員")) colMap.capacity = i;
    if (key.includes("参加資格")) colMap.eligibility = i;
  });

  if (colMap.name === undefined) return races;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const raceName = row[colMap.name] || "";
    if (!raceName) continue;

    const fee =
      colMap.fee !== undefined ? parseFee(row[colMap.fee]) : null;
    const capacity =
      colMap.capacity !== undefined
        ? parseCapacity(row[colMap.capacity])
        : null;
    const timeLimit =
      colMap.timeLimit !== undefined ? row[colMap.timeLimit] || null : null;
    const eligibility =
      colMap.eligibility !== undefined
        ? row[colMap.eligibility] || null
        : null;

    races.push({
      race_name: raceName,
      race_type: normalizeRaceType(raceName),
      distance_km: parseDistance(raceName),
      fee_min: fee,
      fee_max: fee,
      capacity,
      time_limit: timeLimit,
      start_time: null,
      eligibility,
      sort_order: i - 1,
    });
  }

  return races;
}

/**
 * Ticket(DL)形式のrace情報をパース
 */
function parseTicketRaces($) {
  const rawItems = [];

  $("dl").each((i, dl) => {
    const dt = $(dl).find("dt").first().text().trim();
    const dds = [];
    $(dl)
      .find("dd")
      .each((j, dd) => dds.push($(dd).text().trim()));

    if (!dt || dds.length < 1) return;
    const hasEntry = dds.some((d) => d.includes("申し込む"));
    if (!hasEntry) return;

    const feeText = dds.find((d) => /[\d,]+円/.test(d));
    const fee = parseFee(feeText);
    rawItems.push({ name: dt, fee });
  });

  if (rawItems.length === 0) return [];

  // 同一種目のバリエーション集約
  const grouped = new Map();
  for (const item of rawItems) {
    const baseName = item.name
      .replace(/[-ー]参加賞(?:あり|不要|なし|付き)$/g, "")
      .replace(/[-ー](?:Tシャツ|記念品)(?:あり|なし|付き)$/g, "")
      .trim();

    if (grouped.has(baseName)) {
      const existing = grouped.get(baseName);
      if (item.fee !== null) existing.fees.push(item.fee);
    } else {
      grouped.set(baseName, {
        name: baseName,
        fees: item.fee !== null ? [item.fee] : [],
      });
    }
  }

  const races = [];
  let sortOrder = 0;
  for (const [, group] of grouped) {
    const feeMin = group.fees.length > 0 ? Math.min(...group.fees) : null;
    const feeMax = group.fees.length > 0 ? Math.max(...group.fees) : null;

    races.push({
      race_name: group.name,
      race_type: normalizeRaceType(group.name),
      distance_km: parseDistance(group.name),
      fee_min: feeMin,
      fee_max: feeMax,
      capacity: null,
      time_limit: null,
      start_time: null,
      eligibility: null,
      sort_order: sortOrder++,
    });
  }

  return races;
}

/**
 * スケジュールテーブルからstart_timeを抽出してraceに付与
 */
function enrichStartTimes($, races) {
  $("table").each((i, table) => {
    const rows = [];
    $(table)
      .find("tr")
      .each((j, tr) => {
        const cells = [];
        $(tr)
          .find("td, th")
          .each((k, td) => cells.push($(td).text().trim()));
        if (cells.length >= 2) rows.push(cells);
      });

    const isSchedule = rows.some(
      (r) =>
        (r[0].includes("項目") && r[1].includes("時間")) ||
        r[0].includes("スタート")
    );
    if (!isSchedule) return;

    for (const row of rows) {
      if (!row[0].includes("スタート")) continue;
      const timeText = row[1] || "";
      for (const race of races) {
        const nameKey = race.race_name.replace(/[（()）]/g, "");
        if (
          timeText.includes(nameKey) ||
          timeText.includes(race.race_name)
        ) {
          const timeMatch = timeText.match(
            new RegExp(
              `(\\d{1,2}:\\d{2})\\s*[〜～]?\\s*[（(]?${nameKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
            )
          );
          if (timeMatch) {
            race.start_time = timeMatch[1];
          }
        }
      }
      if (races.every((r) => !r.start_time)) {
        const singleTime = timeText.match(/^(\d{1,2}:\d{2})/);
        if (singleTime && !timeText.includes("、")) {
          races.forEach((r) => (r.start_time = singleTime[1]));
        }
      }
    }
  });
}

// ─── イベント基本情報の抽出 ──────────────────

/**
 * 日付正規化 "2026/5/16" or "2026年5月16日" → "2026-05-16"
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/(\d{4})[/年](\d{1,2})[/月](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
}

/**
 * 都道府県を本文テキストから検出
 */
function extractPrefecture(text) {
  for (const pref of PREFECTURES) {
    if (text.includes(pref)) return pref;
  }
  return null;
}

/**
 * HTMLからイベント基本情報を抽出（events テーブル用）
 * @param {CheerioAPI} $ - cheerio インスタンス
 * @param {string} url - 元URL
 * @returns {object} イベント基本情報
 */
export function extractEventInfo($, url) {
  const info = {};

  // OGタグ
  const ogTitle = $('meta[property="og:title"]').attr("content") || "";
  const ogDesc = $('meta[property="og:description"]').attr("content") || "";
  const ogImage = $('meta[property="og:image"]').attr("content") || null;

  // タイトル
  if (ogTitle) {
    info.title = ogTitle.replace(/\s+on\s+Moshicom$/i, "").trim();
    info.normalized_title = info.title;
  } else {
    const h1 = $("h1").first().text().trim();
    info.title = h1 || $("title").text().trim();
    info.normalized_title = info.title;
  }

  // 説明文
  if (ogDesc) {
    const cleanDesc = ogDesc.replace(/\s+on\s+Moshicom$/i, "").trim();
    if (cleanDesc.length > 20) {
      info.description = cleanDesc;
    }
  }

  // 画像
  if (ogImage) info.hero_image_url = ogImage;

  // エントリーステータス
  const h1Text = $("h1").first().text().trim();
  if (h1Text.includes("受付中")) {
    info.entry_status = "open";
  } else if (h1Text.includes("締切") || h1Text.includes("受付終了")) {
    info.entry_status = "closed";
  } else if (h1Text.includes("受付予定")) {
    info.entry_status = "upcoming";
  } else {
    info.entry_status = "unknown";
  }

  // ソースURL
  info.source_url = url;

  // moshicom ID
  const moshicomId = extractMoshicomId(url);
  if (moshicomId) {
    info.source_event_id = moshicomId;
  }

  // 本文テキスト
  const bodyText = $("body").text();

  // 申込み期間
  const entryPeriodMatch = bodyText.match(
    /申込み期間[：:]\s*(\d{4}[/年]\d{1,2}[/月]\d{1,2}日?)\s*[〜～～-]\s*(\d{4}[/年]\d{1,2}[/月]\d{1,2}日?)/
  );
  if (entryPeriodMatch) {
    info.entry_start_date = normalizeDate(entryPeriodMatch[1]);
    info.entry_end_date = normalizeDate(entryPeriodMatch[2]);
  }

  // 開催日（テキストから抽出）
  const datePatterns = [
    /開催日[：:]\s*(\d{4}[/年]\d{1,2}[/月]\d{1,2})/,
    /(\d{4})[年/](\d{1,2})[月/](\d{1,2})日?\s*[（(][日月火水木金土]/,
  ];
  for (const pattern of datePatterns) {
    const m = bodyText.match(pattern);
    if (m) {
      if (m[2]) {
        // 3グループ版
        info.event_date = `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
      } else {
        info.event_date = normalizeDate(m[1]);
      }
      break;
    }
  }

  // event_month
  if (info.event_date) {
    const md = info.event_date.match(/^\d{4}-(\d{2})/);
    if (md) info.event_month = md[1];
  }

  // 都道府県
  info.prefecture = extractPrefecture(bodyText);

  // 会場・住所の構造的抽出
  $("dt, th, .label, strong, b").each((i, el) => {
    const labelText = $(el).text().trim();
    if (/^会場$|^開催場所$|^開催会場$/.test(labelText)) {
      const next = $(el).next("dd, td, span, div").first();
      if (next.length) {
        const val = next.text().trim();
        if (val && val.length < 200) {
          if (!info.venue_name) info.venue_name = val;
        }
      }
    }
    if (/^住所$|^会場住所$|^所在地$/.test(labelText)) {
      const next = $(el).next("dd, td, span, div").first();
      if (next.length) {
        const val = next.text().trim();
        if (val && val.length < 300) {
          info.venue_address = val;
        }
      }
    }
  });

  // 主催者の抽出
  $("dt, th, .label, strong, b").each((i, el) => {
    const labelText = $(el).text().trim();
    if (/^主催$|^主催者$/.test(labelText)) {
      const next = $(el).next("dd, td, span, div").first();
      if (next.length) {
        const val = next.text().trim();
        if (val && val.length < 200) {
          info.organizer_name = val;
        }
      }
    }
  });

  // 公式サイトURLの抽出
  $("a").each((i, el) => {
    const text = $(el).text().trim();
    if (/公式サイト|公式ページ|大会公式/.test(text)) {
      const href = $(el).attr("href");
      if (href && href.startsWith("http") && !href.includes("moshicom.com")) {
        if (!info.official_url) info.official_url = href;
      }
    }
  });

  // 問い合わせ先（電話・メール）
  const contactPatterns = bodyText.match(
    /(?:問い合わせ|連絡先|お問合せ|TEL|電話)[：:\s]*([^\n]{5,80})/i
  );
  if (contactPatterns) {
    const contactText = contactPatterns[1];
    const phoneMatch = contactText.match(/(\d{2,4}[-ー]\d{2,4}[-ー]\d{3,4})/);
    if (phoneMatch) info.organizer_phone = phoneMatch[1];

    const emailMatch = contactText.match(
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
    );
    if (emailMatch) info.organizer_email = emailMatch[1];
  }

  // メール単独検出（問い合わせ先セクション外）
  if (!info.organizer_email) {
    const emailInBody = bodyText.match(
      /(?:メール|E-?mail|Mail)[：:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
    );
    if (emailInBody) info.organizer_email = emailInBody[1];
  }

  return info;
}

// ─── レース情報の抽出 ──────────────────────

/**
 * HTMLからレース情報を抽出（event_races テーブル用）
 * @param {CheerioAPI} $ - cheerio インスタンス
 * @returns {object[]} レース配列
 */
export function extractRaces($) {
  let races = [];

  // パターン1: テーブル形式
  $("table").each((i, table) => {
    if (races.length > 0) return;
    const tableRaces = parseRaceTable($, table);
    if (tableRaces.length > 0) {
      races = tableRaces;
    }
  });

  // パターン2: Ticket(DL)形式
  if (races.length === 0) {
    races = parseTicketRaces($);
  }

  // スケジュールテーブルからstart_time補完
  if (races.length > 0) {
    enrichStartTimes($, races);
  }

  return races;
}

// ─── ページ全文テキスト抽出 ──────────────────

/**
 * HTMLからLLM構造化用のページ全文テキストを抽出
 * script/style/nav等を除去し、本文テキストのみ返す
 * @param {CheerioAPI} $ - cheerio インスタンス
 * @returns {string} 全文テキスト
 */
export function extractPageText($) {
  // 不要な要素を除去
  $("script, style, nav, footer, header, iframe, noscript").remove();

  // 本文テキスト取得
  const text = $("body").text();

  // 連続空白・改行を整理
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── メイン統合関数 ──────────────────────

/**
 * moshicom URL から全情報を取得
 * @param {string} url - moshicom URL
 * @returns {Promise<{ eventInfo, races, pageText, html }>}
 */
export async function fetchAndParseMoshicom(url) {
  // HTML取得
  const html = await fetchMoshicomHtml(url);

  // cheerioでパース
  const $ = cheerio.load(html);

  // 各種情報を抽出
  const eventInfo = extractEventInfo($, url);
  const races = extractRaces($);

  // テキスト抽出用に再度ロード（上のextractRacesでDOMが変わる可能性あるため）
  const $2 = cheerio.load(html);
  const pageText = extractPageText($2);

  return { eventInfo, races, pageText, html };
}
