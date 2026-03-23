import { addDaysToISODate, getISTToday } from "./ist-date";

export interface DatePreset {
  label: string;
  getValue: () => { from: string; to: string };
}

export const DATE_PRESETS: DatePreset[] = [
  {
    label: "Today",
    getValue: () => {
      const today = getISTToday();
      return { from: today, to: today };
    },
  },
  {
    label: "Yesterday",
    getValue: () => {
      const day = addDaysToISODate(getISTToday(), -1);
      return { from: day, to: day };
    },
  },
  {
    label: "Last 7 days",
    getValue: () => ({
      from: addDaysToISODate(getISTToday(), -7),
      to: addDaysToISODate(getISTToday(), -1),
    }),
  },
  {
    label: "Last 14 days",
    getValue: () => ({
      from: addDaysToISODate(getISTToday(), -14),
      to: addDaysToISODate(getISTToday(), -1),
    }),
  },
  {
    label: "Last 30 days",
    getValue: () => ({
      from: addDaysToISODate(getISTToday(), -30),
      to: addDaysToISODate(getISTToday(), -1),
    }),
  },
];

export const VARIANT_COLORS = {
  shopify: "#3b82f6", // blue
  ratio: "#22c55e", // green
} as const;
