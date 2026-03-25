"use client";

import AdminNav from "@/components/AdminNav";
import SaasItemForm from "@/components/SaasItemForm";

export default function AdminSaasItemNewPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <AdminNav />
      <h1 className="text-xl font-bold text-gray-900 mb-6">SaaSツール新規登録</h1>
      <SaasItemForm />
    </div>
  );
}
