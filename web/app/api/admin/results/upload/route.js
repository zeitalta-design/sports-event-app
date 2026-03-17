import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { parseResultsCsv, autoDetectMapping } from "@/lib/csv-results-parser";

/**
 * Phase198: 結果CSVアップロードAPI
 *
 * POST /api/admin/results/upload
 * Body: FormData { csv: File, event_id, result_year, sport_type?, column_overrides? }
 *
 * 処理フロー: CSV → パース → event_results 保存
 */

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user?.is_admin) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    const formData = await request.formData();
    const csvFile = formData.get("csv");
    const eventId = parseInt(formData.get("event_id"));
    const resultYear = parseInt(formData.get("result_year"));
    const sportType = formData.get("sport_type") || "marathon";
    const columnOverridesStr = formData.get("column_overrides");

    // バリデーション
    if (!csvFile || !eventId || !resultYear) {
      return NextResponse.json(
        { error: "csv, event_id, result_year は必須です" },
        { status: 400 }
      );
    }

    // CSVテキスト読み取り
    const csvText = await csvFile.text();
    if (csvText.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "ファイルサイズが大きすぎます（10MB上限）" }, { status: 400 });
    }

    // カラムオーバーライド
    let columnOverrides = null;
    if (columnOverridesStr) {
      try {
        columnOverrides = JSON.parse(columnOverridesStr);
      } catch {
        return NextResponse.json({ error: "column_overrides のJSON形式が不正です" }, { status: 400 });
      }
    }

    // パース
    const { results, mapping, headers, errors, stats } = parseResultsCsv(csvText, {
      eventId,
      resultYear,
      sportType,
      columnOverrides,
    });

    if (results.length === 0) {
      return NextResponse.json({
        success: false,
        message: "取り込み可能な結果がありませんでした",
        headers,
        mapping,
        errors,
        stats,
      });
    }

    // DB保存
    const db = getDb();
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO event_results (
        event_id, result_year, sport_type,
        bib_number, overall_rank, gender_rank, age_rank,
        finish_time, net_time, category_name, gender, age_group,
        finish_status, runner_name_hash, is_public
      ) VALUES (
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    let inserted = 0;
    let duplicated = 0;

    const insertMany = db.transaction((rows) => {
      for (const row of rows) {
        const info = insertStmt.run(
          row.event_id, row.result_year, row.sport_type,
          row.bib_number, row.overall_rank, row.gender_rank, row.age_rank,
          row.finish_time, row.net_time, row.category_name, row.gender, row.age_group,
          row.finish_status, row.runner_name_hash, row.is_public
        );
        if (info.changes > 0) inserted++;
        else duplicated++;
      }
    });

    insertMany(results);

    return NextResponse.json({
      success: true,
      message: `${inserted}件の結果を登録しました`,
      headers,
      mapping,
      errors,
      stats: {
        ...stats,
        inserted,
        duplicated,
      },
    });
  } catch (err) {
    console.error("Results upload error:", err);
    return NextResponse.json(
      { error: "アップロード処理に失敗しました", detail: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/results/upload?preview=1
 * プレビューモード: パースのみ実行、DB保存しない
 */
