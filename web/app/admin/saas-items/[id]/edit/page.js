"use client";

import { useParams } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import SaasItemForm from "@/components/SaasItemForm";

export default function AdminSaasItemEditPage() {
  const { id } = useParams();

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <AdminNav />
      <h1 className="text-xl font-bold text-gray-900 mb-6">SaaSツール編集</h1>
      <SaasItemForm itemId={id} />
    </div>
  );
}
