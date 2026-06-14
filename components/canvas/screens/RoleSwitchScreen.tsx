import Link from "next/link";
import { ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
import { Avatar } from "@/components/canvas/primitives";
import type { Role, User } from "@/lib/canvas/types";
import { initials } from "@/lib/canvas/format";

export interface RoleSwitchScreenData {
  users: (User & { title?: string; hue?: number })[];
}

const roleHrefs: Record<Role, string> = {
  REP: "/rep",
  TAM: "/tam",
  SALES_MANAGER: "/manager",
  FINANCE: "/finance",
};

const roleColors: Record<Role, string> = {
  REP: "from-violet-500/20 to-fuchsia-500/10",
  TAM: "from-sky-500/20 to-cyan-500/10",
  SALES_MANAGER: "from-pink-500/20 to-rose-500/10",
  FINANCE: "from-emerald-500/20 to-teal-500/10",
};

export function RoleSwitchScreen({ data }: { data: RoleSwitchScreenData }) {
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
            HMD Secure CRM gives every team — Sales, TAM, Management, Finance — a workspace that thinks ahead.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.users.map((u) => (
            <Link
              key={u.id}
              href={roleHrefs[u.role]}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elegant"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${roleColors[u.role]} opacity-0 transition-opacity group-hover:opacity-100`} />
              <div className="relative">
                <Avatar initials={initials(u.name)} hue={u.hue ?? u.avatarHue ?? 280} size={48} />
                <div className="mt-4 font-display text-lg font-semibold">{u.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{u.title ?? u.email}</div>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{u.role.replace("_", " ")}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary-glow" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-auto pt-12 text-center text-xs text-muted-foreground">
          Built on EU sovereign infrastructure
        </div>
      </div>
    </div>
  );
}
