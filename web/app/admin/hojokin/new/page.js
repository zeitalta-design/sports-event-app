"use client";
import AdminFormPage from "@/components/admin/AdminFormPage";
import { hojokinConfig } from "@/lib/hojokin-config";

const FIELDS = [
  { key: "slug", label: "Slug", required: true, placeholder: "例: it-hojo-2026" },
  { key: "title", label: "制度名", required: true },
  { key: "category", label: "カテゴリ", type: "select", options: [{ value: "", label: "選択" }, ...hojokinConfig.categories.map((c) => ({ value: c.slug, label: `${c.icon} ${c.label}` }))] },
  { key: "target_type", label: "対象者", type: "select", options: [{ value: "", label: "選択" }, ...hojokinConfig.targetTypes.map((t) => ({ value: t.value, label: t.label }))] },
  { key: "max_amount", label: "補助上限額", type: "number", placeholder: "例: 4500000" },
  { key: "subsidy_rate", label: "補助率", placeholder: "例: 1/2〜2/3" },
  { key: "deadline", label: "公募締切", placeholder: "例: 2026-06-30" },
  { key: "status", label: "募集状況", type: "select", options: hojokinConfig.statusOptions.map((s) => ({ value: s.value, label: s.label })) },
  { key: "provider_name", label: "提供主体", placeholder: "例: 中小企業庁" },
  { key: "summary", label: "制度概要", type: "textarea" },
  { key: "is_published", label: "公開状態", type: "checkbox", checkLabel: "公開する" },
];

export default function HojokinNewPage() {
  return (
    <AdminFormPage
      title="補助金 新規作成"
      apiPath="/api/admin/hojokin"
      basePath="/admin/hojokin"
      fields={FIELDS}
      defaults={{ is_published: 1, category: "other", target_type: "corp", status: "open" }}
    />
  );
}
