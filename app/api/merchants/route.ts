import { NextRequest, NextResponse } from "next/server";
import { canUserAccessMerchant } from "@/lib/auth/rbac";
import { listMerchantSummaries, saveMerchant } from "@/lib/merchants";
import { MerchantInput } from "@/lib/types";
import { requireAdminUser, requireAuthenticatedUser } from "@/lib/api/route-helpers";

function validateMerchantInput(body: MerchantInput, isEditing: boolean) {
  if (
    !body?.name ||
    !body?.domain ||
    !body?.storeDomain ||
    !body?.shopify?.shop ||
    !body?.posthog?.projectId ||
    !body?.gokwik?.merchantMid ||
    !body?.ratioTag
  ) {
    return "Missing required merchant fields";
  }

  if (
    !isEditing &&
    (!body.shopify.accessToken || !body.posthog.apiKey || !body.gokwik.cookie)
  ) {
    return "Missing required credentials for a new merchant";
  }

  return null;
}

export async function GET() {
  const authResult = await requireAuthenticatedUser();
  if ("response" in authResult) {
    return authResult.response;
  }

  const merchants = await listMerchantSummaries();
  const visibleMerchants =
    authResult.user.role === "admin"
      ? merchants
      : merchants.filter((merchant) =>
          canUserAccessMerchant(authResult.user.email, merchant)
        );

  return NextResponse.json(
    visibleMerchants.map((merchant) =>
      authResult.user.role === "admin"
        ? merchant
        : {
            ...merchant,
            viewerEmails: [],
          }
    )
  );
}

export async function POST(req: NextRequest) {
  const adminResult = await requireAdminUser();
  if ("response" in adminResult) {
    return adminResult.response;
  }

  const body = (await req.json()) as MerchantInput;
  const validationError = validateMerchantInput(body, false);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const merchant = await saveMerchant({
    ...body,
    id: body.id || crypto.randomUUID(),
    createdAt: body.createdAt || new Date().toISOString(),
  });

  return NextResponse.json(
    {
      ...merchant,
      shopify: {
        shop: merchant.shopify.shop,
        hasAccessToken: Boolean(merchant.shopify.accessToken),
      },
      posthog: {
        projectId: merchant.posthog.projectId,
        hasApiKey: Boolean(merchant.posthog.apiKey),
      },
      gokwik: {
        merchantMid: merchant.gokwik.merchantMid,
        hasCookie: Boolean(merchant.gokwik.cookie),
      },
    },
    { status: 201 }
  );
}
