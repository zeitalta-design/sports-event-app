/**
 * RUNNET × MOSHICOM データ統合サービス
 *
 * RUNNETイベントにMOSHICOMデータを統合し、情報精度を最大化する。
 * フィールド別の優先順位ルールに従いマージ。
 */

import { getDb } from "@/lib/db";
import { fetchAndParseMoshicom } from "@/lib/moshicom-fetcher";
import { isLlmAvailable } from "@/lib/llm-client";
import { structureMarathonDetailText } from "@/lib/marathon-detail-structurer";

// ─── フィールド別優先ルール ──────────────────

/**
 * MOSHICOM優先フィールド
 * MOSHICOMのデータがあればそちらを採用
 */
const MOSHICOM_PRIORITY_FIELDS = [
  "venue_name",
  "venue_address",
  "access_info",
  "summary",
  "schedule_json",
  "pricing_json",
  "services_json",
  "parking_info",
  "course_info",
  "faq_json",
  "map_url",
  "cancellation_policy",
  "features_json",
  "organizer_name",
  "organizer_phone",
  "organizer_email",
  "organizer_description",
];

/**
 * RUNNET優先フィールド（MOSHICOMで上書きしない）
 */
const RUNNET_PRIORITY_FIELDS = [
  "entry_status",
  "title",
  "normalized_title",
  "event_date",
  "source_url",
  "source_event_id",
  "source_site",
];

// ─── 差分検知 ─────────────────────────

/**
 * RUNNETデータとMOSHICOMデータの差分を検出
 *
 * @param {object} currentEvent - 現在のeventsレコード
 * @param {object} currentDetail - 現在のmarathon_detailsレコード
 * @param {object} moshicomEventInfo - MOSHICOM parser結果
 * @param {object} moshicomRaces - MOSHICOMレース情報
 * @returns {object} { diffs: [{field, current, moshicom, priority}], hasDiff }
 */
export function detectDifferences(currentEvent, currentDetail, moshicomEventInfo, moshicomRaces) {
  const diffs = [];

  // venue_name
  const currentVenue = currentDetail?.venue_name || currentEvent?.venue_name || "";
  const moshicomVenue = moshicomEventInfo?.venue_name || "";
  if (moshicomVenue && moshicomVenue !== currentVenue) {
    diffs.push({
      field: "venue_name",
      label: "会場名",
      current: currentVenue,
      moshicom: moshicomVenue,
      priority: "moshicom",
    });
  }

  // description
  const currentDesc = currentEvent?.description || "";
  const moshicomDesc = moshicomEventInfo?.description || "";
  if (moshicomDesc && moshicomDesc.length > currentDesc.length) {
    diffs.push({
      field: "description",
      label: "説明文",
      current: currentDesc.substring(0, 80) + (currentDesc.length > 80 ? "..." : ""),
      moshicom: moshicomDesc.substring(0, 80) + (moshicomDesc.length > 80 ? "..." : ""),
      priority: "moshicom",
    });
  }

  // event_date
  if (moshicomEventInfo?.event_date && currentEvent?.event_date) {
    if (moshicomEventInfo.event_date !== currentEvent.event_date) {
      diffs.push({
        field: "event_date",
        label: "開催日",
        current: currentEvent.event_date,
        moshicom: moshicomEventInfo.event_date,
        priority: "runnet",
      });
    }
  }

  // races（fee比較）
  if (moshicomRaces?.length > 0) {
    const db = getDb();
    const currentRaces = db
      .prepare("SELECT race_name, fee_min, fee_max FROM event_races WHERE event_id = ?")
      .all(currentEvent?.id);

    if (currentRaces.length > 0) {
      const currentMinFee = Math.min(...currentRaces.filter((r) => r.fee_min).map((r) => r.fee_min));
      const moshicomMinFee = Math.min(...moshicomRaces.filter((r) => r.fee_min).map((r) => r.fee_min));

      if (isFinite(currentMinFee) && isFinite(moshicomMinFee) && currentMinFee !== moshicomMinFee) {
        diffs.push({
          field: "fee_min",
          label: "最低参加費",
          current: `¥${currentMinFee.toLocaleString()}`,
          moshicom: `¥${moshicomMinFee.toLocaleString()}`,
          priority: "moshicom",
        });
      }
    }
  }

  return {
    diffs,
    hasDiff: diffs.length > 0,
    fee_diff: diffs.some((d) => d.field === "fee_min"),
    venue_diff: diffs.some((d) => d.field === "venue_name"),
    date_diff: diffs.some((d) => d.field === "event_date"),
  };
}

// ─── メインマージ処理 ─────────────────────

/**
 * MOSHICOMデータでRUNNETイベントを強化
 *
 * @param {number} eventId - 対象events.id
 * @param {string} moshicomUrl - MOSHICOM URL
 * @param {object} options - { useLlm: true, dryRun: false }
 * @returns {Promise<object>} マージ結果
 */
export async function mergeSourceData(eventId, moshicomUrl, options = {}) {
  const { useLlm = true, dryRun = false } = options;
  const db = getDb();
  const now = new Date().toISOString();

  // 1. 現在のデータ取得
  const currentEvent = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
  if (!currentEvent) {
    throw new Error(`Event ID ${eventId} not found`);
  }

  const currentDetail = db
    .prepare("SELECT * FROM marathon_details WHERE marathon_id = ?")
    .get(eventId);

  // 2. MOSHICOM取得・パース
  let moshicomData;
  try {
    moshicomData = await fetchAndParseMoshicom(moshicomUrl);
  } catch (err) {
    throw new Error(`MOSHICOM fetch failed: ${err.message}`);
  }

  const { eventInfo: moshicomEventInfo, races: moshicomRaces, pageText } = moshicomData;

  // 3. LLM構造化（オプション）
  let llmStructured = null;
  if (useLlm && isLlmAvailable() && pageText) {
    try {
      const result = await structureMarathonDetailText({
        text: pageText,
        sourceUrl: moshicomUrl,
        sourceType: "moshicom",
        marathonName: currentEvent.title,
      });
      llmStructured = result.data;
    } catch (err) {
      console.warn("LLM structuring failed (non-fatal):", err.message);
    }
  }

  // 4. 差分検知
  const differences = detectDifferences(currentEvent, currentDetail, moshicomEventInfo, moshicomRaces);

  if (dryRun) {
    return {
      eventId,
      eventTitle: currentEvent.title,
      moshicomUrl,
      moshicomTitle: moshicomEventInfo.title,
      moshicomRacesCount: moshicomRaces.length,
      differences,
      llmAvailable: !!llmStructured,
      dryRun: true,
    };
  }

  // 5. マージ実行（トランザクション）
  const doMerge = db.transaction(() => {
    // 5a. events テーブル更新（MOSHICOM優先フィールドのみ）
    const eventUpdates = {};
    if (moshicomEventInfo.venue_name && !currentEvent.venue_name) {
      eventUpdates.venue_name = moshicomEventInfo.venue_name;
    }
    if (moshicomEventInfo.description && (!currentEvent.description || moshicomEventInfo.description.length > currentEvent.description.length)) {
      eventUpdates.description = moshicomEventInfo.description;
    }
    if (moshicomEventInfo.official_url && !currentEvent.official_url) {
      eventUpdates.official_url = moshicomEventInfo.official_url;
    }

    if (Object.keys(eventUpdates).length > 0) {
      const setClauses = Object.keys(eventUpdates).map((k) => `${k} = ?`);
      setClauses.push("updated_at = ?");
      const values = [...Object.values(eventUpdates), now, eventId];
      db.prepare(`UPDATE events SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);
    }

    // 5b. marathon_details 更新
    if (currentDetail) {
      const detailUpdates = {};

      // MOSHICOM parser結果からMOSHICOM優先フィールドを統合
      for (const field of MOSHICOM_PRIORITY_FIELDS) {
        const moshicomVal = moshicomEventInfo[field] || (llmStructured ? llmStructured[field] : null);
        if (moshicomVal && !currentDetail[field]) {
          detailUpdates[field] = typeof moshicomVal === "object" ? JSON.stringify(moshicomVal) : moshicomVal;
        }
      }

      // LLM構造化結果から追加フィールドを補完
      if (llmStructured) {
        const llmFields = [
          "tagline", "summary", "course_info", "cancellation_policy",
          "faq_json", "schedule_json", "time_limits_json",
          "registration_requirements_text", "health_management_text",
          "terms_text", "reception_place", "reception_time_text",
          "transit_text", "race_method_text", "cutoff_text",
        ];
        for (const field of llmFields) {
          if (llmStructured[field] && !currentDetail[field]) {
            detailUpdates[field] = typeof llmStructured[field] === "object"
              ? JSON.stringify(llmStructured[field])
              : llmStructured[field];
          }
        }
      }

      // source_priority, source_updated_at, moshicom_url
      detailUpdates.source_priority = "moshicom";
      detailUpdates.source_updated_at = now;
      detailUpdates.moshicom_url = moshicomUrl;

      const setClauses = Object.keys(detailUpdates).map((k) => `${k} = ?`);
      setClauses.push("updated_at = ?");
      const values = [...Object.values(detailUpdates), now, eventId];
      db.prepare(`UPDATE marathon_details SET ${setClauses.join(", ")} WHERE marathon_id = ?`).run(...values);
    } else {
      // marathon_details がない場合は新規作成
      db.prepare(`
        INSERT INTO marathon_details (marathon_id, source_priority, source_updated_at, moshicom_url, source_url, created_at, updated_at)
        VALUES (?, 'moshicom', ?, ?, ?, ?, ?)
      `).run(eventId, now, moshicomUrl, moshicomUrl, now, now);
    }

    // 5c. event_races 補完（MOSHICOM優先: 既存raceにfee_minがない場合のみ補完）
    if (moshicomRaces.length > 0) {
      const existingRaces = db
        .prepare("SELECT * FROM event_races WHERE event_id = ?")
        .all(eventId);

      if (existingRaces.length === 0) {
        // レースがなければMOSHICOMから全追加
        const insertRace = db.prepare(`
          INSERT INTO event_races (event_id, race_name, race_type, distance_km, fee_min, fee_max, capacity, time_limit, start_time, eligibility, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const race of moshicomRaces) {
          insertRace.run(
            eventId, race.race_name, race.race_type, race.distance_km,
            race.fee_min, race.fee_max, race.capacity, race.time_limit,
            race.start_time, race.eligibility, race.sort_order || 0, now, now
          );
        }
      } else {
        // 既存raceのfee_min/fee_maxを補完
        for (const existing of existingRaces) {
          if (existing.fee_min) continue; // 既にある場合はスキップ

          // distance_kmまたはrace_nameで対応するMOSHICOMレースを探す
          const matchRace = moshicomRaces.find((mr) => {
            if (existing.distance_km && mr.distance_km) {
              return Math.abs(existing.distance_km - mr.distance_km) < 0.5;
            }
            if (existing.race_name && mr.race_name) {
              return existing.race_name.includes(mr.race_name) || mr.race_name.includes(existing.race_name);
            }
            return false;
          });

          if (matchRace && matchRace.fee_min) {
            db.prepare(
              "UPDATE event_races SET fee_min = ?, fee_max = ?, updated_at = ? WHERE id = ?"
            ).run(matchRace.fee_min, matchRace.fee_max || matchRace.fee_min, now, existing.id);
          }
        }
      }
    }

    // 5d. event_source_links にMOSHICOM追加
    const existingLink = db
      .prepare("SELECT id FROM event_source_links WHERE event_id = ? AND source_url = ?")
      .get(eventId, moshicomUrl);

    if (!existingLink) {
      db.prepare(`
        INSERT INTO event_source_links (event_id, source_type, source_url, source_event_id, is_primary, is_active, note, created_at, updated_at)
        VALUES (?, 'moshicom', ?, ?, 0, 1, 'auto-merged', ?, ?)
      `).run(eventId, moshicomUrl, moshicomEventInfo.source_event_id || null, now, now);
    }

    // RUNNETリンクも登録（なければ）
    if (currentEvent.source_url) {
      const runnetLink = db
        .prepare("SELECT id FROM event_source_links WHERE event_id = ? AND source_type = 'runnet'")
        .get(eventId);
      if (!runnetLink) {
        db.prepare(`
          INSERT INTO event_source_links (event_id, source_type, source_url, source_event_id, is_primary, is_active, note, created_at, updated_at)
          VALUES (?, 'runnet', ?, ?, 1, 1, 'primary source', ?, ?)
        `).run(eventId, currentEvent.source_url, currentEvent.source_event_id, now, now);
      }
    }
  });

  doMerge();

  return {
    eventId,
    eventTitle: currentEvent.title,
    moshicomUrl,
    moshicomTitle: moshicomEventInfo.title,
    moshicomRacesCount: moshicomRaces.length,
    differences,
    fieldsUpdated: differences.diffs.filter((d) => d.priority === "moshicom").length,
    llmUsed: !!llmStructured,
    dryRun: false,
  };
}
