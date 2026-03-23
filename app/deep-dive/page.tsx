"use client";

import { useMerchant } from "@/lib/hooks/use-merchant";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudienceTab } from "@/components/deep-dive/audience-tab";
import { UTMTab } from "@/components/deep-dive/utm-tab";
import { LocationTab } from "@/components/deep-dive/location-tab";
import { PerformanceTab } from "@/components/deep-dive/performance-tab";

export default function DeepDivePage() {
  const { selectedMerchant } = useMerchant();

  if (!selectedMerchant) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-sm text-zinc-400">
          Select a merchant to view deep dive analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Deep Dive
        </h1>
        <p className="text-sm text-zinc-500">
          Detailed breakdowns for {selectedMerchant.name} (Ratio)
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="audience">
            <TabsList className="mb-4">
              <TabsTrigger value="audience">Audience</TabsTrigger>
              <TabsTrigger value="utm">UTM Sources</TabsTrigger>
              <TabsTrigger value="location">Location</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>
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
