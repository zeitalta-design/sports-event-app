"use client";

import { useParams } from "next/navigation";
import ProviderForm from "@/components/ProviderForm";

export default function AdminProviderEditPage() {
  const { id } = useParams();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">ベンダー編集</h1>
      <ProviderForm providerId={id} />
    </div>
  );
}
