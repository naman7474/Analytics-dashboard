"use client";

import { createContext, useContext } from "react";
import { DateRange } from "../types";

interface DateRangeContextValue {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}

export const DateRangeContext = createContext<DateRangeContextValue>({
  dateRange: { from: "", to: "" },
  setDateRange: () => {},
});

export function useDateRange() {
  return useContext(DateRangeContext);
}
