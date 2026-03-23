import "server-only";

import {
  deleteMerchantLocal,
  getMerchantLocal,
  getMerchantsLocal,
  getMerchantSummariesByIdsLocal,
  getMerchantSummaryLocal,
  listMerchantSummariesLocal,
  saveMerchantLocal,
} from "@/lib/merchant-store/local";
import {
  deleteMerchantSupabase,
  getMerchantSupabase,
  getMerchantsSupabase,
  getMerchantSummariesByIdsSupabase,
  getMerchantSummarySupabase,
  isSupabaseMerchantStoreEnabled,
  listMerchantSummariesSupabase,
  saveMerchantSupabase,
} from "@/lib/merchant-store/supabase";
import { MerchantConfig, MerchantInput, MerchantSummary } from "@/lib/types";

function shouldUseSupabaseMerchantStore() {
  return isSupabaseMerchantStoreEnabled();
}

export async function listMerchantSummaries(): Promise<MerchantSummary[]> {
  if (shouldUseSupabaseMerchantStore()) {
    return listMerchantSummariesSupabase();
  }

  return listMerchantSummariesLocal();
}

export async function getMerchantSummariesByIds(ids: string[]): Promise<MerchantSummary[]> {
  if (shouldUseSupabaseMerchantStore()) {
    return getMerchantSummariesByIdsSupabase(ids);
  }

  return getMerchantSummariesByIdsLocal(ids);
}

export async function getMerchants(): Promise<MerchantConfig[]> {
  if (shouldUseSupabaseMerchantStore()) {
    return getMerchantsSupabase();
  }

  return getMerchantsLocal();
}

export async function getMerchant(id: string): Promise<MerchantConfig | undefined> {
  if (shouldUseSupabaseMerchantStore()) {
    return getMerchantSupabase(id);
  }

  return getMerchantLocal(id);
}

export async function getMerchantSummary(id: string): Promise<MerchantSummary | undefined> {
  if (shouldUseSupabaseMerchantStore()) {
    return getMerchantSummarySupabase(id);
  }

  return getMerchantSummaryLocal(id);
}

export async function saveMerchant(input: MerchantInput): Promise<MerchantConfig> {
  if (shouldUseSupabaseMerchantStore()) {
    return saveMerchantSupabase(input);
  }

  return saveMerchantLocal(input);
}

export async function deleteMerchant(id: string): Promise<void> {
  if (shouldUseSupabaseMerchantStore()) {
    return deleteMerchantSupabase(id);
  }

  return deleteMerchantLocal(id);
}
