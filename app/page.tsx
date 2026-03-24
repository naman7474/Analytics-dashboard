"use client";

import { useDashboardData } from "@/lib/hooks/use-dashboard-data";
import { useMerchant } from "@/lib/hooks/use-merchant";
import { MetricCard } from "@/components/dashboard/metric-card";
import { FunnelComparison } from "@/components/dashboard/funnel-comparison";
import { DailyTrendChart } from "@/components/dashboard/daily-trend-chart";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudienceTab } from "@/components/deep-dive/audience-tab";
import { UTMTab } from "@/components/deep-dive/utm-tab";
import { LocationTab } from "@/components/deep-dive/location-tab";
import { PerformanceTab } from "@/components/deep-dive/performance-tab";
import { PerformanceMetricsSection } from "@/components/dashboard/performance-metrics-section";
import { SignificanceBar } from "@/components/dashboard/significance-bar";
import { formatPercent, formatCurrency, formatNumber } from "@/lib/utils";
import { Loader2 } from "lucide-react";

function SectionLoader({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        <span className="ml-2 text-sm text-zinc-400">{label}</span>
      </CardContent>
    </Card>
  );
}

function MetricCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="mb-2 h-3 w-20 animate-pulse rounded bg-zinc-200 sm:mb-3" />
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="space-y-2">
            <div className="h-2 w-12 animate-pulse rounded bg-zinc-100" />
            <div className="h-5 w-16 animate-pulse rounded bg-zinc-200 sm:h-7" />
          </div>
          <div className="space-y-2">
            <div className="h-2 w-12 animate-pulse rounded bg-zinc-100" />
            <div className="h-5 w-16 animate-pulse rounded bg-zinc-200 sm:h-7" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { selectedMerchant } = useMerchant();
  const { comparison, dailyTrends, isLoading, enabled } = useDashboardData();

  if (!selectedMerchant) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-zinc-700">
            No Merchant Selected
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Add a merchant in Settings, then select it from the dropdown above.
          </p>
        </div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Select a date range to begin.</p>
      </div>
    );
  }

  // Show the full layout immediately — each section handles its own loading
  const comparisonReady = !!comparison;
  const trendsReady = !!dailyTrends;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-base font-semibold text-zinc-900 sm:text-lg dark:text-zinc-100">
          Experiment Overview
        </h1>
        <p className="text-xs text-zinc-500 sm:text-sm">
          Shopify (A) vs Ratio (B) &mdash; {selectedMerchant.name}
        </p>
      </div>

      {/* Statistical significance announcement */}
      {comparisonReady ? (
        <SignificanceBar data={comparison} />
      ) : isLoading ? (
        <div className="h-12 animate-pulse rounded-lg bg-zinc-100" />
      ) : null}

      {/* Summary metric cards */}
      {comparisonReady ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MetricCard
            title="Conversion Rate"
            shopifyValue={comparison.shopify.conversionRate}
            ratioValue={comparison.ratio.conversionRate}
            format={formatPercent}
            winner={comparison.winner.conversionRate}
          />
          <MetricCard
            title="Revenue / Session"
            shopifyValue={comparison.shopify.rps}
            ratioValue={comparison.ratio.rps}
            format={(n) => "₹" + n.toFixed(2)}
            winner={comparison.winner.rps}
          />
          <MetricCard
            title="Avg Order Value"
            shopifyValue={comparison.shopify.aov}
            ratioValue={comparison.ratio.aov}
            format={(n) => formatCurrency(n)}
            winner={comparison.winner.aov}
          />
          <MetricCard
            title="Total Sessions"
            shopifyValue={comparison.shopify.sessions}
            ratioValue={comparison.ratio.sessions}
            format={formatNumber}
            winner={
              comparison.shopify.sessions > comparison.ratio.sessions
                ? "shopify"
                : comparison.ratio.sessions > comparison.shopify.sessions
                ? "ratio"
                : "tie"
            }
          />
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      ) : null}

      {/* Funnel comparison table */}
      {comparisonReady ? (
        <FunnelComparison data={comparison} />
      ) : isLoading ? (
        <SectionLoader label="Loading funnel data..." />
      ) : null}

      {/* Daily trend charts */}
      {trendsReady ? (
        <DailyTrendChart data={dailyTrends} />
      ) : isLoading ? (
        <SectionLoader label="Loading daily trends..." />
      ) : null}

      {/* Deep dive tabs — each tab fetches its own data independently */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <Tabs defaultValue="audience">
            <div className="mb-4 overflow-x-auto scrollbar-hide">
              <TabsList>
                <TabsTrigger value="audience" className="text-xs sm:text-sm">Audience</TabsTrigger>
                <TabsTrigger value="utm" className="text-xs sm:text-sm">UTM Sources</TabsTrigger>
                <TabsTrigger value="location" className="text-xs sm:text-sm">Location</TabsTrigger>
                <TabsTrigger value="performance" className="text-xs sm:text-sm">Performance</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="audience">
              <AudienceTab />
            </TabsContent>
            <TabsContent value="utm">
              <UTMTab />
            </TabsContent>
            <TabsContent value="location">
              <LocationTab />
            </TabsContent>
            <TabsContent value="performance">
              <PerformanceTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Performance Metrics — loads independently */}
      <PerformanceMetricsSection comparison={comparison} />

      {/* No data fallback — only show when loading is done and nothing came back */}
      {!isLoading && !comparisonReady && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-zinc-400">
            No data available for the selected range.
          </p>
        </div>
      )}
    </div>
  );
}
