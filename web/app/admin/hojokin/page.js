"use client";
import AdminListPage from "@/components/admin/AdminListPage";

const COLUMNS = [
  { key: "title", label: "制度名" },
  { key: "category", label: "カテゴリ" },
  { key: "target_type", label: "対象" },
  { key: "max_amount", label: "上限額", render: (item) => item.max_amount ? `${Math.floor(item.max_amount / 10000)}万円` : "—" },
  { key: "status", label: "状態" },
  { key: "updated_at", label: "更新日", render: (item) => item.updated_at?.substring(0, 10) || "—" },
];

export default function HojokinAdminListPage() {
  return (
    <AdminListPage
      title="補助金 管理"
      apiPath="/api/admin/hojokin"
      basePath="/admin/hojokin"
      publicPath="/hojokin"
      columns={COLUMNS}
      syncActions={[
        { label: "補助金情報更新", endpoint: "/api/admin/sync?domain=hojokin", confirmMessage: "補助金情報の最新データを確認しますか？（数十秒かかります）" },
      ]}
    />
  );
}
