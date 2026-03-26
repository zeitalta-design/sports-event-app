"use client";
import AdminListPage from "@/components/admin/AdminListPage";
import { getLicenseFamilyLabel, getEntityStatusBadge } from "@/lib/kyoninka-config";

const COLUMNS = [
  { key: "entity_name", label: "事業者名" },
  { key: "prefecture", label: "都道府県" },
  { key: "primary_license_family", label: "主要許認可", render: (item) => getLicenseFamilyLabel(item.primary_license_family) },
  { key: "registration_count", label: "登録数" },
  { key: "corporate_number", label: "法人番号", render: (item) => item.corporate_number || "—" },
  { key: "entity_status", label: "状態", render: (item) => getEntityStatusBadge(item.entity_status).label },
  { key: "updated_at", label: "更新日", render: (item) => item.updated_at?.substring(0, 10) || "—" },
];

export default function KyoninkaAdminListPage() {
  return (
    <AdminListPage
      title="許認可検索 管理"
      apiPath="/api/admin/kyoninka"
      basePath="/admin/kyoninka"
      publicPath="/kyoninka"
      columns={COLUMNS}
    />
  );
}
