"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  FlaskConical,
  ShieldCheck,
  ArrowRight,
  BarChart3,
  GitCompare,
  Zap,
} from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied:
    "Your account is authenticated, but it does not have access to this dashboard.",
  Configuration:
    "Authentication is not configured correctly. Check the Google auth environment variables.",
};

const FEATURES = [
  {
    icon: BarChart3,
    title: "Funnel Analytics",
    description: "Track sessions, ATC, checkout, and orders across variants",
  },
  {
    icon: GitCompare,
    title: "A/B Comparison",
    description: "Side-by-side Shopify vs Ratio performance metrics",
  },
  {
    icon: Zap,
    title: "Real-time Insights",
    description: "Daily trends, UTM sources, audience & web vitals",
  },
];

export default function SignInPage() {
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();

  const errorMessage = useMemo(() => {
    const error = searchParams.get("error");
    if (!error) return null;
    return ERROR_MESSAGES[error] || "Unable to sign you in.";
  }, [searchParams]);

  const handleSignIn = async () => {
    setIsLoading(true);
    await signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 lg:flex-row">
      {/* Left panel — branding (hidden on small screens, shown as top bar) */}
      <div className="relative flex flex-col justify-between bg-zinc-900 px-6 py-8 text-white sm:px-10 lg:w-[45%] lg:px-16 lg:py-16">
        {/* Subtle grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 sm:h-11 sm:w-11">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold sm:text-xl">A/B Dashboard</p>
              <p className="text-xs text-zinc-400 sm:text-sm">
                Experiment analytics platform
              </p>
            </div>
          </div>

          <div className="mt-8 hidden lg:block">
            <h1 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
              Make data-driven
              <br />
              decisions, faster.
            </h1>
            <p className="mt-4 max-w-md text-base text-zinc-400">
              Compare Shopify and Ratio checkout experiences with unified
              analytics from Shopify, PostHog, and GoKwik — all in one place.
            </p>
          </div>

          {/* Feature cards — hidden on mobile */}
          <div className="mt-10 hidden space-y-4 lg:block">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <feature.icon className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">{feature.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative mt-6 hidden text-xs text-zinc-500 lg:block">
          Built for D2C merchants running conversion experiments
        </p>
      </div>

      {/* Right panel — sign in form */}
      <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10 lg:py-0">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-semibold text-zinc-900 sm:text-2xl">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Use your Google account to access the dashboard.
          </p>

          {errorMessage && (
            <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {errorMessage}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Access policy
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Primathon users get admin access. External viewers can sign in
              only if a merchant has explicitly assigned them access.
            </p>
          </div>

          <Button
            onClick={handleSignIn}
            disabled={isLoading}
            size="lg"
            className="mt-6 h-12 w-full gap-2 text-sm font-medium"
          >
            {isLoading ? (
              "Redirecting..."
            ) : (
              <>
                Continue with Google
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <p className="mt-6 text-center text-xs text-zinc-400">
            By signing in, you agree to the internal data access policies.
          </p>
        </div>
      </div>
    </div>
  );
}
