import { NextRequest, NextResponse } from "next/server";
import { fetchPostHogPerformance } from "@/lib/api/posthog";
import { fetchLiveWebsitePerformance } from "@/lib/api/crux";
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
    const [ratio, shopifyMobile, shopifyDesktop] = await Promise.all([
      fetchPostHogPerformance(merchantResult.merchant, params.from, params.to),
      fetchLiveWebsitePerformance(merchantResult.merchant, "PHONE"),
      fetchLiveWebsitePerformance(merchantResult.merchant, "DESKTOP"),
    ]);

    return NextResponse.json({
      data: {
        shopify: {
          mobile: shopifyMobile,
          desktop: shopifyDesktop,
        },
        ratio,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
