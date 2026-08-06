import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Truck,
  Package,
  LineChart,
  Users,
  Settings,
  Bot,
  Bell,
  TrendingUp,
  Globe,
  PackageSearch,
} from "lucide-react";
import type { ComponentType } from "react";

const LINKS: Array<{ to: string; label: string; icon: ComponentType<{ className?: string }> }> = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/assistant", label: "AI Assistant", icon: Bot },
  { to: "/admin/suppliers", label: "Suppliers", icon: Truck },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/supplier-catalog", label: "Supplier Catalog", icon: PackageSearch },
  { to: "/admin/servers", label: "Game Servers", icon: Globe },
  { to: "/admin/pricing", label: "Price Engine", icon: TrendingUp },
  { to: "/admin/analytics", label: "Analytics", icon: LineChart },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

/** Horizontal, scrollable admin navigation — works down to small phones. */
export function AdminNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="-mx-4 mb-6 overflow-x-auto px-4 pb-1">
      <div className="flex min-w-max gap-1.5">
        {LINKS.map(({ to, label, icon: Icon }) => {
          const active = to === "/admin" ? pathname === "/admin" || pathname === "/admin/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all ${
                active
                  ? "border-[var(--neon)]/60 bg-[var(--neon)]/10 text-foreground shadow-[0_0_20px_-8px_var(--neon)]"
                  : "border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
