"use client";
import AdminFormPage from "@/components/admin/AdminFormPage";
import { minpakuConfig } from "@/lib/minpaku-config";

const FIELDS = [
  { key: "slug", label: "Slug", required: true, placeholder: "例: shibuya-designer-apt" },
  { key: "title", label: "物件名", required: true },
  { key: "category", label: "カテゴリ", type: "select", options: [{ value: "", label: "選択" }, ...minpakuConfig.categories.map((c) => ({ value: c.slug, label: `${c.icon} ${c.label}` }))] },
  { key: "area", label: "エリア", placeholder: "例: 東京都渋谷区" },
  { key: "property_type", label: "物件タイプ", type: "select", options: minpakuConfig.propertyTypes.map((t) => ({ value: t.value, label: t.label })) },
  { key: "capacity", label: "定員", type: "number" },
  { key: "price_per_night", label: "1泊料金", type: "number" },
  { key: "min_nights", label: "最低宿泊日数", type: "number" },
  { key: "host_name", label: "ホスト名" },
  { key: "rating", label: "評価", type: "number", placeholder: "例: 4.5" },
  { key: "review_count", label: "レビュー数", type: "number" },
  { key: "summary", label: "物件概要", type: "textarea" },
  { key: "status", label: "状態", type: "select", options: minpakuConfig.statusOptions.map((s) => ({ value: s.value, label: s.label })) },
  { key: "is_published", label: "公開状態", type: "checkbox", checkLabel: "公開する" },
];

export default function MinpakuNewPage() {
  return <AdminFormPage title="民泊物件 新規作成" apiPath="/api/admin/minpaku" basePath="/admin/minpaku" fields={FIELDS} defaults={{ is_published: 1, category: "city", property_type: "entire", status: "active", min_nights: 1 }} />;
}
