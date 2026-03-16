import { NextResponse } from "next/server";
import { generateAllNotifications } from "@/lib/notification-service";
import { generateEmailJobs } from "@/lib/email-service";
import { sendPendingEmailJobs } from "@/lib/email-sender";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const today = body.date || new Date().toISOString().slice(0, 10);
    const withEmailSend = !!body.withEmailSend;
    const dryRun = !!body.dryRun;
    const limitEmails = Math.min(Number(body.limitEmails) || 50, 200);

    const db = getDb();

    // daily_jobs レコード作成
    const dailyJobId = db
      .prepare(
        `INSERT INTO daily_jobs (run_date, status, with_email_send, dry_run) VALUES (?, 'running', ?, ?)`
      )
      .run(today, withEmailSend ? 1 : 0, dryRun ? 1 : 0).lastInsertRowid;

    const startTime = Date.now();
    const results = {
      notifications_generated: 0,
      notifications_inserted: 0,
      email_jobs_generated: 0,
      email_jobs_inserted: 0,
      emails_sent: 0,
      emails_failed: 0,
    };
    const stepResults = {};
    let overallStatus = "success";
    let errorMessage = null;

    // Step 1: 通知候補生成
    try {
      const notifResult = generateAllNotifications({ today });
      results.notifications_generated = notifResult.total;
      results.notifications_inserted = notifResult.inserted;
      stepResults.notifications = { status: "success", ...notifResult };
    } catch (error) {
      overallStatus = "failed";
      errorMessage = `通知候補生成: ${error.message}`;
      stepResults.notifications = { status: "failed", error: error.message };
    }

    // Step 2: メールキュー生成
    if (overallStatus !== "failed") {
      try {
        const emailResult = generateEmailJobs();
        results.email_jobs_generated = emailResult.total;
        results.email_jobs_inserted = emailResult.inserted;
        stepResults.email_jobs = { status: "success", ...emailResult };
      } catch (error) {
        overallStatus = "partial_success";
        errorMessage = `メールキュー生成: ${error.message}`;
        stepResults.email_jobs = { status: "failed", error: error.message };
      }
    }

    // Step 3: メール送信（オプション）
    if (withEmailSend && overallStatus !== "failed") {
      try {
        const sendResult = await sendPendingEmailJobs({
          limit: limitEmails,
          dryRun,
        });
        results.emails_sent = sendResult.sent;
        results.emails_failed = sendResult.failed;
        stepResults.email_send = { status: "success", ...sendResult };

        if (sendResult.failed > 0 && overallStatus === "success") {
          overallStatus = "partial_success";
        }
      } catch (error) {
        if (overallStatus === "success") overallStatus = "partial_success";
        errorMessage = `メール送信: ${error.message}`;
        stepResults.email_send = { status: "failed", error: error.message };
      }
    } else {
      stepResults.email_send = { status: "skipped" };
    }

    const durationMs = Date.now() - startTime;

    // daily_jobs 更新
    db.prepare(
      `UPDATE daily_jobs SET
        status = ?, finished_at = datetime('now'), duration_ms = ?,
        notifications_generated = ?, notifications_inserted = ?,
        email_jobs_generated = ?, email_jobs_inserted = ?,
        emails_sent = ?, emails_failed = ?,
        summary_json = ?, error_message = ?
       WHERE id = ?`
    ).run(
      overallStatus,
      durationMs,
      results.notifications_generated,
      results.notifications_inserted,
      results.email_jobs_generated,
      results.email_jobs_inserted,
      results.emails_sent,
      results.emails_failed,
      JSON.stringify(stepResults),
      errorMessage,
      dailyJobId
    );

    return NextResponse.json({
      success: overallStatus !== "failed",
      dailyJobId: Number(dailyJobId),
      status: overallStatus,
      date: today,
      durationMs,
      ...results,
      stepResults,
      errorMessage,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
