// Demo role-switch — pick a seeded user; sets a server-side session cookie.
// Real Entra ID SSO is deferred (BUILD-SPEC). This is the demo auth path.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { setDemoUser, dashboardPathForRole } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Role } from "@prisma/client";

const ROLE_LABEL: Record<Role, string> = {
  REP: "Sales Rep",
  TAM: "Technical Account Manager",
  SALES_MANAGER: "Sales Manager",
  FINANCE: "Finance",
};

const ROLE_BLURB: Record<Role, string> = {
  REP: "Accounts, deals, offers, next best action.",
  TAM: "Assigned cases and service history.",
  SALES_MANAGER: "Team pipeline, stalled deals, approvals.",
  FINANCE: "3-year forecast, catalog, finance approvals.",
};

async function switchTo(formData: FormData) {
  "use server";
  const userId = String(formData.get("userId"));
  await setDemoUser(userId);
  // The active user just changed — bust the cache for every route under the root layout so the
  // new role sees fresh per-user data everywhere (approval queues, notifications, dashboards),
  // never a client-router-cached view from the previous role. Critical for the role-switch-heavy demo.
  revalidatePath("/", "layout");
  // Land each role on their own dashboard (the Rep dashboard hosts the AI intake HERO).
  const user = await prisma.user.findUnique({ where: { id: userId } });
  redirect(user ? dashboardPathForRole(user.role) : "/");
}

export default async function RoleSwitchPage() {
  const users = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { email: "asc" }] });

  return (
    <main className="mx-auto max-w-3xl py-10">
      <h1 className="text-2xl font-semibold">Choose a demo user</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        HMD Secure CRM — demo role switch. Production auth is Microsoft Entra ID SSO.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {users.map((u) => (
          <Card key={u.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>{u.name}</CardTitle>
              <Badge variant="secondary">{ROLE_LABEL[u.role]}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{ROLE_BLURB[u.role]}</p>
              <form action={switchTo}>
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="role" value={u.role} />
                <Button type="submit" size="sm" className="w-full">
                  Continue as {u.name.split(" ")[0]}
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
