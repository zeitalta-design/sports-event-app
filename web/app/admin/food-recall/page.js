"use client";
import AdminListPage from "@/components/admin/AdminListPage";

const RISK_COLORS = { high: "text-red-700 bg-red-50", medium: "text-orange-700 bg-orange-50", low: "text-green-700 bg-green-50" };

const COLUMNS = [
  { key: "product_name", label: "商品名" },
  { key: "manufacturer", label: "事業者" },
  { key: "category", label: "分類" },
  {
    key: "risk_level",
    label: "リスク",
    render: (item) => {
      const l = item.risk_level;
      return l ? (
        <span className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded ${RISK_COLORS[l] || ""}`}>
          {l === "high" ? "高" : l === "medium" ? "中" : "低"}
        </span>
      ) : "—";
    },
  },
  { key: "status", label: "状態" },
  { key: "recall_date", label: "回収日", render: (item) => item.recall_date?.substring(0, 10) || "—" },
  { key: "updated_at", label: "更新日", render: (item) => item.updated_at?.substring(0, 10) || "—" },
];

export default function FoodRecallAdminListPage() {
  return (
    <AdminListPage
      title="食品リコール監視 管理"
      apiPath="/api/admin/food-recall"
      basePath="/admin/food-recall"
      publicPath="/food-recall"
      columns={COLUMNS}
    />
  );
}
