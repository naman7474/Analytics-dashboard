"use client";

import useSWR from "swr";
import { useMerchant } from "./use-merchant";
import { useDateRange } from "./use-date-range";
import { SessionMetrics, ExtendedOrderMetrics, ABComparison, DailyDataPoint } from "../types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`API error: ${r.status}`);
    return r.json();
  });

export interface SessionTrends {
  pagesPerSession: DailyDataPoint[];
  bounceRate: DailyDataPoint[];
  avgSessionDuration: DailyDataPoint[];
}

export interface PerformanceData {
  sessionMetrics: { shopify: SessionMetrics; ratio: SessionMetrics } | null;
  sessionTrends: SessionTrends | null;
  orderMetrics: { shopify: ExtendedOrderMetrics; ratio: ExtendedOrderMetrics } | null;
  cartAbandonmentRate: { shopify: number; ratio: number } | null;
  checkoutAbandonmentRate: { shopify: number; ratio: number } | null;
  isLoading: boolean;
  isLoadingSession: boolean;
  isLoadingOrders: boolean;
}

function mergeDailyMetric(
  shopifyDaily: SessionMetrics["daily"],
  ratioDaily: SessionMetrics["daily"],
  field: "pagesPerSession" | "bounceRate" | "avgSessionDuration"
): DailyDataPoint[] {
  const map = new Map<string, { shopify: number; ratio: number }>();
  for (const d of shopifyDaily) {
    map.set(d.date, { shopify: d[field], ratio: 0 });
  }
  for (const d of ratioDaily) {
    const existing = map.get(d.date) || { shopify: 0, ratio: 0 };
    existing.ratio = d[field];
    map.set(d.date, existing);
  }
  return Array.from(map.entries())
    .map(([date, vals]) => ({ date, ...vals }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function usePerformanceMetrics(comparison: ABComparison | null): PerformanceData {
  const { selectedMerchant } = useMerchant();
  const { dateRange } = useDateRange();

  const enabled = !!selectedMerchant && !!dateRange.from && !!dateRange.to;
  const params = enabled
    ? `merchantId=${selectedMerchant!.id}&from=${dateRange.from}&to=${dateRange.to}`
    : "";

  const { data: sessionData, isLoading: loadingSession } = useSWR(
    enabled ? `/api/shopify/session-metrics?${params}` : null,
    fetcher
  );

  const { data: orderData, isLoading: loadingOrders } = useSWR(
    enabled ? `/api/shopify/orders-extended?${params}` : null,
    fetcher
  );

  const isLoading = loadingSession || loadingOrders;

  // Build daily trend data from session metrics
  let sessionTrends: SessionTrends | null = null;
  const sm = sessionData?.data as { shopify: SessionMetrics; ratio: SessionMetrics } | undefined;
  if (sm?.shopify?.daily && sm?.ratio?.daily) {
    sessionTrends = {
      pagesPerSession: mergeDailyMetric(sm.shopify.daily, sm.ratio.daily, "pagesPerSession"),
      bounceRate: mergeDailyMetric(sm.shopify.daily, sm.ratio.daily, "bounceRate"),
      avgSessionDuration: mergeDailyMetric(sm.shopify.daily, sm.ratio.daily, "avgSessionDuration"),
    };
  }

  // Derive cart/checkout abandonment from existing ABComparison
  let cartAbandonmentRate: { shopify: number; ratio: number } | null = null;
  let checkoutAbandonmentRate: { shopify: number; ratio: number } | null = null;

  if (comparison) {
    const s = comparison.shopify;
    const r = comparison.ratio;
    cartAbandonmentRate = {
      shopify: s.atc > 0 ? ((s.atc - s.checkout) / s.atc) * 100 : 0,
      ratio: r.atc > 0 ? ((r.atc - r.checkout) / r.atc) * 100 : 0,
    };
    checkoutAbandonmentRate = {
      shopify: s.checkout > 0 ? ((s.checkout - s.orders) / s.checkout) * 100 : 0,
      ratio: r.checkout > 0 ? ((r.checkout - r.orders) / r.checkout) * 100 : 0,
    };
  }

  return {
    sessionMetrics: sm || null,
    sessionTrends,
    orderMetrics: orderData?.data || null,
    cartAbandonmentRate,
    checkoutAbandonmentRate,
    isLoading,
    isLoadingSession: loadingSession,
    isLoadingOrders: loadingOrders,
  };
}
