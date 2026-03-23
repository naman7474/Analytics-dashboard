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
import { formatPercent, formatCurrency, formatNumber } from "@/lib/utils";
import { Loader2 } from "lucide-react";

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

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        <span className="ml-2 text-sm text-zinc-400">
          Loading dashboard data...
        </span>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-sm text-zinc-400">
          No data available for the selected range.
        </p>
      </div>
    );
  }

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

      {/* Summary metric cards */}
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

      {/* Funnel comparison table */}
      <FunnelComparison data={comparison} />

      {/* Daily trend charts */}
      {dailyTrends && <DailyTrendChart data={dailyTrends} />}

      {/* Deep dive tabs */}
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
    </div>
  );
}
