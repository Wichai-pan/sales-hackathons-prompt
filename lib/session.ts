// Demo session — server-side cookie holding the active seeded user.
// Real Entra ID SSO is deferred (BUILD-SPEC); this is the demo role-switch path.
// Owner depends on: currentUser(), currentRole().

import { cookies } from "next/headers";
import type { Role, User } from "@prisma/client";
import { prisma } from "./db";

export const SESSION_COOKIE = "hmd_demo_user";

/**
 * The active user for this request, from the demo session cookie.
 * Falls back to the seeded Sales Rep (Sofia) so the app never dead-ends in demo mode.
 */
export async function currentUser(): Promise<User | null> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;

  if (id) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (user) return user;
  }

  // Demo fallback: first Sales Rep, deterministic by email.
  return prisma.user.findFirst({
    where: { role: "REP" },
    orderBy: { email: "asc" },
  });
}

export async function currentRole(): Promise<Role | null> {
  const user = await currentUser();
  return user?.role ?? null;
}

/** Set the active demo user. Call only from a server action / route handler. */
export async function setDemoUser(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

/** Clear the active demo user. Call only from a server action / route handler. */
export async function clearDemoUser(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Default landing route per role. */
export function dashboardPathForRole(role: Role): string {
  switch (role) {
    case "REP":
      return "/rep";
    case "TAM":
      return "/tam";
    case "SALES_MANAGER":
      return "/manager";
    case "FINANCE":
      return "/finance";
    default:
      return "/";
  }
}
