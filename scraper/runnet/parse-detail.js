/**
 * RUNNET 詳細ページ HTML パーサー
 * competitionDetailAction / moshicomDetailAction 両対応
 */

const path = require("path");
const { createRequire } = require("module");
const webRequire = createRequire(
  path.join(__dirname, "..", "..", "web", "package.json")
);
const cheerio = webRequire("cheerio");

/**
 * race_type を正規化
 */
function normalizeRaceType(raceName) {
  const name = raceName.toLowerCase();
  // リレー・駅伝を先に判定（「ハーフリレー」がhalf_marathonにならないよう）
  if (/リレー|駅伝|relay/.test(name)) return "relay";
  if (/フル|full|42\.195|マラソン(?!.*ハーフ)/.test(name) && !/ハーフ|half|ウルトラ|ultra/.test(name)) {
    if (/ウルトラ|ultra|100km|100k|50km|50k|70km|60km/.test(name)) return "ultra";
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

/**
 * 距離を race_name から推定 (km)
 */
function parseDistance(raceName) {
  // "フル" → 42.195
  if (/フルマラソン|フル（|フル\s|^フル$/.test(raceName)) return 42.195;
  if (/ハーフマラソン|ハーフ（|ハーフ\s|^ハーフ$/.test(raceName)) return 21.0975;

  // "10km" "10キロ" "10K"
  const kmMatch = raceName.match(/(\d+(?:\.\d+)?)\s*(?:km|キロ|k(?:ilo)?)/i);
  if (kmMatch) return parseFloat(kmMatch[1]);

  // "42.195km"
  const numMatch = raceName.match(/(\d+(?:\.\d+)?)\s*(?:ｋｍ|ＫＭ)/);
  if (numMatch) return parseFloat(numMatch[1]);

  // "500m" → 0.5
  const mMatch = raceName.match(/(\d+)\s*(?:m|ｍ|メートル)/i);
  if (mMatch) return parseInt(mMatch[1]) / 1000;

  return null;
}

/**
 * 参加料テキストから fee を抽出
 * e.g. "フル9900円　ハーフ7700円　5キロラン3300円　親子1100円"
 * returns Map<string_pattern, {min, max}>
 */
function parseFees(feeText) {
  if (!feeText) return {};
  const fees = {};

  // Pattern: "種目名 数字円" or "数字,数字円"
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

/**
 * 定員テキストから定員を抽出
 * e.g. "フル1000人、ハーフ3000人、5キロラン800人、親子200組400人"
 */
function parseCapacities(capText) {
  if (!capText) return {};
  const caps = {};

  // "種目名 数字人" pattern
  const regex = /([^\d,、]+?)(\d[\d,]*)\s*(?:人|名|組)/g;
  let match;
  while ((match = regex.exec(capText)) !== null) {
    const label = match[1].trim();
    const num = parseInt(match[2].replace(/,/g, ""));
    if (label) caps[label] = num;
  }

  return caps;
}

/**
 * テキストからHTMLタグを除去して整形
 */
function cleanText(text) {
  if (!text) return null;
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim() || null;
}

/**
 * HTMLからテキストを抽出（改行を保持）
 */
function cleanHtml(html) {
  if (!html) return null;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim() || null;
}

/**
 * 日付文字列をパース "2025年9月19日 12:00" → "2025-09-19"
 */
function parseDateStr(str) {
  if (!str) return null;
  const m = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
}

/**
 * エントリー期間をパース
 * "2025年9月19日 12:00～2026年3月20日 23:59"
 */
function parseEntryPeriod(text) {
  if (!text) return { start: null, end: null };
  const cleaned = text.replace(/\s+/g, " ").trim();

  // Split by ～ or ~
  const parts = cleaned.split(/[～~]/);
  return {
    start: parseDateStr(parts[0]),
    end: parts[1] ? parseDateStr(parts[1]) : null,
  };
}

/**
 * race_name と fee/capacity のマッチングヘルパー
 */
function matchRaceToFee(raceName, fees) {
  const name = raceName.toLowerCase();
  for (const [label, amount] of Object.entries(fees)) {
    const l = label.toLowerCase();
    // Exact or partial match
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

/**
 * 詳細ページHTMLをパース
 * @param {string} html
 * @returns {object} { eventUpdate, races }
 */
function parseDetail(html) {
  const $ = cheerio.load(html);

  const result = {
    eventUpdate: {},
    races: [],
    marathonDetails: {},
  };

  // === Event info ===

  // Description from .entry-body or meta description
  const entryBody = $(".entry-body").first().text().trim();
  const metaDesc = $('meta[name="description"]').attr("content") || "";
  result.eventUpdate.description = entryBody || cleanText(metaDesc) || null;

  // Hero image - prefer larger center image
  const centerImg = $('img[src*="race_"][src*="_center"]').attr("src");
  const leftImg = $('img[src*="race_"][src*="_left"]').attr("src");
  if (centerImg) {
    result.eventUpdate.hero_image_url = centerImg.split("?")[0];
  } else if (leftImg) {
    result.eventUpdate.hero_image_url = leftImg.split("?")[0];
  }

  // Parse #entrydMainL items
  $("#entrydMainL > li").each((i, el) => {
    const label = $(el).find(".entryT").first().text().trim();
    const value = $(el).find(".entryD").first().text().trim();

    if (label.includes("開催地")) {
      // "宮城県(登米市)" or "宮城県（登米市）"
      const placeMatch = value.match(/([^\s(（]+[都道府県])[\s(（]*([^)）]*)/);
      if (placeMatch) {
        result.eventUpdate.prefecture = placeMatch[1];
        if (placeMatch[2]) result.eventUpdate.city = placeMatch[2].trim();
      }
    }

    if (label.includes("エントリー期間")) {
      const period = parseEntryPeriod(value);
      result.eventUpdate.entry_start_date = period.start;
      result.eventUpdate.entry_end_date = period.end;

      // Determine entry_status based on dates
      const now = new Date();
      const nowStr = now.toISOString().split("T")[0];
      if (period.start && period.end) {
        if (nowStr < period.start) {
          result.eventUpdate.entry_status = "upcoming";
        } else if (nowStr <= period.end) {
          result.eventUpdate.entry_status = "open";
        } else {
          result.eventUpdate.entry_status = "closed";
        }
      }
    }

    if (label.includes("大会公式サイト") || label.includes("大会詳細ページ")) {
      const link = $(el).find(".entryD a").attr("href");
      if (link && link.startsWith("http")) {
        result.eventUpdate.official_url = link;
      }
    }
  });

  // === eTabTbl (大会要項) ===
  const tabTbl = $(".eTabTbl").first();

  // venue from スタート場所 or フィニッシュ場所
  tabTbl.find("li").each((i, el) => {
    const label = $(el).find(".entryT").first().text().trim();
    const value = $(el).find(".entryD").first().text().trim();

    if (label.includes("スタート場所") || label.includes("会場")) {
      result.eventUpdate.venue_name = value || null;
    }
  });

  // === Races (種目・参加資格) ===
  let feeText = "";
  let capacityText = "";

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
      // Race items are in nested li
      $(el).find("> ul > li").each((j, raceLi) => {
        const raceName = $(raceLi).find(".entryT").first().text().trim();
        const raceData = $(raceLi).find(".entryD").first().text().trim();

        if (!raceName) return;

        // Parse time limit from raceData
        const timeLimitMatch = raceData.match(/制限時間[：:]?\s*(.+?)(?:\s|$)/);
        const timeLimit = timeLimitMatch ? timeLimitMatch[1] : null;

        // Parse eligibility (everything before 制限時間)
        const eligibility = raceData.replace(/制限時間.*/, "").trim() || null;

        result.races.push({
          race_name: raceName,
          race_type: normalizeRaceType(raceName),
          distance_km: parseDistance(raceName),
          eligibility,
          time_limit: timeLimit,
          sort_order: j,
        });
      });
    }
  });

  // Parse start times
  tabTbl.find("> li").each((i, el) => {
    const label = $(el).find("> .entryT").first().text().trim();
    if (label.includes("スタート時間")) {
      const startTimeText = $(el).find("> .entryD").text().trim();
      // Parse "08:30(フル（8:30スタート）)" patterns
      const startEntries = startTimeText.split(/\n/).map(s => s.trim()).filter(Boolean);
      for (const entry of startEntries) {
        const m = entry.match(/(\d{2}:\d{2})\s*[（(](.+?)[）)]/);
        if (m) {
          const time = m[1];
          const raceRef = m[2];
          // Match to existing race
          for (const race of result.races) {
            if (raceRef.includes(race.race_name.substring(0, 4)) ||
                race.race_name.includes(raceRef.substring(0, 4))) {
              race.start_time = time;
              break;
            }
          }
        }
      }
    }
  });

  // Apply fees and capacities
  const fees = parseFees(feeText);
  const capacities = parseCapacities(capacityText);

  for (const race of result.races) {
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

  // Check entry button for status
  const entryBtnArea = $("#entrydMainR01");
  if (entryBtnArea.length) {
    const btnText = entryBtnArea.text().trim();
    if (btnText.includes("エントリー") && !result.eventUpdate.entry_status) {
      result.eventUpdate.entry_status = "open";
    }
    if (btnText.includes("締切") || btnText.includes("受付終了")) {
      result.eventUpdate.entry_status = "closed";
    }
  }

  // =====================================================
  // Phase56: marathon_details フィールド抽出
  // =====================================================
  const md = result.marathonDetails;

  // --- 大会要項 (eTabTbl) から詳細フィールドを抽出 ---
  const allTabTbls = $(".eTabTbl");

  // 第1テーブル: 大会要項
  allTabTbls.first().find("> li").each((i, el) => {
    const label = $(el).find("> .entryT").first().text().trim();
    const value = $(el).find("> .entryD").first().text().trim();
    const valueHtml = $(el).find("> .entryD").first().html();

    if (label.includes("主催")) {
      md.organizer_name = value || null;
    }
    if (label.includes("受付時間")) {
      md.reception_time_text = value || null;
    }
    if (label.includes("受付場所")) {
      md.reception_place = value || null;
    }
    if (label.includes("スタート場所") || label.includes("会場")) {
      md.venue_name = value || null;
    }
    if (label.includes("フィニッシュ場所")) {
      md.finish_place = value || null;
    }
    if (label.includes("参加賞")) {
      md.prize_text = value || null;
    }
    if (label.includes("表彰")) {
      md.award_text = value || null;
    }
    if (label.includes("定員")) {
      md.capacity_text = value || null;
    }
    if (label.includes("参加料")) {
      md.fee_text = value || null;
    }
    if (label.includes("参加資格備考")) {
      md.registration_requirements_text = value || null;
    }
  });

  // 第2テーブル: 大会の特徴
  if (allTabTbls.length >= 2) {
    const featuresTbl = allTabTbls.eq(1);
    const services = [];

    featuresTbl.find("> li").each((i, el) => {
      const label = $(el).find("> .entryT").first().text().trim();
      const value = $(el).find("> .entryD").first().text().trim();

      if (label.includes("大会サービス")) {
        // Skip header - services are parsed separately
        return;
      }
      if (label.includes("参加案内")) {
        // 参加案内の発送方法
        services.push({ name: "参加案内", available: true, note: value });
      } else if (label.includes("記録証")) {
        services.push({ name: "記録証", available: value !== "なし", note: value });
      } else if (label.includes("荷物預かり")) {
        services.push({ name: "荷物預かり", available: !value.includes("なし"), note: value });
      } else if (label.includes("保険")) {
        services.push({ name: "保険", available: true, note: value });
      } else if (label.includes("医療サービス")) {
        services.push({ name: "医療サービス", available: true, note: value });
      } else if (label.includes("売店")) {
        services.push({ name: "売店", available: value !== "なし", note: value });
      } else if (label.includes("観光")) {
        services.push({ name: "観光", available: value !== "なし", note: value });
      } else if (label.includes("参加者へのサービス")) {
        services.push({ name: "参加者サービス", available: true, note: value });
      } else if (label.includes("宿泊")) {
        services.push({ name: "宿泊案内", available: value !== "なし", note: value });
      } else if (label.includes("駐車場")) {
        md.parking_info = value || null;
      } else if (label.includes("特産物")) {
        services.push({ name: "特産物", available: true, note: value });
      } else if (label.includes("イベント") || label.includes("招待選手")) {
        services.push({ name: "イベント・招待選手", available: true, note: value });
      }
    });

    if (services.length > 0) {
      md.services_json = JSON.stringify(services);
    }
  }

  // 前回大会情報 (第3テーブル)
  if (allTabTbls.length >= 3) {
    const prevTbl = allTabTbls.eq(2);
    prevTbl.find("> li").each((i, el) => {
      const label = $(el).find("> .entryT").first().text().trim();
      const value = $(el).find("> .entryD").first().text().trim();
      if (label.includes("参加者数")) {
        md.event_scale_label = value || null;
      }
    });
  }

  // 大会の特徴テキスト（.eTabRoute）
  const featureText = $(".eTabRoute").first().text().trim();
  if (featureText) {
    md.summary = featureText;
  }

  // 連絡事項（#noticeBox）→ notes
  const noticeBox = $("#noticeBox dd").first();
  if (noticeBox.length) {
    const noticeHtml = noticeBox.html();
    const noticeText = cleanHtml(noticeHtml);
    if (noticeText) {
      md.notes = noticeText;
    }
  }

  // エントリー期間 → application dates
  if (result.eventUpdate.entry_start_date) {
    md.application_start_at = result.eventUpdate.entry_start_date;
  }
  if (result.eventUpdate.entry_end_date) {
    md.application_end_at = result.eventUpdate.entry_end_date;
  }

  // 公式URL
  if (result.eventUpdate.official_url) {
    md.official_url = result.eventUpdate.official_url;
  }

  // 会場情報
  if (result.eventUpdate.venue_name) {
    md.venue_name = md.venue_name || result.eventUpdate.venue_name;
  }

  // source_url from entry button or page URL
  const entryLink = $('a[href*="entryAction"]').first().attr("href");
  if (entryLink) {
    md.entry_url = entryLink.startsWith("http")
      ? entryLink
      : "https://runnet.jp" + entryLink;
  }

  // pricing_json from fee text
  if (feeText) {
    const pricingItems = [];
    const feeParts = feeText.split(/[　\s]+/).filter(Boolean);
    let currentName = "";
    for (const part of feeParts) {
      const feeMatch = part.match(/(\d[\d,]*)\s*円/);
      if (feeMatch) {
        const fee = part;
        const name = currentName || part.replace(/\d[\d,]*\s*円.*/, "").trim();
        if (name || fee) {
          pricingItems.push({ name: name || "一般", fee, note: "" });
        }
        currentName = "";
      } else if (!part.includes("※")) {
        currentName = part;
      }
    }
    if (pricingItems.length > 0) {
      md.pricing_json = JSON.stringify(pricingItems);
    }
  }

  // schedule_json from start times
  const scheduleItems = [];
  for (const race of result.races) {
    if (race.start_time) {
      scheduleItems.push({ time: race.start_time, label: `${race.race_name} スタート` });
    }
  }
  if (scheduleItems.length > 0) {
    md.schedule_json = JSON.stringify(scheduleItems);
  }

  // time_limits_json
  const timeLimitItems = [];
  for (const race of result.races) {
    if (race.time_limit) {
      timeLimitItems.push({ name: race.race_name, limit: race.time_limit });
    }
  }
  if (timeLimitItems.length > 0) {
    md.time_limits_json = JSON.stringify(timeLimitItems);
  }

  // distances_json
  const distanceItems = [];
  for (const race of result.races) {
    distanceItems.push({
      name: race.race_name,
      distance_km: race.distance_km,
      race_type: race.race_type,
    });
  }
  if (distanceItems.length > 0) {
    md.distances_json = JSON.stringify(distanceItems);
  }

  // Clean up: remove undefined values
  for (const key of Object.keys(md)) {
    if (md[key] === undefined) delete md[key];
  }

  return result;
}

module.exports = {
  parseDetail,
  normalizeRaceType,
  parseDistance,
  parseFees,
  parseCapacities,
  parseEntryPeriod,
};
