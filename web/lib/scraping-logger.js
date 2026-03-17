/**
 * Phase228: スクレイピング実行ログ記録ユーティリティ
 *
 * スクレイピングスクリプトから呼び出して
 * scraping_logsテーブルに記録 + 失敗時Slack通知
 *
 * 使用例:
 *   const logger = createScrapingLogger("runnet", "list");
 *   logger.addSuccess(5);
 *   logger.addFail(2, "Timeout on page 3");
 *   logger.addNew(3);
 *   await logger.finish();
 */

import { getDb } from "./db";
import { notifyScrapingFailed } from "./ops-notify";

/**
 * スクレイピングロガーを作成
 * @param {string} sourceName - 取得元名 (e.g. "runnet", "moshicom")
 * @param {string} jobType - ジョブ種別 (e.g. "list", "detail")
 * @returns {ScrapingLogger}
 */
export function createScrapingLogger(sourceName, jobType = "list") {
  const db = getDb();
  const startedAt = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO scraping_logs (source_name, job_type, status, started_at)
    VALUES (?, ?, 'running', ?)
  `).run(sourceName, jobType, startedAt);

  const logId = result.lastInsertRowid;
  let successCount = 0;
  let failCount = 0;
  let newCount = 0;
  let updateCount = 0;
  const errors = [];

  return {
    get id() { return logId; },

    addSuccess(count = 1) {
      successCount += count;
    },

    addFail(count = 1, errorMsg) {
      failCount += count;
      if (errorMsg) errors.push(errorMsg);
    },

    addNew(count = 1) {
      newCount += count;
    },

    addUpdate(count = 1) {
      updateCount += count;
    },

    /**
     * ログを確定し、失敗があればSlack通知
     */
    async finish() {
      const finishedAt = new Date().toISOString();
      const status = failCount > 0 && successCount === 0 ? "failed" : failCount > 0 ? "partial" : "success";
      const errorSummary = errors.length > 0 ? errors.slice(0, 5).join("; ") : null;

      db.prepare(`
        UPDATE scraping_logs
        SET status = ?, total_count = ?, success_count = ?, fail_count = ?,
            new_count = ?, update_count = ?, error_summary = ?, finished_at = ?
        WHERE id = ?
      `).run(
        status,
        successCount + failCount,
        successCount,
        failCount,
        newCount,
        updateCount,
        errorSummary,
        finishedAt,
        logId
      );

      // 失敗時にSlack通知
      if (status === "failed") {
        try {
          await notifyScrapingFailed({
            id: logId,
            source_name: sourceName,
            fail_count: failCount,
            error_summary: errorSummary,
          });
        } catch (err) {
          console.error("[scraping-logger] 通知送信失敗:", err.message);
        }
      }

      return { id: logId, status, successCount, failCount, newCount, updateCount };
    },
  };
}
