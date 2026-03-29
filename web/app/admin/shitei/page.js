"use client";
import AdminListPage from "@/components/admin/AdminListPage";

const STATUS_LABELS = { open: "募集中", closed: "締切", upcoming: "予定", unknown: "不明" };

const COLUMNS = [
  { key: "title", label: "名称" },
  { key: "municipality_name", label: "自治体" },
  { key: "prefecture", label: "都道府県" },
  { key: "facility_category", label: "施設種別" },
  {
    key: "recruitment_status",
    label: "状態",
    render: (item) => STATUS_LABELS[item.recruitment_status] || item.recruitment_status || "—",
  },
  {
    key: "application_deadline",
    label: "締切日",
    render: (item) => item.application_deadline?.substring(0, 10) || "—",
  },
  { key: "updated_at", label: "更新日", render: (item) => item.updated_at?.substring(0, 10) || "—" },
];

export default function ShiteiAdminListPage() {
  return (
    <AdminListPage
      title="指定管理公募まとめ 管理"
      apiPath="/api/admin/shitei"
      basePath="/admin/shitei"
      publicPath="/shitei"
      columns={COLUMNS}
    />
  );
}
