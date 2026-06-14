import Link from "next/link";
import { Plus, Filter, LayoutGrid, Table2, Sparkles } from "lucide-react";
import { Avatar, SectionHeader } from "@/components/canvas/primitives";
import { Badge } from "@/components/canvas/ui/badge";
import type { Deal, DealStage } from "@/lib/canvas/types";
import { fmt, fmtDate, initials } from "@/lib/canvas/format";

export interface PipelineColumn {
  stage: DealStage;
  label: string;
  deals: (Deal & { risk?: "high" | "medium" | "low"; aiSummary?: string })[];
}

export interface PipelineScreenData {
  columns: PipelineColumn[];
  totals: { active: number; openValue: number; atRisk: number; weighted: number };
  savedViews?: string[];
}

const stageDots: Record<DealStage, string> = {
  LEAD: "bg-slate-500",
  DISCOVERY: "bg-sky-500",
  QUALIFIED: "bg-violet-500",
  PROPOSAL: "bg-fuchsia-500",
  NEGOTIATION: "bg-amber-500",
  CLOSED_WON: "bg-emerald-500",
  CLOSED_LOST: "bg-rose-500",
};

export function PipelineScreen({ data }: { data: PipelineScreenData }) {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <SectionHeader
        title="Pipeline"
        subtitle={`${data.totals.active} active deals · ${fmt(data.totals.openValue)} open · ${fmt(data.totals.weighted)} weighted`}
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border bg-card p-0.5">
              <button type="button" className="flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-xs"><LayoutGrid className="h-3.5 w-3.5" /> Board</button>
              <button type="button" className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground"><Table2 className="h-3.5 w-3.5" /> Table</button>
            </div>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs"><Filter className="h-3.5 w-3.5" /> Filters</button>
            <Link href="/deals/new" className="inline-flex items-center gap-1.5 rounded-lg ai-gradient px-3 py-1.5 text-xs font-medium text-white"><Plus className="h-3.5 w-3.5" /> New deal</Link>
          </div>
        }
      />

      {data.savedViews && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {data.savedViews.map((v, i) => (
            <button key={v} type="button" className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${i === 0 ? "border-primary/40 bg-accent text-foreground" : "border-border text-muted-foreground hover:bg-secondary"}`}>
              {v}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 overflow-x-auto md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
        {data.columns.map((col) => {
          const sum = col.deals.reduce((s, d) => s + (d.amount ?? 0), 0);
          return (
            <div key={col.stage} className="flex min-w-[260px] flex-col rounded-2xl border border-border bg-sidebar/60 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${stageDots[col.stage]}`} />
                  <div className="text-sm font-medium">{col.label}</div>
                </div>
                <div className="text-xs text-muted-foreground tnum">{col.deals.length} · {fmt(sum)}</div>
              </div>
              <div className="flex flex-col gap-2">
                {col.deals.map((d) => (
                  <Link key={d.id} href={`/deals/${d.id}`} className="group cursor-pointer rounded-xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elegant">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium leading-tight">{d.name}</div>
                      {d.risk === "high" && <Badge variant="destructive">High risk</Badge>}
                      {d.risk === "medium" && <Badge variant="warning">Watch</Badge>}
                    </div>
                    {d.accountName && (
                      <div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <Avatar initials={initials(d.accountName)} hue={(d.id.length * 37) % 360} size={20} />
                        <span className="truncate">{d.accountName}</span>
                      </div>
                    )}
                    {d.aiSummary && (
                      <div className="mt-3 rounded-lg border border-primary/20 bg-accent/30 px-2.5 py-1.5">
                        <div className="flex items-center gap-1 text-[10px] ai-gradient-text"><Sparkles className="h-2.5 w-2.5" /> AI</div>
                        <div className="mt-0.5 text-xs leading-snug text-foreground/85">{d.aiSummary}</div>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-display text-base font-semibold tnum">{d.amount != null ? fmt(d.amount) : "—"}</span>
                      <span className="text-[11px] text-muted-foreground">{d.expectedCloseDate ? fmtDate(d.expectedCloseDate) : "—"}</span>
                    </div>
                  </Link>
                ))}
                <Link href={`/deals/new?stage=${col.stage}`} className="mt-1 flex items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground">
                  <Plus className="h-3 w-3" /> Add deal
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
