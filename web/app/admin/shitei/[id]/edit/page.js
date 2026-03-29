"use client";
import { useParams } from "next/navigation";
import AdminFormPage from "@/components/admin/AdminFormPage";

const FIELDS = [
  { key: "slug", label: "Slug", required: true },
  { key: "title", label: "名称", required: true },
  { key: "municipality_name", label: "自治体" },
  { key: "prefecture", label: "都道府県" },
  { key: "facility_category", label: "施設種別" },
  { key: "facility_name", label: "施設名" },
  { key: "recruitment_status", label: "募集状態", type: "select", options: [
    { value: "open", label: "募集中" }, { value: "closed", label: "締切" },
    { value: "upcoming", label: "予定" }, { value: "unknown", label: "不明" },
  ]},
  { key: "application_deadline", label: "応募締切" },
  { key: "contract_start_date", label: "契約開始日" },
  { key: "contract_end_date", label: "契約終了日" },
  { key: "detail_url", label: "詳細URL" },
  { key: "summary", label: "概要", type: "textarea" },
  { key: "eligibility", label: "応募資格", type: "textarea" },
  { key: "is_published", label: "公開状態", type: "checkbox", checkLabel: "公開する" },
];

export default function ShiteiEditPage() {
  const { id } = useParams();
  return (
    <AdminFormPage
      title="指定管理 編集"
      apiPath="/api/admin/shitei"
      basePath="/admin/shitei"
      itemId={Number(id)}
      fields={FIELDS}
    />
  );
}
