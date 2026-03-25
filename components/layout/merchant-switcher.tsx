"use client";

import { useMerchant } from "@/lib/hooks/use-merchant";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Store } from "lucide-react";

export function MerchantSwitcher() {
  const { merchants, selectedMerchant, setSelectedMerchantId, isLoading } =
    useMerchant();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Store className="h-4 w-4" />
        Loading...
      </div>
    );
  }

  if (merchants.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Store className="h-4 w-4" />
        No merchants configured
      </div>
    );
  }

  return (
    <Select
      value={selectedMerchant?.id || ""}
      onValueChange={(val) => val && setSelectedMerchantId(val)}
    >
      <SelectTrigger className="w-[160px] sm:w-[220px] h-9">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-gray-500" />
          <span className="truncate">
            {selectedMerchant ? selectedMerchant.name : "Select merchant"}
          </span>
        </div>
      </SelectTrigger>
      <SelectContent>
        {merchants.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
