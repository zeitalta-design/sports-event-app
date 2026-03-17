import { getDb } from "@/lib/db";

/**
 * Phase208: 大会重複チェックサービス
 *
 * 大会名類似度・開催日・開催地・距離・公式URL・sport_typeで重複候補を検出
 */

/**
 * 2つの文字列の類似度を計算（Jaccard係数ベース bigram）
 */
function bigramSimilarity(a, b) {
  if (!a || !b) return 0;
  const normalize = (s) => s.replace(/[\s　\-・（）()【】\[\]]/g, "").toLowerCase();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return na === nb ? 1 : 0;

  const bigrams = (s) => {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const setA = bigrams(na);
  const setB = bigrams(nb);
  let intersection = 0;
  for (const bg of setA) if (setB.has(bg)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 距離リストの重複度を計算
 */
function distanceOverlap(listA, listB) {
  if (!listA || !listB) return 0;
  const parse = (s) => s.split(/[,、/／]/).map((d) => d.trim().replace(/[^0-9.]/g, "")).filter(Boolean);
  const a = parse(listA);
  const b = parse(listB);
  if (a.length === 0 || b.length === 0) return 0;
  let match = 0;
  for (const d of a) if (b.includes(d)) match++;
  return match / Math.max(a.length, b.length);
}

/**
 * 重複スコアを計算（0-100）
 */
function calcDuplicateScore(eventA, eventB) {
  let score = 0;
  const reasons = [];

  // 大会名類似度（最大40点）
  const nameSim = bigramSimilarity(eventA.title, eventB.title);
  if (nameSim >= 0.8) {
    score += 40;
    reasons.push(`大会名類似 ${Math.round(nameSim * 100)}%`);
  } else if (nameSim >= 0.6) {
    score += Math.round(nameSim * 40);
    reasons.push(`大会名やや類似 ${Math.round(nameSim * 100)}%`);
  }

  // 開催日一致（最大20点）
  if (eventA.event_date && eventB.event_date && eventA.event_date === eventB.event_date) {
    score += 20;
    reasons.push("開催日一致");
  }

  // 開催地一致（最大15点）
  if (eventA.prefecture && eventB.prefecture && eventA.prefecture === eventB.prefecture) {
    score += 10;
    reasons.push("都道府県一致");
    if (eventA.city && eventB.city && eventA.city === eventB.city) {
      score += 5;
      reasons.push("市区町村一致");
    }
  }

  // 距離リスト重複（最大10点）
  const distOv = distanceOverlap(eventA.distance_list, eventB.distance_list);
  if (distOv > 0) {
    score += Math.round(distOv * 10);
    reasons.push(`距離一致 ${Math.round(distOv * 100)}%`);
  }

  // 公式URL一致（最大10点）
  if (eventA.official_url && eventB.official_url) {
    try {
      const urlA = new URL(eventA.official_url).hostname.replace("www.", "");
      const urlB = new URL(eventB.official_url).hostname.replace("www.", "");
      if (urlA === urlB) {
        score += 10;
        reasons.push("公式URLドメイン一致");
      }
    } catch {}
  }

  // sport_type一致（最大5点）
  if (eventA.sport_type && eventB.sport_type && eventA.sport_type === eventB.sport_type) {
    score += 5;
    reasons.push("スポーツ種別一致");
  }

  return { score: Math.min(score, 100), reasons };
}

/**
 * 重複候補を検出
 * @param {Object} options
 * @param {number} options.threshold - 検出閾値（デフォルト50）
 * @param {number} options.limit - 最大件数
 * @returns {Array} 重複候補ペア
 */
export function detectDuplicates({ threshold = 50, limit = 100 } = {}) {
  const db = getDb();

  // アクティブな大会を取得
  const events = db.prepare(`
    SELECT id, title, event_date, prefecture, city, distance_list,
           official_url, sport_type
    FROM events
    WHERE is_active = 1
    ORDER BY id
  `).all();

  const candidates = [];

  // O(n^2) だが、大会名の先頭2文字が異なるものはスキップで高速化
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];

      // 高速フィルタ: sport_typeが異なれば大幅減点のためスキップ候補
      // ただし名前が酷似なら通す
      const quickNameSim = bigramSimilarity(a.title, b.title);
      if (quickNameSim < 0.3) continue;

      const { score, reasons } = calcDuplicateScore(a, b);
      if (score >= threshold) {
        candidates.push({
          eventA: { id: a.id, title: a.title, event_date: a.event_date, prefecture: a.prefecture },
          eventB: { id: b.id, title: b.title, event_date: b.event_date, prefecture: b.prefecture },
          score,
          reasons,
        });
      }
    }
  }

  // スコア降順ソート
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, limit);
}

/**
 * 特定大会の重複候補を検出
 */
export function detectDuplicatesForEvent(eventId, { threshold = 40 } = {}) {
  const db = getDb();
  const target = db.prepare(`
    SELECT id, title, event_date, prefecture, city, distance_list,
           official_url, sport_type
    FROM events WHERE id = ?
  `).get(eventId);
  if (!target) return [];

  const others = db.prepare(`
    SELECT id, title, event_date, prefecture, city, distance_list,
           official_url, sport_type
    FROM events
    WHERE is_active = 1 AND id != ?
  `).all(eventId);

  const candidates = [];
  for (const other of others) {
    const { score, reasons } = calcDuplicateScore(target, other);
    if (score >= threshold) {
      candidates.push({
        event: { id: other.id, title: other.title, event_date: other.event_date, prefecture: other.prefecture },
        score,
        reasons,
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 20);
}

export { bigramSimilarity, calcDuplicateScore };
