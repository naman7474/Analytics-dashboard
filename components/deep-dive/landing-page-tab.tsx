"use client";

import useSWR from "swr";
import { useMerchant } from "@/lib/hooks/use-merchant";
import { useDateRange } from "@/lib/hooks/use-date-range";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SessionRow {
  landingPageType: string;
  sessions: number;
  sessionsWithCartAdditions: number;
  atcRate: number;
}

interface OrderRow {
  landingPageType: string;
  orders: number;
  sales: number;
}

interface MergedRow {
  landingPageType: string;
  shopifySessions: number;
  ratioSessions: number;
  shopifyAtcRate: number;
  ratioAtcRate: number;
  shopifyOrders: number;
  ratioOrders: number;
  shopifySales: number;
  ratioSales: number;
  shopifyCR: number;
  ratioCR: number;
  crDelta: number;
  shopifyRPS: number;
  ratioRPS: number;
}

/**
 * Normalize landing page type strings for matching across sources.
 */
function normalizeType(t: string): string {
  const lower = t.toLowerCase().trim();
  if (lower.includes("home")) return "home";
  if (lower.includes("product")) return "product";
  if (lower.includes("collection")) return "collection";
  if (lower.includes("blog")) return "blog";
  if (lower.includes("search")) return "search";
  if (lower.includes("page")) return "page";
  return lower || "other";
}

/** Build a map from normalized type → aggregated values */
function indexByType<T extends { landingPageType: string }>(
  rows: T[],
  aggregate: (existing: T, incoming: T) => T
): Map<string, T> {
  const map = new Map<string, T>();
  for (const r of rows) {
    const key = normalizeType(r.landingPageType);
    const existing = map.get(key);
    if (existing) {
      map.set(key, aggregate(existing, r));
    } else {
      map.set(key, { ...r, landingPageType: key });
    }
  }
  return map;
}

/**
 * For order data from Shopify Orders API: trust product, collection & page
 * from URL parsing. Home = total − product − collection − page.
 */
function recomputeHomeOrders(ordersByType: Map<string, OrderRow>, orderRows: OrderRow[]): void {
  const totalOrd = orderRows.reduce((s, r) => s + r.orders, 0);
  const totalSal = orderRows.reduce((s, r) => s + r.sales, 0);
  const productOrd = ordersByType.get("product")?.orders || 0;
  const collectionOrd = ordersByType.get("collection")?.orders || 0;
  const pageOrd = ordersByType.get("page")?.orders || 0;
  const productSal = ordersByType.get("product")?.sales || 0;
  const collectionSal = ordersByType.get("collection")?.sales || 0;
  const pageSal = ordersByType.get("page")?.sales || 0;

  ordersByType.clear();
  ordersByType.set("product", { landingPageType: "product", orders: productOrd, sales: productSal });
  ordersByType.set("collection", { landingPageType: "collection", orders: collectionOrd, sales: collectionSal });
  ordersByType.set("page", { landingPageType: "page", orders: pageOrd, sales: pageSal });
  ordersByType.set("home", {
    landingPageType: "home",
    orders: Math.max(0, totalOrd - productOrd - collectionOrd - pageOrd),
    sales: Math.max(0, totalSal - productSal - collectionSal - pageSal),
  });
}

export function LandingPageTab() {
  const { selectedMerchant } = useMerchant();
  const { dateRange } = useDateRange();

  const { data, isLoading } = useSWR(
    selectedMerchant
      ? `/api/shopify/landing-page-funnel?merchantId=${selectedMerchant.id}&from=${dateRange.from}&to=${dateRange.to}`
      : null,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  const shopifySessionRows: SessionRow[] = data?.data?.shopifySessions || [];
  const ratioSessionRows: SessionRow[] = data?.data?.ratioSessions || [];
  const shopifyOrderRows: OrderRow[] = data?.data?.shopifyOrders || [];
  const ratioOrderRows: OrderRow[] = data?.data?.ratioOrders || [];

  // Index sessions by normalized type
  const shopifyByType = indexByType(shopifySessionRows, (a, b) => ({
    ...a,
    sessions: a.sessions + b.sessions,
    sessionsWithCartAdditions: a.sessionsWithCartAdditions + b.sessionsWithCartAdditions,
    atcRate: (a.sessions + b.sessions) > 0
      ? ((a.sessionsWithCartAdditions + b.sessionsWithCartAdditions) / (a.sessions + b.sessions)) * 100
      : 0,
  }));

  const ratioByType = indexByType(ratioSessionRows, (a, b) => ({
    ...a,
    sessions: a.sessions + b.sessions,
    sessionsWithCartAdditions: a.sessionsWithCartAdditions + b.sessionsWithCartAdditions,
    atcRate: (a.sessions + b.sessions) > 0
      ? ((a.sessionsWithCartAdditions + b.sessionsWithCartAdditions) / (a.sessions + b.sessions)) * 100
      : 0,
  }));

  // Index orders by normalized type, then recompute home as remainder
  const shopifyOrdersByType = indexByType(shopifyOrderRows, (a, b) => ({
    ...a,
    orders: a.orders + b.orders,
    sales: a.sales + b.sales,
  }));
  recomputeHomeOrders(shopifyOrdersByType, shopifyOrderRows);

  const ratioOrdersByType = indexByType(ratioOrderRows, (a, b) => ({
    ...a,
    orders: a.orders + b.orders,
    sales: a.sales + b.sales,
  }));
  recomputeHomeOrders(ratioOrdersByType, ratioOrderRows);

  // Collect all page types
  const allTypes = new Set<string>();
  shopifyByType.forEach((_, k) => allTypes.add(k));
  ratioByType.forEach((_, k) => allTypes.add(k));
  shopifyOrdersByType.forEach((_, k) => allTypes.add(k));
  ratioOrdersByType.forEach((_, k) => allTypes.add(k));

  const emptySession: SessionRow = { landingPageType: "", sessions: 0, sessionsWithCartAdditions: 0, atcRate: 0 };
  const emptyOrder: OrderRow = { landingPageType: "", orders: 0, sales: 0 };

  const merged: MergedRow[] = Array.from(allTypes).map((pageType) => {
    const sSess = shopifyByType.get(pageType) || emptySession;
    const rSess = ratioByType.get(pageType) || emptySession;
    const sOrd = shopifyOrdersByType.get(pageType) || emptyOrder;
    const rOrd = ratioOrdersByType.get(pageType) || emptyOrder;

    const shopifyOrders = sOrd.orders;
    const shopifySales = sOrd.sales;
    const ratioOrders = rOrd.orders;
    const ratioSales = rOrd.sales;

    const shopifyCR = sSess.sessions > 0 ? (shopifyOrders / sSess.sessions) * 100 : 0;
    const ratioCR = rSess.sessions > 0 ? (ratioOrders / rSess.sessions) * 100 : 0;

    return {
      landingPageType: pageType,
      shopifySessions: sSess.sessions,
      ratioSessions: rSess.sessions,
      shopifyAtcRate: sSess.atcRate,
      ratioAtcRate: rSess.atcRate,
      shopifyOrders,
      ratioOrders,
      shopifySales,
      ratioSales,
      shopifyCR,
      ratioCR,
      crDelta: ratioCR - shopifyCR,
      shopifyRPS: sSess.sessions > 0 ? shopifySales / sSess.sessions : 0,
      ratioRPS: rSess.sessions > 0 ? ratioSales / rSess.sessions : 0,
    };
  });

  merged.sort((a, b) => (b.shopifySessions + b.ratioSessions) - (a.shopifySessions + a.ratioSessions));

  const totalShopifySessions = merged.reduce((s, r) => s + r.shopifySessions, 0);
  const totalRatioSessions = merged.reduce((s, r) => s + r.ratioSessions, 0);
  const totalShopifyOrders = shopifyOrderRows.reduce((s, r) => s + r.orders, 0);
  const totalRatioOrders = ratioOrderRows.reduce((s, r) => s + r.orders, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm sm:gap-6">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
          <span className="text-gray-400">Shopify</span>
          <span className="font-medium">{totalShopifySessions.toLocaleString()} sessions &middot; {totalShopifyOrders.toLocaleString()} orders</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-gray-400">Ratio</span>
          <span className="font-medium">{totalRatioSessions.toLocaleString()} sessions &middot; {totalRatioOrders.toLocaleString()} orders</span>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <Table className="min-w-[1000px]">
          <TableHeader>
            <TableRow>
              <TableHead>Landing Page</TableHead>
              <TableHead className="text-right text-blue-500">Shopify Sess.</TableHead>
              <TableHead className="text-right text-emerald-500">Ratio Sess.</TableHead>
              <TableHead className="text-right text-blue-500">Shopify ATC%</TableHead>
              <TableHead className="text-right text-emerald-500">Ratio ATC%</TableHead>
              <TableHead className="text-right text-blue-500">Shopify Ord.</TableHead>
              <TableHead className="text-right text-emerald-500">Ratio Ord.</TableHead>
              <TableHead className="text-right text-blue-500">Shopify CR</TableHead>
              <TableHead className="text-right text-emerald-500">Ratio CR</TableHead>
              <TableHead className="text-right">CR Delta</TableHead>
              <TableHead className="text-right text-blue-500">Shopify RPS</TableHead>
              <TableHead className="text-right text-emerald-500">Ratio RPS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {merged.map((row) => (
              <TableRow key={row.landingPageType}>
                <TableCell className="font-medium text-sm capitalize">
                  {row.landingPageType}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.shopifySessions.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.ratioSessions.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums text-blue-600">
                  {row.shopifyAtcRate > 0 ? row.shopifyAtcRate.toFixed(2) + "%" : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600">
                  {row.ratioAtcRate > 0 ? row.ratioAtcRate.toFixed(2) + "%" : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.shopifyOrders.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.ratioOrders.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums text-blue-600">
                  {row.shopifyCR > 0 ? row.shopifyCR.toFixed(2) + "%" : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600">
                  {row.ratioCR > 0 ? row.ratioCR.toFixed(2) + "%" : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {row.shopifyCR > 0 || row.ratioCR > 0 ? (
                    <span className={row.crDelta > 0 ? "text-emerald-600" : row.crDelta < 0 ? "text-red-500" : "text-gray-400"}>
                      {row.crDelta > 0 ? "+" : ""}{row.crDelta.toFixed(2)}pp
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-blue-600">
                  {row.shopifyRPS > 0 ? `₹${row.shopifyRPS.toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600">
                  {row.ratioRPS > 0 ? `₹${row.ratioRPS.toFixed(2)}` : "—"}
                </TableCell>
              </TableRow>
            ))}
            {merged.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-gray-400 py-8">
                  No data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-[10px] text-gray-400 sm:text-xs">
        Shopify orders: not tagged {selectedMerchant?.ratioTag} or Appbrew. Ratio orders: tagged {selectedMerchant?.ratioTag}. Home = total &minus; product &minus; collection &minus; page.
      </p>
    </div>
  );
}
