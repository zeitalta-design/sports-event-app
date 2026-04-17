/**
 * Collector: nyusatsu.central-ministries
 * 中央省庁 6省庁（農水省・経産省・総務省・厚労省・国交省・環境省）の入札公告
 *
 * 新パイプライン経由:
 *   collectCentralMinistriesRaw (fetch+parse) → processCentralMinistries (format+DB)
 */
import { collectCentralMinistriesRaw } from "@/lib/nyusatsu-fetcher";
import { processCentralMinistries } from "@/lib/agents/pipeline/nyusatsu";

/** @type {import("../../types.js").Collector} */
const collector = {
  id: "nyusatsu.central-ministries",
  domain: "nyusatsu",
  sourceLabel: "中央省庁（農水・経産・総務・厚労・国交・環境）",
  async collect({ dryRun = false, logger = console.log } = {}) {
    const start = Date.now();
    try {
      const collected = await collectCentralMinistriesRaw({ logger });
      const stats = processCentralMinistries(collected.perSource, { dryRun, logger });
      return {
        id: "nyusatsu.central-ministries",
        domain: "nyusatsu",
        sourceLabel: "中央省庁（農水・経産・総務・厚労・国交・環境）",
        status: "ok",
        fetched: collected.totalFetched,
        inserted: stats.inserted,
        updated: stats.updated,
        skipped: stats.skipped,
        elapsedMs: Date.now() - start,
        extra: { perSource: stats.perSource },
      };
    } catch (e) {
      return {
        id: "nyusatsu.central-ministries",
        domain: "nyusatsu",
        sourceLabel: "中央省庁（農水・経産・総務・厚労・国交・環境）",
        status: "error",
        fetched: 0, inserted: 0, updated: 0, skipped: 0,
        elapsedMs: Date.now() - start,
        error: e.message,
      };
    }
  },
};

export default collector;
