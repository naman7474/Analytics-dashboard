import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/providers";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth/session";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "A/B Testing Dashboard",
  description: "Shopify vs Ratio experiment analytics",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-gray-50 dark:bg-gray-900">
        {user ? (
          <Providers role={user.role}>
            <AppShell isAdmin={user.role === "admin"} user={user}>
              {children}
            </AppShell>
          </Providers>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
