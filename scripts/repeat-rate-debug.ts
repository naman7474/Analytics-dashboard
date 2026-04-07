/**
 * Debug repeat purchase rate within a time window.
 * Groups orders by customer, counts how many customers bought 2+ times.
 *
 * Usage: npx tsx scripts/repeat-rate-debug.ts <merchantId>
 */

import * as path from "path";
import * as fs from "fs/promises";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const SHOPIFY_API_VERSION = "2026-01";

interface RawOrder {
  orderId: string;
  orderDate: string;
  orderValue: number;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
}

interface MerchantInfo {
  shop: string;
  accessToken: string;
  ratioTag: string;
  name: string;
}

async function getMerchant(merchantId: string): Promise<MerchantInfo | null> {
  // Try local
  try {
    const dataDir = path.join(process.cwd(), "data");
    const merchants = JSON.parse(await fs.readFile(path.join(dataDir, "merchants.json"), "utf-8"));
    const secrets = JSON.parse(await fs.readFile(path.join(dataDir, "merchant-secrets.local.json"), "utf-8"));
    const m = merchants.find((x: { id: string }) => x.id === merchantId);
    if (m && secrets[merchantId]?.shopify?.accessToken) {
      return { shop: m.shopify.shop, accessToken: secrets[merchantId].shopify.accessToken, ratioTag: m.ratioTag, name: m.name };
    }
  } catch {}

  // Try Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const configRes = await fetch(`${supabaseUrl}/rest/v1/merchant_configs?id=eq.${merchantId}&select=*`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const configs = await configRes.json();
  if (!configs?.length) return null;

  const secretRes = await fetch(`${supabaseUrl}/rest/v1/merchant_secrets?merchant_id=eq.${merchantId}&select=*`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const secrets = await secretRes.json();
  if (!secrets?.[0]?.shopify_access_token) return null;

  return {
    shop: configs[0].shopify_shop,
    accessToken: secrets[0].shopify_access_token,
    ratioTag: configs[0].ratio_tag || "primathon",
    name: configs[0].name,
  };
}

async function fetchOrders(
  shop: string,
  accessToken: string,
  ratioTag: string,
  from: string,
  to: string,
  variant: "ratio" | "shopify"
): Promise<RawOrder[]> {
  const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const tagFilter = variant === "ratio" ? `tag:'${ratioTag}'` : `tag_not:'${ratioTag}'`;
  const query = [`created_at:>=${from}`, `created_at:<=${to}`, tagFilter].join(" ");

  const orders: RawOrder[] = [];
  let cursor: string | null = null;
  let hasNext = true;
  let page = 0;

  while (hasNext) {
    page++;
    process.stderr.write(`\r  ${variant}: page ${page} (${orders.length} orders)...`);

    const gql = `query($query: String!, $after: String) {
      orders(first: 250, query: $query, sortKey: CREATED_AT, after: $after) {
        edges {
          cursor
          node {
            name
            createdAt
            totalPriceSet { shopMoney { amount } }
            customer { id displayName email }
          }
        }
        pageInfo { hasNextPage }
      }
    }`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
      body: JSON.stringify({ query: gql, variables: { query, after: cursor } }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    if (data?.errors?.length) throw new Error(data.errors.map((e: { message?: string }) => e.message).join("; "));

    const edges = data?.data?.orders?.edges || [];
    for (const edge of edges) {
      const node = edge.node;
      cursor = edge.cursor;
      if (!node) continue;
      const customer = node.customer;
      orders.push({
        orderId: node.name,
        orderDate: String(node.createdAt).slice(0, 10),
        orderValue: parseFloat(node.totalPriceSet?.shopMoney?.amount || "0"),
        customerId: customer?.id || null,
        customerName: customer?.displayName || "Guest",
        customerEmail: customer?.email || "",
      });
    }
    hasNext = data?.data?.orders?.pageInfo?.hasNextPage || false;
  }
  console.error(`  ${variant}: ${orders.length} orders`);
  return orders;
}

function analyzeRepeatRate(orders: RawOrder[], label: string) {
  // Group by customer ID
  const customerOrders = new Map<string, RawOrder[]>();
  let guestOrders = 0;

  for (const order of orders) {
    if (!order.customerId) {
      guestOrders++;
      continue;
    }
    const existing = customerOrders.get(order.customerId) || [];
    existing.push(order);
    customerOrders.set(order.customerId, existing);
  }

  const totalCustomers = customerOrders.size;
  let oneTimeBuyers = 0;
  let repeatBuyers = 0; // 2+ orders
  let threeTimeBuyers = 0; // 3+ orders
  let repeatOrders = 0;
  let repeatRevenue = 0;
  let firstTimeRevenue = 0;

  const frequencyDist = new Map<number, number>(); // orderCount -> # customers

  for (const [, custOrders] of customerOrders) {
    const count = custOrders.length;
    frequencyDist.set(count, (frequencyDist.get(count) || 0) + 1);

    if (count === 1) {
      oneTimeBuyers++;
      firstTimeRevenue += custOrders[0].orderValue;
    } else {
      repeatBuyers++;
      if (count >= 3) threeTimeBuyers++;
      for (const o of custOrders) repeatRevenue += o.orderValue;
      repeatOrders += count;
    }
  }

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + o.orderValue, 0);

  console.error(`\n=== ${label} ===`);
  console.error(`Total orders: ${totalOrders}`);
  console.error(`Total revenue: ₹${totalRevenue.toFixed(0)}`);
  console.error(`AOV: ₹${totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(0) : 0}`);
  console.error(`Guest orders (no customer): ${guestOrders}`);
  console.error(`Unique customers: ${totalCustomers}`);
  console.error(`  One-time buyers: ${oneTimeBuyers} (${totalCustomers > 0 ? ((oneTimeBuyers / totalCustomers) * 100).toFixed(1) : 0}%)`);
  console.error(`  Repeat buyers (2+ orders): ${repeatBuyers} (${totalCustomers > 0 ? ((repeatBuyers / totalCustomers) * 100).toFixed(1) : 0}%)`);
  console.error(`  3+ orders: ${threeTimeBuyers}`);
  console.error(`  Repeat buyer revenue: ₹${repeatRevenue.toFixed(0)} (${totalRevenue > 0 ? ((repeatRevenue / totalRevenue) * 100).toFixed(1) : 0}% of total)`);
  console.error(`  First-time buyer revenue: ₹${firstTimeRevenue.toFixed(0)}`);

  // Frequency distribution
  const sortedFreqs = Array.from(frequencyDist.entries()).sort((a, b) => a[0] - b[0]);
  console.error(`\n  Order frequency distribution:`);
  for (const [count, customers] of sortedFreqs) {
    console.error(`    ${count} order(s): ${customers} customers`);
  }

  return { totalCustomers, oneTimeBuyers, repeatBuyers, totalOrders, totalRevenue, repeatRevenue, guestOrders };
}

async function main() {
  const merchantId = process.argv[2];
  if (!merchantId) {
    console.error("Usage: npx tsx scripts/repeat-rate-debug.ts <merchantId>");
    process.exit(1);
  }

  const merchant = await getMerchant(merchantId);
  if (!merchant) { console.error("Merchant not found"); process.exit(1); }

  const today = new Date();
  const d30 = new Date(today); d30.setDate(d30.getDate() - 30);
  const d60 = new Date(today); d60.setDate(d60.getDate() - 60);

  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  const todayStr = toISO(today);
  const from30 = toISO(d30);
  const from60 = toISO(d60);

  console.error(`Merchant: ${merchant.name} (${merchant.shop})`);
  console.error(`Today: ${todayStr}\n`);

  // --- 30 days ---
  console.error(`\n========== LAST 30 DAYS (${from30} to ${todayStr}) ==========`);
  const [ratio30, shopify30] = await Promise.all([
    fetchOrders(merchant.shop, merchant.accessToken, merchant.ratioTag, from30, todayStr, "ratio"),
    fetchOrders(merchant.shop, merchant.accessToken, merchant.ratioTag, from30, todayStr, "shopify"),
  ]);
  const r30 = analyzeRepeatRate(ratio30, "RATIO - 30 days");
  const s30 = analyzeRepeatRate(shopify30, "SHOPIFY - 30 days");

  // --- 60 days ---
  console.error(`\n\n========== LAST 60 DAYS (${from60} to ${todayStr}) ==========`);
  const [ratio60, shopify60] = await Promise.all([
    fetchOrders(merchant.shop, merchant.accessToken, merchant.ratioTag, from60, todayStr, "ratio"),
    fetchOrders(merchant.shop, merchant.accessToken, merchant.ratioTag, from60, todayStr, "shopify"),
  ]);
  const r60 = analyzeRepeatRate(ratio60, "RATIO - 60 days");
  const s60 = analyzeRepeatRate(shopify60, "SHOPIFY - 60 days");

  // --- Side by side summary ---
  console.error(`\n\n========== COMPARISON ==========`);
  console.error(`\n30-day repeat rate (customers who bought 2+ times within 30 days):`);
  console.error(`  Ratio:   ${r30.repeatBuyers}/${r30.totalCustomers} = ${r30.totalCustomers > 0 ? ((r30.repeatBuyers / r30.totalCustomers) * 100).toFixed(1) : 0}%`);
  console.error(`  Shopify: ${s30.repeatBuyers}/${s30.totalCustomers} = ${s30.totalCustomers > 0 ? ((s30.repeatBuyers / s30.totalCustomers) * 100).toFixed(1) : 0}%`);

  console.error(`\n60-day repeat rate:`);
  console.error(`  Ratio:   ${r60.repeatBuyers}/${r60.totalCustomers} = ${r60.totalCustomers > 0 ? ((r60.repeatBuyers / r60.totalCustomers) * 100).toFixed(1) : 0}%`);
  console.error(`  Shopify: ${s60.repeatBuyers}/${s60.totalCustomers} = ${s60.totalCustomers > 0 ? ((s60.repeatBuyers / s60.totalCustomers) * 100).toFixed(1) : 0}%`);

  // Check cross-variant repeats: customers who bought on BOTH ratio and shopify
  console.error(`\n--- Cross-variant analysis (30 days) ---`);
  const ratioCustomerIds30 = new Set(ratio30.filter(o => o.customerId).map(o => o.customerId!));
  const shopifyCustomerIds30 = new Set(shopify30.filter(o => o.customerId).map(o => o.customerId!));
  const crossBuyers30 = [...ratioCustomerIds30].filter(id => shopifyCustomerIds30.has(id));
  console.error(`  Customers who bought on BOTH ratio & shopify: ${crossBuyers30.length}`);
  if (crossBuyers30.length > 0 && crossBuyers30.length <= 20) {
    for (const id of crossBuyers30) {
      const rOrders = ratio30.filter(o => o.customerId === id);
      const sOrders = shopify30.filter(o => o.customerId === id);
      console.error(`    ${rOrders[0].customerName} (${rOrders[0].customerEmail}): ${rOrders.length} ratio + ${sOrders.length} shopify orders`);
    }
  }

  console.error(`\n--- Cross-variant analysis (60 days) ---`);
  const ratioCustomerIds60 = new Set(ratio60.filter(o => o.customerId).map(o => o.customerId!));
  const shopifyCustomerIds60 = new Set(shopify60.filter(o => o.customerId).map(o => o.customerId!));
  const crossBuyers60 = [...ratioCustomerIds60].filter(id => shopifyCustomerIds60.has(id));
  console.error(`  Customers who bought on BOTH ratio & shopify: ${crossBuyers60.length}`);
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });
