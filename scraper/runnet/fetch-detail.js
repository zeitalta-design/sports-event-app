/**
 * RUNNET 詳細ページ取得
 */

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 詳細ページのHTMLを取得
 * @param {string} url - 詳細ページURL
 * @returns {Promise<string>} HTML文字列
 */
async function fetchDetail(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ja,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

/**
 * 複数の詳細ページを取得
 * @param {object[]} events - { id, source_event_id, source_url } の配列
 * @returns {Promise<{ event: object, html: string }[]>}
 */
async function fetchDetails(events) {
  const results = [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    try {
      console.log(`  [${i + 1}/${events.length}] Fetching raceId=${ev.source_event_id}: ${ev.source_url}`);
      const html = await fetchDetail(ev.source_url);
      results.push({ event: ev, html });
      console.log(`    OK (${html.length} bytes)`);

      if (i < events.length - 1) {
        await sleep(DELAY_MS);
      }
    } catch (err) {
      console.error(`    ERROR: ${err.message}`);
      results.push({ event: ev, html: null, error: err.message });
    }
  }

  return results;
}

module.exports = { fetchDetail, fetchDetails, DELAY_MS };
