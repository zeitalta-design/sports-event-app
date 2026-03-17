/**
 * ヒーロー画像プロバイダー抽象化
 *
 * 画像取得元を provider として抽象化し、
 * 将来別ソースに差し替えやすい構造にする。
 *
 * 各 provider は以下のインターフェースに従う:
 *   { name, search(query, options) → Promise<Candidate[]> }
 *
 * Candidate:
 *   { id, remoteUrl, downloadUrl, width, height, photographer, creditUrl, tags }
 */

// ─── スライド別検索テーマ ──────────────────────

export const SLIDE_SEARCH_THEMES = {
  "entry-open": {
    label: "今エントリーできる大会",
    queries: [
      "marathon start line runners",
      "race event crowd running",
      "running event gate start",
    ],
    boostTags: ["start", "crowd", "gate", "race", "event", "marathon", "group"],
  },
  "deadline-soon": {
    label: "締切間近の大会",
    queries: [
      "race start gate runners waiting",
      "marathon runners starting line",
      "running event entrance morning",
    ],
    boostTags: ["start", "gate", "waiting", "line", "tension", "race", "morning"],
  },
  "beginner-friendly": {
    label: "初心者でも参加しやすい大会",
    queries: [
      "fun run smiling runners group",
      "beginner running event happy",
      "group running friends jogging",
    ],
    boostTags: ["fun", "smile", "happy", "friends", "group", "family", "jog", "beginner"],
  },
};

export const ALL_SLIDE_KEYS = Object.keys(SLIDE_SEARCH_THEMES);

// ─── Unsplash プロバイダー ──────────────────────

/**
 * Unsplash API プロバイダー
 *
 * 環境変数 UNSPLASH_ACCESS_KEY が必要。
 * https://unsplash.com/developers で取得可能。
 */
function createUnsplashProvider() {
  const BASE_URL = "https://api.unsplash.com";

  return {
    name: "unsplash",

    async search(query, options = {}) {
      const accessKey = process.env.UNSPLASH_ACCESS_KEY;
      if (!accessKey) {
        throw new Error(
          "UNSPLASH_ACCESS_KEY が未設定です。.env.local に追加してください。"
        );
      }

      const { perPage = 10, page = 1 } = options;
      const params = new URLSearchParams({
        query,
        per_page: String(perPage),
        page: String(page),
        orientation: "landscape", // 横長のみ
        content_filter: "high",   // 安全フィルタ
      });

      const res = await fetch(`${BASE_URL}/search/photos?${params}`, {
        headers: { Authorization: `Client-ID ${accessKey}` },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        throw new Error(`Unsplash API error: HTTP ${res.status}`);
      }

      const data = await res.json();

      return (data.results || []).map((photo) => ({
        id: `unsplash-${photo.id}`,
        remoteUrl: photo.urls.regular,    // 1080px幅
        downloadUrl: photo.urls.full,      // フル解像度
        thumbnailUrl: photo.urls.small,    // プレビュー用
        width: photo.width,
        height: photo.height,
        photographer: photo.user?.name || "Unknown",
        creditUrl: photo.user?.links?.html || `https://unsplash.com/@${photo.user?.username}`,
        tags: (photo.tags || []).map((t) => t.title?.toLowerCase()).filter(Boolean),
        description: photo.description || photo.alt_description || "",
        color: photo.color,               // 主要色（#xxxxxx）
      }));
    },
  };
}

// ─── ローカルファイルプロバイダー（テスト用） ──────────

/**
 * ローカルの候補画像をそのまま返すプロバイダー（テスト・手動追加用）
 * data/hero-images.json の candidates を返す。
 */
function createLocalProvider() {
  return {
    name: "local",
    async search(_query, _options) {
      // ローカルプロバイダーは外部検索しない
      return [];
    },
  };
}

// ─── プロバイダーファクトリ ──────────────────────

const PROVIDERS = {
  unsplash: createUnsplashProvider,
  local: createLocalProvider,
};

/**
 * プロバイダーを取得
 * @param {string} name - "unsplash" | "local"
 */
export function getProvider(name = "unsplash") {
  const factory = PROVIDERS[name];
  if (!factory) {
    throw new Error(`Unknown provider: ${name}. Available: ${Object.keys(PROVIDERS).join(", ")}`);
  }
  return factory();
}

/**
 * 指定スライドの候補画像を取得
 *
 * @param {string} slideKey - "entry-open" | "deadline-soon" | "beginner-friendly"
 * @param {object} options - { provider, limit, perQuery }
 * @returns {Promise<Array>} 候補画像リスト
 */
export async function fetchCandidates(slideKey, options = {}) {
  const { provider = "unsplash", limit = 15, perQuery = 5 } = options;
  const theme = SLIDE_SEARCH_THEMES[slideKey];
  if (!theme) {
    throw new Error(`Unknown slide key: ${slideKey}`);
  }

  const prov = getProvider(provider);
  const allCandidates = [];
  const seenIds = new Set();

  for (const query of theme.queries) {
    try {
      const results = await prov.search(query, { perPage: perQuery });
      for (const r of results) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          allCandidates.push({
            ...r,
            sourceProvider: prov.name,
            slideKey,
            searchQuery: query,
          });
        }
      }
    } catch (err) {
      console.warn(`  ⚠ Query "${query}" failed:`, err.message);
    }

    // API レートリミット対策
    if (provider === "unsplash") {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return allCandidates.slice(0, limit);
}
