"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ShieldCheck, Zap } from "lucide-react";
import { SignInIllustration } from "@/components/SignInIllustration";
import Image from "next/image"; // For google logo if needed. We'll use SVG.

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied:
    "Your account is authenticated, but it does not have access to this dashboard.",
  Configuration:
    "Authentication is not configured correctly. Check the Google auth environment variables.",
};

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
    <div className="flex min-h-screen flex-col-reverse lg:flex-row font-sans">
      {/* Left/Bottom panel - Branding */}
      <div className="relative flex w-full lg:w-1/2 flex-col justify-between bg-[#f8f9fa] px-8 py-10 sm:px-12 lg:px-12 lg:py-12">
        {/* Abstract Illustration Container */}
        <div className="flex flex-1 items-center justify-center min-h-[220px] lg:min-h-0">
          <div className="w-full max-w-[280px] lg:max-w-full flex items-center justify-center">
            <SignInIllustration />
          </div>
        </div>

        {/* Bottom Left Text */}
        <div className="mt-8 lg:mt-8 text-center lg:text-left">
          <p className="text-[10px] lg:text-xs font-semibold tracking-widest text-[#9ca3ac] uppercase mb-1 lg:mb-2">
            System Architecture
          </p>
          <h1 className="text-2xl lg:text-[32px] font-bold text-[#1a1f26] mb-2 lg:mb-3">
            A/B Dashboard
          </h1>
          <p className="max-w-md mx-auto lg:mx-0 text-[#5f6b7a] text-sm lg:text-[15px] leading-relaxed">
            Compare Shopify and Ratio checkout experiences with unified analytics from Shopify, PostHog, and GoKwik.
          </p>
        </div>
      </div>

      {/* Right panel - Sign In Form */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center bg-white px-6 py-12 sm:px-12 lg:px-24 xl:px-32">
        <div className="w-full max-w-[420px] mx-auto animate-fadeIn">
          {/* Logo Section */}
          <div className="flex items-center gap-3 mb-12">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111827]">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-[#111827] tracking-tight">A/B Dashboard</span>
          </div>

          <div className="mb-10">
            <h2 className="text-[32px] font-bold text-[#111827] mb-3 tracking-tight">
              Sign In
            </h2>
            <p className="text-[15px] text-[#5e6a78] leading-relaxed">
              Access your experiment analytics platform to review dashboard metrics.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {errorMessage}
            </div>
          )}

          {/* WELCOME BACK Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="h-[1px] flex-1 bg-gray-200"></div>
            <span className="text-[11px] font-semibold tracking-widest text-[#9ca3ac] uppercase">
              Welcome Back
            </span>
            <div className="h-[1px] flex-1 bg-gray-200"></div>
          </div>

          {/* Google Sign-in Card */}
          <button
            onClick={handleSignIn}
            disabled={isLoading}
            className="w-full group relative flex items-center justify-center gap-3 rounded-full border border-gray-200 bg-white p-3 hover:bg-gray-50 hover:border-gray-300 transition-all focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2 mb-8"
          >
            {/* Google Logo SVG */}
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            </div>
            <span className="text-[14px] font-medium text-gray-700 leading-tight">
              Continue with Google
            </span>
            {isLoading && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] rounded-full flex items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
              </div>
            )}
          </button>

          {/* SINGLE SIGN-ON ONLY Divider */}
          <div className="flex items-center gap-4 mb-8">
            <div className="h-[1px] flex-1 bg-gray-200"></div>
            <span className="text-[11px] font-semibold tracking-widest text-[#9ca3ac] uppercase whitespace-nowrap">
              Single Sign-On Only
            </span>
            <div className="h-[1px] flex-1 bg-gray-200"></div>
          </div>

          {/* Info Box */}
          <div className="rounded-2xl border border-gray-100 bg-[#fafafa] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                <ShieldCheck className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-[#111827] mb-1">
                  Corporate Identity
                </h3>
                <p className="text-[13px] text-[#5e6a78] leading-relaxed">
                  Access is strictly limited to authorized engineering personnel using company credentials.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
