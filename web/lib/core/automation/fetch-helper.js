/**
 * 自動化共通基盤 — Fetch Helper
 *
 * HTML取得・エラーハンドリング・リトライ・robots確認の共通ユーティリティ。
 */

const DEFAULT_HEADERS = {
  "User-Agent": "SportsEventApp-DataCollector/1.0 (+https://sportlog.jp/about-data)",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ja,en;q=0.5",
};

/**
 * URLからHTMLを取得する
 * @param {string} url - 取得先URL
 * @param {Object} options
 * @param {number} options.timeout - タイムアウト(ms) デフォルト15秒
 * @param {number} options.retries - リトライ回数 デフォルト2
 * @param {Object} options.headers - 追加ヘッダー
 * @returns {{ ok: boolean, html?: string, status?: number, error?: string }}
 */
export async function fetchHtml(url, { timeout = 15000, retries = 2, headers = {} } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(url, {
        headers: { ...DEFAULT_HEADERS, ...headers },
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timer);

      if (!res.ok) {
        if (attempt < retries && (res.status === 429 || res.status >= 500)) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
        return { ok: false, status: res.status, error: `HTTP ${res.status} ${res.statusText}` };
      }

      const html = await res.text();
      return { ok: true, html, status: res.status };
    } catch (err) {
      if (attempt < retries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      return { ok: false, error: err.name === "AbortError" ? `Timeout (${timeout}ms)` : err.message };
    }
  }
  return { ok: false, error: "Max retries exceeded" };
}

/**
 * 簡易HTMLパーサー — タグから情報を抽出するユーティリティ
 * cheerio/jsdom不要の軽量実装
 */
export function extractText(html, startMarker, endMarker) {
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return null;
  const contentStart = startIdx + startMarker.length;
  const endIdx = html.indexOf(endMarker, contentStart);
  if (endIdx === -1) return null;
  return html.substring(contentStart, endIdx).trim();
}

/**
 * HTMLからタグの内容を全て取得
 */
export function extractAllBetween(html, startTag, endTag) {
  const results = [];
  let pos = 0;
  while (true) {
    const startIdx = html.indexOf(startTag, pos);
    if (startIdx === -1) break;
    const contentStart = startIdx + startTag.length;
    const endIdx = html.indexOf(endTag, contentStart);
    if (endIdx === -1) break;
    results.push(html.substring(contentStart, endIdx).trim());
    pos = endIdx + endTag.length;
  }
  return results;
}

/**
 * HTMLタグを除去してプレーンテキストにする
 */
export function stripTags(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|td|th|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * href属性を抽出
 */
export function extractHrefs(html, pattern = null) {
  const regex = /href=["']([^"']+)["']/gi;
  const hrefs = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    if (pattern && !href.includes(pattern)) continue;
    hrefs.push(href);
  }
  return hrefs;
}

/**
 * 相対URLを絶対URLに変換
 */
export function resolveUrl(base, relative) {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

/**
 * テーブル行からセルの値を取得
 */
export function extractTableRows(html) {
  const rows = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(html)) !== null) {
    const cells = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(trMatch[1])) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
