import { AppRole, MerchantMetadata } from "@/lib/types";

const ADMIN_DOMAIN = "@primathon.in";

export function normalizeUserEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getRoleForEmail(email: string): AppRole {
  return normalizeUserEmail(email).endsWith(ADMIN_DOMAIN) ? "admin" : "viewer";
}

export function isAdminEmail(email: string) {
  return getRoleForEmail(email) === "admin";
}

export function canUserAccessMerchant(
  email: string,
  merchant: Pick<MerchantMetadata, "viewerEmails">
) {
  const normalizedEmail = normalizeUserEmail(email);

  if (isAdminEmail(normalizedEmail)) {
    return true;
  }

  return merchant.viewerEmails.some(
    (viewerEmail) => normalizeUserEmail(viewerEmail) === normalizedEmail
  );
}
