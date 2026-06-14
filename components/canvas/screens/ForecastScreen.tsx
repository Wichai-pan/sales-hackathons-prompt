import { ChevronDown, Sparkles, AlertTriangle, TrendingUp } from "lucide-react";
import { AIChip, GlassCard, SectionHeader } from "@/components/canvas/primitives";
import { Badge } from "@/components/canvas/ui/badge";
import { Select } from "@/components/canvas/ui/input";
import type { Deal } from "@/lib/canvas/types";
import { fmt } from "@/lib/canvas/format";

export interface ForecastScreenData {
  periodLabel: string;
  availablePeriods: string[];
  totals: { closed: number; commit: number; bestCase: number; pipeline: number; target: number };
  waterfall: { name: string; value: number; type: "won" | "commit" | "best" | "pipe" }[];
  deals: (Deal & { category: "Commit" | "Best case" | "Pipeline" | "Omitted"; aiCategory: "Commit" | "Best case" | "Pipeline"; risk: "high" | "medium" | "low" })[];
  aiCommentary: { headline: string; risks: { title: string; body: string }[]; upsides: { title: string; body: string }[] };
}

export function ForecastScreen({ data }: { data: ForecastScreenData }) {
  const max = Math.max(...data.waterfall.map((w) => w.value), 1) * 1.1;
  const colors: Record<string, string> = {
    won: "from-emerald-500 to-emerald-400",
    commit: "from-primary to-primary-glow",
    best: "from-fuchsia-500 to-pink-400",
    pipe: "from-sky-500 to-cyan-400",
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <SectionHeader
        title="Forecast"
        subtitle={`${data.periodLabel} · target ${fmt(data.totals.target)}`}
        action={
          <form action="/forecast" method="get" className="flex items-center gap-2">
            <Select name="period" defaultValue={data.periodLabel}>
              {data.availablePeriods.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </form>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        {[
          { label: "Closed", value: data.totals.closed },
          { label: "Commit", value: data.totals.commit },
          { label: "Best case", value: data.totals.bestCase },
          { label: "Pipeline", value: data.totals.pipeline },
        ].map((k) => (
          <GlassCard key={k.label}>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</div>
            <div className="mt-2 font-display text-3xl font-semibold tnum">{fmt(k.value)}</div>
          </GlassCard>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <GlassCard className="p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="font-medium text-sm">Coverage waterfall</div>
            <div className="text-xs text-muted-foreground">Target {fmt(data.totals.target)}</div>
          </div>
          <div className="p-6">
            <div className="flex items-end justify-around gap-4 h-72">
              {data.waterfall.map((w) => (
                <div key={w.name} className="flex flex-1 flex-col items-center gap-2">
                  <div className="font-display text-sm font-semibold tnum">{fmt(w.value)}</div>
                  <div
                    className={`w-full rounded-t-xl bg-gradient-to-b ${colors[w.type]} shadow-elegant relative overflow-hidden`}
                    style={{ height: `${(w.value / max) * 100}%`, minHeight: 20 }}
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-white/30" />
                  </div>
                  <div className="text-xs text-muted-foreground">{w.name}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary max-w-xl">
                <div className="h-full rounded-full ai-gradient" style={{ width: `${(data.totals.commit / data.totals.target) * 100}%` }} />
              </div>
              <span className="text-xs text-muted-foreground tnum">{Math.round((data.totals.commit / data.totals.target) * 100)}% to target</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-0">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <div className="grid h-7 w-7 place-items-center rounded-lg ai-gradient"><Sparkles className="h-3.5 w-3.5 text-white" /></div>
            <div className="font-display text-sm font-semibold ai-gradient-text">AI Commentary</div>
          </div>
          <div className="space-y-3 p-5 text-sm">
            <p>{data.aiCommentary.headline}</p>
            {data.aiCommentary.risks.map((r) => (
              <div key={r.title} className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-warning">
                <div className="flex items-center gap-1.5 text-xs font-medium"><AlertTriangle className="h-3 w-3" /> {r.title}</div>
                <div className="mt-1 text-foreground text-sm">{r.body}</div>
              </div>
            ))}
            {data.aiCommentary.upsides.map((u) => (
              <div key={u.title} className="rounded-xl border border-info/40 bg-info/10 p-3 text-info">
                <div className="flex items-center gap-1.5 text-xs font-medium"><TrendingUp className="h-3 w-3" /> {u.title}</div>
                <div className="mt-1 text-foreground text-sm">{u.body}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="font-medium text-sm">Forecast deals</div>
          <AIChip>AI categorized {data.deals.length} of {data.deals.length}</AIChip>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              {["Deal", "Account", "Amount", "Close", "Rep judgment", "AI judgment", "Risk"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-medium first:pl-5 last:pr-5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.deals.map((d) => (
              <tr key={d.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/30">
                <td className="px-5 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.accountName}</td>
                <td className="px-4 py-3 font-medium tnum">{d.amount != null ? fmt(d.amount) : "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.expectedCloseDate ?? "—"}</td>
                <td className="px-4 py-3">
                  <form action={`/api/forecast/${d.id}/category`} method="post">
                    <Select name="category" defaultValue={d.category} className="h-8 text-xs">
                      <option>Commit</option><option>Best case</option><option>Pipeline</option><option>Omitted</option>
                    </Select>
                  </form>
                </td>
                <td className="px-4 py-3"><AIChip>{d.aiCategory}</AIChip></td>
                <td className="px-4 py-3 pr-5">
                  <Badge variant={d.risk === "high" ? "destructive" : d.risk === "medium" ? "warning" : "success"}>{d.risk}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
