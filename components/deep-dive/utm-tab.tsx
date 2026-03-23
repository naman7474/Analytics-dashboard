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

/**
 * Canonical source names — merge google + google-ads into "google".
 */
const SOURCE_ALIASES: Record<string, string> = {
  "google-ads": "google",
  "google": "google",
};

/**
 * Match a PostHog utm_source to a canonical source using contains logic.
 */
function matchToCanonicalSource(
  posthogSource: string,
  gokwikSources: string[]
): string {
  const lower = posthogSource.toLowerCase();
  if (!posthogSource || lower === "(direct)" || lower === "(none)" || lower === "null") {
    return "direct";
  }
  for (const gkSource of gokwikSources) {
    if (lower.includes(gkSource.toLowerCase()) || gkSource.toLowerCase().includes(lower)) {
      return SOURCE_ALIASES[gkSource] || gkSource;
    }
  }
  return posthogSource;
}

/**
 * Match a Shopify referrer_source to a GoKwik source.
 * Shopify uses categories: "direct", "social", "search", "email", "paid", "unknown"
 * GoKwik uses: "direct", "facebook", "google-ads", "google", "pp"
 */
function matchShopifyToGokwik(
  shopifySource: string,
  gokwikSources: string[]
): string {
  const lower = shopifySource.toLowerCase();
  if (lower === "direct") return "direct";
  // "social" maps to "facebook" as the primary social source
  if (lower === "social") return gokwikSources.includes("facebook") ? "facebook" : shopifySource;
  // "search" and "paid" both map to "google" (google + google-ads combined)
  if (lower === "search") return "google";
  if (lower === "paid") return "google";
  for (const gkSource of gokwikSources) {
    if (lower.includes(gkSource.toLowerCase())) return SOURCE_ALIASES[gkSource] || gkSource;
  }
  return shopifySource;
}

export function UTMTab() {
  const { selectedMerchant } = useMerchant();
  const { dateRange } = useDateRange();

  const { data, isLoading } = useSWR(
    selectedMerchant
      ? `/api/posthog/utm?merchantId=${selectedMerchant.id}&from=${dateRange.from}&to=${dateRange.to}`
      : null,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  const posthogRows: Array<{ source: string; sessions: number; orders: number }> =
    data?.data?.posthogUTM || [];
  const gokwikData = data?.data?.gokwik || { sources: [], totalOrders: 0, totalSales: 0 };
  const gokwikSources: Array<{ source: string; orders: number }> = gokwikData.sources;
  const totalGokwikOrders: number = gokwikData.totalOrders;
  const totalGokwikSales: number = gokwikData.totalSales;
  const shopifySessionRows: Array<{ source: string; sessions: number }> =
    data?.data?.shopifySessions || [];

  const gkSourceNames = gokwikSources.map((s) => s.source);

  // Merge GoKwik orders using canonical names (google + google-ads → google)
  const gkOrdersMap = new Map<string, number>();
  for (const s of gokwikSources) {
    const canonical = SOURCE_ALIASES[s.source] || s.source;
    gkOrdersMap.set(canonical, (gkOrdersMap.get(canonical) || 0) + s.orders);
  }

  // Aggregate PostHog Ratio sessions & orders by matched canonical source
  const ratioMap = new Map<string, { sessions: number; orders: number }>();
  for (const row of posthogRows) {
    const matched = matchToCanonicalSource(row.source, gkSourceNames);
    if (!ratioMap.has(matched)) ratioMap.set(matched, { sessions: 0, orders: 0 });
    const entry = ratioMap.get(matched)!;
    entry.sessions += row.sessions;
    entry.orders += row.orders;
  }

  // Aggregate Shopify sessions by matched GoKwik source
  const shopifyMap = new Map<string, number>();
  for (const row of shopifySessionRows) {
    const matched = matchShopifyToGokwik(row.source, gkSourceNames);
    shopifyMap.set(matched, (shopifyMap.get(matched) || 0) + row.sessions);
  }

  // Ensure all canonical GoKwik sources appear
  for (const canonical of gkOrdersMap.keys()) {
    if (!ratioMap.has(canonical)) ratioMap.set(canonical, { sessions: 0, orders: 0 });
    if (!shopifyMap.has(canonical)) shopifyMap.set(canonical, 0);
  }

  // Collect all sources
  const allSources = new Set<string>();
  ratioMap.forEach((_, k) => allSources.add(k));
  shopifyMap.forEach((_, k) => allSources.add(k));

  // Build merged rows
  const merged = Array.from(allSources).map((source) => {
    const ratio = ratioMap.get(source) || { sessions: 0, orders: 0 };
    const shopifySessions = shopifyMap.get(source) || 0;
    const gokwikOrders = gkOrdersMap.get(source) || 0;

    // Ratio orders from PostHog, Shopify orders = GoKwik total − Ratio
    const ratioOrders = ratio.orders;
    const shopifyOrders = Math.max(0, gokwikOrders - ratioOrders);

    // Pro-rata sales by order count
    const ratioSales = totalGokwikOrders > 0 ? (ratioOrders / totalGokwikOrders) * totalGokwikSales : 0;
    const shopifySales = totalGokwikOrders > 0 ? (shopifyOrders / totalGokwikOrders) * totalGokwikSales : 0;

    const ratioCR = ratio.sessions > 0 ? (ratioOrders / ratio.sessions) * 100 : 0;
    const shopifyCR = shopifySessions > 0 ? (shopifyOrders / shopifySessions) * 100 : 0;
    const ratioRPS = ratio.sessions > 0 ? ratioSales / ratio.sessions : 0;
    const shopifyRPS = shopifySessions > 0 ? shopifySales / shopifySessions : 0;

    return {
      source,
      ratioSessions: ratio.sessions,
      shopifySessions,
      ratioOrders,
      shopifyOrders,
      gokwikOrders,
      ratioCR,
      shopifyCR,
      crDelta: ratioCR - shopifyCR,
      ratioRPS,
      shopifyRPS,
      rpsDelta: shopifyRPS > 0 ? ((ratioRPS - shopifyRPS) / shopifyRPS) * 100 : 0,
    };
  });

  merged.sort((a, b) => b.gokwikOrders - a.gokwikOrders);

  const totalRatioSessions = merged.reduce((s, r) => s + r.ratioSessions, 0);
  const totalShopifySessions = merged.reduce((s, r) => s + r.shopifySessions, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm sm:gap-6">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-zinc-400">Ratio</span>
          <span className="font-medium">{totalRatioSessions.toLocaleString()} sessions</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
          <span className="text-zinc-400">Shopify</span>
          <span className="font-medium">{totalShopifySessions.toLocaleString()} sessions</span>
        </div>
        <div className="text-zinc-400">
          GoKwik: {totalGokwikOrders.toLocaleString()} orders
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead className="text-right text-emerald-500">Ratio Sess.</TableHead>
              <TableHead className="text-right text-blue-500">Shopify Sess.</TableHead>
              <TableHead className="text-right text-emerald-500">Ratio Ord.</TableHead>
              <TableHead className="text-right text-blue-500">Shopify Ord.</TableHead>
              <TableHead className="text-right text-emerald-500">Ratio CR</TableHead>
              <TableHead className="text-right text-blue-500">Shopify CR</TableHead>
              <TableHead className="text-right">CR Delta</TableHead>
              <TableHead className="text-right text-emerald-500">Ratio RPS</TableHead>
              <TableHead className="text-right text-blue-500">Shopify RPS</TableHead>
              <TableHead className="text-right">RPS Delta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {merged.map((row) => (
              <TableRow key={row.source}>
                <TableCell className="font-medium text-sm">{row.source}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.ratioSessions.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.shopifySessions.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.ratioOrders.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.shopifyOrders.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600">
                  {row.ratioCR > 0 ? row.ratioCR.toFixed(2) + "%" : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-blue-600">
                  {row.shopifyCR > 0 ? row.shopifyCR.toFixed(2) + "%" : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {row.ratioCR > 0 || row.shopifyCR > 0 ? (
                    <span className={row.crDelta > 0 ? "text-emerald-600" : row.crDelta < 0 ? "text-red-500" : "text-zinc-400"}>
                      {row.crDelta > 0 ? "+" : ""}{row.crDelta.toFixed(2)}pp
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600">
                  {row.ratioRPS > 0 ? `₹${row.ratioRPS.toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-blue-600">
                  {row.shopifyRPS > 0 ? `₹${row.shopifyRPS.toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {row.ratioRPS > 0 || row.shopifyRPS > 0 ? (
                    <span className={row.rpsDelta > 0 ? "text-emerald-600" : row.rpsDelta < 0 ? "text-red-500" : "text-zinc-400"}>
                      {row.rpsDelta > 0 ? "+" : ""}{row.rpsDelta.toFixed(1)}%
                    </span>
                  ) : "—"}
                </TableCell>
              </TableRow>
            ))}
            {merged.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-zinc-400 py-8">
                  No data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
