"use client";

import { MerchantSummary } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Store } from "lucide-react";

interface MerchantListProps {
  merchants: MerchantSummary[];
  onEdit: (merchant: MerchantSummary) => void;
  onDelete: (id: string) => void;
}

export function MerchantList({ merchants, onEdit, onDelete }: MerchantListProps) {
  if (merchants.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Store className="h-8 w-8 text-zinc-300 mb-3" />
          <p className="text-sm text-zinc-500">No merchants configured yet.</p>
          <p className="text-xs text-zinc-400 mt-1">
            Click &quot;Add Merchant&quot; to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {merchants.map((m) => (
        <Card key={m.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-100">
                <Store className="h-4 w-4 text-zinc-500" />
              </div>
              <div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-zinc-400">{m.domain}</p>
              </div>
              <div className="flex gap-1.5 ml-3">
                <Badge
                  variant={m.shopify.hasAccessToken ? "secondary" : "outline"}
                  className="text-[10px]"
                >
                  Shopify
                </Badge>
                <Badge
                  variant={m.posthog.hasApiKey ? "secondary" : "outline"}
                  className="text-[10px]"
                >
                  PostHog
                </Badge>
                <Badge
                  variant={m.gokwik.hasCookie ? "secondary" : "outline"}
                  className="text-[10px]"
                >
                  GoKwik
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {m.viewerEmails.length} viewers
                </Badge>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(m)}
                className="h-8 w-8 p-0"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(m.id)}
                className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
