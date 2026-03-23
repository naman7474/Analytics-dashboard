"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { AuthenticatedUser } from "@/lib/types";

export function AppShell({
  isAdmin,
  user,
  children,
}: {
  isAdmin: boolean;
  user: AuthenticatedUser;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <Sidebar
        isAdmin={isAdmin}
        mobileOpen={sidebarOpen}
        onClose={closeSidebar}
      />

      <div className="lg:pl-56">
        <Header
          user={user}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
        />
        <main className="px-4 py-4 sm:px-6 sm:py-6">{children}</main>
      </div>
    </>
  );
}
