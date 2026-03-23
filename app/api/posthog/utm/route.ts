import { NextRequest, NextResponse } from "next/server";
import { fetchPostHogUTM } from "@/lib/api/posthog";
import { fetchGoKwikMarketing } from "@/lib/api/gokwik";
import { fetchShopifySessionsBySource } from "@/lib/api/shopify";
import { getAuthorizedMerchant, getDateRangeParams } from "@/lib/api/route-helpers";

export async function GET(req: NextRequest) {
  const params = getDateRangeParams(req);
  if ("response" in params) {
    return params.response;
  }

  const merchantResult = await getAuthorizedMerchant(params.merchantId);
  if ("response" in merchantResult) {
    return merchantResult.response;
  }

  try {
    const [posthogUTM, gokwikMarketing, shopifySessions] = await Promise.all([
      fetchPostHogUTM(merchantResult.merchant, params.from, params.to),
      fetchGoKwikMarketing(merchantResult.merchant, params.from, params.to),
      fetchShopifySessionsBySource(
        merchantResult.merchant,
        params.from,
        params.to
      ),
    ]);

    return NextResponse.json({
      data: {
        posthogUTM,
        gokwik: gokwikMarketing,
        shopifySessions,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
