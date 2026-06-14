// Root landing — send people straight into the polished demo flow instead of the old
// WAVE-0 foundation overview. We read the session cookie directly (not currentUser(),
// which has a demo fallback to the first rep) so a fresh visitor lands on the branded
// role-switch sign-in; an active session goes to its role dashboard.
// (The original seed-overview lives in git history.)

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, dashboardPathForRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (id) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (user) redirect(dashboardPathForRole(user.role));
  }
  redirect("/role-switch");
}
