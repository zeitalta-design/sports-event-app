"use client";

import AdminNav from "@/components/AdminNav";
import ProviderForm from "@/components/ProviderForm";

export default function AdminProviderNewPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <AdminNav />
      <h1 className="text-xl font-bold text-gray-900 mb-6">ベンダー新規登録</h1>
      <ProviderForm />
    </div>
  );
}
