"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DailyTrends } from "@/lib/types";
import { VARIANT_COLORS } from "@/lib/constants";
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

interface DailyTrendChartProps {
  data: DailyTrends;
}

function TrendChart({
  data,
  formatValue,
}: {
  data: Array<{ date: string; shopify: number; ratio: number }>;
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
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#a1a1aa" }}
            tickLine={false}
            axisLine={{ stroke: "#e4e4e7" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#a1a1aa" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatValue}
            width={45}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e4e4e7",
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
                {value === "shopify" ? "Shopify (A)" : "Ratio (B)"}
              </span>
            )}
          />
          <Line
            type="monotone"
            dataKey="shopify"
            stroke={VARIANT_COLORS.shopify}
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="ratio"
            stroke={VARIANT_COLORS.ratio}
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DailyTrendChart({ data }: DailyTrendChartProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Daily Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sessions">
          <div className="mb-4 overflow-x-auto scrollbar-hide">
            <TabsList>
              <TabsTrigger value="sessions" className="text-xs">
                Sessions
              </TabsTrigger>
              <TabsTrigger value="orders" className="text-xs">
                Orders
              </TabsTrigger>
              <TabsTrigger value="sales" className="text-xs">
                Sales
              </TabsTrigger>
              <TabsTrigger value="cr" className="text-xs">
                Conv. Rate
              </TabsTrigger>
              <TabsTrigger value="rps" className="text-xs">
                RPS
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="sessions">
            <TrendChart data={data.sessions} />
          </TabsContent>
          <TabsContent value="orders">
            <TrendChart data={data.orders} />
          </TabsContent>
          <TabsContent value="sales">
            <TrendChart
              data={data.sales}
              formatValue={(v) => `₹${(v / 1000).toFixed(0)}K`}
            />
          </TabsContent>
          <TabsContent value="cr">
            <TrendChart
              data={data.conversionRate}
              formatValue={(v) => `${v.toFixed(1)}%`}
            />
          </TabsContent>
          <TabsContent value="rps">
            <TrendChart
              data={data.rps}
              formatValue={(v) => `₹${v.toFixed(2)}`}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
