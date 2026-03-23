import { NextRequest, NextResponse } from "next/server";
import { canUserAccessMerchant } from "@/lib/auth/rbac";
import { getMerchant, getMerchantSummary, saveMerchant, deleteMerchant } from "@/lib/merchants";
import { MerchantInput } from "@/lib/types";
import { requireAdminUser, requireAuthenticatedUser } from "@/lib/api/route-helpers";

function validateMerchantInput(body: MerchantInput) {
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

  return null;
}

function toMerchantResponse(merchant: Awaited<ReturnType<typeof getMerchant>>) {
  if (!merchant) return null;

  return {
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
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthenticatedUser();
  if ("response" in authResult) {
    return authResult.response;
  }

  const { id } = await params;
  const merchant = await getMerchantSummary(id);
  if (!merchant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!canUserAccessMerchant(authResult.user.email, merchant)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(
    authResult.user.role === "admin"
      ? merchant
      : {
          ...merchant,
          viewerEmails: [],
        }
  );
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminResult = await requireAdminUser();
  if ("response" in adminResult) {
    return adminResult.response;
  }

  const { id } = await params;
  const existingMerchant = await getMerchant(id);
  if (!existingMerchant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as MerchantInput;
  const validationError = validateMerchantInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const merchant = await saveMerchant({
    ...body,
    id,
    createdAt: existingMerchant.createdAt,
  });

  return NextResponse.json(toMerchantResponse(merchant));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminResult = await requireAdminUser();
  if ("response" in adminResult) {
    return adminResult.response;
  }

  const { id } = await params;
  await deleteMerchant(id);
  return NextResponse.json({ success: true });
}
