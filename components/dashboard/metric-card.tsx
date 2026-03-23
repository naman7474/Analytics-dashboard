"use client";

import { Card, CardContent } from "@/components/ui/card";
import { WinnerBadge, DeltaBadge } from "./winner-badge";
import { cn, calcDelta } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  shopifyValue: number;
  ratioValue: number;
  format: (n: number) => string;
  winner: "shopify" | "ratio" | "tie";
}

export function MetricCard({
  title,
  shopifyValue,
  ratioValue,
  format: fmt,
  winner,
}: MetricCardProps) {
  const delta = calcDelta(ratioValue, shopifyValue);

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-1 sm:mb-3">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 sm:text-xs">
            {title}
          </span>
          <DeltaBadge value={delta} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="space-y-0.5 sm:space-y-1">
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 sm:h-2 sm:w-2" />
              <span className="text-[9px] font-medium uppercase text-zinc-400 sm:text-[10px]">
                Shopify
              </span>
            </div>
            <p className="text-sm font-semibold tabular-nums sm:text-lg">
              {fmt(shopifyValue)}
            </p>
            <WinnerBadge winner={winner} variant="shopify" />
          </div>
          <div className="space-y-0.5 sm:space-y-1">
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 sm:h-2 sm:w-2" />
              <span className="text-[9px] font-medium uppercase text-zinc-400 sm:text-[10px]">
                Ratio
              </span>
            </div>
            <p className="text-sm font-semibold tabular-nums sm:text-lg">
              {fmt(ratioValue)}
            </p>
            <WinnerBadge winner={winner} variant="ratio" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
