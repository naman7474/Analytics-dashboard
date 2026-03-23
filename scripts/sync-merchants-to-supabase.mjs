import { readFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const dataDir = path.join(rootDir, "data");
const merchantsPath = path.join(dataDir, "merchants.json");
const secretsPath = path.join(dataDir, "merchant-secrets.local.json");

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normalizeViewerEmails(viewerEmails) {
  if (!Array.isArray(viewerEmails)) {
    return [];
  }

  return Array.from(
    new Set(
      viewerEmails
        .map((email) => (typeof email === "string" ? email.trim().toLowerCase() : ""))
        .filter(Boolean)
    )
  );
}

function getLegacySecretRecord(raw) {
  const shopify = raw?.shopify ?? {};
  const posthog = raw?.posthog ?? {};
  const gokwik = raw?.gokwik ?? {};

  const accessToken =
    typeof shopify.accessToken === "string" ? shopify.accessToken.trim() : "";
  const apiKey = typeof posthog.apiKey === "string" ? posthog.apiKey.trim() : "";
  const cookie = typeof gokwik.cookie === "string" ? gokwik.cookie.trim() : "";

  if (!accessToken && !apiKey && !cookie) {
    return null;
  }

  return {
    shopify_access_token: accessToken,
    posthog_api_key: apiKey,
    gokwik_cookie: cookie,
  };
}

function mapMerchantConfig(raw) {
  const merchant = raw ?? {};
  const shopify = merchant.shopify ?? {};
  const posthog = merchant.posthog ?? {};
  const gokwik = merchant.gokwik ?? {};

  return {
    id: String(merchant.id),
    name: String(merchant.name ?? "").trim(),
    domain: String(merchant.domain ?? "").trim(),
    store_domain: String(merchant.storeDomain ?? "").trim(),
    shopify_shop: String(shopify.shop ?? "").trim(),
    posthog_project_id: String(posthog.projectId ?? "").trim(),
    gokwik_merchant_mid: String(gokwik.merchantMid ?? "").trim(),
    ratio_tag: String(merchant.ratioTag ?? "primathon").trim(),
    viewer_emails: normalizeViewerEmails(merchant.viewerEmails),
    created_at: String(merchant.createdAt ?? new Date().toISOString()),
  };
}

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function supabaseFetch(pathname, init = {}) {
  const url = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const response = await fetch(`${url}/rest/v1/${pathname}`, {
    method: "GET",
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase API error: ${response.status} - ${message}`);
  }
}

async function main() {
  const merchantRows = await readJson(merchantsPath, []);
  const secretStore = await readJson(secretsPath, {});

  const merchantConfigs = [];
  const merchantSecrets = [];

  for (const rawMerchant of merchantRows) {
    const merchantConfig = mapMerchantConfig(rawMerchant);
    merchantConfigs.push(merchantConfig);

    const mergedSecrets = {
      ...(getLegacySecretRecord(rawMerchant) ?? {}),
      ...(secretStore[merchantConfig.id] ?? {}),
    };

    merchantSecrets.push({
      merchant_id: merchantConfig.id,
      shopify_access_token:
        typeof mergedSecrets.shopify?.accessToken === "string"
          ? mergedSecrets.shopify.accessToken.trim()
          : typeof mergedSecrets.shopify_access_token === "string"
            ? mergedSecrets.shopify_access_token.trim()
            : "",
      posthog_api_key:
        typeof mergedSecrets.posthog?.apiKey === "string"
          ? mergedSecrets.posthog.apiKey.trim()
          : typeof mergedSecrets.posthog_api_key === "string"
            ? mergedSecrets.posthog_api_key.trim()
            : "",
      gokwik_cookie:
        typeof mergedSecrets.gokwik?.cookie === "string"
          ? mergedSecrets.gokwik.cookie.trim()
          : typeof mergedSecrets.gokwik_cookie === "string"
            ? mergedSecrets.gokwik_cookie.trim()
            : "",
    });
  }

  await supabaseFetch("merchant_configs?on_conflict=id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(merchantConfigs),
  });

  await supabaseFetch("merchant_secrets?on_conflict=merchant_id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(merchantSecrets),
  });

  console.log(
    `Synced ${merchantConfigs.length} merchant configuration records to Supabase.`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
