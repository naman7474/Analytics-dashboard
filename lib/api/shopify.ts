import "server-only";

import { MerchantConfig, ShopifySessionData, ShopifyOrderData, SessionMetrics, ExtendedOrderMetrics } from "../types";
import { differenceInISODays, getISTToday, toISTISODate } from "../ist-date";

const SHOPIFY_API_VERSION = "2026-01";

/**
 * Execute a ShopifyQL query against the Shopify Analytics API.
 * The ShopifyQL string is JSON-escaped and inlined into the GraphQL query
 * (shopifyqlQuery does not support GraphQL variables).
 */
async function executeShopifyQL(merchant: MerchantConfig, query: string) {
  const url = `https://${merchant.shopify.shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  // JSON.stringify the query string to get proper escaping (handles quotes, newlines, etc.)
  const escapedQuery = JSON.stringify(query);

  const graphqlBody = `{
    shopifyqlQuery(query: ${escapedQuery}) {
      parseErrors
      tableData {
        columns {
          name
          dataType
        }
        rows
      }
    }
  }`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": merchant.shopify.accessToken,
    },
    body: JSON.stringify({ query: graphqlBody }),
  });

  if (!res.ok) {
    throw new Error(`Shopify API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Convert a date range to ShopifyQL relative date expressions.
 * ShopifyQL expects: SINCE startOfDay(-7d) UNTIL startOfDay(-1d)
 */
function toShopifyQLDates(from: string, to: string): { since: string; until: string } {
  const today = getISTToday();
  const daysAgoFrom = differenceInISODays(today, from);

  // ShopifyQL SINCE accepts startOfDay(-Nd) or today
  const since = daysAgoFrom === 0 ? "today" : `startOfDay(-${daysAgoFrom}d)`;

  // ShopifyQL UNTIL only reliably accepts "today" — relative date expressions
  // like startOfDay(-Nd) cause parse errors in the UNTIL clause.
  // Always use "today" and rely on callers to filter response rows by from/to.
  const until = "today";

  return { since, until };
}

/**
 * Fetch sessions data from Shopify using ShopifyQL.
 * variant "shopify" = landing_page_url NOT CONTAINS storeDomain
 * variant "ratio"   = landing_page_url CONTAINS storeDomain
 */
export async function fetchShopifySessions(
  merchant: MerchantConfig,
  from: string,
  to: string,
  variant: "shopify" | "ratio" = "shopify"
): Promise<ShopifySessionData[]> {
  const { since, until } = toShopifyQLDates(from, to);
  const urlFilter = variant === "ratio"
    ? `landing_page_url CONTAINS '${merchant.storeDomain}'`
    : `landing_page_url NOT CONTAINS '${merchant.storeDomain}'`;

  const query = `FROM sessions SHOW online_store_visitors, sessions, sessions_with_cart_additions WHERE human_or_bot_session IN ('human') AND ${urlFilter} TIMESERIES day WITH TOTALS SINCE ${since} UNTIL ${until} ORDER BY day ASC LIMIT 1000`;

  const result = await executeShopifyQL(merchant, query);
  const tableData = result?.data?.shopifyqlQuery?.tableData;

  if (!tableData?.rows) return [];

  const rows: ShopifySessionData[] = [];

  for (const row of tableData.rows) {
    // Rows are objects keyed by column name in 2026-01 API
    const day = row["day"] || row["Day"];
    // Filter to only include dates within the requested range.
    // ShopifyQL UNTIL "today" can include partial data for today.
    if (day && day !== "Total" && day >= from && day <= to) {
      rows.push({
        date: day,
        visitors: Number(row["online_store_visitors"]) || 0,
        sessions: Number(row["sessions"]) || 0,
        sessionsWithCartAdditions: Number(row["sessions_with_cart_additions"]) || 0,
      });
    }
  }

  return rows;
}

/**
 * Fetch orders from Shopify GraphQL.
 * For Shopify variant (A): orders WITHOUT the ratio tag.
 * For Ratio variant (B): orders WITH the ratio tag.
 */
export async function fetchShopifyOrders(
  merchant: MerchantConfig,
  from: string,
  to: string,
  variant: "shopify" | "ratio"
): Promise<ShopifyOrderData[]> {
  type ShopifyOrdersResponse = {
    data?: {
      orders?: {
        edges?: Array<{
          cursor: string;
          node: {
            id: string;
            name: string;
            totalPriceSet: {
              shopMoney: {
                amount: string;
              };
            };
            createdAt: string;
            tags: string[];
          };
        }>;
        pageInfo?: {
          hasNextPage?: boolean;
        };
      };
    };
    errors?: Array<{
      message?: string;
    }>;
    extensions?: {
      search?: Array<{
        warnings?: Array<{
          message?: string;
          field?: string;
        }>;
      }>;
    };
  };

  // Shopify variant (A): Gokwik-tagged, excluding Ratio and Appbrew
  // Ratio variant (B): tagged with merchant's ratioTag
  const tagFilters =
    variant === "ratio"
      ? [`tag:'${merchant.ratioTag}'`]
      : [`tag_not:'${merchant.ratioTag}'`, `tag_not:'Appbrew'`, `tag:'Gokwik'`];

  const query = [
    `created_at:>=${from}`,
    `created_at:<=${to}`,
    ...tagFilters,
  ].join(" ");

  const url = `https://${merchant.shopify.shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const allOrders: ShopifyOrderData[] = [];
  let cursor: string | null = null;
  let hasNext = true;

  while (hasNext) {
    const graphqlQuery = `query Orders($query: String!, $after: String) {
      orders(first: 250, query: $query, sortKey: CREATED_AT, after: $after) {
        edges {
          cursor
          node {
            id
            name
            totalPriceSet { shopMoney { amount } }
            createdAt
            tags
          }
        }
        pageInfo { hasNextPage }
      }
    }`;

    const res: Response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": merchant.shopify.accessToken,
        "Shopify-Search-Query-Debug": "1",
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: {
          query,
          after: cursor,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Shopify API error: ${res.status} ${res.statusText}`);
    }

    const data: ShopifyOrdersResponse = await res.json();
    const graphqlErrors = data?.errors;
    const searchWarnings = data?.extensions?.search
      ?.flatMap((entry: { warnings?: Array<{ message?: string; field?: string }> }) => entry.warnings || [])
      ?.map((warning: { field?: string; message?: string }) =>
        warning.field ? `${warning.field}: ${warning.message}` : warning.message
      )
      ?.filter(Boolean);

    if (graphqlErrors?.length) {
      throw new Error(
        graphqlErrors
          .map((error: { message?: string }) => error.message || "Unknown GraphQL error")
          .join("; ")
      );
    }

    if (searchWarnings?.length) {
      throw new Error(`Shopify order search warning: ${searchWarnings.join("; ")}`);
    }

    const edges: NonNullable<
      NonNullable<NonNullable<ShopifyOrdersResponse["data"]>["orders"]>["edges"]
    > = data?.data?.orders?.edges || [];

    for (const edge of edges) {
      const node = edge.node;
      allOrders.push({
        id: node.id,
        name: node.name,
        totalPrice: parseFloat(node.totalPriceSet.shopMoney.amount),
        createdAt: node.createdAt,
        tags: node.tags,
      });
      cursor = edge.cursor;
    }

    hasNext = data?.data?.orders?.pageInfo?.hasNextPage || false;
  }

  return allOrders;
}

/**
 * Fetch sessions grouped by referrer_source (UTM source) from Shopify.
 * Uses TIMESERIES day so we can filter out dates outside the requested range.
 */
export async function fetchShopifySessionsBySource(
  merchant: MerchantConfig,
  from: string,
  to: string
) {
  const { since, until } = toShopifyQLDates(from, to);

  const query = `FROM sessions SHOW sessions GROUP BY referrer_source WHERE human_or_bot_session IN ('human') TIMESERIES day SINCE ${since} UNTIL ${until} ORDER BY sessions DESC LIMIT 500`;

  const result = await executeShopifyQL(merchant, query);
  const rows = result?.data?.shopifyqlQuery?.tableData?.rows || [];

  // Aggregate daily rows into totals per source, filtering by date range
  const sourceMap = new Map<string, number>();
  for (const row of rows) {
    const day = row["day"] || row["Day"];
    if (!day || day === "Total" || day < from || day > to) continue;
    const source = String(row["referrer_source"] || row["Referrer source"] || "");
    if (!source) continue;
    sourceMap.set(source, (sourceMap.get(source) || 0) + (Number(row["sessions"]) || 0));
  }

  return Array.from(sourceMap.entries())
    .map(([source, sessions]) => ({ source, sessions }))
    .sort((a, b) => b.sessions - a.sessions);
}

/**
 * Fetch audience breakdown by landing_page_type from Shopify.
 * Uses TIMESERIES day so we can filter out dates outside the requested range.
 */
export async function fetchShopifyAudience(
  merchant: MerchantConfig,
  from: string,
  to: string
) {
  const { since, until } = toShopifyQLDates(from, to);

  const ratioQuery = `FROM sessions SHOW sessions GROUP BY landing_page_type WHERE human_or_bot_session IN ('human') AND landing_page_url CONTAINS '${merchant.storeDomain}' TIMESERIES day SINCE ${since} UNTIL ${until} ORDER BY sessions DESC LIMIT 200`;

  const shopifyQuery = `FROM sessions SHOW sessions GROUP BY landing_page_type WHERE human_or_bot_session IN ('human') AND landing_page_url NOT CONTAINS '${merchant.storeDomain}' TIMESERIES day SINCE ${since} UNTIL ${until} ORDER BY sessions DESC LIMIT 200`;

  const [ratioResult, shopifyResult] = await Promise.all([
    executeShopifyQL(merchant, ratioQuery),
    executeShopifyQL(merchant, shopifyQuery),
  ]);

  const parseRows = (result: { data?: { shopifyqlQuery?: { tableData?: { rows?: Record<string, unknown>[] } } } }) => {
    const rows = result?.data?.shopifyqlQuery?.tableData?.rows || [];
    // Aggregate daily rows into totals per page type, filtering by date range
    const typeMap = new Map<string, number>();
    for (const row of rows) {
      const day = row["day"] || row["Day"];
      if (!day || day === "Total" || day < from || day > to) continue;
      const pageType = String(row["landing_page_type"] || row["Landing page type"] || "");
      if (!pageType) continue;
      typeMap.set(pageType, (typeMap.get(pageType) || 0) + (Number(row["sessions"]) || 0));
    }
    return Array.from(typeMap.entries())
      .map(([landingPageType, sessions]) => ({ landingPageType, sessions }))
      .sort((a, b) => b.sessions - a.sessions);
  };

  return {
    ratio: parseRows(ratioResult),
    shopify: parseRows(shopifyResult),
  };
}

/**
 * Aggregate orders by date.
 */
export function aggregateOrdersByDate(orders: ShopifyOrderData[]): Record<string, { orders: number; sales: number }> {
  const map: Record<string, { orders: number; sales: number }> = {};
  for (const order of orders) {
    const date = toISTISODate(order.createdAt);
    if (!map[date]) map[date] = { orders: 0, sales: 0 };
    map[date].orders++;
    map[date].sales += order.totalPrice;
  }
  return map;
}

/**
 * Fetch session performance metrics from ShopifyQL.
 * Returns pageviews/session, bounce rate, avg session duration, device split.
 */
export async function fetchShopifySessionMetrics(
  merchant: MerchantConfig,
  from: string,
  to: string,
  variant: "shopify" | "ratio"
): Promise<SessionMetrics> {
  const { since, until } = toShopifyQLDates(from, to);
  const urlFilter = variant === "ratio"
    ? `landing_page_url CONTAINS '${merchant.storeDomain}'`
    : `landing_page_url NOT CONTAINS '${merchant.storeDomain}'`;

  const metricsQuery = `FROM sessions SHOW pageviews, sessions, bounce_rate, average_session_duration WHERE human_or_bot_session IN ('human') AND ${urlFilter} TIMESERIES day WITH TOTALS SINCE ${since} UNTIL ${until} ORDER BY day ASC LIMIT 1000`;

  const deviceQuery = `FROM sessions SHOW sessions GROUP BY session_device_type WHERE human_or_bot_session IN ('human') AND ${urlFilter} TIMESERIES day SINCE ${since} UNTIL ${until} ORDER BY sessions DESC LIMIT 500`;

  const [metricsResult, deviceResult] = await Promise.all([
    executeShopifyQL(merchant, metricsQuery),
    executeShopifyQL(merchant, deviceQuery),
  ]);

  // Parse metrics — build daily array and totals, filtered by date range
  const metricsRows = metricsResult?.data?.shopifyqlQuery?.tableData?.rows || [];
  let totalPageviews = 0;
  let totalSessions = 0;
  let weightedBounceRate = 0;
  let weightedDuration = 0;
  const daily: SessionMetrics["daily"] = [];

  for (const row of metricsRows) {
    const day = row["day"] || row["Day"];
    if (!day || day === "Total" || day < from || day > to) continue;
    const sessions = Number(row["sessions"]) || 0;
    const pageviews = Number(row["pageviews"]) || 0;
    const bounceRate = Number(row["bounce_rate"]) || 0;
    const duration = Number(row["average_session_duration"]) || 0;

    totalPageviews += pageviews;
    totalSessions += sessions;
    weightedBounceRate += bounceRate * sessions;
    weightedDuration += duration * sessions;

    daily.push({
      date: day,
      pagesPerSession: sessions > 0 ? pageviews / sessions : 0,
      bounceRate: bounceRate * 100,
      avgSessionDuration: duration,
    });
  }

  // Parse device split — aggregate daily rows filtered by date range
  const deviceRows = deviceResult?.data?.shopifyqlQuery?.tableData?.rows || [];
  const deviceMap = new Map<string, number>();
  for (const row of deviceRows) {
    const day = row["day"] || row["Day"];
    if (!day || day === "Total" || day < from || day > to) continue;
    const device = String(row["session_device_type"] || "unknown");
    const sessions = Number(row["sessions"]) || 0;
    deviceMap.set(device, (deviceMap.get(device) || 0) + sessions);
  }

  return {
    daily,
    totals: {
      pagesPerSession: totalSessions > 0 ? totalPageviews / totalSessions : 0,
      bounceRate: totalSessions > 0 ? (weightedBounceRate / totalSessions) * 100 : 0,
      avgSessionDuration: totalSessions > 0 ? weightedDuration / totalSessions : 0,
    },
    deviceSplit: Array.from(deviceMap.entries())
      .map(([device, sessions]) => ({ device, sessions }))
      .sort((a, b) => b.sessions - a.sessions),
  };
}

/**
 * Fetch extended order data from Shopify GraphQL.
 * Returns items per order, discount usage, prepaid/COD split, new/returning customers.
 */
export async function fetchShopifyOrdersExtended(
  merchant: MerchantConfig,
  from: string,
  to: string,
  variant: "shopify" | "ratio"
): Promise<ExtendedOrderMetrics> {
  const tagFilter =
    variant === "ratio"
      ? `tag:'${merchant.ratioTag}'`
      : `tag_not:'${merchant.ratioTag}'`;

  const query = [
    `created_at:>=${from}`,
    `created_at:<=${to}`,
    tagFilter,
  ].join(" ");

  const url = `https://${merchant.shopify.shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  let totalItems = 0;
  let totalOrders = 0;
  let ordersWithDiscount = 0;
  let totalDiscountAmount = 0;
  let prepaidOrders = 0;
  let codOrders = 0;
  let newCustomerOrders = 0;
  let returningCustomerOrders = 0;
  let cursor: string | null = null;
  let hasNext = true;

  while (hasNext) {
    const graphqlQuery = `query Orders($query: String!, $after: String) {
      orders(first: 250, query: $query, sortKey: CREATED_AT, after: $after) {
        edges {
          cursor
          node {
            id
            tags
            lineItems(first: 50) {
              edges {
                node { quantity }
              }
            }
            discountCodes
            currentTotalDiscountsSet { shopMoney { amount } }
            customer { numberOfOrders }
          }
        }
        pageInfo { hasNextPage }
      }
    }`;

    const res: Response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": merchant.shopify.accessToken,
      },
      body: JSON.stringify({ query: graphqlQuery, variables: { query, after: cursor } }),
    });

    if (!res.ok) throw new Error(`Shopify API error: ${res.status}`);

    const data: Record<string, unknown> = await res.json();
    const errors = data?.errors as Array<{ message?: string }> | undefined;
    if (errors?.length) {
      throw new Error(errors.map((e) => e.message).join("; "));
    }

    const ordersData = (data?.data as Record<string, unknown>)?.orders as Record<string, unknown> | undefined;
    const edges = ((ordersData?.edges) || []) as Array<{ cursor: string; node: Record<string, unknown> }>;

    for (const edge of edges) {
      const node = edge.node as Record<string, unknown>;
      totalOrders++;
      cursor = edge.cursor;

      // Items per order
      const lineItemsObj = node.lineItems as { edges?: Array<{ node: { quantity: number } }> } | undefined;
      const lineItems = lineItemsObj?.edges || [];
      for (const li of lineItems) {
        totalItems += Number(li.node?.quantity) || 0;
      }

      // Discount
      const discountCodes = (node.discountCodes || []) as string[];
      const discountSet = node.currentTotalDiscountsSet as { shopMoney?: { amount?: string } } | undefined;
      const discountAmount = parseFloat(discountSet?.shopMoney?.amount || "0");
      if (discountCodes.length > 0 || discountAmount > 0) {
        ordersWithDiscount++;
        totalDiscountAmount += discountAmount;
      }

      // Payment method — determined by tags
      const tags = ((node.tags || []) as string[]).map((t) => t.toLowerCase());
      if (tags.includes("cod")) codOrders++;
      else if (tags.includes("prepaid")) prepaidOrders++;
      else prepaidOrders++; // default to prepaid if neither tag present

      // New vs returning
      const customer = node.customer as { numberOfOrders?: number } | undefined;
      const customerOrders = Number(customer?.numberOfOrders) || 0;
      if (customerOrders <= 1) newCustomerOrders++;
      else returningCustomerOrders++;
    }

    hasNext = (ordersData?.pageInfo as { hasNextPage?: boolean })?.hasNextPage || false;
  }

  return {
    totalOrders,
    itemsPerOrder: totalOrders > 0 ? totalItems / totalOrders : 0,
    discountUsageRate: totalOrders > 0 ? (ordersWithDiscount / totalOrders) * 100 : 0,
    avgDiscountAmount: ordersWithDiscount > 0 ? totalDiscountAmount / ordersWithDiscount : 0,
    prepaidOrders,
    codOrders,
    newCustomerOrders,
    returningCustomerOrders,
  };
}

/**
 * Extract the URL path from a full URL string.
 */
function extractPath(fullUrl: string): string {
  try {
    return new URL(fullUrl).pathname;
  } catch {
    // If URL parsing fails, treat the value itself as a path
    return fullUrl.startsWith("/") ? fullUrl : "/";
  }
}

/**
 * Map a URL path to a Shopify-style landing page type.
 */
function urlPathToPageType(path: string): string {
  if (!path || path === "/") return "home";
  const lower = path.toLowerCase();
  if (lower.startsWith("/products")) return "product";
  if (lower.startsWith("/collections")) return "collection";
  if (lower.startsWith("/pages")) return "page";
  if (lower.startsWith("/blogs")) return "blog";
  if (lower.startsWith("/search")) return "search";
  return "other";
}

/**
 * Aggregated orders by landing page type for a variant.
 */
export interface LandingPageOrderRow {
  landingPageType: string;
  orders: number;
  sales: number;
}

/**
 * Fetch Ratio orders from Shopify Orders API, extract `full_url` from
 * customAttributes (noteAttributes) to determine landing page type.
 * Only fetches orders tagged with the merchant's ratioTag.
 */
export async function fetchRatioOrdersByLandingPage(
  merchant: MerchantConfig,
  from: string,
  to: string
): Promise<LandingPageOrderRow[]> {
  const url = `https://${merchant.shopify.shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const searchQuery = [
    `created_at:>=${from}`,
    `created_at:<=${to}`,
    `tag:'${merchant.ratioTag}'`,
  ].join(" ");

  const typeMap = new Map<string, { orders: number; sales: number }>();
  let cursor: string | null = null;
  let hasNext = true;

  while (hasNext) {
    const graphqlQuery = `query Orders($query: String!, $after: String) {
      orders(first: 250, query: $query, sortKey: CREATED_AT, after: $after) {
        edges {
          cursor
          node {
            id
            totalPriceSet { shopMoney { amount } }
            customAttributes { key value }
          }
        }
        pageInfo { hasNextPage }
      }
    }`;

    const res: Response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": merchant.shopify.accessToken,
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: { query: searchQuery, after: cursor },
      }),
    });

    if (!res.ok) {
      throw new Error(`Shopify API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (data?.errors?.length) {
      throw new Error(
        data.errors.map((e: { message?: string }) => e.message).join("; ")
      );
    }

    const edges = data?.data?.orders?.edges || [];

    for (const edge of edges) {
      const node = edge.node;
      cursor = edge.cursor;

      const price = parseFloat(node.totalPriceSet?.shopMoney?.amount || "0");

      // Extract full_url from customAttributes (noteAttributes)
      const attrs: Array<{ key: string; value: string }> = node.customAttributes || [];
      const fullUrlAttr = attrs.find(
        (a) => a.key === "full_url" || a.key === "landing_page" || a.key === "landing_page_url"
      );
      const fullUrl = fullUrlAttr?.value || "";

      const path = fullUrl ? extractPath(fullUrl) : "/";
      const pageType = urlPathToPageType(path);

      if (!typeMap.has(pageType)) typeMap.set(pageType, { orders: 0, sales: 0 });
      const entry = typeMap.get(pageType)!;
      entry.orders += 1;
      entry.sales += price;
    }

    hasNext = data?.data?.orders?.pageInfo?.hasNextPage || false;
  }

  return Array.from(typeMap.entries())
    .map(([landingPageType, data]) => ({
      landingPageType,
      orders: data.orders,
      sales: data.sales,
    }))
    .sort((a, b) => b.orders - a.orders);
}

/**
 * Fetch Shopify-variant orders (NOT tagged with ratioTag and NOT tagged with Appbrew).
 * Uses the same URL-based page type mapping as Ratio orders.
 */
export async function fetchShopifyOrdersByLandingPage(
  merchant: MerchantConfig,
  from: string,
  to: string
): Promise<LandingPageOrderRow[]> {
  const url = `https://${merchant.shopify.shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const searchQuery = [
    `created_at:>=${from}`,
    `created_at:<=${to}`,
    `tag_not:'${merchant.ratioTag}'`,
    `tag_not:'Appbrew'`,
    `tag:'Gokwik'`,
  ].join(" ");

  const typeMap = new Map<string, { orders: number; sales: number }>();
  let cursor: string | null = null;
  let hasNext = true;

  while (hasNext) {
    const graphqlQuery = `query Orders($query: String!, $after: String) {
      orders(first: 250, query: $query, sortKey: CREATED_AT, after: $after) {
        edges {
          cursor
          node {
            id
            totalPriceSet { shopMoney { amount } }
            customAttributes { key value }
          }
        }
        pageInfo { hasNextPage }
      }
    }`;

    const res: Response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": merchant.shopify.accessToken,
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: { query: searchQuery, after: cursor },
      }),
    });

    if (!res.ok) {
      throw new Error(`Shopify API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (data?.errors?.length) {
      throw new Error(
        data.errors.map((e: { message?: string }) => e.message).join("; ")
      );
    }

    const edges = data?.data?.orders?.edges || [];

    for (const edge of edges) {
      const node = edge.node;
      cursor = edge.cursor;

      const price = parseFloat(node.totalPriceSet?.shopMoney?.amount || "0");

      const attrs: Array<{ key: string; value: string }> = node.customAttributes || [];
      const fullUrlAttr = attrs.find(
        (a) => a.key === "full_url" || a.key === "landing_page" || a.key === "landing_page_url"
      );
      const fullUrl = fullUrlAttr?.value || "";

      const path = fullUrl ? extractPath(fullUrl) : "/";
      const pageType = urlPathToPageType(path);

      if (!typeMap.has(pageType)) typeMap.set(pageType, { orders: 0, sales: 0 });
      const entry = typeMap.get(pageType)!;
      entry.orders += 1;
      entry.sales += price;
    }

    hasNext = data?.data?.orders?.pageInfo?.hasNextPage || false;
  }

  return Array.from(typeMap.entries())
    .map(([landingPageType, data]) => ({
      landingPageType,
      orders: data.orders,
      sales: data.sales,
    }))
    .sort((a, b) => b.orders - a.orders);
}

/**
 * Landing page session row returned by the aggregation.
 */
export interface LandingPageSessionRow {
  landingPageType: string;
  sessions: number;
  sessionsWithCartAdditions: number;
  atcRate: number; // 0-100
}

/**
 * Fetch sessions + ATC grouped by landing_page_type from ShopifyQL.
 * Returns sessions and cart additions per landing page type for a given variant.
 */
export async function fetchShopifySessionsByLandingPage(
  merchant: MerchantConfig,
  from: string,
  to: string,
  variant: "shopify" | "ratio"
): Promise<LandingPageSessionRow[]> {
  const { since, until } = toShopifyQLDates(from, to);
  const urlFilter = variant === "ratio"
    ? `landing_page_url CONTAINS '${merchant.storeDomain}'`
    : `landing_page_url NOT CONTAINS '${merchant.storeDomain}'`;

  const query = `FROM sessions SHOW sessions, sessions_with_cart_additions GROUP BY landing_page_type WHERE human_or_bot_session IN ('human') AND ${urlFilter} TIMESERIES day SINCE ${since} UNTIL ${until} ORDER BY sessions DESC LIMIT 500`;

  const result = await executeShopifyQL(merchant, query);
  const rows = result?.data?.shopifyqlQuery?.tableData?.rows || [];

  // Aggregate daily rows into totals per landing page type, filtering by date range
  const typeMap = new Map<string, { sessions: number; atc: number }>();

  for (const row of rows) {
    const day = row["day"] || row["Day"];
    if (!day || day === "Total" || day < from || day > to) continue;
    const pageType = String(row["landing_page_type"] || row["Landing page type"] || "");
    if (!pageType) continue;

    if (!typeMap.has(pageType)) typeMap.set(pageType, { sessions: 0, atc: 0 });
    const entry = typeMap.get(pageType)!;
    entry.sessions += Number(row["sessions"]) || 0;
    entry.atc += Number(row["sessions_with_cart_additions"]) || 0;
  }

  return Array.from(typeMap.entries())
    .map(([landingPageType, data]) => ({
      landingPageType,
      sessions: data.sessions,
      sessionsWithCartAdditions: data.atc,
      atcRate: data.sessions > 0 ? (data.atc / data.sessions) * 100 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);
}
