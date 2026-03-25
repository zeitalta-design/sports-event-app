import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getDb } from "@/lib/db";

/**
 * GET /api/admin/marathon-details/[id]
 * 大会の基本情報 + marathon_details を取得
 */
export async function GET(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const marathonId = parseInt(id, 10);
    if (isNaN(marathonId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const db = getDb();

    const event = db
      .prepare(
        `SELECT id, title, event_date, event_month, prefecture, city,
                venue_name, entry_status, source_url, official_url, description
         FROM events WHERE id = ?`
      )
      .get(marathonId);

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const detail = db
      .prepare("SELECT * FROM marathon_details WHERE marathon_id = ?")
      .get(marathonId);

    return NextResponse.json({
      event,
      detail: detail || null,
      has_detail: !!detail,
    });
  } catch (err) {
    console.error("Admin marathon-detail get error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/marathon-details/[id]
 * marathon_details の upsert（新規作成 or 更新）
 */
export async function PUT(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const marathonId = parseInt(id, 10);
    if (isNaN(marathonId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();

    const db = getDb();

    // 対象大会の存在確認
    const event = db
      .prepare("SELECT id FROM events WHERE id = ?")
      .get(marathonId);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // JSON項目のバリデーション
    const jsonFields = [
      "payment_methods_json",
      "level_labels_json",
      "features_json",
      "pricing_json",
      "schedule_json",
      "time_limits_json",
      "faq_json",
      "series_events_json",
      "distances_json",
    ];

    for (const field of jsonFields) {
      if (body[field] !== undefined && body[field] !== null && body[field] !== "") {
        try {
          JSON.parse(body[field]);
        } catch {
          return NextResponse.json(
            { error: `${field} のJSON形式が不正です`, field },
            { status: 400 }
          );
        }
      }
    }

    // 既存レコードの確認
    const existing = db
      .prepare("SELECT id FROM marathon_details WHERE marathon_id = ?")
      .get(marathonId);

    const now = new Date().toISOString();

    // 保存対象のカラム（marathon_id, id, created_at, updated_at を除く）
    const editableColumns = [
      "tagline", "summary", "venue_name", "venue_address", "access_info",
      "application_start_at", "application_end_at", "registration_start_time",
      "payment_methods_json", "agent_entry_allowed", "entry_url", "official_url",
      "cancellation_policy", "event_scale_label", "level_labels_json",
      "features_json", "sports_category", "event_type_label",
      "measurement_method", "notes", "faq_json", "schedule_json",
      "distances_json", "pricing_json", "time_limits_json",
      "organizer_name", "organizer_contact_name", "organizer_email",
      "organizer_phone", "organizer_description", "organizer_review_score",
      "organizer_review_count", "series_events_json", "course_info",
      "map_url", "source_url",
    ];

    if (existing) {
      // UPDATE
      const setClauses = editableColumns
        .map((col) => `${col} = ?`)
        .concat("updated_at = ?");
      const values = editableColumns.map((col) => normalizeValue(body[col]));
      values.push(now);

      db.prepare(
        `UPDATE marathon_details SET ${setClauses.join(", ")} WHERE marathon_id = ?`
      ).run(...values, marathonId);
    } else {
      // INSERT
      const columns = ["marathon_id", ...editableColumns, "created_at", "updated_at"];
      const placeholders = columns.map(() => "?").join(", ");
      const values = [
        marathonId,
        ...editableColumns.map((col) => normalizeValue(body[col])),
        now,
        now,
      ];

      db.prepare(
        `INSERT INTO marathon_details (${columns.join(", ")}) VALUES (${placeholders})`
      ).run(...values);
    }

    // 保存後のデータを返す
    const updated = db
      .prepare("SELECT * FROM marathon_details WHERE marathon_id = ?")
      .get(marathonId);

    return NextResponse.json({
      success: true,
      detail: updated,
      action: existing ? "updated" : "created",
    });
  } catch (err) {
    console.error("Admin marathon-detail upsert error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}

/**
 * 値の正規化
 * - 空文字列 → null
 * - "true"/"false" → 1/0（agent_entry_allowed用）
 */
function normalizeValue(val) {
  if (val === undefined || val === "") return null;
  if (val === true || val === "true") return 1;
  if (val === false || val === "false") return 0;
  return val;
}
