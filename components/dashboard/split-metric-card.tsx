"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SplitItem {
  label: string;
  value: number;
}

interface SplitMetricCardProps {
  title: string;
  shopifyData: SplitItem[];
  ratioData: SplitItem[];
}

function SplitBar({ items, color }: { items: SplitItem[]; color: "blue" | "emerald" }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return <p className="text-xs text-gray-400">No data</p>;

  return (
    <div className="space-y-1.5">
      {items.map((item) => {
        const pct = (item.value / total) * 100;
        return (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-right text-[10px] font-medium text-gray-500 sm:w-20 sm:text-xs">
              {item.label}
            </span>
            <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-gray-100 sm:h-5">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full transition-all",
                  color === "blue" ? "bg-blue-500/20" : "bg-emerald-500/20"
                )}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
              <span
                className={cn(
                  "absolute inset-y-0 left-2 flex items-center text-[10px] font-semibold tabular-nums sm:text-xs",
                  color === "blue" ? "text-blue-700" : "text-emerald-700"
                )}
              >
                {pct.toFixed(1)}%
              </span>
            </div>
            <span className="w-10 text-right text-[10px] tabular-nums text-gray-400 sm:w-14 sm:text-xs">
              {item.value.toLocaleString("en-IN")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function SplitMetricCard({ title, shopifyData, ratioData }: SplitMetricCardProps) {
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-gray-500 sm:text-xs">
          {title}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 sm:h-2 sm:w-2" />
              <span className="text-[9px] font-medium uppercase text-gray-400 sm:text-[10px]">Ratio</span>
            </div>
            <SplitBar items={ratioData} color="emerald" />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 sm:h-2 sm:w-2" />
              <span className="text-[9px] font-medium uppercase text-gray-400 sm:text-[10px]">Shopify</span>
            </div>
            <SplitBar items={shopifyData} color="blue" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
