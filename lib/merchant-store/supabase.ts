import "server-only";

import {
  MerchantConfig,
  MerchantInput,
  MerchantSummary,
} from "@/lib/types";

type MerchantConfigRow = {
  id: string;
  name: string;
  domain: string;
  store_domain: string;
  shopify_shop: string;
  posthog_project_id: string;
  gokwik_merchant_mid: string;
  ratio_tag: string;
  viewer_emails: string[] | null;
  created_at: string;
};

type MerchantSecretRow = {
  merchant_id: string;
  shopify_access_token: string;
  posthog_api_key: string;
  gokwik_cookie: string;
};

function getSupabaseConfig() {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "";
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  return { url, serviceRoleKey, anonKey };
}

export function isSupabaseMerchantStoreEnabled() {
  const { url, serviceRoleKey } = getSupabaseConfig();
  return Boolean(url && serviceRoleKey);
}

function encodeFilterValue(value: string) {
  return encodeURIComponent(value);
}

function buildInFilter(values: string[]) {
  return values
    .map((value) => `"${value.replaceAll('"', '\\"')}"`)
    .join(",");
}

async function supabaseFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const { url, serviceRoleKey, anonKey } = getSupabaseConfig();

  if (!url || !serviceRoleKey) {
    if (url && anonKey) {
      throw new Error(
        "Supabase merchant store requires SUPABASE_SERVICE_ROLE_KEY. Do not use the anon key for merchant secrets."
      );
    }

    throw new Error(
      "Supabase merchant store is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase API error: ${response.status} - ${message}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

function normalizeViewerEmails(viewerEmails: string[] | null | undefined) {
  return Array.from(
    new Set(
      (viewerEmails || [])
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function toSummary(
  merchant: MerchantConfigRow,
  secret?: MerchantSecretRow
): MerchantSummary {
  return {
    id: merchant.id,
    name: merchant.name,
    domain: merchant.domain,
    storeDomain: merchant.store_domain,
    shopify: {
      shop: merchant.shopify_shop,
      hasAccessToken: Boolean(secret?.shopify_access_token),
    },
    posthog: {
      projectId: merchant.posthog_project_id,
      hasApiKey: Boolean(secret?.posthog_api_key),
    },
    gokwik: {
      merchantMid: merchant.gokwik_merchant_mid,
      hasCookie: Boolean(secret?.gokwik_cookie),
    },
    ratioTag: merchant.ratio_tag,
    viewerEmails: normalizeViewerEmails(merchant.viewer_emails),
    createdAt: merchant.created_at,
  };
}

function toConfig(
  merchant: MerchantConfigRow,
  secret?: MerchantSecretRow
): MerchantConfig {
  return {
    id: merchant.id,
    name: merchant.name,
    domain: merchant.domain,
    storeDomain: merchant.store_domain,
    shopify: {
      shop: merchant.shopify_shop,
      accessToken: secret?.shopify_access_token || "",
    },
    posthog: {
      projectId: merchant.posthog_project_id,
      apiKey: secret?.posthog_api_key || "",
    },
    gokwik: {
      merchantMid: merchant.gokwik_merchant_mid,
      cookie: secret?.gokwik_cookie || "",
    },
    ratioTag: merchant.ratio_tag,
    viewerEmails: normalizeViewerEmails(merchant.viewer_emails),
    createdAt: merchant.created_at,
  };
}

async function loadMerchantRows() {
  const [merchantRows, secretRows] = await Promise.all([
    supabaseFetch<MerchantConfigRow[]>(
      "merchant_configs?select=*&order=name.asc"
    ),
    supabaseFetch<MerchantSecretRow[]>("merchant_secrets?select=*"),
  ]);

  const secretMap = new Map(secretRows.map((row) => [row.merchant_id, row]));
  return { merchantRows, secretMap };
}

export async function listMerchantSummariesSupabase(): Promise<MerchantSummary[]> {
  const { merchantRows, secretMap } = await loadMerchantRows();
  return merchantRows.map((merchant) => toSummary(merchant, secretMap.get(merchant.id)));
}

export async function getMerchantSummariesByIdsSupabase(
  ids: string[]
): Promise<MerchantSummary[]> {
  if (ids.length === 0) return [];

  const encodedIds = buildInFilter(ids);
  const merchantRows = await supabaseFetch<MerchantConfigRow[]>(
    `merchant_configs?select=*&id=in.(${encodedIds})&order=name.asc`
  );
  const secretRows = await supabaseFetch<MerchantSecretRow[]>(
    `merchant_secrets?select=*&merchant_id=in.(${encodedIds})`
  );
  const secretMap = new Map(secretRows.map((row) => [row.merchant_id, row]));

  return merchantRows.map((merchant) => toSummary(merchant, secretMap.get(merchant.id)));
}

export async function getMerchantsSupabase(): Promise<MerchantConfig[]> {
  const { merchantRows, secretMap } = await loadMerchantRows();
  return merchantRows.map((merchant) => toConfig(merchant, secretMap.get(merchant.id)));
}

export async function getMerchantSupabase(id: string): Promise<MerchantConfig | undefined> {
  const merchantRows = await supabaseFetch<MerchantConfigRow[]>(
    `merchant_configs?select=*&id=eq.${encodeFilterValue(id)}&limit=1`
  );
  const merchant = merchantRows[0];

  if (!merchant) {
    return undefined;
  }

  const secretRows = await supabaseFetch<MerchantSecretRow[]>(
    `merchant_secrets?select=*&merchant_id=eq.${encodeFilterValue(id)}&limit=1`
  );

  return toConfig(merchant, secretRows[0]);
}

export async function getMerchantSummarySupabase(
  id: string
): Promise<MerchantSummary | undefined> {
  const merchantRows = await supabaseFetch<MerchantConfigRow[]>(
    `merchant_configs?select=*&id=eq.${encodeFilterValue(id)}&limit=1`
  );
  const merchant = merchantRows[0];

  if (!merchant) {
    return undefined;
  }

  const secretRows = await supabaseFetch<MerchantSecretRow[]>(
    `merchant_secrets?select=*&merchant_id=eq.${encodeFilterValue(id)}&limit=1`
  );

  return toSummary(merchant, secretRows[0]);
}

export async function saveMerchantSupabase(input: MerchantInput): Promise<MerchantConfig> {
  const id = input.id || crypto.randomUUID();
  const existing = input.id ? await getMerchantSupabase(id) : undefined;

  const merchantPayload = {
    id,
    name: input.name.trim(),
    domain: input.domain.trim(),
    store_domain: input.storeDomain.trim(),
    shopify_shop: input.shopify.shop.trim(),
    posthog_project_id: input.posthog.projectId.trim(),
    gokwik_merchant_mid: input.gokwik.merchantMid.trim(),
    ratio_tag: input.ratioTag.trim(),
    viewer_emails: normalizeViewerEmails(input.viewerEmails),
    created_at: existing?.createdAt || input.createdAt || new Date().toISOString(),
  };

  await supabaseFetch<MerchantConfigRow[]>(
    "merchant_configs?on_conflict=id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(merchantPayload),
    }
  );

  const secretPayload = {
    merchant_id: id,
    shopify_access_token:
      input.shopify.accessToken?.trim() || existing?.shopify.accessToken || "",
    posthog_api_key:
      input.posthog.apiKey?.trim() || existing?.posthog.apiKey || "",
    gokwik_cookie:
      input.gokwik.cookie?.trim() || existing?.gokwik.cookie || "",
  };

  await supabaseFetch<MerchantSecretRow[]>(
    "merchant_secrets?on_conflict=merchant_id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(secretPayload),
    }
  );

  const merchant = await getMerchantSupabase(id);
  if (!merchant) {
    throw new Error("Failed to save merchant in Supabase");
  }

  return merchant;
}

export async function deleteMerchantSupabase(id: string): Promise<void> {
  await supabaseFetch<null>(`merchant_configs?id=eq.${encodeFilterValue(id)}`, {
    method: "DELETE",
  });
}
