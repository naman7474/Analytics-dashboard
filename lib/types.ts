export type AppRole = "admin" | "viewer";

export interface MerchantMetadata {
  id: string;
  name: string;
  domain: string; // e.g., "wellversed.in"
  storeDomain: string; // e.g., "store.wellversed.in" (Ratio subdomain)
  ratioTag: string; // e.g., "primathon" — tag used on Ratio orders
  viewerEmails: string[];
  createdAt: string;
}

export interface MerchantSummary extends MerchantMetadata {
  shopify: {
    shop: string; // e.g., "wellversed-health.myshopify.com"
    hasAccessToken: boolean;
  };
  posthog: {
    projectId: string;
    hasApiKey: boolean;
  };
  gokwik: {
    merchantMid: string;
    hasCookie: boolean;
  };
}

// Merchant configuration (server-only)
export interface MerchantConfig extends MerchantMetadata {
  shopify: {
    shop: string; // e.g., "wellversed-health.myshopify.com"
    accessToken: string;
  };
  posthog: {
    projectId: string;
    apiKey: string; // personal API key
  };
  gokwik: {
    merchantMid: string;
    cookie: string; // auth cookie string (includes token)
  };
}

export interface MerchantInput {
  id?: string;
  name: string;
  domain: string;
  storeDomain: string;
  shopify: {
    shop: string;
    accessToken?: string;
  };
  posthog: {
    projectId: string;
    apiKey?: string;
  };
  gokwik: {
    merchantMid: string;
    cookie?: string;
  };
  ratioTag: string;
  viewerEmails?: string[];
  createdAt?: string;
}

export interface AuthenticatedUser {
  email: string;
  name?: string | null;
  image?: string | null;
  role: AppRole;
}

// Date range for queries
export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

// Funnel step data for one variant
export interface FunnelStep {
  label: string;
  value: number;
  rate?: number; // % of sessions
}

// Single variant's funnel data
export interface VariantFunnel {
  sessions: number;
  atc: number;
  checkout: number;
  orders: number;
  sales: number;
  atcRate: number;
  checkoutRate: number;
  conversionRate: number;
  aov: number;
  rps: number; // revenue per session
}

// A/B comparison for the dashboard
export interface ABComparison {
  shopify: VariantFunnel;
  ratio: VariantFunnel;
  winner: {
    conversionRate: "shopify" | "ratio" | "tie";
    rps: "shopify" | "ratio" | "tie";
    aov: "shopify" | "ratio" | "tie";
  };
}

// Daily data point for trend charts
export interface DailyDataPoint {
  date: string;
  shopify: number;
  ratio: number;
}

// Daily trend data
export interface DailyTrends {
  sessions: DailyDataPoint[];
  orders: DailyDataPoint[];
  sales: DailyDataPoint[];
  conversionRate: DailyDataPoint[];
  rps: DailyDataPoint[];
}

// Shopify session data from ShopifyQL
export interface ShopifySessionData {
  date: string;
  visitors: number;
  sessions: number;
  sessionsWithCartAdditions: number;
}

// Shopify order data
export interface ShopifyOrderData {
  id: string;
  name: string;
  totalPrice: number;
  createdAt: string;
  tags: string[];
}

// Aggregated Shopify orders by date
export interface ShopifyOrdersAggregated {
  date: string;
  orders: number;
  sales: number;
}

// PostHog funnel data from HogQL
export interface PostHogFunnelData {
  date: string;
  sessions: number;
  sessionsWithAtc: number;
  sessionsWithCheckout: number;
  totalOrders: number;
  atcRate: number;
  checkoutRate: number;
  purchaseRate: number;
}

// GoKwik checkout funnel
export interface GoKwikCheckoutData {
  date: string;
  hour: string;
  checkoutStarted: number;
  addressLanded: number;
  paymentStepReached: number;
  paymentMethodSelected: number;
  successfulOrders: number;
}

// GoKwik order metrics
export interface GoKwikOrderMetrics {
  orderStats: {
    total: number;
    percentageChange: string;
    breakdown: Array<{ date: string; hour: string; value: number }>;
  };
  saleStats: {
    total: number;
    percentageChange: string;
    breakdown: Array<{ date: string; hour: string; value: number }>;
  };
  averageOrderStats: {
    total: number;
    percentageChange: string;
    breakdown: Array<{ date: string; hour: string; value: number }>;
  };
}

// GoKwik marketing source split
export interface GoKwikMarketingSource {
  source: string;
  primaryValue: number;
  secondaryValue: number;
  contribution: string;
  percentageChange: string;
}

// GoKwik product metrics
export interface GoKwikProductMetric {
  description: string;
  sku: string;
  totalSales: number;
  percentageChange: string;
}

// PostHog audience/pathname breakdown
export interface AudienceBreakdown {
  pathname: string;
  sessions: number;
  uniqueVisitors: number;
  percentage: number;
}

// UTM breakdown
export interface UTMBreakdown {
  source: string;
  medium: string;
  campaign: string;
  sessions: number;
  orders: number;
  revenue: number;
}

// Location breakdown
export interface LocationBreakdown {
  city: string;
  region: string;
  country: string;
  sessions: number;
  orders: number;
}

// Web vitals / performance data
export interface PerformanceData {
  metric: string;
  shopifyValue: number;
  ratioValue: number;
  unit: string;
}

// Session performance metrics from ShopifyQL (per variant)
export interface SessionMetrics {
  daily: {
    date: string;
    pagesPerSession: number;
    bounceRate: number;
    avgSessionDuration: number;
  }[];
  totals: {
    pagesPerSession: number;
    bounceRate: number;
    avgSessionDuration: number;
  };
  deviceSplit: { device: string; sessions: number }[];
}

// Extended order metrics (per variant)
export interface ExtendedOrderMetrics {
  totalOrders: number;
  itemsPerOrder: number;
  discountUsageRate: number; // 0-100
  avgDiscountAmount: number;
  prepaidOrders: number;
  codOrders: number;
  newCustomerOrders: number;
  returningCustomerOrders: number;
}

// API response wrapper
export interface ApiResponse<T> {
  data: T;
  error?: string;
}
