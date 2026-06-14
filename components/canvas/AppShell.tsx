"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, KanbanSquare, Building2, MessageSquare,
  TrendingUp, FileText, Zap, Sparkles, Bell, Search, ChevronsLeft,
  Settings, Wallet, ShieldCheck, Package, CheckSquare,
} from "lucide-react";
import { useState, type ReactNode } from "react";
// Mock AiBubble intentionally unused — the wired "Aino" assistant is mounted in app/layout.tsx.
import type { Role, User } from "@/lib/canvas/types";
import { cn } from "@/lib/canvas/utils";
import { initials as initialsOf } from "@/lib/canvas/format";

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof iconMap;
}

const iconMap = {
  LayoutDashboard, Users, KanbanSquare, Building2, MessageSquare,
  TrendingUp, FileText, Zap, ShieldCheck, Wallet, Package, CheckSquare,
};

// Pointed at routes that actually exist in our app.
const defaultNavByRole: Record<Role, NavItem[]> = {
  REP: [
    { href: "/rep", label: "My desk", icon: "LayoutDashboard" },
    { href: "/views", label: "Smart views", icon: "Zap" },
  ],
  TAM: [{ href: "/tam", label: "My cases", icon: "MessageSquare" }],
  SALES_MANAGER: [
    { href: "/manager", label: "Pipeline", icon: "KanbanSquare" },
    { href: "/approvals", label: "Approvals", icon: "CheckSquare" },
    { href: "/reports", label: "Reports", icon: "TrendingUp" },
    { href: "/views", label: "Smart views", icon: "Zap" },
  ],
  FINANCE: [
    { href: "/finance", label: "Finance", icon: "Wallet" },
    { href: "/approvals", label: "Approvals", icon: "CheckSquare" },
    { href: "/catalog", label: "Catalog", icon: "Package" },
    { href: "/reports", label: "Reports", icon: "TrendingUp" },
    { href: "/views", label: "Smart views", icon: "Zap" },
  ],
};

export interface AppShellProps {
  role: Role;
  user: User;
  /** Override the auto nav for this role. */
  nav?: NavItem[];
  /** Number of unread notifications. */
  unreadCount?: number;
  children: ReactNode;
}

export function AppShell({ role, user, nav, unreadCount = 0, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname() ?? "/";
  const items = nav ?? defaultNavByRole[role];

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside
        className={cn(
          "sticky top-0 h-screen shrink-0 border-r border-sidebar-border bg-sidebar transition-all duration-200",
          collapsed ? "w-[68px]" : "w-[232px]"
        )}
      >
        <Link
          href={items[0]?.href ?? "/"}
          className="flex h-14 items-center gap-2 px-4 transition-opacity hover:opacity-80"
          aria-label="回到主页"
          title="回到主页"
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg ai-gradient shadow-elegant">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold leading-tight">HMD Secure</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">CRM · EU Sovereign</div>
            </div>
          )}
        </Link>
        <nav className="flex flex-col gap-0.5 px-2 py-2">
          {items.map((it) => {
            const Icon = iconMap[it.icon];
            const active = pathname === it.href || pathname.startsWith(it.href + "/");
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary-glow")} />
                {!collapsed && <span className="truncate">{it.label}</span>}
                {!collapsed && active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-glow ai-pulse" />}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-3 left-0 right-0 px-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary"
          >
            <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-20 items-center gap-3 border-b border-border bg-background/80 px-6 backdrop-blur-xl">
          {/* Left spacer — equal-weight to the right cluster so the search sits dead-centre. */}
          <div className="flex-1" />

          {/* Centered search */}
          <form action="/search" className="relative flex w-full max-w-md items-center">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <input
              name="q"
              placeholder="Search accounts, deals, cases, contacts…  ⌘K"
              className="h-10 w-full rounded-lg border border-border bg-secondary/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </form>

          {/* Right cluster — pinned to the far right */}
          <div className="flex flex-1 items-center justify-end gap-2">
            <Link
              href="/notifications"
              className="relative grid h-10 w-10 place-items-center rounded-lg border border-border hover:bg-secondary"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-destructive" />}
            </Link>
            <Link
              href="/role-switch"
              className="grid h-10 w-10 place-items-center rounded-lg border border-border hover:bg-secondary"
              aria-label="Switch role"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <Link href="/role-switch" className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 hover:bg-secondary">
              <div
                className="grid h-7 w-7 place-items-center rounded-md text-[11px] font-semibold text-white"
                style={{
                  background: `linear-gradient(135deg, oklch(0.65 0.18 ${user.avatarHue ?? 280}), oklch(0.55 0.22 ${((user.avatarHue ?? 280) + 40) % 360}))`,
                }}
              >
                {initialsOf(user.name)}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-medium leading-tight">{user.name}</div>
                <div className="text-[10px] text-muted-foreground">{role.replace("_", " ")}</div>
              </div>
            </Link>
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
