import "server-only";

import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getMerchants } from "@/lib/merchants";
import { canUserAccessMerchant, getRoleForEmail, normalizeUserEmail } from "@/lib/auth/rbac";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email ? normalizeUserEmail(user.email) : "";
      if (!email) return false;

      if (getRoleForEmail(email) === "admin") {
        return true;
      }

      const merchants = await getMerchants();
      return merchants.some((merchant) => canUserAccessMerchant(email, merchant));
    },
    async jwt({ token, user }) {
      const email = normalizeUserEmail(String(user?.email || token.email || ""));

      if (email) {
        token.email = email;
        token.role = getRoleForEmail(email);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const email = normalizeUserEmail(String(token.email || session.user.email || ""));
        session.user.email = email;
        session.user.role = token.role || getRoleForEmail(email);
      }

      return session;
    },
  },
};
