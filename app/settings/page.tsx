"use client";

import { useState } from "react";
import { useMerchant } from "@/lib/hooks/use-merchant";
import { MerchantInput, MerchantSummary } from "@/lib/types";
import { MerchantForm } from "@/components/settings/merchant-form";
import { MerchantList } from "@/components/settings/merchant-list";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function SettingsPage() {
  const { merchants, refreshMerchants } = useMerchant();
  const [editing, setEditing] = useState<MerchantSummary | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleSave = async (data: MerchantInput) => {
    const method = data.id ? "PUT" : "POST";
    const url = data.id ? `/api/merchants/${data.id}` : "/api/merchants";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    setEditing(null);
    setShowForm(false);
    refreshMerchants();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this merchant?")) return;
    await fetch(`/api/merchants/${id}`, { method: "DELETE" });
    refreshMerchants();
  };

  const handleEdit = (merchant: MerchantSummary) => {
    setEditing(merchant);
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditing(null);
    setShowForm(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-900 sm:text-lg dark:text-zinc-100">
            Settings
          </h1>
          <p className="text-xs text-zinc-500 sm:text-sm">
            Manage merchant configurations and API credentials.
          </p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5 w-full sm:w-auto">
            <Plus className="h-3.5 w-3.5" />
            Add Merchant
          </Button>
        )}
      </div>

      {showForm ? (
        <MerchantForm
          merchant={editing}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : (
        <MerchantList
          merchants={merchants}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
