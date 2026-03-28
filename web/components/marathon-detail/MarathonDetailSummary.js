/**
 * 基本情報サマリー — 情報表スタイル
 * ラベル/値が明確に分かれた一覧表示
 */

import { getStatusLabel } from "@/lib/entry-status";

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${weekdays[d.getDay()]})`;
}

export default function MarathonDetailSummary({ data }) {
  const rows = [];

  if (data.event_date) {
    rows.push({ label: "開催日", value: formatDate(data.event_date), bold: true });
  }

  const startDate = data.entry_start_date;
  const endDate = data.entry_end_date;
  if (startDate || endDate) {
    const parts = [];
    if (startDate) parts.push(formatDate(startDate));
    parts.push("〜");
    if (endDate) parts.push(formatDate(endDate));
    rows.push({ label: "申込期間", value: parts.join(" ") });
  }

  if (data.registration_start_time) {
    rows.push({ label: "受付開始", value: data.registration_start_time });
  }

  if (data.entry_status && data.entry_status !== "unknown") {
    rows.push({ label: "申込状態", value: getStatusLabel(data.entry_status) });
  }

  if (data.venue_name) {
    rows.push({ label: "会場", value: data.venue_name });
  }

  if (data.venue_address) {
    rows.push({ label: "住所", value: data.venue_address });
  }

  if (data.payment_methods && data.payment_methods.length > 0) {
    rows.push({ label: "支払方法", value: data.payment_methods.join(" / ") });
  }

  if (data.agent_entry_allowed !== null && data.agent_entry_allowed !== undefined) {
    rows.push({ label: "代理申込", value: data.agent_entry_allowed ? "可" : "不可" });
  }

  if (data.event_scale_label) {
    rows.push({ label: "規模", value: data.event_scale_label });
  }

  if (data.level_labels && data.level_labels.length > 0) {
    rows.push({ label: "レベル", value: data.level_labels.join(" / ") });
  }

  if (data.measurement_method) {
    rows.push({ label: "計測", value: data.measurement_method });
  }

  if (data.cancellation_policy) {
    rows.push({ label: "キャンセル規定", value: data.cancellation_policy });
  }

  if (data.parking_info) {
    rows.push({ label: "駐車場", value: data.parking_info });
  }

  if (data.races && data.races.length > 0) {
    rows.push({ label: "種目数", value: `${data.races.length}種目` });
  }

  const sourceLabel = data.source_site === "runnet" ? "RUNNET" : data.source_site === "sportsentry" ? "SPORTS ENTRY" : data.source_site === "moshicom" ? "MOSHICOM" : data.source_site;
  const hasMoshicom = data.official_url?.includes("moshicom");
  rows.push({
    label: "データ出典",
    value: hasMoshicom ? `${sourceLabel} / moshicom` : sourceLabel,
  });

  // Phase37: 鮮度情報
  if (data.freshness) {
    rows.push({
      label: "情報確認",
      value: data.freshness.displayText,
      className: data.freshness.className,
    });
  }

  if (rows.length === 0) return null;

  return (
    <div className="card p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">この大会の要点</h2>
      <dl className="divide-y divide-gray-100">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline py-3.5 gap-4"
          >
            <dt className="shrink-0 min-w-[5.5rem]">
              <span className="inline-block px-2 py-0.5 text-xs font-bold text-gray-700 bg-gray-100 rounded">
                {row.label}
              </span>
            </dt>
            <dd
              className={`text-base ${row.className ? row.className : row.bold ? "font-bold text-gray-900" : "text-gray-800 font-medium"}`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
