import "server-only";

import { promises as fs } from "fs";
import path from "path";
import {
  MerchantConfig,
  MerchantInput,
  MerchantMetadata,
  MerchantSummary,
} from "@/lib/types";

type MerchantPublicRecord = MerchantMetadata & {
  shopify: {
    shop: string;
  };
  posthog: {
    projectId: string;
  };
  gokwik: {
    merchantMid: string;
  };
};

type MerchantSecretRecord = {
  shopify: {
    accessToken: string;
  };
  posthog: {
    apiKey: string;
  };
  gokwik: {
    cookie: string;
  };
};

type MerchantSecretStore = Record<string, MerchantSecretRecord>;

const DATA_DIR = path.join(process.cwd(), "data");
const PUBLIC_DATA_PATH = path.join(DATA_DIR, "merchants.json");
const SECRET_DATA_PATH = path.join(DATA_DIR, "merchant-secrets.local.json");

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeEmailList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? normalizeEmail(value) : ""))
        .filter(Boolean)
    )
  );
}

function toPublicRecord(raw: unknown): MerchantPublicRecord {
  const value = (raw ?? {}) as Record<string, unknown>;
  const shopify = (value.shopify ?? {}) as Record<string, unknown>;
  const posthog = (value.posthog ?? {}) as Record<string, unknown>;
  const gokwik = (value.gokwik ?? {}) as Record<string, unknown>;

  return {
    id: String(value.id || crypto.randomUUID()),
    name: String(value.name || ""),
    domain: String(value.domain || ""),
    storeDomain: String(value.storeDomain || ""),
    shopify: {
      shop: String(shopify.shop || ""),
    },
    posthog: {
      projectId: String(posthog.projectId || ""),
    },
    gokwik: {
      merchantMid: String(gokwik.merchantMid || ""),
    },
    ratioTag: String(value.ratioTag || "primathon"),
    viewerEmails: normalizeEmailList(value.viewerEmails),
    createdAt: String(value.createdAt || new Date().toISOString()),
  };
}

function toLegacySecretRecord(raw: unknown): MerchantSecretRecord | null {
  const value = (raw ?? {}) as Record<string, unknown>;
  const shopify = (value.shopify ?? {}) as Record<string, unknown>;
  const posthog = (value.posthog ?? {}) as Record<string, unknown>;
  const gokwik = (value.gokwik ?? {}) as Record<string, unknown>;

  const accessToken = String(shopify.accessToken || "");
  const apiKey = String(posthog.apiKey || "");
  const cookie = String(gokwik.cookie || "");

  if (!accessToken && !apiKey && !cookie) {
    return null;
  }

  return {
    shopify: { accessToken },
    posthog: { apiKey },
    gokwik: { cookie },
  };
}

function toSummary(
  merchant: MerchantPublicRecord,
  secretRecord?: MerchantSecretRecord
): MerchantSummary {
  return {
    ...merchant,
    shopify: {
      shop: merchant.shopify.shop,
      hasAccessToken: Boolean(secretRecord?.shopify.accessToken),
    },
    posthog: {
      projectId: merchant.posthog.projectId,
      hasApiKey: Boolean(secretRecord?.posthog.apiKey),
    },
    gokwik: {
      merchantMid: merchant.gokwik.merchantMid,
      hasCookie: Boolean(secretRecord?.gokwik.cookie),
    },
  };
}

function toMerchantConfig(
  merchant: MerchantPublicRecord,
  secretRecord?: MerchantSecretRecord
): MerchantConfig {
  return {
    ...merchant,
    shopify: {
      shop: merchant.shopify.shop,
      accessToken: secretRecord?.shopify.accessToken || "",
    },
    posthog: {
      projectId: merchant.posthog.projectId,
      apiKey: secretRecord?.posthog.apiKey || "",
    },
    gokwik: {
      merchantMid: merchant.gokwik.merchantMid,
      cookie: secretRecord?.gokwik.cookie || "",
    },
  };
}

async function ensureFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(PUBLIC_DATA_PATH);
  } catch {
    await fs.writeFile(PUBLIC_DATA_PATH, "[]", "utf-8");
  }

  try {
    await fs.access(SECRET_DATA_PATH);
  } catch {
    await fs.writeFile(SECRET_DATA_PATH, "{}", "utf-8");
  }
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  await ensureFiles();

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return raw.trim() ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writePublicRecords(records: MerchantPublicRecord[]) {
  await fs.writeFile(PUBLIC_DATA_PATH, JSON.stringify(records, null, 2), "utf-8");
}

async function writeSecretStore(store: MerchantSecretStore) {
  await fs.writeFile(SECRET_DATA_PATH, JSON.stringify(store, null, 2), "utf-8");
}

async function loadMerchantStore() {
  await ensureFiles();

  const rawPublic = await readJson<unknown[]>(PUBLIC_DATA_PATH, []);
  const rawSecrets = await readJson<Record<string, MerchantSecretRecord>>(SECRET_DATA_PATH, {});

  const publicRecords = rawPublic.map(toPublicRecord);
  const secretStore: MerchantSecretStore = { ...rawSecrets };

  let publicChanged = false;
  let secretChanged = false;

  for (let index = 0; index < rawPublic.length; index += 1) {
    const rawRecord = rawPublic[index];
    const publicRecord = publicRecords[index];
    const legacySecrets = toLegacySecretRecord(rawRecord);

    if (legacySecrets) {
      const existing = secretStore[publicRecord.id];
      secretStore[publicRecord.id] = {
        shopify: {
          accessToken:
            existing?.shopify.accessToken || legacySecrets.shopify.accessToken,
        },
        posthog: {
          apiKey: existing?.posthog.apiKey || legacySecrets.posthog.apiKey,
        },
        gokwik: {
          cookie: existing?.gokwik.cookie || legacySecrets.gokwik.cookie,
        },
      };
      secretChanged = true;
    }

    const originalRecord = rawRecord as Record<string, unknown>;
    if (
      "viewerEmails" in originalRecord === false ||
      (originalRecord.shopify as Record<string, unknown> | undefined)?.accessToken !==
        undefined ||
      (originalRecord.posthog as Record<string, unknown> | undefined)?.apiKey !==
        undefined ||
      (originalRecord.gokwik as Record<string, unknown> | undefined)?.cookie !==
        undefined
    ) {
      publicChanged = true;
    }
  }

  if (publicChanged) {
    await writePublicRecords(publicRecords);
  }

  if (secretChanged) {
    await writeSecretStore(secretStore);
  }

  return { publicRecords, secretStore };
}

export async function listMerchantSummariesLocal(): Promise<MerchantSummary[]> {
  const { publicRecords, secretStore } = await loadMerchantStore();
  return publicRecords.map((merchant) => toSummary(merchant, secretStore[merchant.id]));
}

export async function getMerchantSummariesByIdsLocal(ids: string[]): Promise<MerchantSummary[]> {
  const allowedIds = new Set(ids);
  const summaries = await listMerchantSummariesLocal();
  return summaries.filter((merchant) => allowedIds.has(merchant.id));
}

export async function getMerchantsLocal(): Promise<MerchantConfig[]> {
  const { publicRecords, secretStore } = await loadMerchantStore();
  return publicRecords.map((merchant) => toMerchantConfig(merchant, secretStore[merchant.id]));
}

export async function getMerchantLocal(id: string): Promise<MerchantConfig | undefined> {
  const { publicRecords, secretStore } = await loadMerchantStore();
  const merchant = publicRecords.find((record) => record.id === id);
  return merchant ? toMerchantConfig(merchant, secretStore[id]) : undefined;
}

export async function getMerchantSummaryLocal(id: string): Promise<MerchantSummary | undefined> {
  const { publicRecords, secretStore } = await loadMerchantStore();
  const merchant = publicRecords.find((record) => record.id === id);
  return merchant ? toSummary(merchant, secretStore[id]) : undefined;
}

export async function saveMerchantLocal(input: MerchantInput): Promise<MerchantConfig> {
  const { publicRecords, secretStore } = await loadMerchantStore();
  const id = input.id || crypto.randomUUID();
  const existingPublic = publicRecords.find((merchant) => merchant.id === id);
  const existingSecrets = secretStore[id];

  const publicRecord: MerchantPublicRecord = {
    id,
    name: input.name.trim(),
    domain: input.domain.trim(),
    storeDomain: input.storeDomain.trim(),
    shopify: {
      shop: input.shopify.shop.trim(),
    },
    posthog: {
      projectId: input.posthog.projectId.trim(),
    },
    gokwik: {
      merchantMid: input.gokwik.merchantMid.trim(),
    },
    ratioTag: input.ratioTag.trim(),
    viewerEmails: normalizeEmailList(input.viewerEmails || []),
    createdAt: existingPublic?.createdAt || input.createdAt || new Date().toISOString(),
  };

  const secretRecord: MerchantSecretRecord = {
    shopify: {
      accessToken:
        input.shopify.accessToken?.trim() || existingSecrets?.shopify.accessToken || "",
    },
    posthog: {
      apiKey: input.posthog.apiKey?.trim() || existingSecrets?.posthog.apiKey || "",
    },
    gokwik: {
      cookie: input.gokwik.cookie?.trim() || existingSecrets?.gokwik.cookie || "",
    },
  };

  const nextPublicRecords = publicRecords.filter((merchant) => merchant.id !== id);
  nextPublicRecords.push(publicRecord);
  nextPublicRecords.sort((a, b) => a.name.localeCompare(b.name));

  await writePublicRecords(nextPublicRecords);
  await writeSecretStore({
    ...secretStore,
    [id]: secretRecord,
  });

  return toMerchantConfig(publicRecord, secretRecord);
}

export async function deleteMerchantLocal(id: string): Promise<void> {
  const { publicRecords, secretStore } = await loadMerchantStore();
  const filtered = publicRecords.filter((merchant) => merchant.id !== id);
  const nextSecretStore = { ...secretStore };
  delete nextSecretStore[id];

  await writePublicRecords(filtered);
  await writeSecretStore(nextSecretStore);
}
