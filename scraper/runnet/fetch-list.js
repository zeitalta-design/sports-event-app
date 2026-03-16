/**
 * RUNNET 大会一覧ページ取得
 * Cookie/セッション対応でページネーション取得
 */

const { RunnetSession, LIST_URL, DELAY_MS, sleep } = require("./client");

/**
 * 1ページ分のHTMLを取得
 * @param {RunnetSession} session
 * @param {number} pageIndex
 * @param {object} filterOptions
 * @returns {Promise<string>} HTML文字列
 */
async function fetchPage(session, pageIndex = 1, filterOptions = {}) {
  const params = new URLSearchParams();

  if (pageIndex === 1) {
    params.set("command", "search");
  } else {
    params.set("command", "page");
    params.set("specialize", "null");
  }
  params.set("pageIndex", String(pageIndex));

  if (filterOptions.distanceClass) params.set("distanceClass", filterOptions.distanceClass);
  if (filterOptions.zone) params.set("zone", filterOptions.zone);
  if (filterOptions.available) params.set("available", filterOptions.available);

  const url = `${LIST_URL}?${params}`;
  const response = await session.get(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for page ${pageIndex}`);
  }

  return response.text();
}

/**
 * HTMLにイベントデータが含まれるか検証
 */
function validatePage(html) {
  if (!html || html.length < 1000) return false;
  if (!html.includes("listGroup")) return false;
  if (!html.includes("raceId=")) return false;
  return true;
}

/**
 * 指定ページ範囲のHTMLを取得（セッション自動管理）
 * @param {object} options
 * @returns {Promise<{ pages: Array<{page: number, html: string}>, stats: object }>}
 */
async function fetchPages(options = {}) {
  const {
    startPage = 1,
    endPage = 5,
    cookie,
    verbose = false,
    ...filterOptions
  } = options;

  const session = new RunnetSession({ cookie, verbose });
  const pages = [];
  const stats = {
    requested: 0,
    fetched: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    cookieSource: cookie ? "manual" : "auto",
  };

  const actualStart = Math.max(1, startPage);

  // startPage > 1 の場合、まず page 1 でセッション確立
  if (actualStart > 1) {
    if (verbose) console.log("  Fetching page 1 for session init...");
    try {
      await fetchPage(session, 1, filterOptions);
      if (verbose) console.log(`  Session initialized (${Object.keys(session.cookies).length} cookies)`);
      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`  ERROR initializing session: ${err.message}`);
      stats.errors.push({ page: 1, error: err.message });
    }
  }

  for (let i = actualStart; i <= endPage; i++) {
    stats.requested++;
    try {
      const html = await fetchPage(session, i, filterOptions);

      if (validatePage(html)) {
        pages.push({ page: i, html });
        stats.fetched++;
        if (verbose) console.log(`  Page ${i} OK (${html.length} bytes)`);
      } else {
        stats.skipped++;
        if (verbose) console.log(`  Page ${i} SKIPPED (no valid data, ${html.length} bytes)`);
        if (i > 1 && html.length < 5000) {
          if (verbose) console.log("  End of results detected. Stopping.");
          break;
        }
      }

      if (i < endPage) {
        await sleep(DELAY_MS);
      }
    } catch (err) {
      stats.failed++;
      stats.errors.push({ page: i, error: err.message });
      console.error(`  ERROR on page ${i}: ${err.message}`);
    }
  }

  stats.hasSession = session.hasSession();
  return { pages, stats };
}

module.exports = { fetchPage, fetchPages, validatePage, DELAY_MS };
