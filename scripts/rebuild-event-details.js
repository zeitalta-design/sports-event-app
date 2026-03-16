/**
 * Phase56: marathon_details 一括構築スクリプト
 *
 * RUNNETイベントの詳細ページを再取得し、
 * 強化パーサーで抽出したデータを marathon_details に保存する。
 *
 * Usage:
 *   node scripts/rebuild-event-details.js                  # 未作成分のみ (上限20)
 *   node scripts/rebuild-event-details.js --all            # 全RUNNET
 *   node scripts/rebuild-event-details.js --limit 50       # 上限50件
 *   node scripts/rebuild-event-details.js --id 7           # events.id=7 のみ
 *   node scripts/rebuild-event-details.js --force          # 既存marathon_details も上書き
 *   node scripts/rebuild-event-details.js --dry-run        # DB書き込みなし
 */

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const webRequire = createRequire(
  path.join(__dirname, "..", "web", "package.json")
);
const Database = webRequire("better-sqlite3");

const { fetchDetail, DELAY_MS } = require("../scraper/runnet/fetch-detail");
const { parseDetail } = require("../scraper/runnet/parse-detail");

const DB_PATH = path.join(__dirname, "..", "web", "data", "sports-event.db");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDb() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { force: false, dryRun: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      options.limit = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === "--id" && args[i + 1]) {
      options.id = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === "--all") {
      options.limit = null;
    } else if (args[i] === "--force") {
      options.force = true;
    } else if (args[i] === "--dry-run") {
      options.dryRun = true;
    }
  }

  // Default limit
  if (!options.id && options.limit === undefined) {
    options.limit = 20;
  }

  return options;
}

/**
 * marathon_details に UPSERT
 */
function upsertMarathonDetails(db, eventId, data) {
  const now = new Date().toISOString();

  // marathon_details のカラム一覧 (id, marathon_id, created_at, updated_at 以外)
  const DETAIL_COLUMNS = [
    "tagline", "summary", "venue_name", "venue_address", "access_info",
    "application_start_at", "application_end_at", "registration_start_time",
    "payment_methods_json", "agent_entry_allowed", "entry_url", "official_url",
    "cancellation_policy", "event_scale_label", "level_labels_json",
    "features_json", "sports_category", "event_type_label", "measurement_method",
    "notes", "faq_json", "schedule_json", "distances_json", "pricing_json",
    "time_limits_json", "organizer_name", "organizer_contact_name",
    "organizer_email", "organizer_phone", "organizer_description",
    "organizer_review_score", "organizer_review_count", "series_events_json",
    "course_info", "map_url", "source_url", "services_json", "parking_info",
    // Phase55 新フィールド
    "registration_requirements_text", "health_management_text",
    "terms_text", "pledge_text", "refund_policy_text",
    "reception_place", "reception_time_text", "transit_text",
    "race_method_text", "cutoff_text", "timetable_text",
  ];

  // 既存レコードの確認
  const existing = db
    .prepare("SELECT id FROM marathon_details WHERE marathon_id = ?")
    .get(eventId);

  if (existing) {
    // UPDATE - 非null値のみ更新
    const sets = [];
    const values = { id: existing.id, updated_at: now };

    for (const col of DETAIL_COLUMNS) {
      if (data[col] !== undefined && data[col] !== null) {
        sets.push(`${col} = @${col}`);
        values[col] = data[col];
      }
    }

    if (sets.length === 0) return { action: "skip", fields: 0 };

    sets.push("updated_at = @updated_at");
    const sql = `UPDATE marathon_details SET ${sets.join(", ")} WHERE id = @id`;
    db.prepare(sql).run(values);
    return { action: "updated", fields: sets.length - 1 };
  } else {
    // INSERT
    const cols = ["marathon_id", "created_at", "updated_at"];
    const vals = [eventId, now, now];
    const placeholders = ["?", "?", "?"];

    for (const col of DETAIL_COLUMNS) {
      if (data[col] !== undefined && data[col] !== null) {
        cols.push(col);
        vals.push(data[col]);
        placeholders.push("?");
      }
    }

    const sql = `INSERT INTO marathon_details (${cols.join(", ")}) VALUES (${placeholders.join(", ")})`;
    db.prepare(sql).run(...vals);
    return { action: "inserted", fields: cols.length - 3 };
  }
}

async function main() {
  const options = parseArgs();

  console.log("=== Phase56: marathon_details Rebuild ===");
  console.log("Options:", JSON.stringify(options));
  console.log("");

  const db = getDb();

  // Ensure migrations run (trigger db.js init)
  try {
    // Run migrations by requiring db.js
    const initDb = require("../web/lib/db");
    if (typeof initDb.getDb === "function") {
      const webDb = initDb.getDb();
      webDb.close();
    }
  } catch (e) {
    // db.js is ESM, fallback: run migrations manually
    const migrations = [
      "ALTER TABLE marathon_details ADD COLUMN registration_requirements_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN health_management_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN terms_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN pledge_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN refund_policy_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN reception_place TEXT",
      "ALTER TABLE marathon_details ADD COLUMN reception_time_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN transit_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN race_method_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN cutoff_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN timetable_text TEXT",
    ];
    for (const sql of migrations) {
      try {
        db.exec(sql);
      } catch {
        // Column already exists — OK
      }
    }
  }

  // 1. Get target events
  console.log("[1/3] Getting target events...");
  let sql = `
    SELECT e.id, e.source_event_id, e.source_url, e.title
    FROM events e
    WHERE e.source_site = 'runnet'
      AND e.source_url IS NOT NULL
      AND e.is_active = 1
  `;
  const params = [];

  if (options.id) {
    sql += " AND e.id = ?";
    params.push(options.id);
  }

  if (!options.force) {
    sql += " AND e.id NOT IN (SELECT marathon_id FROM marathon_details WHERE summary IS NOT NULL)";
  }

  sql += " ORDER BY e.id";

  if (options.limit) {
    sql += " LIMIT ?";
    params.push(options.limit);
  }

  const targets = db.prepare(sql).all(...params);
  console.log(`  Found ${targets.length} events to process`);

  if (targets.length === 0) {
    console.log("No events to process. Done.");
    db.close();
    return;
  }

  // 2. Process each event
  console.log("\n[2/3] Fetching, parsing, and importing...");
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  let totalFields = 0;

  for (let i = 0; i < targets.length; i++) {
    const ev = targets[i];
    const prefix = `  [${i + 1}/${targets.length}]`;

    try {
      console.log(`${prefix} Fetching id=${ev.id} (${ev.title?.substring(0, 40)})`);
      const html = await fetchDetail(ev.source_url);
      console.log(`    HTML: ${html.length} bytes`);

      const parsed = parseDetail(html);
      const md = parsed.marathonDetails;

      // Set source_url
      md.source_url = ev.source_url;

      // Count non-null fields
      const fieldCount = Object.keys(md).filter(
        (k) => md[k] !== null && md[k] !== undefined
      ).length;

      if (fieldCount === 0) {
        console.log(`${prefix} SKIP: no marathon_details data extracted`);
        skipCount++;
      } else if (options.dryRun) {
        console.log(
          `${prefix} DRY-RUN: would upsert ${fieldCount} fields for id=${ev.id}`
        );
        successCount++;
        totalFields += fieldCount;
      } else {
        const result = upsertMarathonDetails(db, ev.id, md);
        console.log(
          `${prefix} ${result.action.toUpperCase()}: ${result.fields} fields`
        );
        successCount++;
        totalFields += result.fields;
      }

      // Also update events + event_races (existing behavior)
      if (!options.dryRun) {
        // Update events table
        const evFields = [];
        const evValues = { id: ev.id, updated_at: new Date().toISOString() };
        for (const [key, val] of Object.entries(parsed.eventUpdate)) {
          if (val !== undefined && val !== null) {
            evFields.push(`${key} = @${key}`);
            evValues[key] = val;
          }
        }
        evFields.push("updated_at = @updated_at");
        if (evFields.length > 1) {
          db.prepare(
            `UPDATE events SET ${evFields.join(", ")} WHERE id = @id`
          ).run(evValues);
        }

        // Update event_races
        if (parsed.races && parsed.races.length > 0) {
          const now = new Date().toISOString();
          db.prepare("DELETE FROM event_races WHERE event_id = ?").run(ev.id);
          const insertRace = db.prepare(`
            INSERT INTO event_races (
              event_id, race_name, race_type, distance_km,
              fee_min, fee_max, capacity, time_limit, start_time,
              eligibility, sort_order, created_at, updated_at
            ) VALUES (
              @event_id, @race_name, @race_type, @distance_km,
              @fee_min, @fee_max, @capacity, @time_limit, @start_time,
              @eligibility, @sort_order, @created_at, @updated_at
            )
          `);
          for (const race of parsed.races) {
            insertRace.run({
              event_id: ev.id,
              race_name: race.race_name,
              race_type: race.race_type || null,
              distance_km: race.distance_km || null,
              fee_min: race.fee_min || null,
              fee_max: race.fee_max || null,
              capacity: race.capacity || null,
              time_limit: race.time_limit || null,
              start_time: race.start_time || null,
              eligibility: race.eligibility || null,
              sort_order: race.sort_order || 0,
              created_at: now,
              updated_at: now,
            });
          }
        }
      }
    } catch (err) {
      console.error(`${prefix} ERROR: ${err.message}`);
      failCount++;
    }

    // Rate limiting
    if (i < targets.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // 3. Summary
  console.log("\n[3/3] Summary");
  const totalMd = db
    .prepare("SELECT COUNT(*) as c FROM marathon_details")
    .get().c;
  const totalEvents = db
    .prepare("SELECT COUNT(*) as c FROM events WHERE is_active = 1")
    .get().c;

  console.log(`  Processed: ${targets.length}`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Skipped: ${skipCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log(`  Total fields written: ${totalFields}`);
  console.log(`  marathon_details rows: ${totalMd} / ${totalEvents} events`);
  console.log("=== Done ===");

  db.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
