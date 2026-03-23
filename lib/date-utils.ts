import { differenceInDays, format, parseISO } from "date-fns";

/**
 * Convert a date range to ShopifyQL SINCE/UNTIL clause.
 * ShopifyQL uses relative dates like startOfDay(-7d) or absolute dates.
 */
export function toShopifyQLDateRange(from: string, to: string): { since: string; until: string } {
  const today = format(new Date(), "yyyy-MM-dd");
  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  const todayDate = new Date();

  const daysAgoFrom = differenceInDays(todayDate, fromDate);
  const daysAgoTo = differenceInDays(todayDate, toDate);

  const since = daysAgoFrom === 0 ? "today" : `startOfDay(-${daysAgoFrom}d)`;
  const until = daysAgoTo === 0 ? "today" : daysAgoTo === -1 ? "today" : `startOfDay(-${daysAgoTo - 1}d)`;

  return { since, until };
}

/**
 * Format date range for PostHog HogQL interval expression.
 */
export function toPostHogInterval(from: string, to: string): { intervalDays: number; startExpr: string } {
  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  const days = differenceInDays(toDate, fromDate) + 1;
  return {
    intervalDays: days,
    startExpr: `toDate('${from}')`,
  };
}

/**
 * Format date range for GoKwik API params.
 */
export function toGoKwikDateRange(from: string, to: string): {
  current: string;
  compared: string;
} {
  return {
    current: `${from},${to}`,
    compared: `${from},${to}`, // same range for now, could add comparison
  };
}
