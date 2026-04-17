/**
 * Resolver Layer 1 用の gBizINFO クライアント（stub）
 *
 * 将来的に: 経済産業省の gBizINFO API
 *   https://info.gbiz.go.jp/hojin/v1/hojin
 * を叩いて、事業者名 → 法人番号 を解決する。
 *
 * 現時点では API キー運用が未確定のため stub。呼び出し側は
 * 「結果が null」を前提に設計する（Layer 1 スキップで Layer 2 へ進む）。
 *
 * 環境変数 GBIZINFO_TOKEN が設定されていれば実 API を叩く余地を残す。
 */

const GBIZINFO_ENDPOINT = "https://info.gbiz.go.jp/hojin/v1/hojin";

/**
 * 事業者名から法人番号を問い合わせる
 *
 * @param {string} name  企業名（正規化済でも生でも可）
 * @param {object} [opts]
 * @param {string} [opts.token]    GBIZINFO_TOKEN（未指定時は env を参照）
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<{ corporateNumber: string, canonicalName: string, raw: object } | null>}
 */
export async function lookupCorporateNumber(name, opts = {}) {
  const token = opts.token || process.env.GBIZINFO_TOKEN;
  if (!token) return null; // stub 動作：キー未設定なら null を返す（Layer 1 スキップ）

  const timeoutMs = opts.timeoutMs ?? 10000;
  const url = `${GBIZINFO_ENDPOINT}?name=${encodeURIComponent(name)}`;

  try {
    const res = await fetch(url, {
      headers: {
        "X-hojinInfo-api-token": token,
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (RiskMonitor resolver)",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const body = await res.json();
    const items = body?.["hojin-infos"] || [];
    if (items.length === 0) return null;

    // 複数マッチは先頭の 1 件（スコアリングは将来課題）
    const hit = items[0];
    return {
      corporateNumber: hit["corporate-number"] || hit["corporateNumber"] || null,
      canonicalName:   hit["name"] || null,
      raw: hit,
    };
  } catch {
    return null;
  }
}
