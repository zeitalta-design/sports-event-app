"use client";
import AdminListPage from "@/components/admin/AdminListPage";

const COLUMNS = [
  { key: "title", label: "案件名" },
  { key: "category", label: "カテゴリ" },
  { key: "issuer_name", label: "発注機関" },
  { key: "deadline", label: "締切", render: (item) => item.deadline?.substring(0, 10) || "—" },
  { key: "budget_amount", label: "予算", render: (item) => item.budget_amount ? `${Math.floor(item.budget_amount / 10000)}万円` : "—" },
  { key: "status", label: "状態" },
  { key: "updated_at", label: "更新日", render: (item) => item.updated_at?.substring(0, 10) || "—" },
];

export default function NyusatsuAdminListPage() {
  return (
    <AdminListPage
      title="入札 管理"
      apiPath="/api/admin/nyusatsu"
      basePath="/admin/nyusatsu"
      publicPath="/nyusatsu"
      columns={COLUMNS}
      syncActions={[
        { label: "最新データ取得", endpoint: "/api/admin/sync?domain=nyusatsu", confirmMessage: "入札情報の最新データを取得しますか？（数十秒かかります）" },
      ]}
    />
  );
}
