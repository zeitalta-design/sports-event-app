"use client";
import { useParams } from "next/navigation";
import AdminFormPage from "@/components/admin/AdminFormPage";
import { sanpaiConfig } from "@/lib/sanpai-config";

const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県",
  "三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

const FIELDS = [
  { key: "slug", label: "Slug", required: true },
  { key: "company_name", label: "事業者名", required: true },
  { key: "corporate_number", label: "法人番号" },
  { key: "prefecture", label: "都道府県", type: "select", options: [{ value: "", label: "選択" }, ...PREFECTURES.map((p) => ({ value: p, label: p }))] },
  { key: "city", label: "市区町村" },
  { key: "license_type", label: "許可種別", type: "select", options: [{ value: "", label: "選択" }, ...sanpaiConfig.licenseTypes.map((t) => ({ value: t.slug, label: `${t.icon} ${t.label}` }))] },
  { key: "waste_category", label: "廃棄物区分", type: "select", options: sanpaiConfig.wasteCategories.map((c) => ({ value: c.slug, label: c.label })) },
  { key: "business_area", label: "事業区域" },
  { key: "status", label: "ステータス", type: "select", options: sanpaiConfig.statusOptions.map((s) => ({ value: s.value, label: s.label })) },
  { key: "risk_level", label: "リスクレベル", type: "select", options: sanpaiConfig.riskLevels.map((r) => ({ value: r.value, label: r.label })) },
  { key: "source_name", label: "情報元名" },
  { key: "source_url", label: "情報元URL" },
  { key: "detail_url", label: "詳細URL" },
  { key: "notes", label: "備考", type: "textarea" },
  { key: "is_published", label: "公開状態", type: "checkbox", checkLabel: "公開する" },
];

export default function SanpaiEditPage() {
  const { id } = useParams();
  return (
    <AdminFormPage
      title="産廃事業者 編集"
      apiPath="/api/admin/sanpai"
      basePath="/admin/sanpai"
      itemId={Number(id)}
      fields={FIELDS}
    />
  );
}
