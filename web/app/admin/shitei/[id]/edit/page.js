"use client";
import { useParams } from "next/navigation";
import AdminFormPage from "@/components/admin/AdminFormPage";
import { shiteiConfig } from "@/lib/shitei-config";

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
  { key: "title", label: "案件名", required: true },
  { key: "municipality_name", label: "自治体名" },
  { key: "prefecture", label: "都道府県", type: "select", options: [{ value: "", label: "選択" }, ...PREFECTURES.map((p) => ({ value: p, label: p }))] },
  { key: "facility_category", label: "施設種別", type: "select", options: [{ value: "", label: "選択" }, ...shiteiConfig.facilityCategories.map((c) => ({ value: c.slug, label: `${c.icon} ${c.label}` }))] },
  { key: "facility_name", label: "施設名" },
  { key: "recruitment_status", label: "募集状態", type: "select", options: shiteiConfig.recruitmentStatuses.map((s) => ({ value: s.value, label: s.label })) },
  { key: "application_start_date", label: "公募開始日" },
  { key: "application_deadline", label: "応募期限" },
  { key: "opening_date", label: "説明会日" },
  { key: "contract_start_date", label: "契約開始日" },
  { key: "contract_end_date", label: "契約終了日" },
  { key: "summary", label: "概要", type: "textarea" },
  { key: "eligibility", label: "応募資格", type: "textarea" },
  { key: "application_method", label: "応募方法", type: "textarea" },
  { key: "detail_url", label: "公募詳細URL" },
  { key: "source_name", label: "情報元名" },
  { key: "source_url", label: "情報元URL" },
  { key: "notes", label: "備考", type: "textarea" },
  { key: "is_published", label: "公開状態", type: "checkbox", checkLabel: "公開する" },
];

export default function ShiteiEditPage() {
  const { id } = useParams();
  return (
    <AdminFormPage
      title="公募案件 編集"
      apiPath="/api/admin/shitei"
      basePath="/admin/shitei"
      itemId={Number(id)}
      fields={FIELDS}
    />
  );
}
