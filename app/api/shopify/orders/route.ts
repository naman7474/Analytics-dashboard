import { NextRequest, NextResponse } from "next/server";
import { fetchShopifyOrders, aggregateOrdersByDate } from "@/lib/api/shopify";
import { getAuthorizedMerchant, getDateRangeParams } from "@/lib/api/route-helpers";

export async function GET(req: NextRequest) {
  const params = getDateRangeParams(req);
  if ("response" in params) {
    return params.response;
  }

  const { searchParams } = new URL(req.url);
  const variant = searchParams.get("variant") as "shopify" | "ratio";

  if (!variant) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const merchantResult = await getAuthorizedMerchant(params.merchantId);
  if ("response" in merchantResult) {
    return merchantResult.response;
  }

  try {
    const orders = await fetchShopifyOrders(
      merchantResult.merchant,
      params.from,
      params.to,
      variant
    );
    const aggregated = aggregateOrdersByDate(orders);
    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, o) => sum + o.totalPrice, 0);
    return NextResponse.json({ data: { orders: aggregated, totalOrders, totalSales } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
