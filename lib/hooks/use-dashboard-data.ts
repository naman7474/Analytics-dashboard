"use client";

import useSWR from "swr";
import { useMerchant } from "./use-merchant";
import { useDateRange } from "./use-date-range";
import { ABComparison, DailyTrends, VariantFunnel } from "../types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ShopifyOrdersSummary {
  orders: Record<string, { orders: number; sales: number }>;
  totalOrders: number;
  totalSales: number;
}

function buildParams(merchantId: string, from: string, to: string) {
  return `merchantId=${merchantId}&from=${from}&to=${to}`;
}

export function useDashboardData() {
  const { selectedMerchant } = useMerchant();
  const { dateRange } = useDateRange();

  const enabled = !!selectedMerchant && !!dateRange.from && !!dateRange.to;
  const params = enabled
    ? buildParams(selectedMerchant!.id, dateRange.from, dateRange.to)
    : "";

  // Shopify sessions (variant A — sessions NOT on store.domain)
  const { data: shopifySessions, isLoading: loadingSessions } = useSWR(
    enabled ? `/api/shopify/sessions?${params}&variant=shopify` : null,
    fetcher
  );

  // Shopify sessions (variant B — sessions ON store.domain)
  const { data: ratioSessions, isLoading: loadingRatioSessions } = useSWR(
    enabled ? `/api/shopify/sessions?${params}&variant=ratio` : null,
    fetcher
  );

  // PostHog funnel (variant B — checkout + orders from PostHog)
  const { data: posthogFunnel, isLoading: loadingFunnel } = useSWR(
    enabled ? `/api/posthog/funnel?${params}` : null,
    fetcher
  );

  // GoKwik checkout funnel (total across both variants)
  const { data: gokwikCheckout, isLoading: loadingGokwikCheckout } = useSWR(
    enabled ? `/api/gokwik/checkout-funnel?${params}` : null,
    fetcher
  );

  // Shopify orders for Shopify variant (directly from Shopify, not derived from GoKwik)
  const { data: shopifyOrdersData, isLoading: loadingShopifyOrders } = useSWR(
    enabled ? `/api/shopify/orders?${params}&variant=shopify` : null,
    fetcher
  );

  // Shopify orders for Ratio variant (actual sales, not pro-rata)
  const { data: ratioOrdersData, isLoading: loadingRatioOrders } = useSWR(
    enabled ? `/api/shopify/orders?${params}&variant=ratio` : null,
    fetcher
  );

  const isLoading =
    loadingSessions ||
    loadingRatioSessions ||
    loadingFunnel ||
    loadingGokwikCheckout ||
    loadingShopifyOrders ||
    loadingRatioOrders;

  let comparison: ABComparison | null = null;
  let dailyTrends: DailyTrends | null = null;

  if (
    shopifySessions?.data &&
    ratioSessions?.data &&
    posthogFunnel?.data &&
    shopifyOrdersData?.data
  ) {
    // ── Variant A: Shopify sessions from ShopifyQL ──
    const shopifySessionsData = shopifySessions.data;
    const totalShopifySessions = shopifySessionsData.reduce(
      (s: number, d: { sessions: number }) => s + d.sessions,
      0
    );
    const totalShopifyATC = shopifySessionsData.reduce(
      (s: number, d: { sessionsWithCartAdditions: number }) =>
        s + d.sessionsWithCartAdditions,
      0
    );

    // ── Variant B: Sessions & ATC from Shopify, checkout & orders from PostHog ──
    const ratioSessionsData = ratioSessions.data;
    const totalRatioSessions = ratioSessionsData.reduce(
      (s: number, d: { sessions: number }) => s + d.sessions,
      0
    );
    const totalRatioATC = ratioSessionsData.reduce(
      (s: number, d: { sessionsWithCartAdditions: number }) =>
        s + d.sessionsWithCartAdditions,
      0
    );
    const posthogData = posthogFunnel.data;
    const totalRatioCheckout = posthogData.reduce(
      (s: number, d: { sessionsWithCheckout: number }) =>
        s + d.sessionsWithCheckout,
      0
    );
    const totalRatioOrders = posthogData.reduce(
      (s: number, d: { totalOrders: number }) => s + d.totalOrders,
      0
    );

    // GoKwik checkout funnel — conversionFunnel is an array of events
    // Each event has { event, primaryValue (count), conversion (%), ... }
    // CheckoutStarted.primaryValue = total checkout-started count
    let gokwikTotalCheckoutStarted = 0;
    const checkoutData = gokwikCheckout?.data;
    if (checkoutData?.conversionFunnel?.length > 0) {
      const checkoutEvent = checkoutData.conversionFunnel.find(
        (e: { event: string }) => e.event === "CheckoutStarted"
      );
      if (checkoutEvent) {
        gokwikTotalCheckoutStarted = Number(checkoutEvent.primaryValue) || 0;
      }
    }

    // ── Derive Shopify checkout = GoKwik total checkout − Ratio checkout ──
    const shopifyCheckout = Math.max(0, gokwikTotalCheckoutStarted - totalRatioCheckout);

    // ── Shopify (A) orders directly from Shopify (Gokwik-tagged, excluding Ratio & Appbrew) ──
    const shopifyOrderSummary: ShopifyOrdersSummary = shopifyOrdersData.data;
    const actualShopifyOrders = shopifyOrderSummary.totalOrders;
    const actualShopifySales = shopifyOrderSummary.totalSales;

    // ── Ratio (B) orders from Shopify, with PostHog fallback ──
    const ratioOrderSummary: ShopifyOrdersSummary | undefined = ratioOrdersData?.data;
    const actualRatioOrders = ratioOrderSummary?.totalOrders ?? totalRatioOrders;
    const actualRatioSales = ratioOrderSummary?.totalSales ?? 0;

    const shopifyFunnel: VariantFunnel = {
      sessions: totalShopifySessions,
      atc: totalShopifyATC,
      checkout: shopifyCheckout,
      orders: actualShopifyOrders,
      sales: actualShopifySales,
      atcRate: totalShopifySessions ? (totalShopifyATC / totalShopifySessions) * 100 : 0,
      checkoutRate: totalShopifySessions ? (shopifyCheckout / totalShopifySessions) * 100 : 0,
      conversionRate: totalShopifySessions ? (actualShopifyOrders / totalShopifySessions) * 100 : 0,
      aov: actualShopifyOrders ? actualShopifySales / actualShopifyOrders : 0,
      rps: totalShopifySessions ? actualShopifySales / totalShopifySessions : 0,
    };

    const ratioFunnel: VariantFunnel = {
      sessions: totalRatioSessions,
      atc: totalRatioATC,
      checkout: totalRatioCheckout,
      orders: actualRatioOrders,
      sales: actualRatioSales,
      atcRate: totalRatioSessions ? (totalRatioATC / totalRatioSessions) * 100 : 0,
      checkoutRate: totalRatioSessions ? (totalRatioCheckout / totalRatioSessions) * 100 : 0,
      conversionRate: totalRatioSessions ? (actualRatioOrders / totalRatioSessions) * 100 : 0,
      aov: actualRatioOrders ? actualRatioSales / actualRatioOrders : 0,
      rps: totalRatioSessions ? actualRatioSales / totalRatioSessions : 0,
    };

    const winner = (a: number, b: number): "shopify" | "ratio" | "tie" =>
      a > b ? "shopify" : b > a ? "ratio" : "tie";

    comparison = {
      shopify: shopifyFunnel,
      ratio: ratioFunnel,
      winner: {
        conversionRate: winner(shopifyFunnel.conversionRate, ratioFunnel.conversionRate),
        rps: winner(shopifyFunnel.rps, ratioFunnel.rps),
        aov: winner(shopifyFunnel.aov, ratioFunnel.aov),
      },
    };

    // ── Daily trends ──
    const shopifyDailyOrderBreakdown = shopifyOrderSummary.orders || {};
    const ratioDailyOrderBreakdown = ratioOrderSummary?.orders || {};

    const dateMap = new Map<string, {
      shopifySessions: number; ratioSessions: number;
      shopifyOrders: number; ratioOrders: number;
      shopifySales: number; ratioSales: number;
    }>();

    const emptyDay = () => ({
      shopifySessions: 0, ratioSessions: 0,
      shopifyOrders: 0, ratioOrders: 0,
      shopifySales: 0, ratioSales: 0,
    });

    for (const d of shopifySessionsData) {
      if (!dateMap.has(d.date)) dateMap.set(d.date, emptyDay());
      dateMap.get(d.date)!.shopifySessions = d.sessions;
    }

    for (const d of ratioSessionsData) {
      if (!dateMap.has(d.date)) dateMap.set(d.date, emptyDay());
      dateMap.get(d.date)!.ratioSessions = d.sessions;
    }

    // Ratio daily orders from PostHog
    for (const d of posthogData) {
      if (!dateMap.has(d.date)) dateMap.set(d.date, emptyDay());
      dateMap.get(d.date)!.ratioOrders = d.totalOrders;
    }

    for (const date of Object.keys(shopifyDailyOrderBreakdown)) {
      if (!dateMap.has(date)) dateMap.set(date, emptyDay());
    }

    for (const date of Object.keys(ratioDailyOrderBreakdown)) {
      if (!dateMap.has(date)) dateMap.set(date, emptyDay());
    }

    for (const [date, entry] of dateMap.entries()) {
      const shopifyDay = shopifyDailyOrderBreakdown[date] || { orders: 0, sales: 0 };
      entry.shopifyOrders = shopifyDay.orders;
      entry.shopifySales = shopifyDay.sales;

      const ratioDay = ratioDailyOrderBreakdown[date];
      if (ratioDay) {
        entry.ratioOrders = ratioDay.orders;
        entry.ratioSales = ratioDay.sales;
      }
      // Otherwise ratioOrders from PostHog is already populated, ratioSales stays 0
    }

    const sortedDates = Array.from(dateMap.keys()).sort();

    dailyTrends = {
      sessions: sortedDates.map((date) => ({
        date,
        shopify: dateMap.get(date)!.shopifySessions,
        ratio: dateMap.get(date)!.ratioSessions,
      })),
      orders: sortedDates.map((date) => ({
        date,
        shopify: dateMap.get(date)!.shopifyOrders,
        ratio: dateMap.get(date)!.ratioOrders,
      })),
      sales: sortedDates.map((date) => ({
        date,
        shopify: dateMap.get(date)!.shopifySales,
        ratio: dateMap.get(date)!.ratioSales,
      })),
      conversionRate: sortedDates.map((date) => {
        const d = dateMap.get(date)!;
        return {
          date,
          shopify: d.shopifySessions ? (d.shopifyOrders / d.shopifySessions) * 100 : 0,
          ratio: d.ratioSessions ? (d.ratioOrders / d.ratioSessions) * 100 : 0,
        };
      }),
      rps: sortedDates.map((date) => {
        const d = dateMap.get(date)!;
        return {
          date,
          shopify: d.shopifySessions ? d.shopifySales / d.shopifySessions : 0,
          ratio: d.ratioSessions ? d.ratioSales / d.ratioSessions : 0,
        };
      }),
    };
  }

  return { comparison, dailyTrends, isLoading, enabled };
}

