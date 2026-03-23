"use client";

import useSWR from "swr";
import { format, parseISO } from "date-fns";
import { useMerchant } from "@/lib/hooks/use-merchant";
import { useDateRange } from "@/lib/hooks/use-date-range";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

async function fetcher(url: string) {
  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load performance data");
  }

  return payload;
}

type DeviceKey = "mobile" | "desktop";

interface PerformanceVitals {
  lcp: number;
  fcp: number;
  cls: number;
  inp: number;
  sampleCount?: number;
}

interface PerformanceSourceInfo {
  source: "crux" | "psi";
  label: string;
  collectionPeriod?: {
    firstDate?: string;
    lastDate?: string;
  };
}

interface CruxPerformanceResult {
  vitals: PerformanceVitals;
  meta: PerformanceSourceInfo;
}

interface PerformanceResponse {
  data: {
    shopify: Record<DeviceKey, CruxPerformanceResult | null>;
    ratio: Record<DeviceKey, PerformanceVitals>;
  };
}

type VitalKey = keyof Pick<PerformanceVitals, "lcp" | "fcp" | "cls" | "inp">;

const VITALS_CONFIG: Array<{
  key: VitalKey;
  label: string;
  unit: string;
  good: number;
  poor: number;
}> = [
  {
    key: "lcp",
    label: "Largest Contentful Paint",
    unit: "ms",
    good: 2500,
    poor: 4000,
  },
  {
    key: "fcp",
    label: "First Contentful Paint",
    unit: "ms",
    good: 1800,
    poor: 3000,
  },
  {
    key: "cls",
    label: "Cumulative Layout Shift",
    unit: "",
    good: 0.1,
    poor: 0.25,
  },
  {
    key: "inp",
    label: "Interaction to Next Paint",
    unit: "ms",
    good: 200,
    poor: 500,
  },
];

function hasMetricValue(value: number) {
  return Number.isFinite(value) && value > 0;
}

function formatDateLabel(value: string) {
  return format(parseISO(value), "MMM d, yyyy");
}

function formatVitalValue(key: VitalKey, value: number) {
  if (!hasMetricValue(value)) return "—";
  if (key === "cls") return value.toFixed(3);
  return Math.round(value).toLocaleString("en-IN");
}

function formatDeltaValue(key: VitalKey, value: number) {
  if (!hasMetricValue(value)) return "—";
  if (key === "cls") return value.toFixed(3);
  return Math.round(value).toLocaleString("en-IN");
}

function getVitalColor(value: number, good: number, poor: number) {
  if (!hasMetricValue(value)) return "text-zinc-400";
  if (value <= good) return "text-emerald-600";
  if (value <= poor) return "text-amber-500";
  return "text-red-500";
}

function getVitalLabel(value: number, good: number, poor: number) {
  if (!hasMetricValue(value)) return "No data";
  if (value <= good) return "Good";
  if (value <= poor) return "Needs Improvement";
  return "Poor";
}

function formatCollectionPeriod(meta?: PerformanceSourceInfo) {
  const firstDate = meta?.collectionPeriod?.firstDate;
  const lastDate = meta?.collectionPeriod?.lastDate;

  if (!firstDate || !lastDate) return null;
  return `${formatDateLabel(firstDate)} - ${formatDateLabel(lastDate)}`;
}

function formatRangeLabel(from: string, to: string) {
  if (from === to) return formatDateLabel(from);
  return `${formatDateLabel(from)} - ${formatDateLabel(to)}`;
}

function getComparisonText(
  key: VitalKey,
  shopifyValue: number,
  ratioValue: number
) {
  if (!hasMetricValue(shopifyValue) && !hasMetricValue(ratioValue)) {
    return { tone: "muted", label: "No comparison available" };
  }

  if (!hasMetricValue(shopifyValue)) {
    return { tone: "ratio", label: "Only Ratio data available" };
  }

  if (!hasMetricValue(ratioValue)) {
    return { tone: "shopify", label: "Only Shopify live data available" };
  }

  if (shopifyValue === ratioValue) {
    return { tone: "muted", label: "Both variants are matched" };
  }

  const delta = Math.abs(ratioValue - shopifyValue);
  const formattedDelta = formatDeltaValue(key, delta);
  const unit = key === "cls" ? "" : "ms";

  if (ratioValue < shopifyValue) {
    return {
      tone: "ratio",
      label: `Ratio lower by ${formattedDelta}${unit}`,
    };
  }

  return {
    tone: "shopify",
    label: `Shopify lower by ${formattedDelta}${unit}`,
  };
}

function SourceSummaryCard({
  title,
  tone,
  subtitle,
  detail,
}: {
  title: string;
  tone: "shopify" | "ratio";
  subtitle: string;
  detail: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        tone === "shopify"
          ? "border-blue-100 bg-blue-50/60"
          : "border-emerald-100 bg-emerald-50/60"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            tone === "shopify" ? "bg-blue-500" : "bg-emerald-500"
          )}
        />
        <p
          className={cn(
            "text-sm font-medium",
            tone === "shopify" ? "text-blue-700" : "text-emerald-700"
          )}
        >
          {title}
        </p>
      </div>
      <p className="mt-2 text-sm text-zinc-700">{subtitle}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function VitalComparisonCard({
  config,
  shopify,
  ratio,
}: {
  config: (typeof VITALS_CONFIG)[number];
  shopify: PerformanceVitals;
  ratio: PerformanceVitals;
}) {
  const shopifyValue = shopify[config.key];
  const ratioValue = ratio[config.key];
  const comparison = getComparisonText(config.key, shopifyValue, ratioValue);

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-900">{config.label}</p>
            <p className="mt-1 text-xs text-zinc-500">Lower is better</p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "border-none",
              comparison.tone === "shopify" && "bg-blue-100 text-blue-700",
              comparison.tone === "ratio" && "bg-emerald-100 text-emerald-700",
              comparison.tone === "muted" && "bg-zinc-100 text-zinc-600"
            )}
          >
            {comparison.label}
          </Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
              Shopify Live
            </p>
            <p
              className={cn(
                "mt-2 text-2xl font-semibold tabular-nums",
                getVitalColor(shopifyValue, config.good, config.poor)
              )}
            >
              {formatVitalValue(config.key, shopifyValue)}
              {config.unit && hasMetricValue(shopifyValue) ? (
                <span className="ml-1 text-sm font-normal">{config.unit}</span>
              ) : null}
            </p>
            <p
              className={cn(
                "mt-1 text-xs",
                getVitalColor(shopifyValue, config.good, config.poor)
              )}
            >
              {getVitalLabel(shopifyValue, config.good, config.poor)}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Ratio
            </p>
            <p
              className={cn(
                "mt-2 text-2xl font-semibold tabular-nums",
                getVitalColor(ratioValue, config.good, config.poor)
              )}
            >
              {formatVitalValue(config.key, ratioValue)}
              {config.unit && hasMetricValue(ratioValue) ? (
                <span className="ml-1 text-sm font-normal">{config.unit}</span>
              ) : null}
            </p>
            <p
              className={cn(
                "mt-1 text-xs",
                getVitalColor(ratioValue, config.good, config.poor)
              )}
            >
              {getVitalLabel(ratioValue, config.good, config.poor)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DeviceComparison({
  device,
  shopify,
  ratio,
  from,
  to,
}: {
  device: DeviceKey;
  shopify: CruxPerformanceResult | null;
  ratio: PerformanceVitals;
  from: string;
  to: string;
}) {
  const shopifyDetail =
    formatCollectionPeriod(shopify?.meta) || "Rolling 28-day field data";
  const ratioDetail = `Selected range: ${formatRangeLabel(from, to)}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <SourceSummaryCard
          title={`Shopify ${device === "mobile" ? "Mobile" : "Desktop"} Live Site`}
          tone="shopify"
          subtitle={shopify?.meta.label || "No CrUX field data available"}
          detail={shopifyDetail}
        />
        <SourceSummaryCard
          title={`Ratio ${device === "mobile" ? "Mobile" : "Desktop"}`}
          tone="ratio"
          subtitle="PostHog p75 web vitals"
          detail={`${ratioDetail} • ${ratio.sampleCount || 0} samples`}
        />
      </div>

      <p className="text-xs text-zinc-500">
        Shopify values come from live-site field data. Ratio values come from
        PostHog web vitals for the selected dashboard range, so the time windows
        are intentionally different.
      </p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {VITALS_CONFIG.map((config) => (
          <VitalComparisonCard
            key={config.key}
            config={config}
            shopify={shopify?.vitals || { lcp: 0, fcp: 0, cls: 0, inp: 0 }}
            ratio={ratio}
          />
        ))}
      </div>
    </div>
  );
}

export function PerformanceTab() {
  const { selectedMerchant } = useMerchant();
  const { dateRange } = useDateRange();

  const { data, error, isLoading } = useSWR<PerformanceResponse>(
    selectedMerchant
      ? `/api/posthog/performance?merchantId=${selectedMerchant.id}&from=${dateRange.from}&to=${dateRange.to}`
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

  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error.message}
      </div>
    );
  }

  const shopify = data?.data?.shopify || { mobile: null, desktop: null };
  const ratio = data?.data?.ratio || {
    mobile: { lcp: 0, fcp: 0, cls: 0, inp: 0, sampleCount: 0 },
    desktop: { lcp: 0, fcp: 0, cls: 0, inp: 0, sampleCount: 0 },
  };

  return (
    <Tabs defaultValue="mobile">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-900">Performance Comparison</p>
          <p className="text-xs text-zinc-500">
            Shopify live website vs Ratio experience for mobile and desktop
          </p>
        </div>
        <TabsList>
          <TabsTrigger value="mobile">Mobile</TabsTrigger>
          <TabsTrigger value="desktop">Desktop</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="mobile">
        <DeviceComparison
          device="mobile"
          shopify={shopify.mobile}
          ratio={ratio.mobile}
          from={dateRange.from}
          to={dateRange.to}
        />
      </TabsContent>

      <TabsContent value="desktop">
        <DeviceComparison
          device="desktop"
          shopify={shopify.desktop}
          ratio={ratio.desktop}
          from={dateRange.from}
          to={dateRange.to}
        />
      </TabsContent>
    </Tabs>
  );
}
