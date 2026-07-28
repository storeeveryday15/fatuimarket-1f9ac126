/** Shared admin-domain types mapped to the reseller operations tables. */

export type SupplierStatus =
  | "online"
  | "offline"
  | "slow"
  | "api_error"
  | "auth_error"
  | "unknown";

export type Supplier = {
  id: string;
  name: string;
  website: string | null;
  api_endpoint: string | null;
  api_key_secret_name: string | null;
  status: string;
  priority: number;
  supported_products: string[];
  notes: string | null;
  auto_pricing_enabled: boolean;
  auto_ordering_enabled: boolean;
  last_checked_at: string | null;
  avg_response_ms: number | null;
  error_count: number;
  wallet_balance_inr: number;
  created_at: string;
  updated_at: string;
};

export type CatalogProduct = {
  id: string;
  product_slug: string;
  tier_label: string;
  category: string | null;
  image_url: string | null;
  description: string | null;
  price_inr: number;
  supplier_cost_inr: number;
  supplier_id: string | null;
  supplier_url: string | null;
  visible: boolean;
  featured: boolean;
  stock_status: string;
  auto_pricing: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PriceHistoryRow = {
  id: string;
  catalog_product_id: string | null;
  supplier_id: string | null;
  old_price_inr: number | null;
  new_price_inr: number | null;
  supplier_cost_inr: number | null;
  profit_inr: number | null;
  reason: string | null;
  ai_explanation: string | null;
  changed_by: string | null;
  created_at: string;
};

export type AdminNotification = {
  id: string;
  type: string;
  severity: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
  created_at: string;
};

export type PlatformSettings = {
  id: number;
  min_profit_inr: number;
  max_profit_inr: number;
  min_profit_pct: number;
  max_profit_pct: number;
  price_rounding: string;
  auto_pricing_mode: string;
  auto_ordering_enabled: boolean;
  low_wallet_threshold_inr: number;
  low_profit_threshold_inr: number;
  discord_webhook_url: string | null;
  email_alerts_enabled: boolean;
  telegram_alerts_enabled: boolean;
  ai_behaviour: string | null;
  updated_at: string;
};

export type AiReport = {
  id: string;
  report_date: string;
  kind: string;
  content: string;
  metrics: Record<string, unknown>;
  created_at: string;
};

export const SUPPLIER_STATUS_META: Record<string, { label: string; className: string }> = {
  online: { label: "Online", className: "bg-success/15 text-success" },
  offline: { label: "Offline", className: "bg-destructive/15 text-destructive" },
  slow: { label: "Slow response", className: "bg-warning/15 text-warning" },
  api_error: { label: "API error", className: "bg-destructive/10 text-destructive/80" },
  auth_error: { label: "Auth error", className: "bg-destructive/10 text-destructive/80" },
  unknown: { label: "Unknown", className: "bg-secondary text-muted-foreground" },
};

export const SEVERITY_META: Record<string, { label: string; className: string }> = {
  info: { label: "Info", className: "bg-blue-500/15 text-blue-500" },
  success: { label: "Success", className: "bg-success/15 text-success" },
  warning: { label: "Warning", className: "bg-warning/15 text-warning" },
  critical: { label: "Critical", className: "bg-destructive/15 text-destructive" },
};
