/**
 * moshicom.com 詳細ページ取得
 */

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DELAY_MS = 2500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * moshicom.com の詳細ページHTMLを取得
 * @param {string} sourceEventId - moshicom イベントID
 * @returns {Promise<string>} HTML文字列
 */
async function fetchMoshicomDetail(sourceEventId) {
  const url = `https://moshicom.com/${sourceEventId}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ja,en;q=0.9",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

/**
 * 複数のmoshicomイベント詳細を取得
 * @param {object[]} events - { id, source_event_id, title } の配列
 * @returns {Promise<{ event: object, html: string|null, error?: string }[]>}
 */
async function fetchMoshicomDetails(events) {
  const results = [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    try {
      const url = `https://moshicom.com/${ev.source_event_id}`;
      console.log(`  [${i + 1}/${events.length}] Fetching ${url}`);
      const html = await fetchMoshicomDetail(ev.source_event_id);
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

module.exports = { fetchMoshicomDetail, fetchMoshicomDetails, DELAY_MS };
