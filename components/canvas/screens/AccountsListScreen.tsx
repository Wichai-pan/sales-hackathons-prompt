import Link from "next/link";
import { Filter, Plus, Search, Sparkles, Download } from "lucide-react";
import { AIChip, Avatar, HealthRing, SectionHeader } from "@/components/canvas/primitives";
import { Badge } from "@/components/canvas/ui/badge";
import type { Account } from "@/lib/canvas/types";
import { fmt, initials } from "@/lib/canvas/format";

export interface AccountsListScreenData {
  total: number;
  totalDevices: number;
  facets: {
    industries: string[];
    regions: string[];
    owners: string[];
  };
  accounts: (Account & {
    devices?: number;
    arr?: number;
    health?: number;
    aiSignal?: { tone: "primary" | "success" | "default"; label: string };
  })[];
}

export function AccountsListScreen({ data }: { data: AccountsListScreenData }) {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <SectionHeader
        title="Accounts"
        subtitle={`${data.accounts.length} of ${data.total} enterprise accounts · ${data.totalDevices.toLocaleString()} devices under management`}
        action={
          <div className="flex items-center gap-2">
            <a href="/api/accounts/export" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs"><Download className="h-3.5 w-3.5" /> Export</a>
            <Link href="/accounts/new" className="inline-flex items-center gap-1.5 rounded-lg ai-gradient px-3 py-1.5 text-xs font-medium text-white"><Plus className="h-3.5 w-3.5" /> Add account</Link>
          </div>
        }
      />

      <div className="flex gap-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <form action="/accounts" method="get" className="sticky top-20 space-y-5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input name="q" placeholder="Filter…" className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-2 text-xs focus:border-primary focus:outline-none" />
            </div>
            {[
              { title: "Industry", name: "industry", items: data.facets.industries },
              { title: "Region", name: "region", items: data.facets.regions },
              { title: "Owner", name: "owner", items: data.facets.owners },
              { title: "Health", name: "health", items: ["Healthy (80+)", "At risk (60-79)", "Critical (<60)"] },
            ].map((g) => (
              <div key={g.title}>
                <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span>{g.title}</span><Filter className="h-3 w-3" />
                </div>
                <div className="space-y-1">
                  {g.items.map((it) => (
                    <label key={it} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-secondary">
                      <input type="checkbox" name={g.name} value={it} className="h-3 w-3 accent-[oklch(var(--primary))]" />
                      <span className="truncate">{it}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button type="submit" className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-accent/40 py-2 text-xs ai-gradient-text">
              <Sparkles className="h-3 w-3" /> Apply filters
            </button>
          </form>
        </aside>

        <div className="flex-1 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  {["Account", "Industry", "Region", "Owner", "Devices", "ARR", "Health", "AI signal"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left font-medium first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.accounts.map((a) => (
                  <tr key={a.id} className="border-t border-border/60 hover:bg-secondary/30">
                    <td className="px-4 py-3 pl-5">
                      <Link href={`/accounts/${a.id}`} className="flex items-center gap-3">
                        <Avatar initials={initials(a.name)} hue={(a.id.length * 37) % 360} size={30} />
                        <div>
                          <div className="font-medium">{a.name}</div>
                          <div className="text-[11px] text-muted-foreground">{a.domain ?? a.id}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.industry ?? "—"}</td>
                    <td className="px-4 py-3"><Badge>{a.region ?? "—"}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{a.ownerName ?? "—"}</td>
                    <td className="px-4 py-3 tnum">{(a.devices ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium tnum">{a.arr != null ? fmt(a.arr) : "—"}</td>
                    <td className="px-4 py-3">{a.health != null ? <HealthRing value={a.health} size={36} /> : "—"}</td>
                    <td className="px-4 py-3 pr-5">
                      {a.aiSignal ? (
                        a.aiSignal.tone === "primary" ? <AIChip>{a.aiSignal.label}</AIChip> :
                        <Badge variant={a.aiSignal.tone === "success" ? "success" : "default"}>{a.aiSignal.label}</Badge>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
