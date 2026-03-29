"use client";
import AdminListPage from "@/components/admin/AdminListPage";

const ACTION_LABELS = {
  license_revocation: "免許取消",
  business_suspension: "営業停止",
  improvement_order: "改善命令",
  warning: "指示・警告",
  guidance: "指導・勧告",
  other: "その他",
};
const ACTION_COLORS = {
  license_revocation: "text-red-700 bg-red-50",
  business_suspension: "text-orange-700 bg-orange-50",
  improvement_order: "text-amber-700 bg-amber-50",
  warning: "text-blue-700 bg-blue-50",
  guidance: "text-gray-700 bg-gray-50",
};

const COLUMNS = [
  { key: "organization_name_raw", label: "事業者名" },
  {
    key: "action_type",
    label: "処分種別",
    render: (item) => {
      const t = item.action_type;
      return t ? (
        <span className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded ${ACTION_COLORS[t] || ""}`}>
          {ACTION_LABELS[t] || t}
        </span>
      ) : "—";
    },
  },
  { key: "authority_name", label: "行政機関" },
  { key: "prefecture", label: "都道府県" },
  { key: "action_date", label: "処分日", render: (item) => item.action_date?.substring(0, 10) || "—" },
  { key: "updated_at", label: "更新日", render: (item) => item.updated_at?.substring(0, 10) || "—" },
];

export default function GyoseiShobunAdminListPage() {
  return (
    <AdminListPage
      title="行政処分DB 管理"
      apiPath="/api/admin/gyosei-shobun"
      basePath="/admin/gyosei-shobun"
      publicPath="/gyosei-shobun"
      columns={COLUMNS}
    />
  );
}
