import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canUserAccessMerchant } from "@/lib/auth/rbac";
import { getMerchant } from "@/lib/merchants";
import { AuthenticatedUser, MerchantConfig } from "@/lib/types";

type AuthResult =
  | {
      user: AuthenticatedUser;
    }
  | {
      response: NextResponse;
    };

export async function requireAuthenticatedUser(): Promise<AuthResult> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { user };
}

export async function requireAdminUser(): Promise<AuthResult> {
  const result = await requireAuthenticatedUser();

  if ("response" in result) {
    return result;
  }

  if (result.user.role !== "admin") {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return result;
}

export function getDateRangeParams(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const merchantId = searchParams.get("merchantId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!merchantId || !from || !to) {
    return {
      response: NextResponse.json({ error: "Missing params" }, { status: 400 }),
    };
  }

  return { merchantId, from, to };
}

export async function getAuthorizedMerchant(merchantId: string): Promise<
  | {
      merchant: MerchantConfig;
    }
  | {
      response: NextResponse;
    }
> {
  const authResult = await requireAuthenticatedUser();
  if ("response" in authResult) {
    return { response: authResult.response };
  }

  const merchant = await getMerchant(merchantId);
  if (!merchant) {
    return {
      response: NextResponse.json({ error: "Merchant not found" }, { status: 404 }),
    };
  }

  if (!canUserAccessMerchant(authResult.user.email, merchant)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { merchant };
}
