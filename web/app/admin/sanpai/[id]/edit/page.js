"use client";
import { useParams } from "next/navigation";
import AdminFormPage from "@/components/admin/AdminFormPage";

const FIELDS = [
  { key: "slug", label: "Slug", required: true },
  { key: "company_name", label: "事業者名", required: true },
  { key: "prefecture", label: "都道府県" },
  { key: "license_type", label: "許可種別" },
  { key: "license_number", label: "許可番号" },
  { key: "risk_level", label: "リスクレベル", type: "select", options: [
    { value: "low", label: "低" }, { value: "medium", label: "中" },
    { value: "high", label: "高" }, { value: "critical", label: "重大" },
  ]},
  { key: "status", label: "状態", type: "select", options: [
    { value: "active", label: "稼働中" }, { value: "suspended", label: "停止" },
    { value: "revoked", label: "取消" },
  ]},
  { key: "business_area", label: "事業区域" },
  { key: "notes", label: "備考", type: "textarea" },
  { key: "is_published", label: "公開状態", type: "checkbox", checkLabel: "公開する" },
];

export default function SanpaiEditPage() {
  const { id } = useParams();
  return (
    <AdminFormPage
      title="産廃処分 編集"
      apiPath="/api/admin/sanpai"
      basePath="/admin/sanpai"
      itemId={Number(id)}
      fields={FIELDS}
    />
  );
}
