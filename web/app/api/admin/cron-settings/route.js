import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 自動巡回設定 API
 * GET  /api/admin/cron-settings — 全カテゴリの設定一覧
 * POST /api/admin/cron-settings — 設定の作成・更新
 */

function ensureTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS cron_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain_id TEXT NOT NULL UNIQUE,
      enabled INTEGER DEFAULT 0,
      schedule_hour INTEGER DEFAULT 3,
      targets TEXT DEFAULT '[]',
      notify_on_complete INTEGER DEFAULT 0,
      last_run_at TEXT,
      last_run_result TEXT,
      last_run_items INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  return db;
}

const DOMAINS = [
  { id: "gyosei-shobun", label: "行政処分", targets: ["mlit", "prefecture"] },
  { id: "sanpai", label: "産廃処分", targets: ["sanpai_sync"] },
  { id: "nyusatsu", label: "入札", targets: ["nyusatsu_sync"] },
  { id: "shitei", label: "指定管理", targets: ["shitei_sync"] },
  { id: "hojokin", label: "補助金", targets: ["hojokin_sync"] },
  { id: "kyoninka", label: "許認可", targets: ["kyoninka_sync"] },
];

export async function GET() {
  try {
    const db = ensureTable();
    const rows = db.prepare("SELECT * FROM cron_settings ORDER BY domain_id").all();

    // 全カテゴリ分を返す（未登録カテゴリはデフォルト値で埋める）
    const settings = DOMAINS.map((d) => {
      const existing = rows.find((r) => r.domain_id === d.id);
      if (existing) {
        return {
          ...existing,
          label: d.label,
          availableTargets: d.targets,
          targets: JSON.parse(existing.targets || "[]"),
          enabled: !!existing.enabled,
          notify_on_complete: !!existing.notify_on_complete,
        };
      }
      return {
        domain_id: d.id,
        label: d.label,
        enabled: false,
        schedule_hour: 3,
        targets: d.targets,
        availableTargets: d.targets,
        notify_on_complete: false,
        last_run_at: null,
        last_run_result: null,
        last_run_items: 0,
      };
    });

    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const db = ensureTable();
    const body = await request.json();
    const { domain_id, enabled, schedule_hour, targets, notify_on_complete } = body;

    if (!domain_id) {
      return NextResponse.json({ error: "domain_id が必要です" }, { status: 400 });
    }

    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    const targetsJson = JSON.stringify(targets || []);

    // UPSERT
    db.prepare(`
      INSERT INTO cron_settings (domain_id, enabled, schedule_hour, targets, notify_on_complete, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(domain_id) DO UPDATE SET
        enabled = excluded.enabled,
        schedule_hour = excluded.schedule_hour,
        targets = excluded.targets,
        notify_on_complete = excluded.notify_on_complete,
        updated_at = excluded.updated_at
    `).run(
      domain_id,
      enabled ? 1 : 0,
      schedule_hour ?? 3,
      targetsJson,
      notify_on_complete ? 1 : 0,
      now,
      now,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
