import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { GlassCard, SectionHeader, AIChip } from "@/components/canvas/primitives";
import { Badge } from "@/components/canvas/ui/badge";
import { Button } from "@/components/canvas/ui/button";
import { Select, Textarea } from "@/components/canvas/ui/input";
import type { Deal, DealForecastPeriod, DealStage, ServerAction } from "@/lib/canvas/types";
import { fmt, fmtDate } from "@/lib/canvas/format";
import { noopAction } from "@/lib/canvas/types";

export interface DealDetailScreenData {
  deal: Deal;
  /** 3-year quarterly forecast (12 periods). */
  forecast: DealForecastPeriod[];
  notes: { id: string; body: string; authorName: string; createdAt: string }[];
  /** Action receives `stage` field. */
  changeStageAction?: ServerAction;
  /** Action receives `body` field. */
  addNoteAction?: ServerAction;
}

const stages: DealStage[] = ["LEAD", "DISCOVERY", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"];

export function DealDetailScreen({ data }: { data: DealDetailScreenData }) {
  const d = data.deal;
  const max = Math.max(...data.forecast.map((p) => p.totalRevenue)) || 1;
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Link href="/deals" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All deals
      </Link>

      <SectionHeader
        title={d.name}
        subtitle={`${d.accountName ?? ""} · ${d.channel} · ${d.serviceModel.replace(/_/g, " ")} · close ${d.expectedCloseDate ? fmtDate(d.expectedCloseDate) : "—"}`}
        action={
          <form action={data.changeStageAction ?? noopAction} className="flex items-center gap-2">
            <Select name="stage" defaultValue={d.stage}>
              {stages.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Button type="submit" size="sm">Update stage</Button>
          </form>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Forecast chart */}
        <GlassCard className="p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="font-medium text-sm">3-year quarterly forecast</div>
            <AIChip>Auto-projected · {d.probability}% probability</AIChip>
          </div>
          <div className="p-6">
            <div className="flex items-end gap-1 h-64">
              {data.forecast.map((p) => {
                const dev = (p.deviceRevenue / max) * 100;
                const svc = (p.serviceRevenue / max) * 100;
                const weighted = (p.weightedRevenue / max) * 100;
                return (
                  <div key={p.periodLabel} className="group relative flex flex-1 flex-col items-center gap-1">
                    <div className="relative flex w-full flex-col-reverse" style={{ height: "200px" }}>
                      <div className="w-full bg-gradient-to-t from-primary to-primary-glow rounded-t-sm" style={{ height: `${dev}%` }} />
                      <div className="w-full bg-gradient-to-t from-chart-3 to-chart-2 opacity-80" style={{ height: `${svc}%` }} />
                      {/* weighted line marker */}
                      <div className="absolute left-0 right-0 border-t-2 border-dashed border-warning" style={{ bottom: `${weighted}%` }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground -rotate-45 origin-top-left whitespace-nowrap mt-2">{p.periodLabel}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-12 flex gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-gradient-to-t from-primary to-primary-glow" /> Device revenue</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-gradient-to-t from-chart-3 to-chart-2" /> Service revenue</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 border-t-2 border-dashed border-warning" /> Weighted</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-0">
          <div className="border-b border-border px-5 py-3 font-medium text-sm">Deal facts</div>
          <dl className="divide-y divide-border text-sm">
            {[
              ["Stage", d.stage],
              ["Probability", `${d.probability}%`],
              ["Status", d.status],
              ["Channel", d.channel],
              ["Service model", d.serviceModel.replace(/_/g, " ")],
              ["Owner", d.ownerName ?? "—"],
              ["Last activity", d.lastActivityAt ? new Date(d.lastActivityAt).toLocaleString() : "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-5 py-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </GlassCard>
      </div>

      {/* Forecast table */}
      <GlassCard className="p-0">
        <div className="border-b border-border px-5 py-3 font-medium text-sm">Quarterly forecast detail</div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              {["Period", "Device units", "Device rev", "Service rev", "Total", "Weighted"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-medium first:pl-5 last:pr-5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.forecast.map((p) => (
              <tr key={p.periodLabel} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-2.5 font-medium">{p.periodLabel}</td>
                <td className="px-4 py-2.5 tnum">{p.deviceUnits.toLocaleString()}</td>
                <td className="px-4 py-2.5 tnum">{fmt(p.deviceRevenue)}</td>
                <td className="px-4 py-2.5 tnum">{fmt(p.serviceRevenue)}</td>
                <td className="px-4 py-2.5 tnum font-medium">{fmt(p.totalRevenue)}</td>
                <td className="px-4 py-2.5 tnum text-warning">{fmt(p.weightedRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      {/* Notes */}
      <GlassCard className="p-0">
        <div className="border-b border-border px-5 py-3 font-medium text-sm">Notes</div>
        <div className="divide-y divide-border">
          {data.notes.map((n) => (
            <div key={n.id} className="px-5 py-3">
              <div className="text-sm">{n.body}</div>
              <div className="mt-1 text-xs text-muted-foreground">{n.authorName} · {new Date(n.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
        <form action={data.addNoteAction ?? noopAction} className="border-t border-border p-4">
          <Textarea name="body" rows={2} placeholder="Add a note…" />
          <div className="mt-2 flex justify-end">
            <Button type="submit" size="sm"><Sparkles className="h-3 w-3" /> Post note</Button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
