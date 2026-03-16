/**
 * moshicom.com 詳細ページ HTML パーサー
 *
 * 2つのパターンに対応:
 * 1. Table形式: <table> に 種目|参加費|制限時間|募集人数|参加資格
 * 2. Ticket形式: <dl> に dt=種目名, dd=料金, dd=申し込む
 */

const path = require("path");
const { createRequire } = require("module");
const webRequire = createRequire(
  path.join(__dirname, "..", "..", "web", "package.json")
);
const cheerio = webRequire("cheerio");

// runnet の parse-detail から共通ユーティリティを再利用
const { normalizeRaceType, parseDistance } = require("../runnet/parse-detail");

/**
 * 金額文字列をパース "4,500円" → 4500
 */
function parseFee(feeStr) {
  if (!feeStr) return null;
  const m = feeStr.replace(/\s/g, "").match(/([\d,]+)円/);
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ""), 10);
}

/**
 * 人数文字列をパース "200人" → 200
 */
function parseCapacity(capStr) {
  if (!capStr) return null;
  const m = capStr.replace(/\s/g, "").match(/([\d,]+)人/);
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ""), 10);
}

/**
 * テーブル形式のrace情報をパース
 * 種目 | 参加費 | 制限時間 | 募集人数 | 参加資格
 */
function parseRaceTable($, table) {
  const races = [];
  const rows = [];

  $(table).find("tr").each((i, tr) => {
    const cells = [];
    $(tr).find("td, th").each((j, td) => {
      cells.push($(td).text().trim());
    });
    if (cells.length >= 2) rows.push(cells);
  });

  if (rows.length < 2) return races;

  // ヘッダー行を検出してカラムマッピング
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

    const fee = colMap.fee !== undefined ? parseFee(row[colMap.fee]) : null;
    const capacity = colMap.capacity !== undefined ? parseCapacity(row[colMap.capacity]) : null;
    const timeLimit = colMap.timeLimit !== undefined ? row[colMap.timeLimit] || null : null;
    const eligibility = colMap.eligibility !== undefined ? row[colMap.eligibility] || null : null;

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
 * <dl><dt>種目名</dt><dd>金額円</dd><dd>申し込む</dd></dl>
 *
 * 同一種目で参加賞あり/なしのバリエーションがある場合はfee_min/fee_maxで集約
 */
function parseTicketRaces($) {
  const rawItems = [];

  $("dl").each((i, dl) => {
    const dt = $(dl).find("dt").first().text().trim();
    const dds = [];
    $(dl).find("dd").each((j, dd) => dds.push($(dd).text().trim()));

    if (!dt || dds.length < 1) return;
    // 「申し込む」ボタンがある = ticket entry
    const hasEntry = dds.some((d) => d.includes("申し込む"));
    if (!hasEntry) return;

    const feeText = dds.find((d) => /[\d,]+円/.test(d));
    const fee = parseFee(feeText);

    rawItems.push({ name: dt, fee });
  });

  if (rawItems.length === 0) return [];

  // 同一種目のバリエーション（参加賞あり/なし等）を集約
  // "ハーフ（21.0975km）-参加賞不要" と "ハーフ（21.0975km）-参加賞あり" → 1つに
  const grouped = new Map();
  for (const item of rawItems) {
    // 「-参加賞あり」「-参加賞不要」等のサフィックスを除去してベース名を取得
    const baseName = item.name
      .replace(/[-ー]参加賞(?:あり|不要|なし|付き)$/g, "")
      .replace(/[-ー](?:Tシャツ|記念品)(?:あり|なし|付き)$/g, "")
      .trim();

    if (grouped.has(baseName)) {
      const existing = grouped.get(baseName);
      if (item.fee !== null) {
        existing.fees.push(item.fee);
      }
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
    $(table).find("tr").each((j, tr) => {
      const cells = [];
      $(tr).find("td, th").each((k, td) => cells.push($(td).text().trim()));
      if (cells.length >= 2) rows.push(cells);
    });

    // スケジュールテーブル判定: 「項目」「時間」ヘッダー or 「スタート」を含む行
    const isSchedule = rows.some(
      (r) =>
        (r[0].includes("項目") && r[1].includes("時間")) ||
        r[0].includes("スタート")
    );
    if (!isSchedule) return;

    for (const row of rows) {
      if (!row[0].includes("スタート")) continue;
      // "9:30 〜（10km）、9:35 〜（5km）" のようなフォーマット
      const timeText = row[1] || "";
      for (const race of races) {
        // race_nameのキーワードがtimeTextに含まれるか
        const nameKey = race.race_name.replace(/[（()）]/g, "");
        if (timeText.includes(nameKey) || timeText.includes(race.race_name)) {
          const timeMatch = timeText.match(
            new RegExp(`(\\d{1,2}:\\d{2})\\s*[〜～]?\\s*[（(]?${nameKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
          );
          if (timeMatch) {
            race.start_time = timeMatch[1];
          }
        }
      }
      // 単一スタート時間の場合（全種目同時）
      if (races.every((r) => !r.start_time)) {
        const singleTime = timeText.match(/^(\d{1,2}:\d{2})/);
        if (singleTime && !timeText.includes("、")) {
          races.forEach((r) => (r.start_time = singleTime[1]));
        }
      }
    }
  });
}

/**
 * moshicom.com のイベント詳細HTMLをパース
 * @param {string} html
 * @returns {{ eventUpdate: object, races: object[] }}
 */
function parseMoshicomDetail(html) {
  const $ = cheerio.load(html);

  const eventUpdate = {};

  // メタタグからイベント情報
  const ogTitle = $('meta[property="og:title"]').attr("content") || "";
  const ogDesc = $('meta[property="og:description"]').attr("content") || "";
  const ogImage = $('meta[property="og:image"]').attr("content") || null;

  // og:titleから " on Moshicom" を除去
  if (ogTitle) {
    eventUpdate.normalized_title = ogTitle.replace(/\s+on\s+Moshicom$/i, "").trim();
  }

  // descriptionはRUNNET詳細より詳しい場合のみ更新するため、常にセット
  if (ogDesc) {
    const cleanDesc = ogDesc.replace(/\s+on\s+Moshicom$/i, "").trim();
    if (cleanDesc.length > 50) {
      eventUpdate.description = cleanDesc;
    }
  }

  if (ogImage) {
    eventUpdate.hero_image_url = ogImage;
  }

  // official_url
  eventUpdate.official_url = null; // caller sets from source_event_id

  // エントリーステータス判定
  const h1Text = $("h1").first().text().trim();
  if (h1Text.includes("受付中")) {
    eventUpdate.entry_status = "open";
  } else if (h1Text.includes("締切") || h1Text.includes("受付終了")) {
    eventUpdate.entry_status = "closed";
  } else if (h1Text.includes("受付予定")) {
    eventUpdate.entry_status = "upcoming";
  }

  // 申込み期間をテキストから抽出
  const bodyText = $("body").text();
  const entryPeriodMatch = bodyText.match(
    /申込み期間[：:]\s*(\d{4}[/年]\d{1,2}[/月]\d{1,2}日?)\s*[〜～～-]\s*(\d{4}[/年]\d{1,2}[/月]\d{1,2}日?)/
  );
  if (entryPeriodMatch) {
    eventUpdate.entry_start_date = normalizeDate(entryPeriodMatch[1]);
    eventUpdate.entry_end_date = normalizeDate(entryPeriodMatch[2]);
  }

  // Race情報を抽出（2パターン）
  let races = [];

  // パターン1: テーブル形式
  $("table").each((i, table) => {
    if (races.length > 0) return; // 最初に見つかったものを使用
    const tableRaces = parseRaceTable($, table);
    if (tableRaces.length > 0) {
      races = tableRaces;
    }
  });

  // パターン2: テーブルがなければ Ticket(DL)形式
  if (races.length === 0) {
    races = parseTicketRaces($);
  }

  // スケジュールテーブルからstart_timeを補完
  if (races.length > 0) {
    enrichStartTimes($, races);
  }

  return { eventUpdate, races };
}

/**
 * 日付正規化 "2026/5/16" or "2026年5月16日" → "2026-05-16"
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/(\d{4})[/年](\d{1,2})[/月](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
}

module.exports = { parseMoshicomDetail, parseFee, parseCapacity };
