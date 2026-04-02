import "server-only";

import { MerchantConfig } from "../types";
import { addDaysToISODate, differenceInISODays } from "../ist-date";

const GOKWIK_API = "https://api.gokwik.co/v3/api/dashboard/merchantStats";

/**
 * Compute the compared (previous) date range for GoKwik API.
 * GoKwik expects compared_datetime_range to be the prior period of the same length.
 */
function computeComparedRange(from: string, to: string): string {
  const rangeDays = differenceInISODays(to, from) + 1;
  const comparedTo = addDaysToISODate(from, -1);
  const comparedFrom = addDaysToISODate(comparedTo, -rangeDays + 1);
  return `${comparedFrom},${comparedTo}`;
}

/**
 * Make an authenticated request to the GoKwik API.
 */
async function gokwikFetch(merchant: MerchantConfig, endpoint: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  const url = `${GOKWIK_API}/${endpoint}?${searchParams.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json, text/plain, */*",
      "merchant-mid": merchant.gokwik.merchantMid,
      origin: "https://dashboard.gokwik.co",
      referer: "https://dashboard.gokwik.co/",
      cookie: merchant.gokwik.cookie,
    },
  });

  if (!res.ok) {
    throw new Error(`GoKwik API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetch checkout funnel metrics from GoKwik.
 */
export async function fetchGoKwikCheckoutFunnel(
  merchant: MerchantConfig,
  from: string,
  to: string
) {
  const result = await gokwikFetch(merchant, "checkout-funnel-metrics", {
    payment_method_filter: "all",
    sales_channel: "web",
    current_datetime_range: `${from},${to}`,
    compared_datetime_range: computeComparedRange(from, to),
  });

  return result?.data || null;
}

/**
 * Fetch order metrics from GoKwik (orders, sales, AOV).
 */
export async function fetchGoKwikOrderMetrics(
  merchant: MerchantConfig,
  from: string,
  to: string
) {
  const result = await gokwikFetch(merchant, "order-metrics", {
    payment_method_filter: "all",
    sales_channel: "web",
    current_datetime_range: `${from},${to}`,
    compared_datetime_range: computeComparedRange(from, to),
  });

  const data = result?.data;
  if (!data) return null;

  return {
    orderStats: {
      total: data.orderStats?.total || 0,
      percentageChange: data.orderStats?.percentageChange || "0",
      breakdown: data.orderStats?.primaryBreakdown || [],
    },
    saleStats: {
      total: data.saleStats?.total || 0,
      percentageChange: data.saleStats?.percentageChange || "0",
      breakdown: data.saleStats?.primaryBreakdown || [],
    },
    averageOrderStats: {
      total: data.averageOrderStats?.total || 0,
      percentageChange: data.averageOrderStats?.percentageChange || "0",
      breakdown: data.averageOrderStats?.primaryBreakdown || [],
    },
  };
}

/**
 * Fetch marketing source split from GoKwik.
 * Also fetches order-metrics to get total sales for pro-rata revenue calculation.
 */
export async function fetchGoKwikMarketing(
  merchant: MerchantConfig,
  from: string,
  to: string
) {
  const comparedRange = computeComparedRange(from, to);

  const [splitResult, orderResult] = await Promise.all([
    gokwikFetch(merchant, "gmv-sales-split-metrics", {
      split_by: "mkt_source",
      sales_by: "count",
      sales_channel: "web",
      current_datetime_range: `${from},${to}`,
      compared_datetime_range: comparedRange,
    }),
    gokwikFetch(merchant, "order-metrics", {
      payment_method_filter: "all",
      sales_channel: "web",
      current_datetime_range: `${from},${to}`,
      compared_datetime_range: comparedRange,
    }),
  ]);

  const stats = splitResult?.data?.stats || [];
  const totalOrders = orderResult?.data?.orderStats?.total || 0;
  const totalSales = orderResult?.data?.saleStats?.total || 0;

  return {
    sources: stats.map((s: { source: string; primaryValue: number; contribution: string; percentageChange: string }) => ({
      source: String(s.source),
      orders: Number(s.primaryValue) || 0,
      contribution: s.contribution,
    })),
    totalOrders,
    totalSales,
  };
}

/**
 * Map a GoKwik landing page URL path to a Shopify-compatible landing_page_type.
 */
function landingPagePathToType(path: string): string {
  if (!path || path === "/") return "home";
  const lower = path.toLowerCase();
  if (lower.startsWith("/products")) return "product";
  if (lower.startsWith("/collections")) return "collection";
  if (lower.startsWith("/pages")) return "page";
  if (lower.startsWith("/blogs")) return "blog";
  if (lower.startsWith("/search")) return "search";
  return "other";
}

/**
 * Parse a simple CSV string into an array of string arrays.
 */
function parseCSV(text: string): string[][] {
  return text
    .split("\n")
    .map((line) => line.split(",").map((cell) => cell.trim()))
    .filter((row) => row.length > 1);
}

/**
 * Fetch GoKwik order-level CSV and aggregate orders+sales by landing page type.
 * Returns totals across both variants (GoKwik doesn't split by variant).
 * Filters to web channel only.
 */
export async function fetchGoKwikOrdersByLandingPage(
  merchant: MerchantConfig,
  from: string,
  to: string
): Promise<{ landingPageType: string; orders: number; sales: number }[]> {
  const comparedRange = computeComparedRange(from, to);
  const params = new URLSearchParams({
    current_datetime_range: `${from},${to}`,
    compared_datetime_range: comparedRange,
    mode: "null",
    response_mode: "download",
  });

  const url = `${GOKWIK_API}/gmv-sales-split-metrics?${params.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json, text/plain, */*",
      "merchant-mid": merchant.gokwik.merchantMid,
      origin: "https://dashboard.gokwik.co",
      referer: "https://dashboard.gokwik.co/",
      cookie: merchant.gokwik.cookie,
    },
  });

  if (!res.ok) {
    throw new Error(`GoKwik CSV API error: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  const rows = parseCSV(text);
  if (rows.length < 2) return [];

  // Find column indices from header row
  const header = rows[0].map((h) => h.toLowerCase());
  const salesChannelIdx = header.findIndex((h) => h.includes("sales channel"));
  const landingPageIdx = header.findIndex((h) => h.includes("landing page"));
  const ordersIdx = header.findIndex((h) => h.includes("total orders"));
  const salesIdx = header.findIndex((h) => h.includes("total sales"));

  if (landingPageIdx === -1 || ordersIdx === -1 || salesIdx === -1) return [];

  // Aggregate by landing page type, filtering to web only
  const typeMap = new Map<string, { orders: number; sales: number }>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Skip app channel — only web sessions can be matched to Shopify
    if (salesChannelIdx !== -1 && row[salesChannelIdx]?.toLowerCase() === "app") continue;

    const path = row[landingPageIdx] || "/";
    const pageType = landingPagePathToType(path);
    const orders = Number(row[ordersIdx]) || 0;
    const sales = parseFloat(row[salesIdx]) || 0;

    if (!typeMap.has(pageType)) typeMap.set(pageType, { orders: 0, sales: 0 });
    const entry = typeMap.get(pageType)!;
    entry.orders += orders;
    entry.sales += sales;
  }

  return Array.from(typeMap.entries())
    .map(([landingPageType, data]) => ({
      landingPageType,
      orders: data.orders,
      sales: data.sales,
    }))
    .sort((a, b) => b.orders - a.orders);
}

/**
 * Fetch top product metrics from GoKwik.
 */
export async function fetchGoKwikProducts(
  merchant: MerchantConfig,
  from: string,
  to: string
) {
  const result = await gokwikFetch(merchant, "top-product-metrics", {
    payment_method_filter: "all",
    sales_by: "count",
    sales_channel: "web",
    current_datetime_range: `${from},${to}`,
    compared_datetime_range: computeComparedRange(from, to),
  });

  return result?.data?.stats || [];
}
