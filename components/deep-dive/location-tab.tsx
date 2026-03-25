"use client";

import useSWR from "swr";
import { useMerchant } from "@/lib/hooks/use-merchant";
import { useDateRange } from "@/lib/hooks/use-date-range";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function LocationTab() {
  const { selectedMerchant } = useMerchant();
  const { dateRange } = useDateRange();

  const { data, isLoading } = useSWR(
    selectedMerchant
      ? `/api/posthog/locations?merchantId=${selectedMerchant.id}&from=${dateRange.from}&to=${dateRange.to}`
      : null,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  const rows = data?.data || [];

  return (
    <div className="overflow-x-auto">
    <Table className="min-w-[420px]">
      <TableHeader>
        <TableRow>
          <TableHead>City</TableHead>
          <TableHead>Region</TableHead>
          <TableHead>Country</TableHead>
          <TableHead className="text-right">Sessions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(
          (
            row: {
              city: string;
              region: string;
              country: string;
              sessions: number;
            },
            i: number
          ) => (
            <TableRow key={i}>
              <TableCell className="text-sm">{row.city}</TableCell>
              <TableCell className="text-sm text-gray-500">
                {row.region}
              </TableCell>
              <TableCell className="text-sm text-gray-500">
                {row.country}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.sessions.toLocaleString()}
              </TableCell>
            </TableRow>
          )
        )}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-gray-400 py-8">
              No data available
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
    </div>
  );
}
