"use client";
import AdminListPage from "@/components/admin/AdminListPage";

const STATUS_LABELS = { active: "有効", suspended: "停止", revoked: "取消", expired: "失効" };

const COLUMNS = [
  { key: "entity_name", label: "事業者名" },
  { key: "prefecture", label: "都道府県" },
  { key: "primary_license_family", label: "許認可種別" },
  { key: "registration_count", label: "登録数" },
  {
    key: "entity_status",
    label: "状態",
    render: (item) => STATUS_LABELS[item.entity_status] || item.entity_status || "—",
  },
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
