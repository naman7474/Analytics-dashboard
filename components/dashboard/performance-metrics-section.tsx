"use client";

import { usePerformanceMetrics } from "@/lib/hooks/use-performance-metrics";
import { ABComparison, DailyDataPoint } from "@/lib/types";
import { VARIANT_COLORS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";

/* ------------------------------------------------------------------ */
/*  Reusable trend chart (same pattern as DailyTrendChart)            */
/* ------------------------------------------------------------------ */

function TrendChart({
  data,
  formatValue,
}: {
  data: DailyDataPoint[];
  formatValue?: (v: number) => string;
}) {
  const formattedData = data.map((d) => ({
    ...d,
    date: format(parseISO(d.date), "MMM d"),
  }));

  return (
    <div className="h-[220px] sm:h-[300px]">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <LineChart data={formattedData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatValue}
            width={45}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontSize: "12px",
            }}
            formatter={(value, name) => [
              formatValue ? formatValue(Number(value)) : Number(value).toLocaleString(),
              name === "shopify" ? "Shopify" : "Ratio",
            ]}
          />
          <Legend
            formatter={(value) => (
              <span className="text-xs">
                {value === "ratio" ? "Ratio" : "Shopify"}
              </span>
            )}
          />
          <Line
            type="monotone"
            dataKey="ratio"
            stroke={VARIANT_COLORS.ratio}
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="shopify"
            stroke={VARIANT_COLORS.shopify}
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Comparison bar — inline A vs B for a single aggregate metric      */
/* ------------------------------------------------------------------ */

function ComparisonRow({
  label,
  shopifyValue,
  ratioValue,
  format: fmt,
  lowerIsBetter = false,
}: {
  label: string;
  shopifyValue: number;
  ratioValue: number;
  format: (n: number) => string;
  lowerIsBetter?: boolean;
}) {
  const shopifyWins = lowerIsBetter ? shopifyValue < ratioValue : shopifyValue > ratioValue;
  const ratioWins = lowerIsBetter ? ratioValue < shopifyValue : ratioValue > shopifyValue;

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2.5 pr-4 text-xs font-medium text-gray-600 sm:text-sm">{label}</td>
      <td className={`py-2.5 px-4 text-right text-xs tabular-nums sm:text-sm ${ratioWins ? "font-semibold text-emerald-600" : "text-gray-500"}`}>
        {fmt(ratioValue)}
      </td>
      <td className={`py-2.5 pl-4 text-right text-xs tabular-nums sm:text-sm ${shopifyWins ? "font-semibold text-blue-600" : "text-gray-500"}`}>
        {fmt(shopifyValue)}
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Split table — for categorical breakdowns (device, payment, etc.)  */
/* ------------------------------------------------------------------ */

function SplitTable({
  title,
  shopifyData,
  ratioData,
}: {
  title: string;
  shopifyData: { label: string; value: number }[];
  ratioData: { label: string; value: number }[];
}) {
  const shopifyTotal = shopifyData.reduce((s, i) => s + i.value, 0);
  const ratioTotal = ratioData.reduce((s, i) => s + i.value, 0);

  // Merge labels from both variants
  const allLabels = Array.from(
    new Set([...shopifyData.map((d) => d.label), ...ratioData.map((d) => d.label)])
  );

  const shopifyMap = new Map(shopifyData.map((d) => [d.label, d.value]));
  const ratioMap = new Map(ratioData.map((d) => [d.label, d.value]));

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold text-gray-500 sm:text-sm">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-2 pr-4 text-[10px] font-medium uppercase tracking-wider text-gray-400 sm:text-xs" />
              <th className="pb-2 px-4 text-right text-[10px] font-medium uppercase tracking-wider text-gray-400 sm:text-xs" colSpan={2}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                  Ratio
                </span>
              </th>
              <th className="pb-2 pl-4 text-right text-[10px] font-medium uppercase tracking-wider text-gray-400 sm:text-xs" colSpan={2}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" />
                  Shopify
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {allLabels.map((label) => {
              const sVal = shopifyMap.get(label) || 0;
              const rVal = ratioMap.get(label) || 0;
              const sPct = shopifyTotal > 0 ? (sVal / shopifyTotal) * 100 : 0;
              const rPct = ratioTotal > 0 ? (rVal / ratioTotal) * 100 : 0;
              return (
                <tr key={label} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 pr-4 text-xs font-medium text-gray-600 sm:text-sm capitalize">
                    {label}
                  </td>
                  <td className="py-2 px-2 text-right text-xs tabular-nums text-gray-500 sm:text-sm">
                    {rVal.toLocaleString("en-IN")}
                  </td>
                  <td className="py-2 px-2 text-right text-[10px] tabular-nums text-gray-400 sm:text-xs">
                    ({rPct.toFixed(1)}%)
                  </td>
                  <td className="py-2 px-2 text-right text-xs tabular-nums text-gray-500 sm:text-sm">
                    {sVal.toLocaleString("en-IN")}
                  </td>
                  <td className="py-2 pl-2 text-right text-[10px] tabular-nums text-gray-400 sm:text-xs">
                    ({sPct.toFixed(1)}%)
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main section                                                       */
/* ------------------------------------------------------------------ */

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-block animate-pulse rounded bg-gray-200 ${className}`}>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
    </span>
  );
}

function ShimmerRow({ label }: { label: string }) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2.5 pr-4 text-xs font-medium text-gray-600 sm:text-sm">{label}</td>
      <td className="py-2.5 px-4 text-right"><Shimmer className="w-12 h-4" /></td>
      <td className="py-2.5 pl-4 text-right"><Shimmer className="w-12 h-4" /></td>
    </tr>
  );
}

function ShimmerSplitTable({ title, labels }: { title: string; labels: string[] }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold text-gray-500 sm:text-sm">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-2 pr-4 text-[10px] font-medium uppercase tracking-wider text-gray-400 sm:text-xs" />
              <th className="pb-2 px-4 text-right text-[10px] font-medium uppercase tracking-wider text-gray-400 sm:text-xs" colSpan={2}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                  Ratio
                </span>
              </th>
              <th className="pb-2 pl-4 text-right text-[10px] font-medium uppercase tracking-wider text-gray-400 sm:text-xs" colSpan={2}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" />
                  Shopify
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {labels.map((label) => (
              <tr key={label} className="border-b border-gray-50 last:border-0">
                <td className="py-2 pr-4 text-xs font-medium text-gray-600 sm:text-sm capitalize">{label}</td>
                <td className="py-2 px-2 text-right"><Shimmer className="w-10 h-4" /></td>
                <td className="py-2 px-2 text-right"><Shimmer className="w-10 h-4" /></td>
                <td className="py-2 px-2 text-right"><Shimmer className="w-10 h-4" /></td>
                <td className="py-2 pl-2 text-right"><Shimmer className="w-10 h-4" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatPct(n: number): string {
  return n.toFixed(1) + "%";
}

function formatDecimal(n: number): string {
  return n.toFixed(2);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export function PerformanceMetricsSection({ comparison }: { comparison: ABComparison | null }) {
  const {
    sessionMetrics,
    sessionTrends,
    orderMetrics,
    cartAbandonmentRate,
    checkoutAbandonmentRate,
    isLoading,
    isLoadingSession,
    isLoadingOrders,
  } = usePerformanceMetrics(comparison);

  const sm = sessionMetrics;
  const om = orderMetrics;
  const hasTrends = sessionTrends && (sessionTrends.pagesPerSession.length > 0);
  const hasOrderData = om?.shopify && om?.ratio;

  // Only return null when everything is done loading and there's no data at all
  if (!isLoading && !hasTrends && !hasOrderData && !cartAbandonmentRate) {
    return null;
  }

  // Show nothing only if everything is still loading and we have zero data
  if (isLoading && !hasTrends && !hasOrderData && !cartAbandonmentRate && !sm) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-400">Loading performance metrics...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Engagement Trends — daily charts */}
      {hasTrends && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Engagement Trends</CardTitle>
            <p className="text-xs text-gray-500">Daily A vs B comparison</p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pagesPerSession">
              <div className="mb-4 overflow-x-auto scrollbar-hide">
                <TabsList>
                  <TabsTrigger value="pagesPerSession" className="text-xs">
                    Pages / Session
                  </TabsTrigger>
                  <TabsTrigger value="avgSessionDuration" className="text-xs">
                    Avg Duration
                  </TabsTrigger>
                  <TabsTrigger value="bounceRate" className="text-xs">
                    Bounce Rate
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="pagesPerSession">
                <TrendChart
                  data={sessionTrends!.pagesPerSession}
                  formatValue={(v) => v.toFixed(1)}
                />
              </TabsContent>
              <TabsContent value="avgSessionDuration">
                <TrendChart
                  data={sessionTrends!.avgSessionDuration}
                  formatValue={formatDuration}
                />
              </TabsContent>
              <TabsContent value="bounceRate">
                <TrendChart
                  data={sessionTrends!.bounceRate}
                  formatValue={(v) => `${v.toFixed(1)}%`}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Checkout & Order Metrics — comparison table */}
      {(cartAbandonmentRate || hasOrderData || isLoadingOrders || isLoadingSession) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Checkout & Order Metrics</CardTitle>
            <p className="text-xs text-gray-500">Aggregate A vs B comparison</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-2 pr-4 text-[10px] font-medium uppercase tracking-wider text-gray-400 sm:text-xs">
                      Metric
                    </th>
                    <th className="pb-2 px-4 text-right text-[10px] font-medium uppercase tracking-wider text-gray-400 sm:text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                        Ratio
                      </span>
                    </th>
                    <th className="pb-2 pl-4 text-right text-[10px] font-medium uppercase tracking-wider text-gray-400 sm:text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" />
                        Shopify
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cartAbandonmentRate && (
                    <ComparisonRow
                      label="Cart Abandonment"
                      shopifyValue={cartAbandonmentRate.shopify}
                      ratioValue={cartAbandonmentRate.ratio}
                      format={formatPct}
                      lowerIsBetter
                    />
                  )}
                  {checkoutAbandonmentRate && (
                    <ComparisonRow
                      label="Checkout Abandonment"
                      shopifyValue={checkoutAbandonmentRate.shopify}
                      ratioValue={checkoutAbandonmentRate.ratio}
                      format={formatPct}
                      lowerIsBetter
                    />
                  )}
                  {hasOrderData ? (
                    <>
                      <ComparisonRow
                        label="Items / Order"
                        shopifyValue={om!.shopify.itemsPerOrder}
                        ratioValue={om!.ratio.itemsPerOrder}
                        format={formatDecimal}
                      />
                      <ComparisonRow
                        label="Discount Usage"
                        shopifyValue={om!.shopify.discountUsageRate}
                        ratioValue={om!.ratio.discountUsageRate}
                        format={formatPct}
                        lowerIsBetter
                      />
                      <ComparisonRow
                        label="Avg Discount Amount"
                        shopifyValue={om!.shopify.avgDiscountAmount}
                        ratioValue={om!.ratio.avgDiscountAmount}
                        format={(n) => `₹${n.toFixed(0)}`}
                        lowerIsBetter
                      />
                    </>
                  ) : isLoadingOrders ? (
                    <>
                      <ShimmerRow label="Items / Order" />
                      <ShimmerRow label="Discount Usage" />
                      <ShimmerRow label="Avg Discount Amount" />
                    </>
                  ) : null}
                  {sm?.shopify?.totals && sm?.ratio?.totals ? (
                    <>
                      <ComparisonRow
                        label="Pages / Session"
                        shopifyValue={sm.shopify.totals.pagesPerSession}
                        ratioValue={sm.ratio.totals.pagesPerSession}
                        format={formatDecimal}
                      />
                      <ComparisonRow
                        label="Avg Session Duration"
                        shopifyValue={sm.shopify.totals.avgSessionDuration}
                        ratioValue={sm.ratio.totals.avgSessionDuration}
                        format={formatDuration}
                      />
                      <ComparisonRow
                        label="Bounce Rate"
                        shopifyValue={sm.shopify.totals.bounceRate}
                        ratioValue={sm.ratio.totals.bounceRate}
                        format={formatPct}
                        lowerIsBetter
                      />
                    </>
                  ) : isLoadingSession ? (
                    <>
                      <ShimmerRow label="Pages / Session" />
                      <ShimmerRow label="Avg Session Duration" />
                      <ShimmerRow label="Bounce Rate" />
                    </>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breakdown Tables — Device, Payment, Customer type */}
      {(sm?.shopify?.deviceSplit || hasOrderData || isLoadingOrders || isLoadingSession) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Breakdowns</CardTitle>
            <p className="text-xs text-gray-500">Category-wise A vs B split</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {sm?.shopify?.deviceSplit && sm?.ratio?.deviceSplit ? (
              <SplitTable
                title="Device Breakup"
                shopifyData={sm.shopify.deviceSplit.map((d) => ({
                  label: d.device.charAt(0).toUpperCase() + d.device.slice(1),
                  value: d.sessions,
                }))}
                ratioData={sm.ratio.deviceSplit.map((d) => ({
                  label: d.device.charAt(0).toUpperCase() + d.device.slice(1),
                  value: d.sessions,
                }))}
              />
            ) : isLoadingSession ? (
              <ShimmerSplitTable title="Device Breakup" labels={["Desktop", "Mobile", "Tablet"]} />
            ) : null}

            {hasOrderData ? (
              <>
                <SplitTable
                  title="Prepaid vs COD"
                  shopifyData={[
                    { label: "Prepaid", value: om!.shopify.prepaidOrders },
                    { label: "COD", value: om!.shopify.codOrders },
                  ]}
                  ratioData={[
                    { label: "Prepaid", value: om!.ratio.prepaidOrders },
                    { label: "COD", value: om!.ratio.codOrders },
                  ]}
                />
                <SplitTable
                  title="First vs Repeat Buyers"
                  shopifyData={[
                    { label: "First", value: om!.shopify.newCustomerOrders },
                    { label: "Repeat", value: om!.shopify.returningCustomerOrders },
                  ]}
                  ratioData={[
                    { label: "First", value: om!.ratio.newCustomerOrders },
                    { label: "Repeat", value: om!.ratio.returningCustomerOrders },
                  ]}
                />
              </>
            ) : isLoadingOrders ? (
              <>
                <ShimmerSplitTable title="Prepaid vs COD" labels={["Prepaid", "COD"]} />
                <ShimmerSplitTable title="First vs Repeat Buyers" labels={["First", "Repeat"]} />
              </>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
