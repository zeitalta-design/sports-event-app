"use client";
import AdminListPage from "@/components/admin/AdminListPage";
import { getFacilityCategoryLabel, getRecruitmentStatusBadge, formatDate } from "@/lib/shitei-config";

const COLUMNS = [
  { key: "title", label: "案件名" },
  { key: "municipality_name", label: "自治体" },
  { key: "facility_category", label: "施設種別", render: (item) => getFacilityCategoryLabel(item.facility_category) },
  { key: "recruitment_status", label: "募集状態", render: (item) => getRecruitmentStatusBadge(item.recruitment_status).label },
  { key: "application_deadline", label: "応募期限", render: (item) => formatDate(item.application_deadline) },
  { key: "updated_at", label: "更新日", render: (item) => item.updated_at?.substring(0, 10) || "—" },
];

export default function ShiteiAdminListPage() {
  return (
    <AdminListPage
      title="指定管理公募 管理"
      apiPath="/api/admin/shitei"
      basePath="/admin/shitei"
      publicPath="/shitei"
      columns={COLUMNS}
    />
  );
}
