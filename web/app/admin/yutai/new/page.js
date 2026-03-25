"use client";
import AdminFormPage from "@/components/admin/AdminFormPage";
import { yutaiConfig } from "@/lib/yutai-config";

const FIELDS = [
  { key: "code", label: "証券コード", required: true, placeholder: "例: 2702" },
  { key: "slug", label: "Slug", required: true, placeholder: "例: 2702-mcdonalds" },
  { key: "title", label: "銘柄名", required: true },
  { key: "category", label: "カテゴリ", type: "select", options: [{ value: "", label: "選択" }, ...yutaiConfig.categories.map((c) => ({ value: c.slug, label: `${c.icon} ${c.label}` }))] },
  { key: "confirm_months", label: "権利確定月（JSON）", placeholder: '例: [3, 9]' },
  { key: "min_investment", label: "最低投資金額", type: "number", placeholder: "例: 67300" },
  { key: "benefit_summary", label: "優待内容", type: "textarea" },
  { key: "dividend_yield", label: "配当利回り(%)", type: "number", placeholder: "例: 0.74" },
  { key: "benefit_yield", label: "優待利回り(%)", type: "number", placeholder: "例: 1.5" },
  { key: "is_published", label: "公開状態", type: "checkbox", checkLabel: "公開する" },
];

export default function YutaiNewPage() {
  return (
    <AdminFormPage
      title="株主優待 新規作成"
      apiPath="/api/admin/yutai"
      basePath="/admin/yutai"
      fields={FIELDS}
      defaults={{ is_published: 1, category: "food", confirm_months: "[]" }}
    />
  );
}
