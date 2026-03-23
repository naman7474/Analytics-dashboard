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

interface AudienceRow {
  landingPageType: string;
  sessions: number;
}

export function AudienceTab() {
  const { selectedMerchant } = useMerchant();
  const { dateRange } = useDateRange();

  const { data, isLoading } = useSWR(
    selectedMerchant
      ? `/api/posthog/audience?merchantId=${selectedMerchant.id}&from=${dateRange.from}&to=${dateRange.to}`
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

  const ratioRows: AudienceRow[] = data?.data?.ratio || [];
  const shopifyRows: AudienceRow[] = data?.data?.shopify || [];

  const allowedTypes = new Set(["Product", "Collection", "Homepage", "Custom Page"]);

  // Build a unified list of allowed landing page types
  const allTypes = new Set<string>();
  ratioRows.filter((r) => allowedTypes.has(r.landingPageType)).forEach((r) => allTypes.add(r.landingPageType));
  shopifyRows.filter((r) => allowedTypes.has(r.landingPageType)).forEach((r) => allTypes.add(r.landingPageType));

  const ratioMap = new Map(ratioRows.map((r) => [r.landingPageType, r.sessions]));
  const shopifyMap = new Map(shopifyRows.map((r) => [r.landingPageType, r.sessions]));

  const totalRatio = ratioRows.reduce((s, r) => s + r.sessions, 0);
  const totalShopify = shopifyRows.reduce((s, r) => s + r.sessions, 0);

  // Sort by combined sessions descending
  const sortedTypes = Array.from(allTypes).sort(
    (a, b) =>
      (ratioMap.get(b) || 0) + (shopifyMap.get(b) || 0) -
      ((ratioMap.get(a) || 0) + (shopifyMap.get(a) || 0))
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm sm:gap-6">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-zinc-400">Ratio</span>
          <span className="font-medium">{totalRatio.toLocaleString()} sessions</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
          <span className="text-zinc-400">Shopify</span>
          <span className="font-medium">{totalShopify.toLocaleString()} sessions</span>
        </div>
      </div>

      <div className="overflow-x-auto">
      <Table className="min-w-[480px]">
        <TableHeader>
          <TableRow>
            <TableHead>Landing Page Type</TableHead>
            <TableHead className="text-right">
              <span className="text-emerald-500">Ratio</span> Sessions
            </TableHead>
            <TableHead className="text-right">
              <span className="text-emerald-500">Ratio</span> %
            </TableHead>
            <TableHead className="text-right">
              <span className="text-blue-500">Shopify</span> Sessions
            </TableHead>
            <TableHead className="text-right">
              <span className="text-blue-500">Shopify</span> %
            </TableHead>
            <TableHead className="text-right">Delta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTypes.map((pageType) => {
            const ratioSessions = ratioMap.get(pageType) || 0;
            const shopifySessions = shopifyMap.get(pageType) || 0;
            const ratioPctNum = totalRatio ? (ratioSessions / totalRatio) * 100 : 0;
            const shopifyPctNum = totalShopify ? (shopifySessions / totalShopify) * 100 : 0;
            const delta = ratioPctNum - shopifyPctNum;

            return (
              <TableRow key={pageType}>
                <TableCell className="font-medium text-sm">{pageType}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {ratioSessions.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums text-emerald-500">
                  {ratioPctNum.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {shopifySessions.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums text-blue-500">
                  {shopifyPctNum.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  <span className={delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-zinc-400"}>
                    {delta > 0 ? "+" : ""}{delta.toFixed(1)}pp
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
          {sortedTypes.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-zinc-400 py-8">
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
