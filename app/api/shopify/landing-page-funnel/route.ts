import { NextRequest, NextResponse } from "next/server";
import { fetchShopifySessionsByLandingPage, fetchRatioOrdersByLandingPage, fetchShopifyOrdersByLandingPage } from "@/lib/api/shopify";
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
    const [shopifySessions, ratioSessions, shopifyOrders, ratioOrders] = await Promise.all([
      fetchShopifySessionsByLandingPage(
        merchantResult.merchant,
        params.from,
        params.to,
        "shopify"
      ),
      fetchShopifySessionsByLandingPage(
        merchantResult.merchant,
        params.from,
        params.to,
        "ratio"
      ),
      fetchShopifyOrdersByLandingPage(
        merchantResult.merchant,
        params.from,
        params.to
      ),
      fetchRatioOrdersByLandingPage(
        merchantResult.merchant,
        params.from,
        params.to
      ),
    ]);

    return NextResponse.json({
      data: {
        shopifySessions,
        ratioSessions,
        shopifyOrders,
        ratioOrders,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
