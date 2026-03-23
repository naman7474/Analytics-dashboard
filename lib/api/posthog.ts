import "server-only";

import { MerchantConfig, PostHogFunnelData } from "../types";
import { PerformanceVitals } from "./crux";

const POSTHOG_API = "https://us.posthog.com";

/**
 * Execute a HogQL query against the PostHog API.
 */
async function executeHogQL(merchant: MerchantConfig, query: string) {
  const url = `${POSTHOG_API}/api/projects/${merchant.posthog.projectId}/query/`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${merchant.posthog.apiKey}`,
    },
    body: JSON.stringify({
      query: {
        kind: "HogQLQuery",
        query,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog API error: ${res.status} - ${text}`);
  }

  return res.json();
}

/**
 * Fetch Ratio funnel data from PostHog.
 * Sessions where entry URL contains store.{domain}.
 */
export async function fetchPostHogFunnel(
  merchant: MerchantConfig,
  from: string,
  to: string
): Promise<PostHogFunnelData[]> {
  const storeDomain = merchant.storeDomain;

  const query = `
    WITH orders AS (
      SELECT toDate(toTimeZone(timestamp, 'Asia/Kolkata')) AS date,
             count(*) AS total_orders
      FROM events
      WHERE toDate(toTimeZone(timestamp, 'Asia/Kolkata')) >= toDate('${from}')
        AND toDate(toTimeZone(timestamp, 'Asia/Kolkata')) <= toDate('${to}')
        AND properties.$session_entry_url LIKE '%${storeDomain}%'
        AND event = 'purchase'
      GROUP BY 1
    )
    SELECT toDate(toTimeZone(events.timestamp, 'Asia/Kolkata')) AS date,
           countDistinctIf(\`$session_id\`, event = '$pageview') AS sessions,
           countDistinctIf(\`$session_id\`, event = 'add_to_cart') AS sessions_with_atc,
           round(100 * sessions_with_atc / sessions, 2) AS atc_per,
           countDistinctIf(\`$session_id\`, event = 'checkout_started') AS sessions_with_checkout,
           round(100 * sessions_with_checkout / sessions, 2) AS checkout_per,
           countDistinctIf(\`$session_id\`, event = 'purchase') AS sessions_purchases,
           max(orders.total_orders) AS total_orders,
           round(100 * total_orders / sessions, 2) AS purchase_per
    FROM events
    LEFT JOIN orders ON toDate(toTimeZone(events.timestamp, 'Asia/Kolkata')) = orders.date
    WHERE toDate(toTimeZone(events.timestamp, 'Asia/Kolkata')) >= toDate('${from}')
      AND toDate(toTimeZone(events.timestamp, 'Asia/Kolkata')) <= toDate('${to}')
      AND properties.$session_entry_url LIKE '%${storeDomain}%'
    GROUP BY 1
    ORDER BY 1 ASC`;

  const result = await executeHogQL(merchant, query);
  const rows = result?.results || [];

  return rows.map((row: unknown[]) => ({
    date: String(row[0]),
    sessions: Number(row[1]) || 0,
    sessionsWithAtc: Number(row[2]) || 0,
    atcRate: Number(row[3]) || 0,
    sessionsWithCheckout: Number(row[4]) || 0,
    checkoutRate: Number(row[5]) || 0,
    totalOrders: Number(row[7]) || 0,
    purchaseRate: Number(row[8]) || 0,
  }));
}

/**
 * Fetch audience breakdown from PostHog — split by variant.
 * Ratio = landing_page_url contains storeDomain
 * Shopify = landing_page_url does NOT contain storeDomain
 */
export async function fetchPostHogAudience(
  merchant: MerchantConfig,
  from: string,
  to: string
) {
  const storeDomain = merchant.storeDomain;

  const query = `
    SELECT
      if(properties.$session_entry_url LIKE '%${storeDomain}%', 'Ratio', 'Shopify') AS variant,
      properties.$pathname AS pathname,
      count(DISTINCT \`$session_id\`) AS sessions,
      count(DISTINCT distinct_id) AS unique_visitors
    FROM events
    WHERE toDate(toTimeZone(timestamp, 'Asia/Kolkata')) >= toDate('${from}')
      AND toDate(toTimeZone(timestamp, 'Asia/Kolkata')) <= toDate('${to}')
      AND event = '$pageview'
    GROUP BY 1, 2
    ORDER BY variant ASC, sessions DESC
    LIMIT 100`;

  const result = await executeHogQL(merchant, query);
  return (result?.results || []).map((row: unknown[]) => ({
    variant: String(row[0]),
    pathname: String(row[1]),
    sessions: Number(row[2]) || 0,
    uniqueVisitors: Number(row[3]) || 0,
  }));
}

/**
 * Fetch UTM breakdown from PostHog for Ratio variant.
 * Returns sessions and orders (purchase events) per utm_source.
 * PostHog only tracks Ratio (store.domain) traffic.
 */
export async function fetchPostHogUTM(
  merchant: MerchantConfig,
  from: string,
  to: string
) {
  const storeDomain = merchant.storeDomain;

  const query = `
    SELECT properties.utm_source AS source,
           count(DISTINCT \`$session_id\`) AS sessions,
           countDistinctIf(\`$session_id\`, event = 'purchase') AS orders
    FROM events
    WHERE toDate(toTimeZone(timestamp, 'Asia/Kolkata')) >= toDate('${from}')
      AND toDate(toTimeZone(timestamp, 'Asia/Kolkata')) <= toDate('${to}')
      AND properties.$session_entry_url LIKE '%${storeDomain}%'
    GROUP BY 1
    ORDER BY sessions DESC
    LIMIT 100`;

  const result = await executeHogQL(merchant, query);
  return (result?.results || []).map((row: unknown[]) => ({
    source: String(row[0] || "(direct)"),
    sessions: Number(row[1]) || 0,
    orders: Number(row[2]) || 0,
  }));
}

/**
 * Fetch geo/location breakdown from PostHog.
 */
export async function fetchPostHogLocations(
  merchant: MerchantConfig,
  from: string,
  to: string
) {
  const storeDomain = merchant.storeDomain;

  const query = `
    SELECT properties.$geoip_city_name AS city,
           properties.$geoip_subdivision_1_name AS region,
           properties.$geoip_country_name AS country,
           count(DISTINCT \`$session_id\`) AS sessions
    FROM events
    WHERE toDate(toTimeZone(timestamp, 'Asia/Kolkata')) >= toDate('${from}')
      AND toDate(toTimeZone(timestamp, 'Asia/Kolkata')) <= toDate('${to}')
      AND properties.$session_entry_url LIKE '%${storeDomain}%'
      AND event = '$pageview'
    GROUP BY 1, 2, 3
    ORDER BY sessions DESC
    LIMIT 50`;

  const result = await executeHogQL(merchant, query);
  return (result?.results || []).map((row: unknown[]) => ({
    city: String(row[0] || "Unknown"),
    region: String(row[1] || "Unknown"),
    country: String(row[2] || "Unknown"),
    sessions: Number(row[3]) || 0,
  }));
}

/**
 * Fetch web vitals/performance data from PostHog.
 */
export async function fetchPostHogPerformance(
  merchant: MerchantConfig,
  from: string,
  to: string
) {
  const storeDomain = merchant.storeDomain;

  const query = `
    SELECT properties.$device_type AS device_type,
           quantileIf(0.75)(properties.$web_vitals_LCP_value, isNotNull(properties.$web_vitals_LCP_value)) AS lcp,
           quantileIf(0.75)(properties.$web_vitals_FCP_value, isNotNull(properties.$web_vitals_FCP_value)) AS fcp,
           quantileIf(0.75)(properties.$web_vitals_CLS_value, isNotNull(properties.$web_vitals_CLS_value)) AS cls,
           quantileIf(0.75)(properties.$web_vitals_INP_value, isNotNull(properties.$web_vitals_INP_value)) AS inp,
           count() AS sample_count
    FROM events
    WHERE toDate(toTimeZone(timestamp, 'Asia/Kolkata')) >= toDate('${from}')
      AND toDate(toTimeZone(timestamp, 'Asia/Kolkata')) <= toDate('${to}')
      AND properties.$session_entry_url LIKE '%${storeDomain}%'
      AND event = '$web_vitals'
      AND properties.$device_type IN ('Desktop', 'Mobile')
    GROUP BY 1`;

  const result = await executeHogQL(merchant, query);
  const rows = result?.results || [];
  const emptyVitals = (): PerformanceVitals => ({
    lcp: 0,
    fcp: 0,
    cls: 0,
    inp: 0,
    sampleCount: 0,
  });

  const data: { mobile: PerformanceVitals; desktop: PerformanceVitals } = {
    mobile: emptyVitals(),
    desktop: emptyVitals(),
  };

  for (const row of rows) {
    const deviceType = String(row[0] || "").toLowerCase();
    const key = deviceType === "desktop" ? "desktop" : deviceType === "mobile" ? "mobile" : null;
    if (!key) continue;

    data[key] = {
      lcp: Number(row[1]) || 0,
      fcp: Number(row[2]) || 0,
      cls: Number(row[3]) || 0,
      inp: Number(row[4]) || 0,
      sampleCount: Number(row[5]) || 0,
    };
  }

  return data;
}
