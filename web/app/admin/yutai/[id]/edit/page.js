"use client";
import { useParams } from "next/navigation";
import AdminFormPage from "@/components/admin/AdminFormPage";
import { yutaiConfig } from "@/lib/yutai-config";

const FIELDS = [
  { key: "code", label: "証券コード", required: true },
  { key: "slug", label: "Slug", required: true },
  { key: "title", label: "銘柄名", required: true },
  { key: "category", label: "カテゴリ", type: "select", options: [{ value: "", label: "選択" }, ...yutaiConfig.categories.map((c) => ({ value: c.slug, label: `${c.icon} ${c.label}` }))] },
  { key: "confirm_months", label: "権利確定月（JSON）", placeholder: '例: [3, 9]' },
  { key: "min_investment", label: "最低投資金額", type: "number" },
  { key: "benefit_summary", label: "優待内容", type: "textarea" },
  { key: "dividend_yield", label: "配当利回り(%)", type: "number" },
  { key: "benefit_yield", label: "優待利回り(%)", type: "number" },
  { key: "is_published", label: "公開状態", type: "checkbox", checkLabel: "公開する" },
];

export default function YutaiEditPage() {
  const { id } = useParams();
  return (
    <AdminFormPage
      title="株主優待 編集"
      apiPath="/api/admin/yutai"
      basePath="/admin/yutai"
      itemId={Number(id)}
      fields={FIELDS}
    />
  );
}
