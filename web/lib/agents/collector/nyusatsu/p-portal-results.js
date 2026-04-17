/**
 * Collector: nyusatsu.p-portal-results
 * 調達ポータル（旧GEPS）落札実績オープンデータ
 *
 * 新パイプライン経由:
 *   collectPPortalRaw (fetch+parse) → processPPortalResults (format+DB)
 */
import { collectPPortalRaw } from "@/lib/nyusatsu-result-fetcher";
import { processPPortalResults } from "@/lib/agents/pipeline/nyusatsu";

/** @type {import("../../types.js").Collector} */
const collector = {
  id: "nyusatsu.p-portal-results",
  domain: "nyusatsu",
  sourceLabel: "調達ポータル 落札実績（オープンデータ）",
  async collect({ dryRun = false, logger = console.log, mode = "diff", date, year } = {}) {
    const start = Date.now();
    try {
      const collected = await collectPPortalRaw({ mode, date, year, logger });
      const stats = processPPortalResults(collected.rawRecords, {
        sourceUrl: collected.url,
        dryRun,
        logger,
      });
      return {
        id: "nyusatsu.p-portal-results",
        domain: "nyusatsu",
        sourceLabel: "調達ポータル 落札実績（オープンデータ）",
        status: "ok",
        fetched: collected.rawRecords.length,
        inserted: stats.inserted,
        updated: stats.updated,
        skipped: stats.skipped,
        elapsedMs: Date.now() - start,
        extra: { filename: collected.filename },
      };
    } catch (e) {
      return {
        id: "nyusatsu.p-portal-results",
        domain: "nyusatsu",
        sourceLabel: "調達ポータル 落札実績（オープンデータ）",
        status: "error",
        fetched: 0, inserted: 0, updated: 0, skipped: 0,
        elapsedMs: Date.now() - start,
        error: e.message,
      };
    }
  },
};

export default collector;
