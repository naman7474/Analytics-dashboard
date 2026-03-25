"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ABComparison } from "@/lib/types";
import { formatNumber, formatCurrency, formatPercent } from "@/lib/utils";
import { DeltaBadge } from "./winner-badge";
import { cn } from "@/lib/utils";

interface FunnelComparisonProps {
  data: ABComparison;
}

export function FunnelComparison({ data }: FunnelComparisonProps) {
  const rows = [
    {
      step: "Sessions",
      shopify: data.shopify.sessions,
      ratio: data.ratio.sessions,
      shopifyRate: null,
      ratioRate: null,
      format: formatNumber,
    },
    {
      step: "Add to Cart",
      shopify: data.shopify.atc,
      ratio: data.ratio.atc,
      shopifyRate: data.shopify.atcRate,
      ratioRate: data.ratio.atcRate,
      format: formatNumber,
    },
    {
      step: "Checkout",
      shopify: data.shopify.checkout,
      ratio: data.ratio.checkout,
      shopifyRate: data.shopify.checkoutRate,
      ratioRate: data.ratio.checkoutRate,
      format: formatNumber,
    },
    {
      step: "Orders",
      shopify: data.shopify.orders,
      ratio: data.ratio.orders,
      shopifyRate: data.shopify.conversionRate,
      ratioRate: data.ratio.conversionRate,
      format: formatNumber,
    },
    {
      step: "Sales",
      shopify: data.shopify.sales,
      ratio: data.ratio.sales,
      shopifyRate: null,
      ratioRate: null,
      format: formatCurrency,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">
          Funnel Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0 overflow-x-auto">
        <Table className="min-w-[540px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6 w-[120px]">Step</TableHead>
              <TableHead className="text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  Shopify
                </div>
              </TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  Ratio
                </div>
              </TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right pr-6">Delta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              // For steps with rates, show the rate delta (percentage point difference).
              // For steps without rates (Sessions, Sales), show relative % change.
              let delta: number;
              if (row.ratioRate !== null && row.shopifyRate !== null) {
                delta = row.ratioRate - row.shopifyRate;
              } else {
                delta =
                  row.shopify === 0
                    ? 0
                    : ((row.ratio - row.shopify) / row.shopify) * 100;
              }

              return (
                <TableRow key={row.step}>
                  <TableCell className="pl-6 font-medium text-sm">
                    {row.step}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {row.format(row.shopify)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-gray-400">
                    {row.shopifyRate !== null
                      ? formatPercent(row.shopifyRate)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {row.format(row.ratio)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-gray-400">
                    {row.ratioRate !== null
                      ? formatPercent(row.ratioRate)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <DeltaBadge
                      value={delta}
                      suffix={row.ratioRate !== null ? "pp" : "%"}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
