import Link from "next/link";
import { Trophy, Sparkles, Check, X } from "lucide-react";
import { AIChip, Avatar, GlassCard, SectionHeader, SparkLine } from "@/components/canvas/primitives";
import { Badge } from "@/components/canvas/ui/badge";
import type { DealStage } from "@/lib/canvas/types";
import { fmt, initials } from "@/lib/canvas/format";

export interface ManagerScreenData {
  kpis: { committed: number; atRisk: number; gapToTarget: number; target: number };
  funnel: { stage: DealStage; label: string; count: number; value: number }[];
  byOwner: {
    ownerId: string;
    ownerName: string;
    avatarHue?: number;
    quota: number;       // currency
    attainment: number;  // %
    dealCount: number;
    trend?: number[];
  }[];
  stalled: { id: string; name: string; accountName: string; daysStalled: number; amount: number }[];
  pastClose: { id: string; name: string; accountName: string; daysOverdue: number; amount: number }[];
  pendingApprovals: { id: string; title: string; accountName: string; discountPercent: number; total: number; currency: string; aiRecommended: "APPROVE" | "REJECT" | "NEGOTIATE" }[];
  aiPipelineHealth: string;
}

export function ManagerScreen({ data }: { data: ManagerScreenData }) {
  const maxFunnel = Math.max(...data.funnel.map((f) => f.value), 1);
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <SectionHeader title="Sales Manager · EMEA" subtitle="Pipeline health, coverage, approvals" />

      {/* KPI strip */}
      <div className="grid gap-4 lg:grid-cols-4">
        <GlassCard>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Committed</div>
          <div className="mt-2 font-display text-3xl font-semibold tnum text-success">{fmt(data.kpis.committed)}</div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">At risk</div>
          <div className="mt-2 font-display text-3xl font-semibold tnum text-warning">{fmt(data.kpis.atRisk)}</div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Gap to target</div>
          <div className="mt-2 font-display text-3xl font-semibold tnum text-destructive">{fmt(data.kpis.gapToTarget)}</div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Target</div>
          <div className="mt-2 font-display text-3xl font-semibold tnum">{fmt(data.kpis.target)}</div>
        </GlassCard>
      </div>

      {/* AI pipeline health */}
      <GlassCard className="border-primary/30 bg-accent/20 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg ai-gradient"><Sparkles className="h-5 w-5 text-white" /></div>
          <div>
            <div className="text-sm font-medium ai-gradient-text">AI pipeline health</div>
            <p className="mt-1 text-sm">{data.aiPipelineHealth}</p>
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Funnel */}
        <GlassCard className="p-0">
          <div className="border-b border-border px-5 py-3 font-medium text-sm">7-stage funnel</div>
          <div className="p-5 space-y-2">
            {data.funnel.map((f) => (
              <div key={f.stage} className="flex items-center gap-3">
                <div className="w-32 text-xs text-muted-foreground truncate">{f.label}</div>
                <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-secondary">
                  <div className="absolute inset-y-0 left-0 ai-gradient" style={{ width: `${(f.value / maxFunnel) * 100}%` }} />
                  <div className="relative flex h-full items-center justify-between px-2 text-[11px]">
                    <span>{f.count}</span>
                    <span className="tnum font-medium">{fmt(f.value)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* By owner */}
        <GlassCard className="p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2 font-medium text-sm"><Trophy className="h-4 w-4 text-warning" /> By owner</div>
            <AIChip>Ranked</AIChip>
          </div>
          <div className="divide-y divide-border">
            {[...data.byOwner].sort((a, b) => b.attainment - a.attainment).map((m, i) => (
              <div key={m.ownerId} className="flex items-center gap-4 px-5 py-3">
                <div className="w-5 text-center font-display text-sm font-semibold text-muted-foreground tnum">{i + 1}</div>
                <Avatar initials={initials(m.ownerName)} hue={m.avatarHue ?? (i * 70) % 360} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium leading-tight">{m.ownerName}</div>
                  <div className="text-xs text-muted-foreground">{m.dealCount} active deals</div>
                </div>
                {m.trend && <SparkLine data={m.trend} />}
                <div className="w-40">
                  <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{m.attainment}%</span><span className="text-muted-foreground">of quota</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className={`h-full rounded-full ${m.attainment >= 100 ? "bg-success" : m.attainment >= 80 ? "ai-gradient" : "bg-warning"}`} style={{ width: `${Math.min(m.attainment, 130)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="font-medium text-sm">Stalled deals</div>
            <Badge variant="warning">{data.stalled.length}</Badge>
          </div>
          <div className="divide-y divide-border">
            {data.stalled.map((d) => (
              <Link key={d.id} href={`/deals/${d.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-secondary/30">
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{d.accountName} · stalled {d.daysStalled}d</div>
                </div>
                <div className="font-display tnum">{fmt(d.amount)}</div>
              </Link>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="font-medium text-sm">Past close date</div>
            <Badge variant="destructive">{data.pastClose.length}</Badge>
          </div>
          <div className="divide-y divide-border">
            {data.pastClose.map((d) => (
              <Link key={d.id} href={`/deals/${d.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-secondary/30">
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{d.accountName} · {d.daysOverdue}d overdue</div>
                </div>
                <div className="font-display tnum">{fmt(d.amount)}</div>
              </Link>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Approval queue */}
      <GlassCard className="p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="font-medium text-sm">Approval queue</div>
          <Badge variant="warning">{data.pendingApprovals.length} pending</Badge>
        </div>
        <div className="divide-y divide-border">
          {data.pendingApprovals.map((a) => (
            <div key={a.id} className="flex items-start gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{a.title}</div>
                <div className="text-xs text-muted-foreground">{a.accountName}</div>
                <div className="mt-2 rounded-lg border border-primary/30 bg-accent/20 p-2 text-xs">
                  <span className="ai-gradient-text font-medium"><Sparkles className="mr-1 inline h-3 w-3" />AI: </span>
                  {a.aiRecommended === "APPROVE" ? `Within policy. Recommend approve.` :
                   a.aiRecommended === "REJECT" ? `Outside policy. Recommend reject.` :
                   `Borderline. Recommend negotiate.`}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-lg font-semibold tnum">{fmt(a.total, a.currency)}</div>
                <div className="text-xs text-muted-foreground">−{a.discountPercent}%</div>
              </div>
              <Link href={`/approvals/${a.id}`} className="inline-flex items-center gap-1 rounded-lg ai-gradient px-3 py-2 text-xs font-medium text-white"><Check className="h-3 w-3" /> Review</Link>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
