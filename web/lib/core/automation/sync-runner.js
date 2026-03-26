/**
 * 自動化共通基盤 — 同期実行ランナー
 *
 * 各ドメインの importer を共通フローでラップし、
 * startSyncRun → 差分検知 → 変更記録 → 公開判定 → finishSyncRun を実行する。
 *
 * 各ドメインは adapter を定義して渡す。
 */

import { getDb } from "@/lib/db";
import { startSyncRun, finishSyncRun, getDataSourceById } from "./sync-logger";
import { detectFieldChanges, recordChanges } from "./change-detector";
import { makePublishDecision, createAdminNotification } from "./publish-decision";

/**
 * ドメインアダプター定義
 * @typedef {Object} DomainAdapter
 * @property {string} domainId - ドメインID
 * @property {string} entityType - エンティティタイプ名
 * @property {string[]} trackedFields - 差分追跡するフィールド名
 * @property {function} normalize - 生データを正規化する関数
 * @property {function} findExisting - slug等で既存データを検索する関数
 * @property {function} upsert - upsert関数
 */

/**
 * 同期実行を走らせる
 * @param {Object} params
 * @param {DomainAdapter} params.adapter - ドメインアダプター
 * @param {Array} params.rawItems - 取り込む生データ配列
 * @param {number|null} params.sourceId - データソースID
 * @param {string} params.runType - "manual" | "scheduled" | "api"
 * @param {boolean} params.dryRun - dry run モード
 * @param {boolean} params.verbose - 詳細ログ
 * @returns {Object} 実行レポート
 */
export function runSyncWithTracking({
  adapter,
  rawItems,
  sourceId = null,
  runType = "manual",
  dryRun = false,
  verbose = false,
}) {
  const { domainId, entityType, trackedFields, normalize, findExisting, upsert } = adapter;

  // 同期実行開始
  const runId = dryRun ? null : startSyncRun({ domainId, sourceId, runType });
  const source = sourceId ? getDataSourceById(sourceId) : null;

  const report = {
    runId,
    total: rawItems.length,
    fetched: rawItems.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    review: 0,
    failed: 0,
    errors: [],
    changes: [],
  };

  for (let i = 0; i < rawItems.length; i++) {
    try {
      // 1. 正規化
      const { item, errors } = normalize(rawItems[i]);
      if (errors.length > 0 || !item) {
        report.errors.push(...errors);
        report.failed++;
        if (verbose) console.log(`  [${i + 1}] SKIP: ${errors.join(", ")}`);
        continue;
      }

      // 2. 既存データ検索
      const existing = findExisting(item.slug);

      if (existing) {
        // 3a. 差分検知
        const fieldChanges = detectFieldChanges(existing, item, trackedFields);

        if (fieldChanges.length === 0) {
          report.unchanged++;
          if (verbose) console.log(`  [${i + 1}] UNCHANGED: ${item.slug}`);
          continue;
        }

        // 4. 公開判定
        const decision = makePublishDecision({
          domainId,
          item,
          changeType: "updated",
          fieldChanges,
          source,
        });

        // 5. upsert 実行
        if (!dryRun) {
          upsert(item);

          // 6. 変更記録
          recordChanges({
            domainId,
            syncRunId: runId,
            sourceId,
            entityType,
            entityId: existing.id,
            entitySlug: item.slug,
            changeType: "updated",
            changes: fieldChanges,
            requiresReview: decision.requiresReview,
          });

          if (decision.requiresReview) report.review++;
        }

        report.updated++;
        report.changes.push({
          slug: item.slug,
          type: "updated",
          fields: fieldChanges.map((c) => c.field),
          decision: decision.decision,
        });

        if (verbose) console.log(`  [${i + 1}] UPDATE: ${item.slug} (${fieldChanges.length} changes, ${decision.decision})`);
      } else {
        // 3b. 新規作成
        const decision = makePublishDecision({
          domainId,
          item,
          changeType: "created",
          source,
        });

        if (!dryRun) {
          const result = upsert(item);

          // 変更記録
          recordChanges({
            domainId,
            syncRunId: runId,
            sourceId,
            entityType,
            entityId: result.id,
            entitySlug: item.slug,
            changeType: "created",
            requiresReview: decision.requiresReview,
          });

          if (decision.requiresReview) report.review++;
        }

        report.created++;
        report.changes.push({
          slug: item.slug,
          type: "created",
          decision: decision.decision,
        });

        if (verbose) console.log(`  [${i + 1}] CREATE: ${item.slug} (${decision.decision})`);
      }
    } catch (err) {
      report.errors.push(`[${i + 1}] ${err.message}`);
      report.failed++;
      if (verbose) console.log(`  [${i + 1}] ERROR: ${err.message}`);
    }
  }

  // 同期実行完了
  if (!dryRun && runId) {
    finishSyncRun(runId, {
      runStatus: report.failed > 0 && report.created + report.updated === 0 ? "failed" : "completed",
      fetchedCount: report.fetched,
      createdCount: report.created,
      updatedCount: report.updated,
      unchangedCount: report.unchanged,
      reviewCount: report.review,
      failedCount: report.failed,
      errorSummary: report.errors.length > 0 ? report.errors.slice(0, 5).join("\n") : null,
    });

    // 通知: 同期完了
    if (report.created > 0 || report.updated > 0 || report.review > 0) {
      const parts = [];
      if (report.created > 0) parts.push(`新規${report.created}件`);
      if (report.updated > 0) parts.push(`更新${report.updated}件`);
      if (report.review > 0) parts.push(`要確認${report.review}件`);
      createAdminNotification({
        domainId,
        notificationType: report.review > 0 ? "warning" : "info",
        title: `[${domainId}] 同期完了: ${parts.join(", ")}`,
        message: `Run #${runId} — 取得${report.fetched}件中、${parts.join(", ")}`,
        relatedEntityType: "sync_run",
        relatedEntityId: runId,
      });
    }
  }

  return report;
}
