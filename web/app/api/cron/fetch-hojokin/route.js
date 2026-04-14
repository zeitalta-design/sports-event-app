/**
 * 補助金 — J-Grants API 自動取得
 *
 * POST /api/cron/fetch-hojokin
 * J-Grants公開APIから補助金情報を取得しDBに登録。
 * 多キーワード戦略で幅広くカバー。
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const JGRANTS_BASE = "https://api.jgrants-portal.go.jp/exp/v1/public/subsidies";

const KEYWORDS = [
  { keyword: "事業", label: "汎用" },
  { keyword: "補助", label: "汎用" },
  { keyword: "ものづくり", label: "カテゴリ" },
  { keyword: "設備投資", label: "カテゴリ" },
  { keyword: "省エネ", label: "カテゴリ" },
  { keyword: "研究開発", label: "カテゴリ" },
  { keyword: "販路開拓", label: "カテゴリ" },
  { keyword: "人材育成", label: "カテゴリ" },
  { keyword: "創業", label: "カテゴリ" },
  { keyword: "IT導入", label: "カテゴリ" },
  { keyword: "中小企業", label: "対象" },
  { keyword: "小規模事業者", label: "対象" },
  { keyword: "グリーン", label: "施策" },
  { keyword: "事業再構築", label: "施策" },
  { keyword: "生産性向上", label: "施策" },
];

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") === "true";
    const maxKeywords = Math.min(parseInt(searchParams.get("max") || "1", 10), 15);

    const db = getDb();
    const startTime = Date.now();
    let totalFetched = 0;
    let created = 0;
    let updated = 0;
    const seen = new Set();
    const errors = [];

    // upsert prepared statement
    const upsertStmt = db.prepare(`
      INSERT INTO hojokin_items
        (slug, title, category, target_type, max_amount, subsidy_rate,
         deadline, status, provider_name, summary, source_name, source_url, detail_url,
         is_published, review_status, created_at, updated_at)
      VALUES
        (@slug, @title, @category, @target_type, @max_amount, @subsidy_rate,
         @deadline, @status, @provider_name, @summary, @source_name, @source_url, @detail_url,
         1, 'approved', datetime('now'), datetime('now'))
      ON CONFLICT(slug) DO UPDATE SET
        title = excluded.title,
        deadline = excluded.deadline,
        status = excluded.status,
        max_amount = excluded.max_amount,
        subsidy_rate = excluded.subsidy_rate,
        summary = excluded.summary,
        provider_name = excluded.provider_name,
        updated_at = datetime('now')
    `);

    for (const kw of KEYWORDS.slice(0, maxKeywords)) {
      try {
        const params = new URLSearchParams({
          keyword: kw.keyword,
          sort: "created_date",
          order: "DESC",
          acceptance: "0",
        });
        const res = await fetch(`${JGRANTS_BASE}?${params}`, {
          headers: { "User-Agent": "RiskMonitor/1.0", Accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
          errors.push(`${kw.keyword}: HTTP ${res.status}`);
          continue;
        }

        let data;
        try {
          data = await res.json();
        } catch {
          errors.push(`${kw.keyword}: JSON parse error`);
          continue;
        }

        const items = data.result || [];
        totalFetched += items.length;

        if (!dryRun) {
          for (const item of items) {
            const slug = item.id ? `jgrants-${item.id}` : null;
            if (!slug || seen.has(slug)) continue;
            seen.add(slug);

            try {
              const existing = db.prepare("SELECT id FROM hojokin_items WHERE slug = ?").get(slug);
              upsertStmt.run({
                slug,
                title: (item.title || "").slice(0, 200),
                category: inferCategory(item),
                target_type: inferTargetType(item),
                max_amount: item.subsidy_max_limit || null,
                subsidy_rate: item.subsidy_rate || null,
                deadline: formatDate(item.acceptance_end_datetime),
                status: inferStatus(item),
                provider_name: (item.subsidy_executing_organization_name_ja || item.target || "").slice(0, 100),
                summary: (item.outline || item.use_purpose || "").slice(0, 500),
                source_name: "J-Grants",
                source_url: "https://www.jgrants-portal.go.jp/",
                detail_url: item.id ? `https://www.jgrants-portal.go.jp/subsidy/${item.id}` : null,
              });
              if (existing) updated++;
              else created++;
            } catch { /* dedup conflict, ignore */ }
          }
        }

        // API rate limiting
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        errors.push(`${kw.keyword}: ${e.message}`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // sync_runs記録
    if (!dryRun) {
      try {
        db.prepare(`
          INSERT INTO sync_runs (domain_id, run_type, run_status, fetched_count, created_count, updated_count, started_at, finished_at)
          VALUES ('hojokin', 'scheduled', 'completed', ?, ?, ?, datetime('now'), datetime('now'))
        `).run(totalFetched, created, updated);
      } catch { /* ignore */ }
    }

    return NextResponse.json({
      ok: true,
      totalFetched,
      created,
      updated,
      unique: seen.size,
      elapsed,
      errors: errors.length > 0 ? errors : undefined,
      dryRun,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function inferCategory(item) {
  const text = `${item.title || ""} ${item.use_purpose || ""}`;
  if (/IT|DX|デジタル|システム|情報/.test(text)) return "it";
  if (/ものづくり|設備|製造|生産/.test(text)) return "equipment";
  if (/研究開発|R&D|技術開発/.test(text)) return "rd";
  if (/雇用|人材|従業員/.test(text)) return "employment";
  if (/海外|輸出|グローバル/.test(text)) return "export";
  if (/創業|起業|スタートアップ/.test(text)) return "startup";
  return "other";
}

function inferTargetType(item) {
  const text = `${item.target_number_of_employees || ""} ${item.title || ""}`;
  if (/スタートアップ|ベンチャー|創業/.test(text)) return "startup";
  if (/NPO|非営利/.test(text)) return "npo";
  return "corp";
}

function inferStatus(item) {
  const now = new Date();
  const end = item.acceptance_end_datetime ? new Date(item.acceptance_end_datetime) : null;
  const start = item.acceptance_start_datetime ? new Date(item.acceptance_start_datetime) : null;
  if (end && end < now) return "closed";
  if (start && start > now) return "upcoming";
  return "open";
}

function formatDate(iso) {
  if (!iso) return null;
  return iso.split("T")[0];
}
