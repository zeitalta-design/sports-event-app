"use client";

/**
 * 企業詳細ページ（cross-domain hub）
 *
 * - organizations テーブル 1 行を表示
 * - 既存の CrossDomainLinks を使って入札/補助金/許認可/行政処分/産廃の
 *   件数＋検索リンクを列挙
 *
 * 重い集計や統合ダッシュボードは意図的に載せていない。件数+リンクで十分。
 */

import { useEffect, useState, use } from "react";
import Link from "next/link";
import CrossDomainLinks from "@/components/core/CrossDomainLinks";

export const dynamic = "force-dynamic";

export default function OrganizationDetailPage({ params }) {
  const { id } = use(params);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/organizations/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <main className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-500">読み込み中…</main>;
  }
  if (error || !data) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12">
        <p className="text-red-600 mb-4">企業が見つかりません: {error || "not found"}</p>
        <Link href="/" className="text-blue-600 hover:underline">← ホームに戻る</Link>
      </main>
    );
  }

  const { organization: org, variants, links } = data;
  const displayName = org.display_name || org.normalized_name;
  const lookupKey = org.corporate_number || displayName;
  const prefCity = [org.prefecture, org.city].filter(Boolean).join(" ");

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:underline">HOME</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-700 font-medium">企業</span>
        <span className="mx-1">/</span>
        <span className="text-gray-900 font-medium truncate">{displayName}</span>
      </nav>

      {/* ヘッダ */}
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{displayName}</h1>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600">
          {org.corporate_number && (
            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
              法人番号 {org.corporate_number}
            </span>
          )}
          {prefCity && <span>📍 {prefCity}</span>}
          {org.source && (
            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded">
              初出: {org.source}
            </span>
          )}
          {org.is_active === 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">非表示</span>
          )}
        </div>
      </header>

      {/* 基本情報 */}
      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">基本情報</h2>
        <table className="w-full text-sm">
          <tbody>
            {[
              ["表示名", displayName],
              ["正規化名", org.normalized_name],
              ["法人番号", org.corporate_number || "—"],
              ["所在地", prefCity || "—"],
              ["住所", org.address || "—"],
              ["作成日", org.created_at],
              ["更新日", org.updated_at],
            ].filter(([, v]) => v != null && v !== "" && v !== "—").map(([label, value], i, arr) => (
              <tr key={label} className={i < arr.length - 1 ? "border-b border-gray-100" : ""}>
                <td className="py-2 text-gray-500 w-32">{label}</td>
                <td className="py-2 text-gray-900">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 他DB情報（cross-domain hub の本体） */}
      <CrossDomainLinks lookupKey={lookupKey} />

      {/* 表記ゆれ */}
      {variants.length > 0 && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">表記ゆれ履歴</h2>
          <p className="text-xs text-gray-500 mb-3">
            各ドメインでこの企業を観測した際の原文表記と照合方法。
          </p>
          <table className="w-full text-sm">
            <thead className="text-gray-500 border-b border-gray-100">
              <tr>
                <th className="text-left py-2">原文</th>
                <th className="text-left py-2">ドメイン</th>
                <th className="text-left py-2">照合</th>
                <th className="text-right py-2">信頼度</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2">{v.raw_name}</td>
                  <td className="py-2 text-gray-600">{v.source_domain || "—"}</td>
                  <td className="py-2 text-gray-600">{v.match_method || "—"}</td>
                  <td className="py-2 text-right tabular-nums text-gray-600">
                    {v.confidence != null ? v.confidence.toFixed(2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* resolved_entities 接続（低レイヤ情報だが traceability 目的で見せる） */}
      {links.length > 0 && (
        <section className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">resolved_entities 接続</h2>
          <p className="text-xs text-gray-500 mb-3">
            ある企業が nyusatsu 側の resolver でどの entity として扱われているか。
          </p>
          <ul className="text-sm space-y-1">
            {links.map((l, i) => (
              <li key={i} className="flex items-center justify-between border-b border-gray-50 py-1">
                <span>
                  <Link
                    href={`/nyusatsu/entities/${l.resolved_entity_id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {l.resolved_canonical_name || `entity #${l.resolved_entity_id}`}
                  </Link>
                </span>
                <span className="text-xs text-gray-500">
                  {l.link_type} / {l.source} / conf={l.confidence?.toFixed?.(2) ?? l.confidence}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
