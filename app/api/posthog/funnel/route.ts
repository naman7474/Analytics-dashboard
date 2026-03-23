import { NextRequest, NextResponse } from "next/server";
import { fetchPostHogFunnel } from "@/lib/api/posthog";
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
    const data = await fetchPostHogFunnel(
      merchantResult.merchant,
      params.from,
      params.to
    );
    return NextResponse.json({ data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
