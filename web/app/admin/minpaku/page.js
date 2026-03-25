"use client";
import AdminListPage from "@/components/admin/AdminListPage";

export default function MinpakuAdminListPage() {
  return <AdminListPage title="民泊ナビ 管理" apiPath="/api/admin/minpaku" basePath="/admin/minpaku" publicPath="/minpaku" columns={[
    { key: "title", label: "物件名" },
    { key: "category", label: "カテゴリ" },
    { key: "area", label: "エリア" },
    { key: "property_type", label: "タイプ" },
    { key: "price_per_night", label: "1泊料金", render: (i) => i.price_per_night ? `¥${i.price_per_night.toLocaleString()}` : "—" },
    { key: "status", label: "状態" },
    { key: "updated_at", label: "更新日", render: (i) => i.updated_at?.substring(0, 10) || "—" },
  ]} />;
}
