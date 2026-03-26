"use client";
import { useParams } from "next/navigation";
import AdminFormPage from "@/components/admin/AdminFormPage";
import { foodRecallConfig } from "@/lib/food-recall-config";

const FIELDS = [
  { key: "slug", label: "Slug", required: true },
  { key: "product_name", label: "商品名", required: true },
  { key: "manufacturer", label: "製造者" },
  { key: "category", label: "食品カテゴリ", type: "select", options: [{ value: "", label: "選択" }, ...foodRecallConfig.categories.map((c) => ({ value: c.slug, label: `${c.icon} ${c.label}` }))] },
  { key: "recall_type", label: "リコール種別", type: "select", options: foodRecallConfig.recallTypes.map((t) => ({ value: t.value, label: t.label })) },
  { key: "reason", label: "原因", type: "select", options: [{ value: "", label: "選択" }, ...foodRecallConfig.reasons.map((r) => ({ value: r.value, label: r.label }))] },
  { key: "risk_level", label: "リスクレベル", type: "select", options: foodRecallConfig.riskLevels.map((r) => ({ value: r.value, label: r.label })) },
  { key: "affected_area", label: "対象地域" },
  { key: "lot_number", label: "ロット番号" },
  { key: "recall_date", label: "リコール日" },
  { key: "summary", label: "概要", type: "textarea" },
  { key: "consumer_action", label: "消費者への対応", type: "textarea" },
  { key: "source_url", label: "情報元URL" },
  { key: "manufacturer_url", label: "製造者URL" },
  { key: "status", label: "状態", type: "select", options: foodRecallConfig.statusOptions.map((s) => ({ value: s.value, label: s.label })) },
  { key: "is_published", label: "公開状態", type: "checkbox", checkLabel: "公開する" },
];

export default function FoodRecallEditPage() {
  const { id } = useParams();
  return (
    <AdminFormPage
      title="食品リコール 編集"
      apiPath="/api/admin/food-recall"
      basePath="/admin/food-recall"
      itemId={Number(id)}
      fields={FIELDS}
    />
  );
}
