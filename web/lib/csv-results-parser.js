/**
 * Phase199: 柔軟CSVパーサー
 *
 * 大会ごとに形式が異なるCSV結果を自動判定してパースする。
 * ヘッダー行からカラムマッピングを推論し、event_results形式に変換。
 */

// ─── カラム名→フィールドのマッピング辞書 ──────────────

const COLUMN_PATTERNS = {
  bib_number: [
    /^(ゼッケン|ナンバー|bib|no\.?|番号|ナンバ)$/i,
    /^(ゼッケン番号|bib.?number|race.?number|出走番号)$/i,
  ],
  overall_rank: [
    /^(総合順位|総合|順位|rank|overall.?rank|place|着順)$/i,
    /^(total.?rank|general.?rank|位)$/i,
  ],
  gender_rank: [
    /^(性別順位|男女別|性別|gender.?rank|sex.?rank)$/i,
  ],
  age_rank: [
    /^(年代順位|年代別|age.?rank|age.?group.?rank|部門順位)$/i,
  ],
  finish_time: [
    /^(タイム|グロスタイム|gross|finish.?time|完走タイム|記録|time|ゴールタイム)$/i,
  ],
  net_time: [
    /^(ネット|ネットタイム|net|net.?time|実走)$/i,
  ],
  category_name: [
    /^(種目|カテゴリ|部門|category|race|distance|event|競技)$/i,
  ],
  gender: [
    /^(性別|sex|gender|男女)$/i,
  ],
  age_group: [
    /^(年代|年齢|age|age.?group|年齢層)$/i,
  ],
  runner_name: [
    /^(氏名|名前|name|runner|選手名|ランナー名|お名前)$/i,
  ],
  finish_status: [
    /^(完走|status|結果|finish|DNF|finish.?status)$/i,
  ],
};

// ─── メイン関数 ──────────────────────────────────

/**
 * CSVテキストをパースしてevent_results配列に変換
 * @param {string} csvText - CSVテキスト
 * @param {object} options
 * @param {number} options.eventId
 * @param {number} options.resultYear
 * @param {string} [options.sportType]
 * @param {object} [options.columnOverrides] - カラムマッピングの上書き { csvColumnIndex: fieldName }
 * @returns {{ results: object[], mapping: object, errors: string[], stats: object }}
 */
export function parseResultsCsv(csvText, { eventId, resultYear, sportType = "marathon", columnOverrides = null }) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return { results: [], mapping: {}, errors: ["CSVにデータ行がありません（ヘッダー+1行以上必要）"], stats: {} };
  }

  // ヘッダー解析
  const headers = parseCsvLine(lines[0]);
  const mapping = columnOverrides || autoDetectMapping(headers);

  const errors = [];
  const results = [];
  let skipCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length === 0 || cols.every((c) => !c.trim())) {
      skipCount++;
      continue;
    }

    try {
      const row = buildResultRow(cols, mapping, { eventId, resultYear, sportType });
      if (row) {
        results.push(row);
      } else {
        skipCount++;
      }
    } catch (err) {
      errors.push(`行${i + 1}: ${err.message}`);
      if (errors.length > 20) {
        errors.push("...エラーが多すぎるため中断");
        break;
      }
    }
  }

  return {
    results,
    mapping,
    headers,
    errors,
    stats: {
      totalLines: lines.length - 1,
      parsed: results.length,
      skipped: skipCount,
      errorCount: errors.length,
    },
  };
}

// ─── カラム自動判定 ──────────────────────────────

/**
 * ヘッダー行からカラムマッピングを自動推論
 * @param {string[]} headers
 * @returns {object} { fieldName: columnIndex }
 */
export function autoDetectMapping(headers) {
  const mapping = {};
  const usedIndices = new Set();

  for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
    for (let i = 0; i < headers.length; i++) {
      if (usedIndices.has(i)) continue;
      const header = headers[i].trim();
      if (!header) continue;

      for (const pattern of patterns) {
        if (pattern.test(header)) {
          mapping[field] = i;
          usedIndices.add(i);
          break;
        }
      }
      if (mapping[field] !== undefined) break;
    }
  }

  return mapping;
}

// ─── 行データ構築 ──────────────────────────────

function buildResultRow(cols, mapping, { eventId, resultYear, sportType }) {
  const get = (field) => {
    const idx = mapping[field];
    if (idx === undefined || idx >= cols.length) return null;
    const val = cols[idx]?.trim();
    return val || null;
  };

  const bibNumber = get("bib_number");
  const finishTime = normalizeTime(get("finish_time"));
  const netTime = normalizeTime(get("net_time"));
  const overallRank = parseRank(get("overall_rank"));
  const finishStatus = normalizeFinishStatus(get("finish_status"), finishTime);

  // 最低限、ゼッケンかタイムがないとスキップ
  if (!bibNumber && !finishTime && !overallRank) return null;

  // ランナー名のハッシュ化（プライバシー対応）
  const runnerName = get("runner_name");
  const nameHash = runnerName ? simpleHash(runnerName) : null;

  return {
    event_id: eventId,
    result_year: resultYear,
    sport_type: sportType,
    bib_number: bibNumber,
    overall_rank: overallRank,
    gender_rank: parseRank(get("gender_rank")),
    age_rank: parseRank(get("age_rank")),
    finish_time: finishTime,
    net_time: netTime,
    category_name: get("category_name"),
    gender: normalizeGender(get("gender")),
    age_group: get("age_group"),
    finish_status: finishStatus,
    runner_name_hash: nameHash,
    is_public: 1,
  };
}

// ─── ヘルパー ──────────────────────────────────

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function normalizeTime(timeStr) {
  if (!timeStr) return null;
  // "HH:MM:SS" or "H:MM:SS" or "MM:SS" — そのまま返す
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr)) return timeStr;
  // "01h23m45s" 形式
  const hms = timeStr.match(/(\d+)h\s*(\d+)m\s*(\d+)s/i);
  if (hms) return `${hms[1]}:${hms[2].padStart(2, "0")}:${hms[3].padStart(2, "0")}`;
  // "1時間23分45秒" 形式
  const jp = timeStr.match(/(\d+)時間?\s*(\d+)分\s*(\d+)秒?/);
  if (jp) return `${jp[1]}:${jp[2].padStart(2, "0")}:${jp[3].padStart(2, "0")}`;
  // "DNF" etc
  if (/DNF|DNS|DQ|棄権|途中棄権/i.test(timeStr)) return null;
  return timeStr;
}

function parseRank(str) {
  if (!str) return null;
  const num = parseInt(str.replace(/[位着]/, ""), 10);
  return isNaN(num) ? null : num;
}

function normalizeFinishStatus(status, finishTime) {
  if (!status && finishTime) return "finished";
  if (!status) return "finished";
  const s = status.toLowerCase();
  if (/dnf|途中棄権|リタイア/.test(s)) return "dnf";
  if (/dns|不出走|欠場/.test(s)) return "dns";
  if (/dq|失格/.test(s)) return "dq";
  return "finished";
}

function normalizeGender(str) {
  if (!str) return null;
  if (/^(男|male|M)$/i.test(str.trim())) return "male";
  if (/^(女|female|F)$/i.test(str.trim())) return "female";
  return str.trim();
}

function simpleHash(str) {
  // DJB2ハッシュ — 個人名匿名化用
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33 + str.charCodeAt(i)) & 0xffffffff;
  }
  return hash.toString(16);
}
