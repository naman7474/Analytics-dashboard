"use client";

import { useState } from "react";
import { MerchantInput, MerchantSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MerchantFormProps {
  merchant?: MerchantSummary | null;
  onSave: (merchant: MerchantInput) => void;
  onCancel: () => void;
}

function formatViewerEmails(viewerEmails: string[]) {
  return viewerEmails.join(", ");
}

function parseViewerEmails(value: string) {
  return value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function MerchantForm({ merchant, onSave, onCancel }: MerchantFormProps) {
  const isEditing = Boolean(merchant);

  const [form, setForm] = useState({
    name: merchant?.name || "",
    domain: merchant?.domain || "",
    storeDomain: merchant?.storeDomain || "",
    shopifyShop: merchant?.shopify.shop || "",
    shopifyAccessToken: "",
    posthogProjectId: merchant?.posthog.projectId || "",
    posthogApiKey: "",
    gokwikMerchantMid: merchant?.gokwik.merchantMid || "",
    gokwikCookie: "",
    ratioTag: merchant?.ratioTag || "primathon",
    viewerEmails: formatViewerEmails(merchant?.viewerEmails || []),
  });

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSave({
      id: merchant?.id,
      createdAt: merchant?.createdAt,
      name: form.name,
      domain: form.domain,
      storeDomain: form.storeDomain,
      shopify: {
        shop: form.shopifyShop,
        accessToken: form.shopifyAccessToken || undefined,
      },
      posthog: {
        projectId: form.posthogProjectId,
        apiKey: form.posthogApiKey || undefined,
      },
      gokwik: {
        merchantMid: form.gokwikMerchantMid,
        cookie: form.gokwikCookie || undefined,
      },
      ratioTag: form.ratioTag,
      viewerEmails: parseViewerEmails(form.viewerEmails),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {isEditing ? "Edit Merchant" : "Add Merchant"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              General
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="name" className="text-xs">
                  Merchant Name
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g., Wellversed Health"
                  required
                />
              </div>
              <div>
                <Label htmlFor="domain" className="text-xs">
                  Domain
                </Label>
                <Input
                  id="domain"
                  value={form.domain}
                  onChange={(e) => update("domain", e.target.value)}
                  placeholder="e.g., wellversed.in"
                  required
                />
              </div>
              <div>
                <Label htmlFor="storeDomain" className="text-xs">
                  Ratio Store Domain
                </Label>
                <Input
                  id="storeDomain"
                  value={form.storeDomain}
                  onChange={(e) => update("storeDomain", e.target.value)}
                  placeholder="e.g., store.wellversed.in"
                  required
                />
              </div>
              <div>
                <Label htmlFor="ratioTag" className="text-xs">
                  Ratio Order Tag
                </Label>
                <Input
                  id="ratioTag"
                  value={form.ratioTag}
                  onChange={(e) => update("ratioTag", e.target.value)}
                  placeholder="e.g., primathon"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Viewer Access
            </h3>
            <div>
              <Label htmlFor="viewerEmails" className="text-xs">
                Allowed Viewer Emails
              </Label>
              <Input
                id="viewerEmails"
                value={form.viewerEmails}
                onChange={(e) => update("viewerEmails", e.target.value)}
                placeholder="user1@example.com, user2@example.com"
              />
              <p className="mt-1 text-xs text-zinc-400">
                Only non-Primathon users in this list will see this merchant.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Shopify
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="shopifyShop" className="text-xs">
                  Shop Domain
                </Label>
                <Input
                  id="shopifyShop"
                  value={form.shopifyShop}
                  onChange={(e) => update("shopifyShop", e.target.value)}
                  placeholder="e.g., store.myshopify.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="shopifyAccessToken" className="text-xs">
                  Access Token
                </Label>
                <Input
                  id="shopifyAccessToken"
                  type="password"
                  value={form.shopifyAccessToken}
                  onChange={(e) => update("shopifyAccessToken", e.target.value)}
                  placeholder={
                    isEditing ? "Leave blank to keep current token" : "shpat_..."
                  }
                  required={!isEditing}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              PostHog
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="posthogProjectId" className="text-xs">
                  Project ID
                </Label>
                <Input
                  id="posthogProjectId"
                  value={form.posthogProjectId}
                  onChange={(e) => update("posthogProjectId", e.target.value)}
                  placeholder="e.g., 12345"
                  required
                />
              </div>
              <div>
                <Label htmlFor="posthogApiKey" className="text-xs">
                  Personal API Key
                </Label>
                <Input
                  id="posthogApiKey"
                  type="password"
                  value={form.posthogApiKey}
                  onChange={(e) => update("posthogApiKey", e.target.value)}
                  placeholder={
                    isEditing ? "Leave blank to keep current key" : "phx_..."
                  }
                  required={!isEditing}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              GoKwik
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="gokwikMerchantMid" className="text-xs">
                  Merchant MID
                </Label>
                <Input
                  id="gokwikMerchantMid"
                  value={form.gokwikMerchantMid}
                  onChange={(e) => update("gokwikMerchantMid", e.target.value)}
                  placeholder="e.g., 19g6kl5hxd6n2"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="gokwikCookie" className="text-xs">
                Cookie String
              </Label>
              <Input
                id="gokwikCookie"
                type="password"
                value={form.gokwikCookie}
                onChange={(e) => update("gokwikCookie", e.target.value)}
                placeholder={
                  isEditing
                    ? "Leave blank to keep current cookie"
                    : "Full cookie string from browser"
                }
                required={!isEditing}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" size="sm">
              {isEditing ? "Update" : "Add"} Merchant
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
