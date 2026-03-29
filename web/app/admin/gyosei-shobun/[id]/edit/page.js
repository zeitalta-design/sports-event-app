"use client";
import { useParams } from "next/navigation";
import AdminFormPage from "@/components/admin/AdminFormPage";

const FIELDS = [
  { key: "slug", label: "Slug", required: true },
  { key: "organization_name_raw", label: "事業者名", required: true },
  { key: "action_type", label: "処分種別", type: "select", options: [
    { value: "license_revocation", label: "免許取消" },
    { value: "business_suspension", label: "営業停止" },
    { value: "improvement_order", label: "改善命令" },
    { value: "warning", label: "指示・警告" },
    { value: "guidance", label: "指導・勧告" },
    { value: "other", label: "その他" },
  ]},
  { key: "action_date", label: "処分日" },
  { key: "authority_name", label: "行政機関" },
  { key: "authority_level", label: "管轄レベル", type: "select", options: [
    { value: "national", label: "国" }, { value: "prefectural", label: "都道府県" },
    { value: "municipal", label: "市区町村" },
  ]},
  { key: "prefecture", label: "都道府県" },
  { key: "industry", label: "業種" },
  { key: "legal_basis", label: "法的根拠" },
  { key: "penalty_period", label: "処分期間" },
  { key: "summary", label: "概要", type: "textarea" },
  { key: "detail", label: "詳細", type: "textarea" },
  { key: "source_url", label: "情報源URL" },
  { key: "source_name", label: "情報源名" },
  { key: "is_published", label: "公開状態", type: "checkbox", checkLabel: "公開する" },
];

export default function GyoseiShobunEditPage() {
  const { id } = useParams();
  return (
    <AdminFormPage
      title="行政処分 編集"
      apiPath="/api/admin/gyosei-shobun"
      basePath="/admin/gyosei-shobun"
      itemId={Number(id)}
      fields={FIELDS}
    />
  );
}
