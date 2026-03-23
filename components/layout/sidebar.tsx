"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Settings,
  FlaskConical,
  X,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3, adminOnly: false },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

export function Sidebar({
  isAdmin,
  mobileOpen,
  onClose,
}: {
  isAdmin: boolean;
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-50 h-screen w-56 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 transition-transform duration-200 ease-in-out",
        // Desktop: always visible
        "lg:translate-x-0",
        // Mobile: slide in/out
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-sm">A/B Dashboard</span>
        </div>
        {/* Close button on mobile */}
        <button
          onClick={onClose}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 lg:hidden dark:hover:bg-zinc-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {navItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
