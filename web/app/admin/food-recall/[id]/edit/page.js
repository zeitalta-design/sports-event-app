"use client";
import { useParams } from "next/navigation";
import AdminFormPage from "@/components/admin/AdminFormPage";

const FIELDS = [
  { key: "slug", label: "Slug", required: true },
  { key: "product_name", label: "商品名", required: true },
  { key: "manufacturer", label: "事業者" },
  { key: "category", label: "分類" },
  { key: "recall_type", label: "回収種別" },
  { key: "reason", label: "回収理由" },
  { key: "risk_level", label: "リスク", type: "select", options: [
    { value: "low", label: "低" }, { value: "medium", label: "中" }, { value: "high", label: "高" },
  ]},
  { key: "status", label: "状態", type: "select", options: [
    { value: "ongoing", label: "回収中" }, { value: "completed", label: "完了" }, { value: "monitoring", label: "経過観察" },
  ]},
  { key: "recall_date", label: "回収日" },
  { key: "affected_area", label: "対象地域" },
  { key: "consumer_action", label: "消費者対応", type: "textarea" },
  { key: "summary", label: "概要", type: "textarea" },
  { key: "source_url", label: "情報源URL" },
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
