import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { AuthenticatedUser } from "@/lib/types";
import { getRoleForEmail, normalizeUserEmail } from "@/lib/auth/rbac";

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ? normalizeUserEmail(session.user.email) : "";

  if (!email) {
    return null;
  }

  return {
    email,
    name: session?.user?.name || null,
    image: session?.user?.image || null,
    role: session?.user?.role || getRoleForEmail(email),
  };
}
