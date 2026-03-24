import { NextRequest, NextResponse } from "next/server";
import { fetchShopifySessionMetrics } from "@/lib/api/shopify";
import { getAuthorizedMerchant, getDateRangeParams } from "@/lib/api/route-helpers";

export async function GET(req: NextRequest) {
  const params = getDateRangeParams(req);
  if ("response" in params) return params.response;

  const merchantResult = await getAuthorizedMerchant(params.merchantId);
  if ("response" in merchantResult) return merchantResult.response;

  try {
    const [shopify, ratio] = await Promise.all([
      fetchShopifySessionMetrics(merchantResult.merchant, params.from, params.to, "shopify"),
      fetchShopifySessionMetrics(merchantResult.merchant, params.from, params.to, "ratio"),
    ]);

    return NextResponse.json({ data: { shopify, ratio } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
