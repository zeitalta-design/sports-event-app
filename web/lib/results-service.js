import { getDb } from "./db.js";

/**
 * Phase148: 大会結果サービス
 *
 * プライバシーファースト設計:
 * - 公開APIでは個人名を一切返さない
 * - runner_name_hash は内部照合専用、APIレスポンスに含めない
 * - ユーザー紐付け（user_results）はログインユーザー本人のみ閲覧可
 * - ゼッケン番号(bib_number)のみ公開識別子として使用
 */

// ---------------------------------------------------------------------------
// 公開: 大会結果一覧（匿名化済み）
// ---------------------------------------------------------------------------

/**
 * 大会の公開結果一覧を取得（匿名）
 * @param {number} eventId
 * @param {object} opts
 * @returns {{ results: object[], total: number }}
 */
export function getEventResults(eventId, { year, category, gender, ageGroup, limit = 50, offset = 0 } = {}) {
  const db = getDb();

  let where = "er.event_id = ? AND er.is_public = 1";
  const params = [eventId];

  if (year) {
    where += " AND er.result_year = ?";
    params.push(year);
  }
  if (category) {
    where += " AND er.category_name = ?";
    params.push(category);
  }
  if (gender) {
    where += " AND er.gender = ?";
    params.push(gender);
  }
  if (ageGroup) {
    where += " AND er.age_group = ?";
    params.push(ageGroup);
  }

  // 公開カラムのみ — runner_name_hash は除外
  const rows = db.prepare(`
    SELECT
      er.id,
      er.event_id,
      er.result_year,
      er.bib_number,
      er.overall_rank,
      er.gender_rank,
      er.age_rank,
      er.finish_time,
      er.net_time,
      er.category_name,
      er.gender,
      er.age_group,
      er.finish_status,
      er.sport_type
    FROM event_results er
    WHERE ${where}
    ORDER BY er.overall_rank ASC NULLS LAST, er.finish_time ASC NULLS LAST
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const countRow = db.prepare(`
    SELECT COUNT(*) as cnt FROM event_results er WHERE ${where}
  `).get(...params);

  return { results: rows, total: countRow?.cnt || 0 };
}

/**
 * 大会結果で使用可能な年度一覧
 */
export function getEventResultYears(eventId) {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT result_year
    FROM event_results
    WHERE event_id = ? AND is_public = 1 AND result_year IS NOT NULL
    ORDER BY result_year DESC
  `).all(eventId).map((r) => r.result_year);
}

/**
 * 大会結果で使用可能なカテゴリ一覧
 */
export function getEventResultCategories(eventId, year) {
  const db = getDb();
  let sql = `
    SELECT DISTINCT category_name
    FROM event_results
    WHERE event_id = ? AND is_public = 1 AND category_name IS NOT NULL
  `;
  const params = [eventId];
  if (year) {
    sql += " AND result_year = ?";
    params.push(year);
  }
  sql += " ORDER BY category_name";
  return db.prepare(sql).all(...params).map((r) => r.category_name);
}

// ---------------------------------------------------------------------------
// 公開: 結果サマリー（統計）
// ---------------------------------------------------------------------------

/**
 * 大会結果のサマリー統計を生成
 * @returns {{ finisher_count, dnf_count, completion_rate, avg_time, fastest_time, categories, gender_breakdown }}
 */
export function getEventResultsSummary(eventId, year) {
  const db = getDb();

  let where = "event_id = ? AND is_public = 1";
  const params = [eventId];
  if (year) {
    where += " AND result_year = ?";
    params.push(year);
  }

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN finish_status = 'finished' THEN 1 ELSE 0 END) as finisher_count,
      SUM(CASE WHEN finish_status = 'dnf' THEN 1 ELSE 0 END) as dnf_count,
      SUM(CASE WHEN finish_status = 'dns' THEN 1 ELSE 0 END) as dns_count,
      MIN(CASE WHEN finish_status = 'finished' AND finish_time IS NOT NULL THEN finish_time END) as fastest_time,
      MIN(CASE WHEN finish_status = 'finished' AND net_time IS NOT NULL THEN net_time END) as fastest_net_time
    FROM event_results
    WHERE ${where}
  `).get(...params);

  if (!stats || stats.total === 0) return null;

  // 完走率
  const completionRate = stats.total > 0
    ? Math.round((stats.finisher_count / stats.total) * 100)
    : 0;

  // カテゴリ別集計
  const categories = db.prepare(`
    SELECT
      category_name,
      COUNT(*) as count,
      SUM(CASE WHEN finish_status = 'finished' THEN 1 ELSE 0 END) as finished,
      MIN(CASE WHEN finish_status = 'finished' AND finish_time IS NOT NULL THEN finish_time END) as fastest
    FROM event_results
    WHERE ${where} AND category_name IS NOT NULL
    GROUP BY category_name
    ORDER BY count DESC
  `).all(...params);

  // 性別別集計
  const genderBreakdown = db.prepare(`
    SELECT
      gender,
      COUNT(*) as count,
      SUM(CASE WHEN finish_status = 'finished' THEN 1 ELSE 0 END) as finished
    FROM event_results
    WHERE ${where} AND gender IS NOT NULL
    GROUP BY gender
    ORDER BY count DESC
  `).all(...params);

  return {
    total: stats.total,
    finisher_count: stats.finisher_count,
    dnf_count: stats.dnf_count,
    dns_count: stats.dns_count,
    completion_rate: completionRate,
    fastest_time: stats.fastest_time,
    fastest_net_time: stats.fastest_net_time,
    categories,
    gender_breakdown: genderBreakdown,
  };
}

// ---------------------------------------------------------------------------
// ユーザー: 結果紐付け
// ---------------------------------------------------------------------------

/**
 * ゼッケン番号で結果を検索（紐付け候補）
 * 本人確認用: bib_number + event_id + year で検索
 */
export function findResultByBib(eventId, bibNumber, year) {
  const db = getDb();
  let where = "event_id = ? AND bib_number = ?";
  const params = [eventId, bibNumber];
  if (year) {
    where += " AND result_year = ?";
    params.push(year);
  }

  return db.prepare(`
    SELECT
      id, event_id, result_year, bib_number,
      overall_rank, gender_rank, age_rank,
      finish_time, net_time, category_name,
      gender, age_group, finish_status, sport_type
    FROM event_results
    WHERE ${where}
    LIMIT 1
  `).get(...params) || null;
}

/**
 * ユーザーの結果紐付けを作成
 * @returns {{ success: boolean, error?: string }}
 */
export function linkUserResult(userId, resultId, eventId) {
  const db = getDb();

  // 結果が存在するか確認
  const result = db.prepare("SELECT id FROM event_results WHERE id = ? AND event_id = ?").get(resultId, eventId);
  if (!result) return { success: false, error: "result_not_found" };

  // 既に紐付け済みか確認
  const existing = db.prepare(
    "SELECT id FROM user_results WHERE user_id = ? AND result_id = ?"
  ).get(userId, resultId);
  if (existing) return { success: false, error: "already_linked" };

  // 同一大会・同年度で既に別の結果を紐付け済みか確認
  const sameEvent = db.prepare(`
    SELECT ur.id FROM user_results ur
    JOIN event_results er ON ur.result_id = er.id
    WHERE ur.user_id = ? AND ur.event_id = ?
      AND er.result_year = (SELECT result_year FROM event_results WHERE id = ?)
  `).get(userId, eventId, resultId);
  if (sameEvent) return { success: false, error: "same_event_year_linked" };

  try {
    db.prepare(`
      INSERT INTO user_results (user_id, result_id, event_id)
      VALUES (?, ?, ?)
    `).run(userId, resultId, eventId);
    return { success: true };
  } catch (err) {
    if (err.message?.includes("UNIQUE")) {
      return { success: false, error: "already_linked" };
    }
    throw err;
  }
}

/**
 * ユーザーの紐付け解除
 */
export function unlinkUserResult(userId, resultId) {
  const db = getDb();
  const info = db.prepare(
    "DELETE FROM user_results WHERE user_id = ? AND result_id = ?"
  ).run(userId, resultId);
  return { success: info.changes > 0 };
}

// ---------------------------------------------------------------------------
// ユーザー: My Results（個人履歴）
// ---------------------------------------------------------------------------

/**
 * ユーザーの全結果を取得（本人のみ閲覧可）
 */
export function getUserResults(userId) {
  const db = getDb();
  return db.prepare(`
    SELECT
      ur.id as link_id,
      ur.verified,
      ur.created_at as linked_at,
      er.id as result_id,
      er.event_id,
      er.result_year,
      er.bib_number,
      er.overall_rank,
      er.gender_rank,
      er.age_rank,
      er.finish_time,
      er.net_time,
      er.category_name,
      er.gender,
      er.age_group,
      er.finish_status,
      er.sport_type,
      e.title as event_title,
      e.event_date,
      e.prefecture,
      e.area
    FROM user_results ur
    JOIN event_results er ON ur.result_id = er.id
    JOIN events e ON ur.event_id = e.id
    ORDER BY er.result_year DESC, e.event_date DESC
  `).all(userId);
}

/**
 * ユーザーのPB（自己ベスト）を距離別に取得
 */
export function getUserPBs(userId) {
  const db = getDb();

  // カテゴリ（≒距離）別の最速タイム
  const results = getUserResults(userId);
  const pbMap = {};

  for (const r of results) {
    if (r.finish_status !== "finished" || !r.finish_time) continue;
    const cat = r.category_name || "不明";
    if (!pbMap[cat] || r.finish_time < pbMap[cat].finish_time) {
      pbMap[cat] = {
        category: cat,
        finish_time: r.finish_time,
        net_time: r.net_time,
        event_title: r.event_title,
        event_id: r.event_id,
        result_year: r.result_year,
        overall_rank: r.overall_rank,
      };
    }
  }

  return Object.values(pbMap).sort((a, b) => (a.category > b.category ? 1 : -1));
}

/**
 * ユーザーの成長推移（カテゴリ別タイム一覧）
 */
export function getUserGrowth(userId, category) {
  const results = getUserResults(userId);
  return results
    .filter((r) => {
      if (r.finish_status !== "finished" || !r.finish_time) return false;
      if (category && r.category_name !== category) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.result_year !== b.result_year) return a.result_year - b.result_year;
      return (a.event_date || "").localeCompare(b.event_date || "");
    })
    .map((r) => ({
      result_year: r.result_year,
      event_title: r.event_title,
      event_id: r.event_id,
      finish_time: r.finish_time,
      net_time: r.net_time,
      overall_rank: r.overall_rank,
      event_date: r.event_date,
    }));
}

// ---------------------------------------------------------------------------
// 管理: 結果管理
// ---------------------------------------------------------------------------

/**
 * 管理画面用: イベント別の結果概要
 */
export function getAdminResultsOverview({ sportType, limit = 50, offset = 0 } = {}) {
  const db = getDb();

  let where = "1=1";
  const params = [];
  if (sportType) {
    where += " AND er.sport_type = ?";
    params.push(sportType);
  }

  const rows = db.prepare(`
    SELECT
      er.event_id,
      e.title as event_title,
      er.sport_type,
      er.result_year,
      COUNT(*) as total_results,
      SUM(CASE WHEN er.is_public = 1 THEN 1 ELSE 0 END) as public_count,
      SUM(CASE WHEN er.finish_status = 'finished' THEN 1 ELSE 0 END) as finisher_count,
      MIN(CASE WHEN er.finish_status = 'finished' THEN er.finish_time END) as fastest,
      COUNT(DISTINCT ur.user_id) as linked_users
    FROM event_results er
    LEFT JOIN events e ON er.event_id = e.id
    LEFT JOIN user_results ur ON er.id = ur.result_id
    WHERE ${where}
    GROUP BY er.event_id, er.result_year
    ORDER BY er.result_year DESC, total_results DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const countRow = db.prepare(`
    SELECT COUNT(DISTINCT event_id || '-' || result_year) as cnt
    FROM event_results er
    WHERE ${where}
  `).get(...params);

  return { items: rows, total: countRow?.cnt || 0 };
}

/**
 * 管理画面用: 結果の公開/非公開切り替え
 */
export function updateResultPublicStatus(resultId, isPublic) {
  const db = getDb();
  db.prepare("UPDATE event_results SET is_public = ? WHERE id = ?").run(isPublic ? 1 : 0, resultId);
  return { success: true };
}
