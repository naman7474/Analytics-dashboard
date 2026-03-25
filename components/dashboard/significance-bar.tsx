"use client";

import { ABComparison } from "@/lib/types";
import { useUser } from "@/lib/hooks/use-user";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Approximation of the standard normal CDF using Abramowitz & Stegun formula.
 * Accurate to ~1.5e-7.
 */
function normalCDF(z: number): number {
  if (z < -8) return 0;
  if (z > 8) return 1;

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1 + sign * y);
}

const MIN_SESSIONS = 100;
const MAX_SESSION_RATIO = 20; // flag if one variant has 20x more sessions than the other

interface SignificanceResult {
  winner: "shopify" | "ratio" | "tie";
  confidence: number; // 0-100
  lift: number; // % lift of winner over loser
  zScore: number;
  sessionImbalance: boolean; // true when session counts are heavily skewed
}

/**
 * Two-sample z-test on Revenue Per Session (RPS).
 *
 * Variance approximation for RPS:
 *   Each session yields revenue = 0 (no purchase) or ~AOV (purchase).
 *   Var(X) ≈ p × AOV² × (1 - p)  where p = conversion_rate (decimal)
 *
 * z = (rps_a - rps_b) / sqrt(var_a/n_a + var_b/n_b)
 */
function computeRPSSignificance(data: ABComparison): SignificanceResult {
  const s = data.shopify;
  const r = data.ratio;

  // Check session imbalance
  const minSess = Math.min(s.sessions, r.sessions);
  const maxSess = Math.max(s.sessions, r.sessions);
  const sessionImbalance = minSess > 0 && maxSess / minSess > MAX_SESSION_RATIO;

  // Need minimum sessions on BOTH variants for a meaningful test
  if (s.sessions < MIN_SESSIONS || r.sessions < MIN_SESSIONS) {
    return { winner: "tie", confidence: 0, lift: 0, zScore: 0, sessionImbalance };
  }

  const pS = s.orders / s.sessions; // conversion rate (decimal)
  const pR = r.orders / r.sessions;

  const varS = pS * s.aov * s.aov * (1 - pS);
  const varR = pR * r.aov * r.aov * (1 - pR);

  const se = Math.sqrt(varS / s.sessions + varR / r.sessions);

  if (se === 0) {
    return { winner: "tie", confidence: 0, lift: 0, zScore: 0, sessionImbalance };
  }

  const z = (s.rps - r.rps) / se;
  const pValue = 2 * (1 - normalCDF(Math.abs(z))); // two-tailed
  const confidence = Math.min((1 - pValue) * 100, 99.99);

  const winner: "shopify" | "ratio" | "tie" =
    z > 0 ? "shopify" : z < 0 ? "ratio" : "tie";

  const loserRPS = winner === "shopify" ? r.rps : s.rps;
  const winnerRPS = winner === "shopify" ? s.rps : r.rps;
  const lift = loserRPS > 0 ? ((winnerRPS - loserRPS) / loserRPS) * 100 : 0;

  return { winner, confidence, lift, zScore: z, sessionImbalance };
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 99) return "Very High";
  if (confidence >= 95) return "High";
  if (confidence >= 90) return "Moderate";
  if (confidence >= 80) return "Low";
  return "Not Significant";
}

function InfoTooltip() {
  return (
    <Tooltip>
      <TooltipTrigger className="shrink-0 rounded-full p-0.5 text-gray-400 hover:text-gray-600 focus:outline-none dark:hover:text-gray-300">
        <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-sm p-3 text-xs leading-relaxed">
        <p className="font-semibold mb-2">How is the winner determined?</p>
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <span className="shrink-0 font-medium text-background/70">Method</span>
            <span>Two-sample z-test on Revenue Per Session (RPS)</span>
          </div>
          <div className="flex gap-2">
            <span className="shrink-0 font-medium text-background/70">Variance</span>
            <span>p &times; AOV&sup2; &times; (1&minus;p), where p = conversion rate</span>
          </div>
          <div className="flex gap-2">
            <span className="shrink-0 font-medium text-background/70">Levels</span>
            <span>&ge;95% High &middot; &ge;90% Moderate &middot; &lt;90% Not significant</span>
          </div>
          <div className="flex gap-2">
            <span className="shrink-0 font-medium text-background/70">Note</span>
            <span>Both variants need &ge;100 sessions. Large session imbalances are flagged.</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function SignificanceBar({ data }: { data: ABComparison }) {
  const { role } = useUser();
  const result = computeRPSSignificance(data);

  // Shopify winning → admin-only; Ratio winning → show to all
  if (result.winner === "shopify" && result.confidence >= 50 && role !== "admin") {
    return null;
  }

  const isSignificant = result.confidence >= 90;
  const winnerLabel = result.winner === "shopify" ? "Shopify (A)" : "Ratio (B)";
  const loserLabel = result.winner === "shopify" ? "Ratio (B)" : "Shopify (A)";
  const confidenceLabel = getConfidenceLabel(result.confidence);

  // Not enough data
  if (result.winner === "tie" || result.confidence < 50) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 sm:px-4 sm:py-3 dark:border-gray-700 dark:bg-gray-800/50">
        <Minus className="h-4 w-4 shrink-0 text-gray-400" />
        <p className="text-xs text-gray-500 sm:text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">No clear winner yet</span>
          {" — "}
          {data.shopify.sessions < MIN_SESSIONS || data.ratio.sessions < MIN_SESSIONS
            ? `both variants need at least ${MIN_SESSIONS.toLocaleString()} sessions.`
            : "not enough data to determine statistical significance on RPS."}
          {result.confidence > 0 && (
            <span className="ml-1 text-gray-400">
              ({result.confidence.toFixed(1)}% confidence)
            </span>
          )}
        </p>
        <InfoTooltip />
      </div>
    );
  }

  const bgClass = isSignificant
    ? result.winner === "ratio"
      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
      : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
    : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30";

  const iconColor = isSignificant
    ? result.winner === "ratio"
      ? "text-emerald-500"
      : "text-blue-500"
    : "text-amber-500";

  const textColor = isSignificant
    ? result.winner === "ratio"
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-blue-700 dark:text-blue-300"
    : "text-amber-700 dark:text-amber-300";

  const Icon = result.lift >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 sm:items-center sm:px-4 sm:py-3 ${bgClass}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 sm:mt-0 sm:h-5 sm:w-5 ${iconColor}`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-sm">
          <span className={`font-semibold ${textColor}`}>{winnerLabel}</span>
          {" is winning with "}
          <span className={`font-semibold ${textColor}`}>
            {result.lift.toFixed(1)}% higher RPS
          </span>
          {" over "}
          {loserLabel}
        </p>
        <p className="mt-0.5 text-[10px] text-gray-500 sm:text-xs">
          {confidenceLabel} confidence ({result.confidence.toFixed(1)}%)
          {isSignificant
            ? " — statistically significant"
            : " — needs more data for significance"}
          <span className="ml-2 text-gray-400">
            z = {Math.abs(result.zScore).toFixed(2)}
          </span>
          {result.sessionImbalance && (
            <span className="ml-2 text-amber-500">
              — session split is heavily skewed ({data.shopify.sessions.toLocaleString("en-IN")} vs {data.ratio.sessions.toLocaleString("en-IN")})
            </span>
          )}
        </p>
      </div>
      <InfoTooltip />
    </div>
  );
}
