"use client";
import AdminListPage from "@/components/admin/AdminListPage";

const COLUMNS = [
  { key: "code", label: "コード" },
  { key: "title", label: "銘柄名" },
  { key: "category", label: "カテゴリ" },
  { key: "min_investment", label: "最低投資額", render: (item) => item.min_investment ? `${item.min_investment.toLocaleString()}円` : "—" },
  { key: "updated_at", label: "更新日", render: (item) => item.updated_at?.substring(0, 10) || "—" },
];

export default function YutaiAdminListPage() {
  return (
    <AdminListPage
      title="株主優待ナビ 管理"
      apiPath="/api/admin/yutai"
      basePath="/admin/yutai"
      publicPath="/yutai"
      columns={COLUMNS}
    />
  );
}
