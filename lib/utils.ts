import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

export function formatCurrency(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function formatPercent(n: number): string {
  return n.toFixed(2) + "%";
}

export function calcDelta(a: number, b: number): number {
  if (b === 0) return 0;
  return ((a - b) / b) * 100;
}
