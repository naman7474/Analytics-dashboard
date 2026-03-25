"use client";

import { signOut } from "next-auth/react";
import { MerchantSwitcher } from "./merchant-switcher";
import { DateRangePicker } from "./date-range-picker";
import { Button } from "@/components/ui/button";
import { AuthenticatedUser } from "@/lib/types";
import { Menu, LogOut } from "lucide-react";

export function Header({
  user,
  onMenuToggle,
}: {
  user: AuthenticatedUser;
  onMenuToggle?: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/80">
      {/* Top row: hamburger + merchant + user */}
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden dark:hover:bg-gray-800"
          >
            <Menu className="h-5 w-5" />
          </button>
          <MerchantSwitcher />
          <div className="hidden rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 sm:inline-flex">
            {user.role === "admin" ? "Admin" : "Viewer"}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden text-right md:block">
            <p className="text-sm font-medium text-gray-900">{user.name || user.email}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </div>
      {/* Date picker row — scrollable on mobile */}
      <div className="border-t border-gray-100 px-4 py-2 sm:px-6 dark:border-gray-800/50">
        <DateRangePicker />
      </div>
    </header>
  );
}
