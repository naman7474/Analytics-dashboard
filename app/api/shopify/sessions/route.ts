import { NextRequest, NextResponse } from "next/server";
import { fetchShopifySessions } from "@/lib/api/shopify";
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
    const variant = new URL(req.url).searchParams.get("variant") === "ratio" ? "ratio" : "shopify";
    const data = await fetchShopifySessions(
      merchantResult.merchant,
      params.from,
      params.to,
      variant
    );
    return NextResponse.json({ data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
