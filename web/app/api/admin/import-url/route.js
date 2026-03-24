import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isLlmAvailable } from "@/lib/llm-client";
import { structureMarathonDetailText } from "@/lib/marathon-detail-structurer";
import {
  isMoshicomUrl,
  fetchAndParseMoshicom,
} from "@/lib/moshicom-fetcher";
import {
  isRunnetUrl,
  fetchAndParseRunnet,
} from "@/lib/runnet-fetcher";
import {
  isSportsentryUrl,
  fetchAndParseSportsentry,
} from "@/lib/sportsentry-fetcher";
import { recordEntryStatusSnapshot } from "@/lib/entry-history";
import { getEntryUrgencyMeta } from "@/lib/entry-urgency";
import { getEntryHistorySummary } from "@/lib/entry-history";

/**
 * POST /api/admin/import-url
 *
 * moshicom / RUNNET URLから一括で events + event_races + marathon_details を登録/更新する。
 *
 * Body:
 *   url            - moshicom or RUNNET URL（必須）
 *   existingEventId - 既存大会IDに紐付ける場合のみ指定（任意）
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { url, existingEventId } = body;

    // ─── バリデーション ────────────────────

    if (!url || !url.trim()) {
      return NextResponse.json(
        { success: false, error: "URLを入力してください。", step: "validate" },
        { status: 400 }
      );
    }

    // ソース判定
    let sourceSite;
    if (isMoshicomUrl(url)) {
      sourceSite = "moshicom";
    } else if (isRunnetUrl(url)) {
      sourceSite = "runnet";
    } else if (isSportsentryUrl(url)) {
      sourceSite = "sportsentry";
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "moshicom.com / runnet.jp / sportsentry.ne.jp のURLを入力してください。",
          step: "validate",
        },
        { status: 400 }
      );
    }

    const llmAvailable = isLlmAvailable();

    // ─── Step 1: HTML取得 + パース ───────────

    let eventInfo, races, pageText;
    try {
      let result;
      if (sourceSite === "moshicom") {
        result = await fetchAndParseMoshicom(url);
      } else if (sourceSite === "runnet") {
        result = await fetchAndParseRunnet(url);
      } else {
        result = await fetchAndParseSportsentry(url);
      }
      eventInfo = result.eventInfo;
      races = result.races;
      pageText = result.pageText;
    } catch (err) {
      console.error("Fetch error:", err);
      return NextResponse.json(
        {
          success: false,
          error: `ページの取得に失敗しました: ${err.message}`,
          step: "fetch",
        },
        { status: 502 }
      );
    }

    if (!eventInfo.title) {
      return NextResponse.json(
        {
          success: false,
          error: "大会名を取得できませんでした。ページ構成が想定と異なる可能性があります。",
          step: "parse",
        },
        { status: 422 }
      );
    }

    // ─── Step 2: LLM構造化（利用可能な場合のみ） ────────────────

    let structureResult = null;
    let mergedDetail = {};

    if (llmAvailable) {
      try {
        structureResult = await structureMarathonDetailText({
          text: pageText,
          sourceUrl: url,
          sourceType: sourceSite,
          marathonName: eventInfo.title,
        });
        // Parser-LLMマージ
        mergedDetail = mergeParserWithLlm(eventInfo, structureResult.data);
      } catch (err) {
        console.error("Structure error:", err);
        // LLMエラーでも パーサー結果のみで続行
        mergedDetail = mergeParserWithLlm(eventInfo, {});
      }
    } else {
      // LLM未設定: パーサー抽出結果のみで保存
      mergedDetail = mergeParserWithLlm(eventInfo, {});
    }

    // ─── Step 3: DB保存 ─────────────────

    const db = getDb();
    const now = new Date().toISOString();

    let eventId;
    let action;

    try {
      if (existingEventId) {
        // ── 既存大会の更新 ──
        eventId = parseInt(existingEventId, 10);
        if (isNaN(eventId)) {
          return NextResponse.json(
            { success: false, error: "無効な大会IDです。", step: "save" },
            { status: 400 }
          );
        }

        const existing = db
          .prepare("SELECT id FROM events WHERE id = ?")
          .get(eventId);
        if (!existing) {
          return NextResponse.json(
            { success: false, error: `大会ID ${eventId} が見つかりません。`, step: "save" },
            { status: 404 }
          );
        }

        const doUpdate = db.transaction(() => {
          updateEvent(db, eventId, eventInfo, now);
          if (races.length > 0) {
            upsertRaces(db, eventId, races, now);
          }
          upsertMarathonDetails(db, eventId, mergedDetail, now);
        });

        doUpdate();
        action = "updated";
      } else {
        // ── 新規大会の作成 ──

        // 重複チェック（同じ source_site + source_event_id があれば更新）
        const duplicateCheck = db
          .prepare(
            "SELECT id FROM events WHERE source_site = ? AND source_event_id = ?"
          )
          .get(sourceSite, eventInfo.source_event_id);

        if (duplicateCheck) {
          eventId = duplicateCheck.id;

          const doUpdate = db.transaction(() => {
            updateEvent(db, eventId, eventInfo, now);
            if (races.length > 0) {
              upsertRaces(db, eventId, races, now);
            }
            upsertMarathonDetails(db, eventId, mergedDetail, now);
          });

          doUpdate();
          action = "updated";
        } else {
          const doCreate = db.transaction(() => {
            const insertResult = db
              .prepare(
                `INSERT INTO events (
                  source_site, source_event_id, title, normalized_title,
                  sport_type, sport_slug, prefecture, city, venue_name,
                  event_date, event_month, entry_status, source_url,
                  official_url, hero_image_url, description,
                  entry_start_date, entry_end_date,
                  is_active, scraped_at, created_at, updated_at
                ) VALUES (
                  @source_site, @source_event_id, @title, @normalized_title,
                  'marathon', 'marathon', @prefecture, @city, @venue_name,
                  @event_date, @event_month, @entry_status, @source_url,
                  @official_url, @hero_image_url, @description,
                  @entry_start_date, @entry_end_date,
                  1, @now, @now, @now
                )`
              )
              .run({
                source_site: sourceSite,
                source_event_id: eventInfo.source_event_id || null,
                title: eventInfo.title,
                normalized_title: eventInfo.normalized_title || eventInfo.title,
                prefecture: eventInfo.prefecture || null,
                city: eventInfo.city || null,
                venue_name: eventInfo.venue_name || null,
                event_date: eventInfo.event_date || null,
                event_month: eventInfo.event_month || null,
                entry_status: eventInfo.entry_status || "unknown",
                source_url: eventInfo.source_url || url,
                official_url: eventInfo.official_url || null,
                hero_image_url: eventInfo.hero_image_url || null,
                description: eventInfo.description || null,
                entry_start_date: eventInfo.entry_start_date || null,
                entry_end_date: eventInfo.entry_end_date || null,
                now,
              });

            eventId = insertResult.lastInsertRowid;

            if (races.length > 0) {
              insertRaces(db, eventId, races, now);
            }

            upsertMarathonDetails(db, eventId, mergedDetail, now);
          });

          doCreate();
          action = "created";
        }
      }
    } catch (err) {
      console.error("DB save error:", err);
      return NextResponse.json(
        {
          success: false,
          error: `データベース保存に失敗しました: ${err.message}`,
          step: "save",
        },
        { status: 500 }
      );
    }

    // ─── Step 4: 履歴スナップショット + 緊急度キャッシュ ───

    let historyResult = null;
    try {
      historyResult = recordEntryStatusSnapshot(eventId, {
        status: eventInfo.entry_status || "unknown",
        sourceType: "import",
        sourceUrl: url,
        entryOpenAt: eventInfo.entry_start_date || null,
        entryCloseAt: eventInfo.entry_end_date || null,
        eventDate: eventInfo.event_date || null,
        pageText: pageText,
        note: `${sourceSite} import`,
      });

      // 緊急度キャッシュを events テーブルに保存
      const summary = getEntryHistorySummary(eventId);
      const urgencyMeta = getEntryUrgencyMeta(
        {
          entry_status: eventInfo.entry_status,
          description: eventInfo.description,
          entry_signals_json: null,
        },
        summary
      );

      if (urgencyMeta.urgencyLabel) {
        db.prepare(
          "UPDATE events SET urgency_label = ?, urgency_level = ? WHERE id = ?"
        ).run(urgencyMeta.urgencyLabel, urgencyMeta.urgencyLevel, eventId);
      }

      // Phase37: last_verified_at を更新
      db.prepare(
        "UPDATE events SET last_verified_at = ? WHERE id = ?"
      ).run(new Date().toISOString(), eventId);
    } catch (err) {
      console.warn("Entry history/urgency update failed (non-fatal):", err.message);
    }

    // ─── レスポンス ─────────────────────

    return NextResponse.json({
      success: true,
      eventId,
      action,
      title: eventInfo.title,
      sourceSite,
      racesCount: races.length,
      hasDetail: true,
      structureResult: structureResult
        ? {
            model: structureResult.model,
            usage: structureResult.usage,
            validation: structureResult.validation,
          }
        : { model: "parser-only", usage: null, validation: null },
      entryHistory: historyResult
        ? {
            inserted: historyResult.inserted,
            signalsDetected: historyResult.signals.map((s) => s.label),
            closeReason: historyResult.closeReason,
          }
        : null,
    });
  } catch (err) {
    console.error("Import URL error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "インポート処理でエラーが発生しました。",
        step: "unknown",
      },
      { status: 500 }
    );
  }
}

// ─── Parser-LLM マージ ──────────────────────

/**
 * parser抽出値を優先し、LLM値で補完するマージ
 * 確定的データ（日付・URL・主催者連絡先等）はparser優先
 * 自由テキスト（summary・FAQ等）はLLM優先
 */
function mergeParserWithLlm(eventInfo, llmData) {
  const merged = { ...llmData };

  // parser優先フィールド（確定的データ）
  const parserPriorityMap = {
    application_start_at: eventInfo.entry_start_date,
    application_end_at: eventInfo.entry_end_date,
    venue_name: eventInfo.venue_name,
    venue_address: eventInfo.venue_address,
    official_url: eventInfo.official_url,
    organizer_name: eventInfo.organizer_name,
    organizer_phone: eventInfo.organizer_phone,
    organizer_email: eventInfo.organizer_email,
  };

  for (const [key, parserValue] of Object.entries(parserPriorityMap)) {
    if (parserValue) {
      merged[key] = parserValue;
    }
  }

  return merged;
}

// ─── DB ヘルパー関数 ──────────────────────

function updateEvent(db, eventId, eventInfo, now) {
  const fields = [];
  const values = { id: eventId, updated_at: now, scraped_at: now };

  const updateFields = [
    "title", "normalized_title", "prefecture", "city", "venue_name",
    "event_date", "event_month", "entry_status", "source_url",
    "official_url", "hero_image_url", "description",
    "entry_start_date", "entry_end_date",
  ];

  for (const key of updateFields) {
    if (eventInfo[key] !== undefined && eventInfo[key] !== null) {
      fields.push(`${key} = @${key}`);
      values[key] = eventInfo[key];
    }
  }

  fields.push("updated_at = @updated_at", "scraped_at = @scraped_at");

  if (fields.length > 0) {
    db.prepare(`UPDATE events SET ${fields.join(", ")} WHERE id = @id`).run(
      values
    );
  }
}

function insertRaces(db, eventId, races, now) {
  const insertRace = db.prepare(`
    INSERT INTO event_races (
      event_id, race_name, race_type, distance_km,
      fee_min, fee_max, capacity, time_limit, start_time,
      eligibility, category, note, sort_order, created_at, updated_at
    ) VALUES (
      @event_id, @race_name, @race_type, @distance_km,
      @fee_min, @fee_max, @capacity, @time_limit, @start_time,
      @eligibility, @category, @note, @sort_order, @created_at, @updated_at
    )
  `);

  for (const race of races) {
    insertRace.run({
      event_id: eventId,
      race_name: race.race_name,
      race_type: race.race_type || null,
      distance_km: race.distance_km || null,
      fee_min: race.fee_min || null,
      fee_max: race.fee_max || null,
      capacity: race.capacity || null,
      time_limit: race.time_limit || null,
      start_time: race.start_time || null,
      eligibility: race.eligibility || null,
      category: race.category || null,
      note: race.note || null,
      sort_order: race.sort_order || 0,
      created_at: now,
      updated_at: now,
    });
  }
}

function upsertRaces(db, eventId, races, now) {
  db.prepare("DELETE FROM event_races WHERE event_id = ?").run(eventId);
  insertRaces(db, eventId, races, now);
}

function upsertMarathonDetails(db, eventId, structuredData, now) {
  const existing = db
    .prepare("SELECT id FROM marathon_details WHERE marathon_id = ?")
    .get(eventId);

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
    "services_json", "parking_info",
  ];

  function normalizeValue(val) {
    if (val === undefined || val === "") return null;
    if (val === true || val === "true") return 1;
    if (val === false || val === "false") return 0;
    return val;
  }

  if (existing) {
    const setClauses = editableColumns
      .map((col) => `${col} = ?`)
      .concat("updated_at = ?");
    const values = editableColumns.map((col) =>
      normalizeValue(structuredData[col])
    );
    values.push(now);

    db.prepare(
      `UPDATE marathon_details SET ${setClauses.join(", ")} WHERE marathon_id = ?`
    ).run(...values, eventId);
  } else {
    const columns = [
      "marathon_id",
      ...editableColumns,
      "created_at",
      "updated_at",
    ];
    const placeholders = columns.map(() => "?").join(", ");
    const values = [
      eventId,
      ...editableColumns.map((col) => normalizeValue(structuredData[col])),
      now,
      now,
    ];

    db.prepare(
      `INSERT INTO marathon_details (${columns.join(", ")}) VALUES (${placeholders})`
    ).run(...values);
  }
}
