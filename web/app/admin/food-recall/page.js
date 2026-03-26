"use client";
import AdminListPage from "@/components/admin/AdminListPage";
import { getRiskLevel, getStatusBadge, formatRecallDate } from "@/lib/food-recall-config";

const COLUMNS = [
  { key: "product_name", label: "商品名" },
  { key: "manufacturer", label: "製造者" },
  { key: "category", label: "カテゴリ" },
  { key: "risk_level", label: "リスク", render: (item) => { const r = getRiskLevel(item.risk_level); return r.label; } },
  { key: "status", label: "状態", render: (item) => getStatusBadge(item.status).label },
  { key: "recall_date", label: "リコール日", render: (item) => formatRecallDate(item.recall_date) },
  { key: "updated_at", label: "更新日", render: (item) => item.updated_at?.substring(0, 10) || "—" },
];

export default function FoodRecallAdminListPage() {
  return (
    <AdminListPage
      title="食品リコール 管理"
      apiPath="/api/admin/food-recall"
      basePath="/admin/food-recall"
      publicPath="/food-recall"
      columns={COLUMNS}
    />
  );
}
