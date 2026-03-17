/**
 * ヒーロー画像スコアリング・選別ロジック
 *
 * IMAGE-GUIDE.md の選定基準をスコア化し、
 * 閾値以上の画像のみ active 候補にする。
 *
 * スコア: 0〜100
 *   - 基本品質: 最大 50点
 *   - スライド適合: 最大 30点
 *   - ペナルティ: 最大 -30点
 *   - 採用閾値: 60点
 */

import { SLIDE_SEARCH_THEMES } from "./hero-image-sources.js";

// ─── 定数 ──────────────────────

export const SCORE_THRESHOLD = 60; // 採用最低スコア
const MIN_WIDTH = 1200;            // 最低幅
const MIN_HEIGHT = 600;            // 最低高さ
const IDEAL_ASPECT_MIN = 1.5;     // 理想アスペクト比 最小 (3:2)
const IDEAL_ASPECT_MAX = 2.5;     // 理想アスペクト比 最大 (21:9)

// NG タグ・キーワード（文字入り画像・イラスト・バナー系を除外）
const REJECT_TAGS = [
  "illustration", "drawing", "cartoon", "anime", "vector",
  "poster", "banner", "flyer", "advertisement", "ad",
  "text", "typography", "logo", "sign", "infographic",
  "graphic design", "digital art", "3d render",
];

// 減点タグ（風景だけ・単調な写真）
const PENALTY_TAGS = [
  "landscape", "scenery", "mountain", "sunset", "sunrise",
  "nature", "forest", "ocean", "beach", "sky",
  "aerial", "drone", "bird eye",
];

// 加点タグ（人物・イベント感）
const BOOST_TAGS = [
  "runner", "runners", "running", "marathon", "race",
  "athlete", "crowd", "event", "competition", "sport",
  "finish line", "start line", "cheering", "celebration",
  "medal", "bib", "course", "track", "stadium",
  "people", "group", "team", "friends", "family",
  "happy", "smile", "joy", "fun",
];

// ─── メインスコアリング ──────────────────────

/**
 * 候補画像にスコアを付与
 *
 * @param {object} candidate - 候補画像データ
 * @param {string} slideKey - "entry-open" | "deadline-soon" | "beginner-friendly"
 * @returns {object} { score, reasons, rejected, candidate }
 */
export function scoreCandidate(candidate, slideKey) {
  const reasons = [];
  let score = 0;
  let rejected = false;

  const tags = (candidate.tags || []).map((t) => t.toLowerCase());
  const desc = (candidate.description || "").toLowerCase();
  const allText = [...tags, desc].join(" ");

  // ─── 即時除外チェック ───

  // NG タグが含まれていたら即除外
  for (const ng of REJECT_TAGS) {
    if (tags.includes(ng) || desc.includes(ng)) {
      reasons.push(`NG: "${ng}" タグ検出`);
      rejected = true;
      return { score: 0, reasons, rejected, candidate };
    }
  }

  // ─── 基本品質スコア (最大 50点) ───

  // 1. 解像度チェック (最大 15点)
  if (candidate.width >= 1920 && candidate.height >= 1080) {
    score += 15;
    reasons.push("+15 高解像度 (1920+)");
  } else if (candidate.width >= MIN_WIDTH && candidate.height >= MIN_HEIGHT) {
    score += 10;
    reasons.push("+10 十分な解像度");
  } else {
    score += 0;
    reasons.push("+0 解像度不足");
    if (candidate.width < MIN_WIDTH || candidate.height < MIN_HEIGHT) {
      rejected = true;
      reasons.push("NG: 最低解像度未達");
      return { score: 0, reasons, rejected, candidate };
    }
  }

  // 2. アスペクト比 (最大 10点)
  const aspect = candidate.width / candidate.height;
  if (aspect >= IDEAL_ASPECT_MIN && aspect <= IDEAL_ASPECT_MAX) {
    score += 10;
    reasons.push(`+10 理想的なアスペクト比 (${aspect.toFixed(2)})`);
  } else if (aspect >= 1.2) {
    score += 5;
    reasons.push(`+5 許容アスペクト比 (${aspect.toFixed(2)})`);
  } else {
    reasons.push(`+0 縦長すぎる (${aspect.toFixed(2)})`);
    rejected = true;
    reasons.push("NG: 縦長画像");
    return { score: 0, reasons, rejected, candidate };
  }

  // 3. 人物・イベント関連タグの存在 (最大 15点)
  let boostCount = 0;
  for (const bt of BOOST_TAGS) {
    if (allText.includes(bt)) boostCount++;
  }
  const boostScore = Math.min(15, boostCount * 3);
  score += boostScore;
  if (boostScore > 0) {
    reasons.push(`+${boostScore} イベント関連タグ (${boostCount}件)`);
  }

  // 4. 説明文の充実度 (最大 10点)
  if (desc.length > 30) {
    score += 10;
    reasons.push("+10 説明文あり");
  } else if (desc.length > 10) {
    score += 5;
    reasons.push("+5 短い説明文");
  }

  // ─── スライド別適合スコア (最大 30点) ───

  const theme = SLIDE_SEARCH_THEMES[slideKey];
  if (theme?.boostTags) {
    let slideBoost = 0;
    for (const st of theme.boostTags) {
      if (allText.includes(st)) slideBoost++;
    }
    const slideScore = Math.min(30, slideBoost * 5);
    score += slideScore;
    if (slideScore > 0) {
      reasons.push(`+${slideScore} スライド適合 (${slideBoost}件)`);
    }
  }

  // ─── ペナルティ (最大 -30点) ───

  // 風景だけ・自然系タグ
  let penaltyCount = 0;
  for (const pt of PENALTY_TAGS) {
    if (allText.includes(pt)) penaltyCount++;
  }
  if (penaltyCount > 0) {
    const penalty = Math.min(30, penaltyCount * 5);
    score -= penalty;
    reasons.push(`-${penalty} 風景/自然系タグ (${penaltyCount}件)`);
  }

  // 人物関連タグが全くない場合
  const hasHumanTag = ["people", "runner", "runners", "athlete", "crowd", "group", "team", "person", "man", "woman"].some(
    (t) => allText.includes(t)
  );
  if (!hasHumanTag) {
    score -= 10;
    reasons.push("-10 人物タグなし");
  }

  score = Math.max(0, Math.min(100, score));

  return { score, reasons, rejected, candidate };
}

// ─── 候補リストの選別 ──────────────────────

/**
 * 候補リストをスコアリングし、上位を返す
 *
 * @param {Array} candidates - 候補画像リスト
 * @param {string} slideKey
 * @param {object} options - { threshold, maxResults }
 * @returns {Array<{ score, reasons, rejected, candidate }>}
 */
export function rankCandidates(candidates, slideKey, options = {}) {
  const { threshold = SCORE_THRESHOLD, maxResults = 5 } = options;

  const scored = candidates.map((c) => scoreCandidate(c, slideKey));

  // 除外されていないもの → スコア降順
  const eligible = scored
    .filter((s) => !s.rejected)
    .sort((a, b) => b.score - a.score);

  // 閾値以上のもの
  const approved = eligible.filter((s) => s.score >= threshold);

  return {
    approved: approved.slice(0, maxResults),
    belowThreshold: eligible.filter((s) => s.score < threshold).slice(0, 5),
    rejected: scored.filter((s) => s.rejected),
    bestScore: approved.length > 0 ? approved[0].score : 0,
    totalCandidates: candidates.length,
    approvedCount: approved.length,
  };
}

// ─── データストア操作 ──────────────────────

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const DATA_PATH = join(process.cwd(), "data", "hero-images.json");

/**
 * hero-images.json の初期構造
 */
function getEmptyStore() {
  return {
    version: 1,
    updatedAt: null,
    slides: {
      "entry-open": { active: null, candidates: [] },
      "deadline-soon": { active: null, candidates: [] },
      "beginner-friendly": { active: null, candidates: [] },
    },
  };
}

/**
 * データストアを読み込む
 */
export function loadStore() {
  try {
    if (!existsSync(DATA_PATH)) return getEmptyStore();
    const raw = readFileSync(DATA_PATH, "utf-8");
    const store = JSON.parse(raw);
    // スライドキーが足りなければ補完
    for (const key of ["entry-open", "deadline-soon", "beginner-friendly"]) {
      if (!store.slides[key]) {
        store.slides[key] = { active: null, candidates: [] };
      }
    }
    return store;
  } catch {
    return getEmptyStore();
  }
}

/**
 * データストアを保存
 */
export function saveStore(store) {
  store.updatedAt = new Date().toISOString();
  const dir = dirname(DATA_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(DATA_PATH, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * 候補をストアに追加（重複は上書き）
 */
export function addCandidatesToStore(store, slideKey, scoredResults) {
  const slide = store.slides[slideKey];
  if (!slide) return;

  for (const result of scoredResults) {
    const c = result.candidate;
    const existing = slide.candidates.findIndex((x) => x.id === c.id);
    const entry = {
      id: c.id,
      slideKey,
      sourceProvider: c.sourceProvider || "unknown",
      remoteUrl: c.remoteUrl,
      downloadUrl: c.downloadUrl,
      thumbnailUrl: c.thumbnailUrl,
      width: c.width,
      height: c.height,
      aspectRatio: +(c.width / c.height).toFixed(3),
      photographer: c.photographer,
      creditUrl: c.creditUrl,
      tags: c.tags,
      description: c.description,
      score: result.score,
      reasons: result.reasons,
      status: result.score >= SCORE_THRESHOLD ? "approved" : "candidate",
      localPath: null,
      checkedAt: new Date().toISOString(),
    };

    if (existing >= 0) {
      slide.candidates[existing] = entry;
    } else {
      slide.candidates.push(entry);
    }
  }

  // スコア降順でソート
  slide.candidates.sort((a, b) => b.score - a.score);
}

/**
 * 最高スコアの approved 候補を active にする
 * ダウンロード済み（localPath あり）かつ採用条件を満たすもののみ
 */
export function activateBest(store, slideKey) {
  const slide = store.slides[slideKey];
  if (!slide) return null;

  const best = slide.candidates.find(
    (c) => c.status === "approved" && c.localPath && c.score >= SCORE_THRESHOLD
  );

  if (!best) return null;

  // 既存 active があれば status を approved に戻す
  if (slide.active) {
    const prev = slide.candidates.find((c) => c.id === slide.active.id);
    if (prev) prev.status = "approved";
  }

  best.status = "active";
  slide.active = {
    id: best.id,
    localPath: best.localPath,
    photographer: best.photographer,
    creditUrl: best.creditUrl,
    score: best.score,
    activatedAt: new Date().toISOString(),
  };

  return best;
}
