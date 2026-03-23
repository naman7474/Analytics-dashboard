import "server-only";

import { MerchantConfig } from "../types";

type CruxFormFactor = "PHONE" | "DESKTOP";

export interface PerformanceVitals {
  lcp: number;
  fcp: number;
  cls: number;
  inp: number;
  sampleCount?: number;
}

export interface PerformanceSourceInfo {
  source: "crux" | "psi";
  label: string;
  collectionPeriod?: {
    firstDate?: string;
    lastDate?: string;
  };
}

export interface CruxPerformanceResult {
  vitals: PerformanceVitals;
  meta: PerformanceSourceInfo;
}

const CRUX_API = "https://chromeuxreport.googleapis.com/v1/records:queryRecord";
const PSI_API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

function ensureHttpsOrigin(domain: string) {
  return domain.startsWith("http://") || domain.startsWith("https://")
    ? new URL(domain).origin
    : `https://${domain}`;
}

function formatCollectionDate(date?: { year?: number; month?: number; day?: number }) {
  if (!date?.year || !date?.month || !date?.day) return undefined;
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function parseCruxApiResponse(payload: {
  record?: {
    metrics?: Record<string, { percentiles?: { p75?: number | string } }>;
    collectionPeriod?: {
      firstDate?: { year?: number; month?: number; day?: number };
      lastDate?: { year?: number; month?: number; day?: number };
    };
  };
}): CruxPerformanceResult | null {
  const metrics = payload.record?.metrics;
  if (!metrics) return null;

  return {
    vitals: {
      lcp: Number(metrics.largest_contentful_paint?.percentiles?.p75) || 0,
      fcp: Number(metrics.first_contentful_paint?.percentiles?.p75) || 0,
      cls: Number(metrics.cumulative_layout_shift?.percentiles?.p75) || 0,
      inp: Number(metrics.interaction_to_next_paint?.percentiles?.p75) || 0,
    },
    meta: {
      source: "crux",
      label: "CrUX 28-day p75",
      collectionPeriod: {
        firstDate: formatCollectionDate(payload.record?.collectionPeriod?.firstDate),
        lastDate: formatCollectionDate(payload.record?.collectionPeriod?.lastDate),
      },
    },
  };
}

function parsePsiResponse(payload: {
  originLoadingExperience?: {
    metrics?: Record<string, { percentile?: number | string }>;
  };
}): CruxPerformanceResult | null {
  const metrics = payload.originLoadingExperience?.metrics;
  if (!metrics) return null;

  return {
    vitals: {
      lcp: Number(metrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile) || 0,
      fcp: Number(metrics.FIRST_CONTENTFUL_PAINT_MS?.percentile) || 0,
      cls: Number(metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile) || 0,
      inp: Number(metrics.INTERACTION_TO_NEXT_PAINT?.percentile) || 0,
    },
    meta: {
      source: "psi",
      label: "CrUX via PSI 28-day p75",
    },
  };
}

async function fetchCruxApi(origin: string, formFactor: CruxFormFactor) {
  const apiKey = process.env.CRUX_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(`${CRUX_API}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      origin,
      formFactor,
      metrics: [
        "largest_contentful_paint",
        "first_contentful_paint",
        "cumulative_layout_shift",
        "interaction_to_next_paint",
      ],
    }),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(`CrUX API error: ${res.status} - ${message}`);
  }

  return parseCruxApiResponse(await res.json());
}

async function fetchPsiCruxFallback(origin: string, formFactor: CruxFormFactor) {
  const strategy = formFactor === "PHONE" ? "mobile" : "desktop";
  const url = new URL(PSI_API);
  url.searchParams.set("url", origin);
  url.searchParams.set("strategy", strategy);
  url.searchParams.set("category", "PERFORMANCE");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(`PageSpeed Insights API error: ${res.status} - ${message}`);
  }

  return parsePsiResponse(await res.json());
}

export async function fetchLiveWebsitePerformance(
  merchant: MerchantConfig,
  formFactor: CruxFormFactor
): Promise<CruxPerformanceResult | null> {
  const origin = ensureHttpsOrigin(merchant.domain);
  const cruxResult = await fetchCruxApi(origin, formFactor);
  if (cruxResult) return cruxResult;
  return fetchPsiCruxFallback(origin, formFactor);
}
