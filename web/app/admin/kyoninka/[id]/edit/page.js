"use client";
import { useParams } from "next/navigation";
import AdminFormPage from "@/components/admin/AdminFormPage";

const FIELDS = [
  { key: "slug", label: "Slug", required: true },
  { key: "entity_name", label: "事業者名", required: true },
  { key: "prefecture", label: "都道府県" },
  { key: "city", label: "市区町村" },
  { key: "address", label: "住所" },
  { key: "corporate_number", label: "法人番号" },
  { key: "primary_license_family", label: "主要許認可種別" },
  { key: "entity_status", label: "状態", type: "select", options: [
    { value: "active", label: "有効" }, { value: "suspended", label: "停止" },
    { value: "revoked", label: "取消" }, { value: "expired", label: "失効" },
  ]},
  { key: "source_name", label: "データソース" },
  { key: "notes", label: "備考", type: "textarea" },
  { key: "is_published", label: "公開状態", type: "checkbox", checkLabel: "公開する" },
];

export default function KyoninkaEditPage() {
  const { id } = useParams();
  return (
    <AdminFormPage
      title="許認可 編集"
      apiPath="/api/admin/kyoninka"
      basePath="/admin/kyoninka"
      itemId={Number(id)}
      fields={FIELDS}
    />
  );
}
