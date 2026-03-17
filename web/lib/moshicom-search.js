/**
 * MOSHICOM検索・同一イベントマッチングロジック
 *
 * RUNNETイベントに対しMOSHICOMを検索し、
 * スコア方式で同一大会を判定する。
 */

import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const SEARCH_BASE_URL = "https://moshicom.com/search/";

// ─── イベント名正規化 ──────────────────────

/**
 * 大会名を比較用に正規化
 * 「第XX回」「大会」「マラソン」等のノイズを除去し、コア部分を抽出
 */
export function normalizeEventName(name) {
  if (!name) return "";
  return name
    .replace(/第\d+回\s*/g, "")              // 「第XX回」除去
    .replace(/\d{4}年?\s*/g, "")              // 年号除去
    .replace(/20[2-3]\d\s*/g, "")             // 2020-2039 除去
    .replace(/【.*?】/g, "")                   // 【】内除去
    .replace(/\[.*?\]/g, "")                   // []内除去
    .replace(/（.*?）/g, "")                   // （）内除去
    .replace(/\(.*?\)/g, "")                   // ()内除去
    .replace(/\s*in\s+.+$/i, "")               // 「in 〇〇」除去
    .replace(/\s*カップ$/g, "")                // 末尾「カップ」除去
    .replace(/\s*フェス(?:タ|ティバル)?$/g, "") // 「フェス」「フェスタ」除去
    .replace(/\s*(?:大会|マラソン大会)\s*$/g, "") // 末尾「大会」除去
    .replace(/\s+/g, "")                       // スペース除去
    .replace(/・/g, "")                         // 中点除去
    .replace(/ー/g, "")                         // 長音除去（カタカナ表記ゆれ対策）
    .trim();
}

/**
 * 2つの文字列の部分一致度を計算（0〜1）
 * Dice係数ベースの2-gram類似度
 */
function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const bigrams = (str) => {
    const set = new Set();
    for (let i = 0; i < str.length - 1; i++) {
      set.add(str.substring(i, i + 2));
    }
    return set;
  };

  const setA = bigrams(a);
  const setB = bigrams(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const gram of setA) {
    if (setB.has(gram)) intersection++;
  }

  return (2 * intersection) / (setA.size + setB.size);
}

// ─── 同一イベント判定スコア ──────────────────

/**
 * RUNNETイベントとMOSHICOM検索結果のマッチスコアを計算
 *
 * @param {object} runnetEvent - { title, event_date, prefecture }
 * @param {object} moshicomResult - { title, date, prefecture }
 * @returns {number} 0〜100のスコア
 */
export function matchEventScore(runnetEvent, moshicomResult) {
  let score = 0;

  // 1. 大会名の類似度 (最大50点)
  const nameA = normalizeEventName(runnetEvent.title);
  const nameB = normalizeEventName(moshicomResult.title);

  // 完全一致
  if (nameA === nameB) {
    score += 50;
  } else if (nameA.includes(nameB) || nameB.includes(nameA)) {
    // 一方が他方を含む（短い方が3文字以上かつ長い方の40%以上の長さ）
    const shorter = Math.min(nameA.length, nameB.length);
    const longer = Math.max(nameA.length, nameB.length);
    if (shorter >= 3 && shorter / longer >= 0.4) {
      score += 45;
    } else if (shorter >= 3) {
      score += 30; // 含むが長さ比が低い（部分的なキーワード一致）
    } else {
      score += 15;
    }
  } else {
    // 2-gram類似度
    const sim = stringSimilarity(nameA, nameB);
    score += Math.round(sim * 50);
  }

  // 2. 開催日一致 (最大30点)
  if (runnetEvent.event_date && moshicomResult.date) {
    const dateA = runnetEvent.event_date.replace(/-/g, "");
    const dateB = moshicomResult.date.replace(/-/g, "");
    if (dateA === dateB) {
      score += 30;
    } else if (dateA.substring(0, 6) === dateB.substring(0, 6)) {
      // 同月（日が違う場合は少し加点）
      score += 10;
    }
  }

  // 3. 開催地（都道府県）一致 (最大20点)
  if (runnetEvent.prefecture && moshicomResult.prefecture) {
    if (runnetEvent.prefecture === moshicomResult.prefecture) {
      score += 20;
    }
  }

  return score;
}

// ─── MOSHICOM検索 ──────────────────────

/**
 * MOSHICOMサイト内検索を実行
 *
 * @param {string} query - 検索クエリ（大会名）
 * @returns {Promise<Array<{title, url, moshicomId, date, prefecture}>>}
 */
export async function searchMoshicom(query) {
  const searchUrl = `${SEARCH_BASE_URL}?q=${encodeURIComponent(query)}`;

  const response = await fetch(searchUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ja,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`MOSHICOM search failed: HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  // 検索結果のイベントリストをパース
  // MOSHICOMの検索結果ページ構造に合わせてセレクタ調整
  $("a[href*='moshicom.com/']").each((i, el) => {
    const href = $(el).attr("href") || "";
    const idMatch = href.match(/moshicom\.com\/(\d+)/);
    if (!idMatch) return;

    const moshicomId = idMatch[1];
    // 重複チェック
    if (results.some((r) => r.moshicomId === moshicomId)) return;

    // タイトル取得（リンク内のテキストまたは周辺要素）
    let title = $(el).text().trim();
    // 親要素からタイトルを取得する場合
    if (!title || title.length < 3) {
      title = $(el).closest("div, li, article").find("h2, h3, .title, .name").first().text().trim();
    }
    if (!title || title.length < 3) return;

    // 日付取得（近傍テキストから）
    const container = $(el).closest("div, li, article");
    const containerText = container.text();
    let date = null;
    const dateMatch = containerText.match(/(\d{4})[/年](\d{1,2})[/月](\d{1,2})/);
    if (dateMatch) {
      date = `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, "0")}-${String(dateMatch[3]).padStart(2, "0")}`;
    }

    // 都道府県
    let prefecture = null;
    const PREFECTURES = [
      "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
      "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
      "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
      "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
      "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
      "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
      "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
    ];
    for (const pref of PREFECTURES) {
      if (containerText.includes(pref)) {
        prefecture = pref;
        break;
      }
    }

    results.push({
      title,
      url: href.startsWith("http") ? href : `https://moshicom.com/${moshicomId}`,
      moshicomId,
      date,
      prefecture,
    });
  });

  return results;
}

// ─── マッチング統合 ──────────────────────

/**
 * RUNNETイベントに対しMOSHICOMを検索し、最高スコアのマッチを返す
 *
 * @param {object} event - { title, event_date, prefecture }
 * @param {object} options - { minScore: 80 }
 * @returns {Promise<{match, score, allResults} | null>}
 */
export async function findMoshicomMatch(event, options = {}) {
  const { minScore = 80 } = options;

  // 検索クエリ構築: 正規化した大会名のコア部分を使用
  const searchQuery = normalizeEventName(event.title);
  if (!searchQuery || searchQuery.length < 2) return null;

  try {
    const results = await searchMoshicom(event.title);
    if (results.length === 0) return null;

    // 各結果にスコアを付与
    const scored = results.map((r) => ({
      ...r,
      score: matchEventScore(event, r),
    }));

    // スコア降順ソート
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (best.score >= minScore) {
      return {
        match: best,
        score: best.score,
        allResults: scored.slice(0, 5), // 上位5件を参考用に返す
      };
    }

    return {
      match: null,
      score: best.score,
      allResults: scored.slice(0, 5),
    };
  } catch (error) {
    console.error(`MOSHICOM search failed for "${event.title}":`, error.message);
    return null;
  }
}
