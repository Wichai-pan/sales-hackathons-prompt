import Link from "next/link";
import { Clock, AlertTriangle } from "lucide-react";
import { GlassCard, SectionHeader, KpiTile } from "@/components/canvas/primitives";
import { Badge } from "@/components/canvas/ui/badge";
import type { Case, CasePriority } from "@/lib/canvas/types";

export interface TamDashboardData {
  ownerName: string;
  kpis: { label: string; value: string; delta?: number; trend?: number[] }[];
  byPriority: { priority: CasePriority; cases: Case[] }[];
  /** Computed server-side: time-to-due bucketed. */
  byAge: { bucket: "0-4h" | "4-24h" | "1-3d" | "3d+"; count: number }[];
  slaOverdue: Case[];
  slaDueSoon: Case[];
}

const priorityTone: Record<CasePriority, "destructive" | "warning" | "info" | "default"> = {
  P1: "destructive", P2: "warning", P3: "info", P4: "default",
};

export function TamDashboardScreen({ data }: { data: TamDashboardData }) {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <SectionHeader title={`TAM workspace · ${data.ownerName}`} subtitle="Open cases, SLA, escalations" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.kpis.map((k) => <KpiTile key={k.label} {...k} />)}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-0">
          <div className="border-b border-border px-5 py-3 font-medium text-sm">By priority</div>
          <div className="divide-y divide-border">
            {data.byPriority.map((g) => (
              <div key={g.priority} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <Badge variant={priorityTone[g.priority]}>{g.priority}</Badge>
                  <span className="text-xs text-muted-foreground tnum">{g.cases.length} open</span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {g.cases.slice(0, 4).map((c) => (
                    <Link key={c.id} href={`/cases/${c.id}`} className="block rounded-md px-2 py-1 text-sm hover:bg-secondary/40">
                      <span className="font-medium">{c.title}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{c.accountName}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-0">
          <div className="border-b border-border px-5 py-3 font-medium text-sm">By age</div>
          <div className="p-5 space-y-3">
            {data.byAge.map((b) => {
              const max = Math.max(...data.byAge.map((x) => x.count), 1);
              return (
                <div key={b.bucket}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{b.bucket}</span>
                    <span className="tnum font-medium">{b.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full ai-gradient" style={{ width: `${(b.count / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="h-4 w-4 text-destructive" /> SLA overdue</div>
          <Badge variant="destructive">{data.slaOverdue.length}</Badge>
        </div>
        <div className="divide-y divide-border">
          {data.slaOverdue.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-secondary/30">
              <div>
                <div className="font-medium">{c.title}</div>
                <div className="text-xs text-muted-foreground">{c.accountName} · due {c.dueDate}</div>
              </div>
              <Badge variant={priorityTone[c.priority]}>{c.priority}</Badge>
            </Link>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-medium"><Clock className="h-4 w-4 text-warning" /> Due soon</div>
          <Badge variant="warning">{data.slaDueSoon.length}</Badge>
        </div>
        <div className="divide-y divide-border">
          {data.slaDueSoon.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-secondary/30">
              <div>
                <div className="font-medium">{c.title}</div>
                <div className="text-xs text-muted-foreground">{c.accountName} · due {c.dueDate}</div>
              </div>
              <Badge variant={priorityTone[c.priority]}>{c.priority}</Badge>
            </Link>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
