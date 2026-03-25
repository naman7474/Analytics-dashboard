"use client";

import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface WinnerBadgeProps {
  winner: "shopify" | "ratio" | "tie";
  variant: "shopify" | "ratio";
}

export function WinnerBadge({ winner, variant }: WinnerBadgeProps) {
  if (winner === "tie") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
        <Minus className="h-3 w-3" />
        Tie
      </span>
    );
  }

  const isWinner = winner === variant;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        isWinner
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-600"
      )}
    >
      {isWinner ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      {isWinner ? "Winner" : "Lower"}
    </span>
  );
}

interface DeltaBadgeProps {
  value: number;
  suffix?: string;
}

export function DeltaBadge({ value, suffix = "%" }: DeltaBadgeProps) {
  const isPositive = value > 0;
  const isZero = value === 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        isZero
          ? "text-gray-400"
          : isPositive
          ? "text-emerald-600"
          : "text-red-500"
      )}
    >
      {isPositive && "+"}
      {value.toFixed(1)}
      {suffix}
    </span>
  );
}
