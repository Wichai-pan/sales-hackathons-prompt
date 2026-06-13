// Shared top nav (foundation, V-owned). Shows the active demo user, role,
// notification count, and links. Visual restyle (Lovable look); wiring unchanged.

import Link from "next/link";
import { Bell, Search, ShieldCheck } from "lucide-react";
import { currentUser } from "@/lib/session";
import { unreadCount } from "@/lib/notify";
import type { Role } from "@prisma/client";

const ROLE_LABEL: Record<Role, string> = {
  REP: "Sales Rep",
  TAM: "TAM",
  SALES_MANAGER: "Sales Manager",
  FINANCE: "Finance",
};

// Role-aware nav (WAVE 1 routes). Each link shows only for the listed roles.
const ROLE_LINKS: { label: string; href: string; roles: Role[] }[] = [
  { label: "My desk", href: "/rep", roles: ["REP"] },
  { label: "Manager", href: "/manager", roles: ["SALES_MANAGER"] },
  { label: "Finance", href: "/finance", roles: ["FINANCE"] },
  { label: "Approvals", href: "/approvals", roles: ["SALES_MANAGER", "FINANCE"] },
  { label: "Catalog", href: "/catalog", roles: ["FINANCE"] },
  { label: "My cases", href: "/tam", roles: ["TAM"] },
  { label: "Reports", href: "/reports", roles: ["SALES_MANAGER", "FINANCE"] },
  { label: "Smart views", href: "/views", roles: ["REP", "SALES_MANAGER", "FINANCE"] },
];

const linkCls =
  "rounded-md px-2.5 py-1.5 transition-colors hover:bg-secondary hover:text-foreground";

export async function Nav() {
  const user = await currentUser();
  const unread = user ? await unreadCount(user.id) : 0;
  const initials = user
    ? user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "";

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg ai-gradient shadow-elegant">
              <ShieldCheck className="h-4 w-4 text-white" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-sm font-semibold tracking-tight">HMD Secure</span>
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">CRM · EU Sovereign</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-0.5 text-sm text-muted-foreground md:flex">
            <Link href="/" className={linkCls}>Overview</Link>
            {user &&
              ROLE_LINKS.filter((l) => l.roles.includes(user.role)).map((l) => (
                <Link key={l.href} href={l.href} className={linkCls}>
                  {l.label}
                </Link>
              ))}
            <Link href="/role-switch" className={linkCls}>Switch role</Link>
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <form action="/search" className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="q"
              placeholder="Search…"
              aria-label="Search the CRM"
              className="h-9 w-44 rounded-lg border border-border bg-secondary/40 pl-8 pr-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none lg:w-56"
            />
          </form>
          <Link
            href="/notifications"
            className="relative grid h-9 w-9 place-items-center rounded-lg border border-border transition-colors hover:bg-secondary"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4 text-muted-foreground" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {unread}
              </span>
            )}
          </Link>
          {user ? (
            <Link
              href="/role-switch"
              className="flex items-center gap-2 rounded-lg border border-border px-1.5 py-1 transition-colors hover:bg-secondary"
            >
              <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-[11px] font-semibold text-primary-foreground">
                {initials}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-xs font-medium leading-tight">{user.name}</span>
                <span className="block text-[10px] text-muted-foreground">{ROLE_LABEL[user.role]}</span>
              </span>
            </Link>
          ) : (
            <Link href="/role-switch" className="text-sm font-medium text-primary">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
