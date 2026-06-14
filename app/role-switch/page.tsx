// Demo role-switch — pick a seeded user; sets a server-side session cookie.
// Real Entra ID SSO is deferred (BUILD-SPEC). This is the demo auth path.
//
// Ported onto the canvas RoleSwitchScreen aesthetic (aurora hero + glass cards).
// The screen renders each user as a plain navigation <Link>, which would BYPASS the
// cookie-setting server action. We must keep our wired per-user <form action={switchTo}>
// so the demo session cookie is actually set — functionality > pixel-match. We therefore
// reuse the screen's presentational chrome (aurora hero header) inline and keep our wired
// cards, restyled with canvas classes + the canvas Avatar primitive.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { setDemoUser, dashboardPathForRole } from "@/lib/session";
import { Avatar } from "@/components/canvas/primitives";
import { initials } from "@/lib/canvas/format";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

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

// Visual-only: deterministic Avatar hue per role (we don't store avatarHue).
const ROLE_HUE: Record<Role, number> = {
  REP: 280,
  TAM: 220,
  SALES_MANAGER: 340,
  FINANCE: 160,
};

const ROLE_GRADIENT: Record<Role, string> = {
  REP: "from-violet-500/20 to-fuchsia-500/10",
  TAM: "from-sky-500/20 to-cyan-500/10",
  SALES_MANAGER: "from-pink-500/20 to-rose-500/10",
  FINANCE: "from-emerald-500/20 to-teal-500/10",
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
    <div className="aurora relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="aurora-bg absolute inset-0 opacity-60" />
      <div className="grid-bg absolute inset-0 opacity-40" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg ai-gradient shadow-elegant">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-display text-base font-semibold">HMD Secure</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">CRM · EU Sovereign</div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            All systems operational
          </div>
        </header>

        <div className="my-16 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-accent/40 px-3 py-1 text-xs">
            <Sparkles className="h-3 w-3 text-primary-glow" />
            <span className="ai-gradient-text font-medium">AI-native CRM for secure enterprise</span>
          </div>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Sign in as your role.
            <br />
            <span className="ai-gradient-text">Your dashboard is waiting.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            HMD Secure CRM — demo role switch. Production auth is Microsoft Entra ID SSO.
          </p>
        </div>

        {/* Wired per-user cards: each submits switchTo (sets the demo cookie) — NOT a plain link. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {users.map((u) => (
            <form
              key={u.id}
              action={switchTo}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elegant"
            >
              <input type="hidden" name="userId" value={u.id} />
              <input type="hidden" name="role" value={u.role} />
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${ROLE_GRADIENT[u.role]} opacity-0 transition-opacity group-hover:opacity-100`} />
              <button type="submit" className="relative block w-full text-left">
                <Avatar initials={initials(u.name)} hue={ROLE_HUE[u.role]} size={48} />
                <div className="mt-4 font-display text-lg font-semibold">{u.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{ROLE_LABEL[u.role]}</div>
                <p className="mt-2 text-xs text-muted-foreground">{ROLE_BLURB[u.role]}</p>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{u.role.replace("_", " ")}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition group-hover:text-primary-glow">
                    Continue as {u.name.split(" ")[0]}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                </div>
              </button>
            </form>
          ))}
        </div>

        <div className="mt-auto pt-12 text-center text-xs text-muted-foreground">
          Built on EU sovereign infrastructure
        </div>
      </div>
    </div>
  );
}
