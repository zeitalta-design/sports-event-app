/**
 * 行政処分DB — 情報源到達性監査
 *
 * 情報源台帳の各URLに対して到達性チェックを行い、
 * 状態（ok / warn / error）を判定する。
 * Server-side のみで使用。
 */

const TIMEOUT_MS = 10_000;
const DELAY_BETWEEN_MS = 500;

/**
 * 1件の情報源に対して到達性チェックを実行
 */
export async function auditSource(source) {
  if (!source.url) {
    return {
      sourceId: source.id,
      status: "warn",
      httpStatus: null,
      contentType: null,
      resolvedUrl: null,
      checkedAt: new Date().toISOString(),
      note: "URLが設定されていません",
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(source.url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "TaikaiNavi-SourceAudit/1.0",
        Accept: "text/html,application/xhtml+xml,application/pdf,*/*",
      },
    });

    clearTimeout(timer);

    const contentType = res.headers.get("content-type") || "";
    const resolvedUrl = res.url;
    const httpStatus = res.status;

    let status = "ok";
    let note = "";

    if (httpStatus >= 400) {
      status = "error";
      note = `HTTP ${httpStatus}`;
    } else if (httpStatus >= 300) {
      status = "warn";
      note = `リダイレクト: ${resolvedUrl}`;
    }

    // ドメインが大きく変わった場合は警告
    if (resolvedUrl && status === "ok") {
      const origHost = new URL(source.url).hostname;
      const resolvedHost = new URL(resolvedUrl).hostname;
      if (origHost !== resolvedHost && !resolvedHost.endsWith(origHost.replace(/^www\./, ""))) {
        status = "warn";
        note = `リダイレクト先ドメインが異なります: ${resolvedHost}`;
      }
    }

    return {
      sourceId: source.id,
      status,
      httpStatus,
      contentType: contentType.split(";")[0].trim(),
      resolvedUrl,
      checkedAt: new Date().toISOString(),
      note,
    };
  } catch (err) {
    const isTimeout = err.name === "AbortError";
    return {
      sourceId: source.id,
      status: "error",
      httpStatus: null,
      contentType: null,
      resolvedUrl: null,
      checkedAt: new Date().toISOString(),
      note: isTimeout ? `タイムアウト (${TIMEOUT_MS / 1000}秒)` : `接続エラー: ${err.message}`,
    };
  }
}

/**
 * 全情報源を直列で監査（rate limit 考慮）
 */
export async function auditAllSources(sources) {
  const results = [];
  for (const source of sources) {
    if (!source.active) {
      results.push({
        sourceId: source.id,
        status: "unknown",
        httpStatus: null,
        contentType: null,
        resolvedUrl: null,
        checkedAt: new Date().toISOString(),
        note: "無効化されたソース（スキップ）",
      });
      continue;
    }
    const result = await auditSource(source);
    results.push(result);
    // rate limit
    await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MS));
  }
  return results;
}
