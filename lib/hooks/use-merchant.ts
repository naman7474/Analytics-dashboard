"use client";

import { createContext, useContext } from "react";
import { MerchantSummary } from "../types";

interface MerchantContextValue {
  merchants: MerchantSummary[];
  selectedMerchant: MerchantSummary | null;
  setSelectedMerchantId: (id: string) => void;
  refreshMerchants: () => void;
  isLoading: boolean;
}

export const MerchantContext = createContext<MerchantContextValue>({
  merchants: [],
  selectedMerchant: null,
  setSelectedMerchantId: () => {},
  refreshMerchants: () => {},
  isLoading: false,
});

export function useMerchant() {
  return useContext(MerchantContext);
}
