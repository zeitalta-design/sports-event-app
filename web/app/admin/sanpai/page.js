"use client";
import AdminListPage from "@/components/admin/AdminListPage";
import { getRiskLevel, getStatusBadge, getLicenseTypeLabel, formatDate } from "@/lib/sanpai-config";

const COLUMNS = [
  { key: "company_name", label: "事業者名" },
  { key: "prefecture", label: "都道府県" },
  { key: "license_type", label: "許可種別", render: (item) => getLicenseTypeLabel(item.license_type) },
  { key: "risk_level", label: "リスク", render: (item) => getRiskLevel(item.risk_level).label },
  { key: "penalty_count", label: "処分件数" },
  { key: "status", label: "状態", render: (item) => getStatusBadge(item.status).label },
  { key: "updated_at", label: "更新日", render: (item) => item.updated_at?.substring(0, 10) || "—" },
];

export default function SanpaiAdminListPage() {
  return (
    <AdminListPage
      title="産廃処分ウォッチ 管理"
      apiPath="/api/admin/sanpai"
      basePath="/admin/sanpai"
      publicPath="/sanpai"
      columns={COLUMNS}
    />
  );
}
