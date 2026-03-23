"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { MerchantContext } from "@/lib/hooks/use-merchant";
import { DateRangeContext } from "@/lib/hooks/use-date-range";
import { MerchantSummary, DateRange } from "@/lib/types";
import { addDaysToISODate, getISTToday } from "@/lib/ist-date";

export function Providers({ children }: { children: ReactNode }) {
  const today = getISTToday();
  const [merchants, setMerchants] = useState<MerchantSummary[]>([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: addDaysToISODate(today, -7),
    to: addDaysToISODate(today, -1),
  });

  const fetchMerchants = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/merchants");
      const data = await res.json();
      setMerchants(data);
    } catch (e) {
      console.error("Failed to fetch merchants:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMerchants();
  }, [fetchMerchants]);

  useEffect(() => {
    if (merchants.length === 0) {
      if (selectedMerchantId) {
        setSelectedMerchantId("");
      }
      return;
    }

    const hasSelectedMerchant = merchants.some(
      (merchant) => merchant.id === selectedMerchantId
    );

    if (!hasSelectedMerchant) {
      setSelectedMerchantId(merchants[0].id);
    }
  }, [merchants, selectedMerchantId]);

  const selectedMerchant =
    merchants.find((m) => m.id === selectedMerchantId) || null;

  return (
    <MerchantContext.Provider
      value={{
        merchants,
        selectedMerchant,
        setSelectedMerchantId,
        refreshMerchants: fetchMerchants,
        isLoading,
      }}
    >
      <DateRangeContext.Provider value={{ dateRange, setDateRange }}>
        {children}
      </DateRangeContext.Provider>
    </MerchantContext.Provider>
  );
}
