import "server-only";

import { MerchantConfig, ShopifySessionData, ShopifyOrderData } from "../types";
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
  const daysAgoTo = differenceInISODays(today, to);

  // ShopifyQL SINCE accepts startOfDay(-Nd) or today
  const since = daysAgoFrom === 0 ? "today" : `startOfDay(-${daysAgoFrom}d)`;

  // ShopifyQL UNTIL is exclusive — to include the "to" date, we need the day after.
  // Use "today" when the to date is today or yesterday (startOfDay(-0d) is invalid).
  // Callers must filter response rows by from/to to exclude extra data.
  let until: string;
  if (daysAgoTo <= 0) {
    until = "today";
  } else if (daysAgoTo === 1) {
    until = "today";
  } else {
    until = `startOfDay(-${daysAgoTo - 1}d)`;
  }

  return { since, until };
}

/**
 * Fetch sessions data from Shopify using ShopifyQL.
 * Filters OUT sessions that land on store.{domain} (those are Ratio sessions).
 */
export async function fetchShopifySessions(
  merchant: MerchantConfig,
  from: string,
  to: string
): Promise<ShopifySessionData[]> {
  const { since, until } = toShopifyQLDates(from, to);

  const query = `FROM sessions SHOW online_store_visitors, sessions, sessions_with_cart_additions WHERE human_or_bot_session IN ('human') AND landing_page_url NOT CONTAINS '${merchant.storeDomain}' TIMESERIES day WITH TOTALS SINCE ${since} UNTIL ${until} ORDER BY day ASC LIMIT 1000`;

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
