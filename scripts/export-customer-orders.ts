/**
 * Standalone script to export all orders with customer data as CSV.
 * Run: npx tsx scripts/export-customer-orders.ts <merchantId> <from> <to>
 *
 * Example:
 *   npx tsx scripts/export-customer-orders.ts 5855d033-da21-4fed-9da5-006640392a29 2026-03-30 2026-04-05
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const SHOPIFY_API_VERSION = "2026-01";

interface OrderRow {
  variant: string;
  orderId: string;
  orderCreatedAt: string;
  orderDate: string;
  orderValue: string;
  customerName: string;
  customerEmail: string;
  customerCreatedAt: string;
  customerDate: string;
  lifetimeOrders: string;
  classification: string;
}

interface MerchantInfo {
  shop: string;
  accessToken: string;
  ratioTag: string;
  name: string;
}

async function getMerchantFromSupabase(merchantId: string): Promise<MerchantInfo | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
    return null;
  }

  // Fetch merchant config
  const configRes = await fetch(
    `${supabaseUrl}/rest/v1/merchant_configs?id=eq.${merchantId}&select=*`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );
  const configs = await configRes.json();
  if (!configs?.length) return null;

  const config = configs[0];

  // Fetch merchant secrets
  const secretRes = await fetch(
    `${supabaseUrl}/rest/v1/merchant_secrets?merchant_id=eq.${merchantId}&select=*`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );
  const secrets = await secretRes.json();
  const secret = secrets?.[0];

  if (!secret?.shopify_access_token) {
    console.error("No Shopify access token found for merchant");
    return null;
  }

  return {
    shop: config.shopify_shop,
    accessToken: secret.shopify_access_token,
    ratioTag: config.ratio_tag || "primathon",
    name: config.name,
  };
}

async function getMerchantFromLocal(merchantId: string): Promise<MerchantInfo | null> {
  try {
    const dataDir = path.join(process.cwd(), "data");
    const merchantsRaw = await fs.readFile(path.join(dataDir, "merchants.json"), "utf-8");
    const secretsRaw = await fs.readFile(path.join(dataDir, "merchant-secrets.local.json"), "utf-8");

    const merchants = JSON.parse(merchantsRaw) as Array<{
      id: string;
      name: string;
      shopify: { shop: string };
      ratioTag: string;
    }>;
    const secrets = JSON.parse(secretsRaw) as Record<string, { shopify: { accessToken: string } }>;

    const merchant = merchants.find((m) => m.id === merchantId);
    const accessToken = secrets[merchantId]?.shopify?.accessToken;

    if (!merchant || !accessToken) return null;

    return {
      shop: merchant.shopify.shop,
      accessToken,
      ratioTag: merchant.ratioTag,
      name: merchant.name,
    };
  } catch {
    return null;
  }
}

async function fetchAllOrders(
  shop: string,
  accessToken: string,
  ratioTag: string,
  from: string,
  to: string,
  variant: "ratio" | "shopify"
): Promise<OrderRow[]> {
  const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const tagFilter =
    variant === "ratio" ? `tag:'${ratioTag}'` : `tag_not:'${ratioTag}'`;

  const query = [
    `created_at:>=${from}`,
    `created_at:<=${to}`,
    tagFilter,
  ].join(" ");

  const rows: OrderRow[] = [];
  let cursor: string | null = null;
  let hasNext = true;
  let page = 0;

  while (hasNext) {
    page++;
    process.stderr.write(`\r  ${variant}: fetching page ${page}...`);

    const graphqlQuery = `query Orders($query: String!, $after: String) {
      orders(first: 250, query: $query, sortKey: CREATED_AT, after: $after) {
        edges {
          cursor
          node {
            name
            createdAt
            totalPriceSet { shopMoney { amount currencyCode } }
            customer {
              createdAt
              displayName
              numberOfOrders
              email
            }
          }
        }
        pageInfo { hasNextPage }
      }
    }`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query: graphqlQuery, variables: { query, after: cursor } }),
    });

    if (!res.ok) throw new Error(`Shopify API error: ${res.status}`);
    const data = await res.json();
    if (data?.errors?.length) {
      throw new Error(data.errors.map((e: { message?: string }) => e.message).join("; "));
    }

    const edges = data?.data?.orders?.edges || [];

    for (const edge of edges) {
      const node = edge.node;
      cursor = edge.cursor;
      if (!node) continue;

      const customer = node.customer as {
        createdAt?: string;
        displayName?: string;
        numberOfOrders?: string;
        email?: string;
      } | null;

      const orderDate = String(node.createdAt ?? "").slice(0, 10);
      const priceSet = node.totalPriceSet as { shopMoney?: { amount?: string } } | undefined;
      const orderValue = priceSet?.shopMoney?.amount || "0";
      const customerDate = customer?.createdAt?.slice(0, 10) || "";
      const classification =
        customerDate && customerDate < orderDate ? "REPEAT" : "FIRST";

      rows.push({
        variant,
        orderId: node.name || "",
        orderCreatedAt: node.createdAt || "",
        orderDate,
        orderValue,
        customerName: customer?.displayName || "Guest",
        customerEmail: customer?.email || "",
        customerCreatedAt: customer?.createdAt || "",
        customerDate,
        lifetimeOrders: customer?.numberOfOrders || "0",
        classification,
      });
    }

    hasNext = data?.data?.orders?.pageInfo?.hasNextPage || false;
  }

  console.error(`  ${variant}: ${rows.length} orders fetched`);
  return rows;
}

async function main() {
  const [, , merchantId, from, to] = process.argv;
  if (!merchantId || !from || !to) {
    console.error("Usage: npx tsx scripts/export-customer-orders.ts <merchantId> <from> <to>");
    process.exit(1);
  }

  // Try local first, then Supabase
  let merchant = await getMerchantFromLocal(merchantId);
  if (!merchant) {
    console.error("Not found in local files, trying Supabase...");
    merchant = await getMerchantFromSupabase(merchantId);
  }

  if (!merchant) {
    console.error(`Could not find merchant ${merchantId}`);
    process.exit(1);
  }

  console.error(`Fetching orders for ${merchant.name} (${merchant.shop})`);
  console.error(`Date range: ${from} to ${to}\n`);

  const [ratioRows, shopifyRows] = await Promise.all([
    fetchAllOrders(merchant.shop, merchant.accessToken, merchant.ratioTag, from, to, "ratio"),
    fetchAllOrders(merchant.shop, merchant.accessToken, merchant.ratioTag, from, to, "shopify"),
  ]);

  const allRows = [...ratioRows, ...shopifyRows];

  // Summary
  const ratioRepeat = ratioRows.filter((r) => r.classification === "REPEAT").length;
  const shopifyRepeat = shopifyRows.filter((r) => r.classification === "REPEAT").length;
  console.error(`\n--- Summary ---`);
  const ratioTotal = ratioRows.reduce((s, r) => s + parseFloat(r.orderValue), 0);
  const shopifyTotal = shopifyRows.reduce((s, r) => s + parseFloat(r.orderValue), 0);
  console.error(`Ratio:   ${ratioRows.length} total | ${ratioRepeat} repeat (${ratioRows.length > 0 ? ((ratioRepeat / ratioRows.length) * 100).toFixed(1) : 0}%) | ${ratioRows.length - ratioRepeat} first | AOV: ₹${ratioRows.length > 0 ? (ratioTotal / ratioRows.length).toFixed(0) : 0}`);
  console.error(`Shopify: ${shopifyRows.length} total | ${shopifyRepeat} repeat (${shopifyRows.length > 0 ? ((shopifyRepeat / shopifyRows.length) * 100).toFixed(1) : 0}%) | ${shopifyRows.length - shopifyRepeat} first | AOV: ₹${shopifyRows.length > 0 ? (shopifyTotal / shopifyRows.length).toFixed(0) : 0}`);

  // CSV to stdout
  const headers = [
    "Variant",
    "Order ID",
    "Order Created At",
    "Order Date",
    "Order Value",
    "Customer Name",
    "Customer Email",
    "Customer Created At",
    "Customer Date",
    "Lifetime Orders",
    "Classification",
  ];

  console.log(headers.join(","));
  for (const row of allRows) {
    console.log(
      [
        row.variant,
        row.orderId,
        row.orderCreatedAt,
        row.orderDate,
        row.orderValue,
        `"${(row.customerName || "").replace(/"/g, '""')}"`,
        row.customerEmail,
        row.customerCreatedAt,
        row.customerDate,
        row.lifetimeOrders,
        row.classification,
      ].join(",")
    );
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
