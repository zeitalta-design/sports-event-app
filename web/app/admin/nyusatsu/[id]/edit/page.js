"use client";
import { useParams } from "next/navigation";
import AdminFormPage from "@/components/admin/AdminFormPage";
import { nyusatsuConfig } from "@/lib/nyusatsu-config";

const FIELDS = [
  { key: "slug", label: "Slug", required: true },
  { key: "title", label: "案件名", required: true },
  { key: "category", label: "カテゴリ", type: "select", options: [{ value: "", label: "選択" }, ...nyusatsuConfig.categories.map((c) => ({ value: c.slug, label: `${c.icon} ${c.label}` }))] },
  { key: "issuer_name", label: "発注機関" },
  { key: "target_area", label: "対象地域" },
  { key: "deadline", label: "締切日" },
  { key: "budget_amount", label: "予算規模", type: "number" },
  { key: "bidding_method", label: "入札方式", type: "select", options: [{ value: "", label: "選択" }, ...nyusatsuConfig.biddingMethods.map((m) => ({ value: m.value, label: m.label }))] },
  { key: "summary", label: "案件概要", type: "textarea" },
  { key: "status", label: "状態", type: "select", options: [{ value: "open", label: "募集中" }, { value: "upcoming", label: "募集予定" }, { value: "closed", label: "終了" }] },
  { key: "is_published", label: "公開状態", type: "checkbox", checkLabel: "公開する" },
];

export default function NyusatsuEditPage() {
  const { id } = useParams();
  return (
    <AdminFormPage
      title="入札案件 編集"
      apiPath="/api/admin/nyusatsu"
      basePath="/admin/nyusatsu"
      itemId={Number(id)}
      fields={FIELDS}
    />
  );
}
