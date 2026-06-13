// Shared top nav (foundation, V-owned). Shows the active demo user, role,
// notification count, and links. Role dashboards are added by WAVE 1 owners.

import Link from "next/link";
import { Bell, ShieldCheck, UserCircle2 } from "lucide-react";
import { currentUser } from "@/lib/session";
import { unreadCount } from "@/lib/notify";
import { Badge } from "@/components/ui/badge";
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
];

export async function Nav() {
  const user = await currentUser();
  const unread = user ? await unreadCount(user.id) : 0;

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            HMD Secure CRM
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-muted-foreground sm:flex">
            <Link href="/" className="hover:text-foreground">Overview</Link>
            {user &&
              ROLE_LINKS.filter((l) => l.roles.includes(user.role)).map((l) => (
                <Link key={l.href} href={l.href} className="hover:text-foreground">
                  {l.label}
                </Link>
              ))}
            <Link href="/role-switch" className="hover:text-foreground">Switch role</Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/notifications" className="relative" aria-label="Notifications">
            <Bell className="h-5 w-5 text-muted-foreground" />
            {unread > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {unread}
              </span>
            )}
          </Link>
          {user ? (
            <Link href="/role-switch" className="flex items-center gap-2 text-sm">
              <UserCircle2 className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">{user.name}</span>
              <Badge variant="secondary">{ROLE_LABEL[user.role]}</Badge>
            </Link>
          ) : (
            <Link href="/role-switch" className="text-sm font-medium text-primary">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
