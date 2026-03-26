/**
 * 自動化共通基盤 — 通知チャネル
 *
 * admin_notifications に加え、Slack webhook + メールへの通知を提供する。
 * 環境変数で有効/無効を切替。通知失敗は同期本体に影響しない。
 *
 * 環境変数:
 *   SLACK_WEBHOOK_URL — Slack Incoming Webhook URL
 *   NOTIFICATION_EMAIL_TO — メール送信先
 *   NOTIFICATION_EMAIL_FROM — メール送信元（デフォルト: noreply@sportlog.jp）
 *   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS — SMTP設定
 */

// DB依存を排除: createAdminNotification は db インスタンスを受け取る形に
// cron スクリプトから呼ぶ場合は db を渡す

/**
 * admin_notifications にレコードを挿入
 * @param {Object} db - better-sqlite3 DBインスタンス
 */
function insertAdminNotification(db, { domainId, notificationType, title, message, relatedEntityType, relatedEntityId }) {
  db.prepare(`
    INSERT INTO admin_notifications (domain_id, notification_type, title, message, related_entity_type, related_entity_id, created_at)
    VALUES (@domainId, @notificationType, @title, @message, @relatedEntityType, @relatedEntityId, datetime('now'))
  `).run({ domainId, notificationType, title, message, relatedEntityType, relatedEntityId: relatedEntityId || null });
}

// ─── 通知イベント種別 ─────────────────────

export const NOTIFICATION_EVENTS = {
  SYNC_SUCCESS: "sync_success",
  SYNC_REVIEW_REQUIRED: "sync_review_required",
  SYNC_FAILED: "sync_failed",
  SOURCE_HTTP_ERROR: "source_http_error",
  SOURCE_TIMEOUT: "source_timeout",
  SOURCE_INACTIVE: "source_inactive",
};

/**
 * 同期結果から通知イベントを生成・送信する
 * @param {Object} params
 * @param {string} params.domainId
 * @param {number} params.runId
 * @param {Object} params.report — { total, created, updated, unchanged, review, failed, errors }
 * @param {string} params.sourceName
 * @param {string[]} params.sourceErrors — ソース取得時のエラー
 */
export async function sendSyncNotification({ db, domainId, runId, report, sourceName = null, sourceErrors = [] }) {
  // 1. 通知イベント種別を判定
  let eventType;
  let severity;
  if (report.failed > 0 && report.created + report.updated === 0) {
    eventType = NOTIFICATION_EVENTS.SYNC_FAILED;
    severity = "error";
  } else if (report.review > 0) {
    eventType = NOTIFICATION_EVENTS.SYNC_REVIEW_REQUIRED;
    severity = "warning";
  } else {
    eventType = NOTIFICATION_EVENTS.SYNC_SUCCESS;
    severity = "info";
  }

  // 2. 通知本文を組み立て
  const parts = [];
  if (report.created > 0) parts.push(`新規${report.created}件`);
  if (report.updated > 0) parts.push(`更新${report.updated}件`);
  if (report.unchanged > 0) parts.push(`不変${report.unchanged}件`);
  if (report.review > 0) parts.push(`要確認${report.review}件`);
  if (report.failed > 0) parts.push(`失敗${report.failed}件`);

  const title = `[${domainId}] 同期${eventType === NOTIFICATION_EVENTS.SYNC_FAILED ? "失敗" : "完了"}: ${parts.join(", ") || "変更なし"}`;
  const message = [
    `Run #${runId}`,
    sourceName ? `ソース: ${sourceName}` : null,
    `取得: ${report.total || report.fetched || 0}件`,
    parts.length > 0 ? parts.join(", ") : "変更なし",
    report.errors?.length > 0 ? `エラー: ${report.errors.slice(0, 3).join("; ")}` : null,
    sourceErrors?.length > 0 ? `ソースエラー: ${sourceErrors.slice(0, 3).join("; ")}` : null,
  ].filter(Boolean).join("\n");

  // 3. admin_notifications に記録
  try {
    insertAdminNotification(db, {
      domainId,
      notificationType: severity,
      title,
      message,
      relatedEntityType: "sync_run",
      relatedEntityId: runId,
    });
  } catch (err) {
    console.error("[notifier] admin_notifications 記録失敗:", err.message);
  }

  // 4. ソースエラー通知（404 / timeout 等）
  for (const sourceError of sourceErrors) {
    try {
      const errType = sourceError.includes("404") ? NOTIFICATION_EVENTS.SOURCE_HTTP_ERROR
        : sourceError.includes("Timeout") ? NOTIFICATION_EVENTS.SOURCE_TIMEOUT
        : NOTIFICATION_EVENTS.SOURCE_HTTP_ERROR;
      insertAdminNotification(db, {
        domainId,
        notificationType: "error",
        title: `[${domainId}] ソースエラー`,
        message: sourceError,
        relatedEntityType: "data_source",
      });
    } catch { /* skip */ }
  }

  // 5. Slack webhook
  await sendSlackNotification({ title, message, severity, domainId, runId, eventType });

  // 6. メール通知
  await sendEmailNotification({ title, message, severity, domainId, runId, eventType });
}

// ─── Slack Webhook ─────────────────────

async function sendSlackNotification({ title, message, severity, domainId, runId, eventType }) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return; // 無効

  const colorMap = { error: "#dc2626", warning: "#f59e0b", info: "#3b82f6" };
  const emojiMap = { error: "🚨", warning: "⚠️", info: "✅" };

  const payload = {
    text: `${emojiMap[severity] || "📋"} ${title}`,
    attachments: [
      {
        color: colorMap[severity] || "#6b7280",
        fields: [
          { title: "ドメイン", value: domainId, short: true },
          { title: "Run ID", value: `#${runId}`, short: true },
          { title: "イベント", value: eventType, short: true },
        ],
        text: message,
        footer: "SportLog Automation",
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[notifier] Slack webhook 失敗: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error(`[notifier] Slack webhook エラー: ${err.message}`);
  }
}

// ─── メール通知 ─────────────────────

async function sendEmailNotification({ title, message, severity, domainId, runId, eventType }) {
  const emailTo = process.env.NOTIFICATION_EMAIL_TO;
  const smtpHost = process.env.SMTP_HOST;
  if (!emailTo || !smtpHost) return; // 無効

  const emailFrom = process.env.NOTIFICATION_EMAIL_FROM || "noreply@sportlog.jp";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.SMTP_USER || "";
  const smtpPass = process.env.SMTP_PASS || "";

  // 簡易 SMTP送信（nodemailer が利用可能な場合）
  try {
    let nodemailer;
    try { nodemailer = await import("nodemailer"); } catch { return; /* nodemailer未インストール */ }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
    });

    await transporter.sendMail({
      from: emailFrom,
      to: emailTo,
      subject: title,
      text: [
        `同期結果通知`,
        `━━━━━━━━━━━━━━`,
        `ドメイン: ${domainId}`,
        `Run ID: #${runId}`,
        `イベント: ${eventType}`,
        `重要度: ${severity}`,
        ``,
        message,
        ``,
        `━━━━━━━━━━━━━━`,
        `SportLog Automation`,
      ].join("\n"),
    });
  } catch (err) {
    console.error(`[notifier] メール送信失敗: ${err.message}`);
  }
}

// ─── 通知設定の確認 ─────────────────────

export function getNotificationConfig() {
  return {
    slack: {
      enabled: !!process.env.SLACK_WEBHOOK_URL,
      url: process.env.SLACK_WEBHOOK_URL ? "***設定済み***" : "未設定",
    },
    email: {
      enabled: !!(process.env.NOTIFICATION_EMAIL_TO && process.env.SMTP_HOST),
      to: process.env.NOTIFICATION_EMAIL_TO || "未設定",
      host: process.env.SMTP_HOST || "未設定",
    },
    adminNotifications: { enabled: true },
  };
}
