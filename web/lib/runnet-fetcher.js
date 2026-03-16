/**
 * RUNNET サーバーサイド取得・パース
 *
 * HTML取得 → cheerio解析 → イベント情報/レース情報/全文テキスト抽出
 * 既存 scraper/runnet/parse-detail.js を ESM化して web/lib に移植。
 * moshicom-fetcher.js と同じシグネチャで統一。
 */

import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ─── URL解析 ────────────────────────────

/**
 * RUNNET URLかどうか判定
 * runnet.jp/entry/... or runnet.jp/runtes/... 等
 */
export function isRunnetUrl(url) {
  return /^https?:\/\/(www\.)?runnet\.jp\//.test(url);
}

/**
 * RUNNET URLからイベントIDを抽出
 * "https://runnet.jp/entry/123456" → "123456"
 * "https://runnet.jp/runtes/entryform/123456" → "123456"
 */
export function extractRunnetId(url) {
  const m = url.match(/runnet\.jp\/(?:entry|runtes\/entryform|cgi-bin\/[^/]+)\/(\d+)/);
  return m ? m[1] : null;
}

// ─── HTML取得 ────────────────────────────

/**
 * RUNNET のHTMLを取得
 * @param {string} url - RUNNET URL
 * @returns {Promise<string>} HTML文字列
 */
export async function fetchRunnetHtml(url) {
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

// ─── race_type / distance 正規化 ──────────────

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

// ─── テキストヘルパー ──────────────────────

function cleanText(text) {
  if (!text) return null;
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim() || null;
}

function parseDateStr(str) {
  if (!str) return null;
  const m = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
}

function parseEntryPeriod(text) {
  if (!text) return { start: null, end: null };
  const cleaned = text.replace(/\s+/g, " ").trim();
  const parts = cleaned.split(/[～~]/);
  return {
    start: parseDateStr(parts[0]),
    end: parts[1] ? parseDateStr(parts[1]) : null,
  };
}

// ─── 参加費・定員パーサー ──────────────────

function parseFees(feeText) {
  if (!feeText) return {};
  const fees = {};
  const parts = feeText.split(/[　\s,、]+/);
  let currentLabel = "";

  for (const part of parts) {
    const feeMatch = part.match(/(\d[\d,]*)\s*円/);
    if (feeMatch) {
      const amount = parseInt(feeMatch[1].replace(/,/g, ""));
      const label = currentLabel || part.replace(/\d[\d,]*\s*円.*/, "").trim();
      fees[label] = amount;
    } else {
      currentLabel = part;
    }
  }
  return fees;
}

function parseCapacities(capText) {
  if (!capText) return {};
  const caps = {};
  const regex = /([^\d,、]+?)(\d[\d,]*)\s*(?:人|名|組)/g;
  let match;
  while ((match = regex.exec(capText)) !== null) {
    const label = match[1].trim();
    const num = parseInt(match[2].replace(/,/g, ""));
    if (label) caps[label] = num;
  }
  return caps;
}

function matchRaceToFee(raceName, fees) {
  const name = raceName.toLowerCase();
  for (const [label, amount] of Object.entries(fees)) {
    const l = label.toLowerCase();
    if (name.includes(l) || l.includes(name.substring(0, 3))) {
      return amount;
    }
  }
  return null;
}

function matchRaceToCapacity(raceName, capacities) {
  const name = raceName.toLowerCase();
  for (const [label, amount] of Object.entries(capacities)) {
    const l = label.toLowerCase();
    if (name.includes(l) || l.includes(name.substring(0, 3))) {
      return amount;
    }
  }
  return null;
}

// ─── イベント基本情報の抽出 ──────────────────

/**
 * HTMLからイベント基本情報を抽出（events テーブル用）
 * @param {CheerioAPI} $ - cheerio インスタンス
 * @param {string} url - 元URL
 * @returns {object} イベント基本情報
 */
export function extractEventInfo($, url) {
  const info = {};

  // タイトル: OGタグ → <title> → h1
  const ogTitle = $('meta[property="og:title"]').attr("content") || "";
  const titleTag = $("title").text().trim();
  const h1Text = $("h1").first().text().trim();

  if (ogTitle) {
    info.title = ogTitle.replace(/\s*[-|]\s*RUNNET.*$/i, "").trim();
  } else if (titleTag) {
    info.title = titleTag.replace(/\s*[-|]\s*RUNNET.*$/i, "").trim();
  } else if (h1Text) {
    info.title = h1Text;
  }
  info.normalized_title = info.title || null;

  // 説明文
  const entryBody = $(".entry-body").first().text().trim();
  const metaDesc = $('meta[name="description"]').attr("content") || "";
  info.description = entryBody || cleanText(metaDesc) || null;

  // ヒーロー画像
  const centerImg = $('img[src*="race_"][src*="_center"]').attr("src");
  const leftImg = $('img[src*="race_"][src*="_left"]').attr("src");
  if (centerImg) {
    info.hero_image_url = centerImg.split("?")[0];
  } else if (leftImg) {
    info.hero_image_url = leftImg.split("?")[0];
  }

  // ソースURL
  info.source_url = url;

  // RUNNET ID
  const runnetId = extractRunnetId(url);
  if (runnetId) {
    info.source_event_id = runnetId;
  }

  // #entrydMainL から基本情報抽出
  $("#entrydMainL > li").each((i, el) => {
    const label = $(el).find(".entryT").first().text().trim();
    const value = $(el).find(".entryD").first().text().trim();

    if (label.includes("開催地")) {
      const placeMatch = value.match(/([^\s(（]+[都道府県])[\s(（]*([^)）]*)/);
      if (placeMatch) {
        info.prefecture = placeMatch[1];
        if (placeMatch[2]) info.city = placeMatch[2].trim();
      }
    }

    if (label.includes("エントリー期間")) {
      const period = parseEntryPeriod(value);
      info.entry_start_date = period.start;
      info.entry_end_date = period.end;

      // 日付でentry_status推定
      const now = new Date();
      const nowStr = now.toISOString().split("T")[0];
      if (period.start && period.end) {
        if (nowStr < period.start) {
          info.entry_status = "upcoming";
        } else if (nowStr <= period.end) {
          info.entry_status = "open";
        } else {
          info.entry_status = "closed";
        }
      }
    }

    if (label.includes("大会公式サイト") || label.includes("大会詳細ページ")) {
      const link = $(el).find(".entryD a").attr("href");
      if (link && link.startsWith("http")) {
        info.official_url = link;
      }
    }

    if (label.includes("開催日")) {
      info.event_date = parseDateStr(value);
      if (info.event_date) {
        const md = info.event_date.match(/^\d{4}-(\d{2})/);
        if (md) info.event_month = md[1];
      }
    }
  });

  // eTabTbl から会場情報
  const tabTbl = $(".eTabTbl").first();
  tabTbl.find("li").each((i, el) => {
    const label = $(el).find(".entryT").first().text().trim();
    const value = $(el).find(".entryD").first().text().trim();

    if (label.includes("スタート場所") || label.includes("会場")) {
      info.venue_name = value || null;
    }
  });

  // エントリーボタンからステータス推定
  if (!info.entry_status) {
    const entryBtnArea = $("#entrydMainR01");
    if (entryBtnArea.length) {
      const btnText = entryBtnArea.text().trim();
      if (btnText.includes("エントリー")) {
        info.entry_status = "open";
      }
      if (btnText.includes("締切") || btnText.includes("受付終了")) {
        info.entry_status = "closed";
      }
    }
  }

  if (!info.entry_status) {
    info.entry_status = "unknown";
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
  const races = [];
  let feeText = "";
  let capacityText = "";

  const tabTbl = $(".eTabTbl").first();

  tabTbl.find("> li").each((i, el) => {
    const label = $(el).find("> .entryT").first().text().trim();
    const value = $(el).find("> .entryD").first().text().trim();

    if (label.includes("参加料")) {
      feeText = value;
    }
    if (label.includes("定員")) {
      capacityText = value;
    }

    if (label.includes("種目") && label.includes("参加資格")) {
      $(el).find("> ul > li").each((j, raceLi) => {
        const raceName = $(raceLi).find(".entryT").first().text().trim();
        const raceData = $(raceLi).find(".entryD").first().text().trim();

        if (!raceName) return;

        // 制限時間
        const timeLimitMatch = raceData.match(/制限時間[：:]?\s*(.+?)(?:\s|$)/);
        const timeLimit = timeLimitMatch ? timeLimitMatch[1] : null;

        // 参加資格（制限時間の前の部分）
        const eligibility = raceData.replace(/制限時間.*/, "").trim() || null;

        races.push({
          race_name: raceName,
          race_type: normalizeRaceType(raceName),
          distance_km: parseDistance(raceName),
          eligibility,
          time_limit: timeLimit,
          fee_min: null,
          fee_max: null,
          capacity: null,
          start_time: null,
          category: null,
          note: null,
          sort_order: j,
        });
      });
    }
  });

  // スタート時間を付与
  tabTbl.find("> li").each((i, el) => {
    const label = $(el).find("> .entryT").first().text().trim();
    if (label.includes("スタート時間")) {
      const startTimeText = $(el).find("> .entryD").text().trim();
      const startEntries = startTimeText.split(/\n/).map((s) => s.trim()).filter(Boolean);
      for (const entry of startEntries) {
        const m = entry.match(/(\d{1,2}:\d{2})\s*[（(](.+?)[）)]/);
        if (m) {
          const time = m[1];
          const raceRef = m[2];
          for (const race of races) {
            if (
              raceRef.includes(race.race_name.substring(0, 4)) ||
              race.race_name.includes(raceRef.substring(0, 4))
            ) {
              race.start_time = time;
              break;
            }
          }
        }
      }

      // 単一時間の場合は全種目に適用
      if (races.every((r) => !r.start_time)) {
        const singleTime = startTimeText.match(/^(\d{1,2}:\d{2})/);
        if (singleTime && !startTimeText.includes("、")) {
          races.forEach((r) => (r.start_time = singleTime[1]));
        }
      }
    }
  });

  // 参加費・定員をマッチング
  const fees = parseFees(feeText);
  const capacities = parseCapacities(capacityText);

  for (const race of races) {
    const fee = matchRaceToFee(race.race_name, fees);
    if (fee) {
      race.fee_min = fee;
      race.fee_max = fee;
    }
    const cap = matchRaceToCapacity(race.race_name, capacities);
    if (cap) {
      race.capacity = cap;
    }
  }

  return races;
}

// ─── ページ全文テキスト抽出 ──────────────────

/**
 * HTMLからLLM構造化用のページ全文テキストを抽出
 * @param {CheerioAPI} $ - cheerio インスタンス
 * @returns {string} 全文テキスト
 */
export function extractPageText($) {
  $("script, style, nav, footer, header, iframe, noscript").remove();

  const text = $("body").text();

  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── メイン統合関数 ──────────────────────

/**
 * RUNNET URL から全情報を取得
 * @param {string} url - RUNNET URL
 * @returns {Promise<{ eventInfo, races, pageText, html }>}
 */
export async function fetchAndParseRunnet(url) {
  const html = await fetchRunnetHtml(url);

  const $ = cheerio.load(html);
  const eventInfo = extractEventInfo($, url);
  const races = extractRaces($);

  // テキスト抽出用に再度ロード（DOM変更対策）
  const $2 = cheerio.load(html);
  const pageText = extractPageText($2);

  return { eventInfo, races, pageText, html };
}
