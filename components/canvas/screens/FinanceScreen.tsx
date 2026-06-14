import { Download } from "lucide-react";
import { GlassCard, KpiTile, SectionHeader, SparkLine } from "@/components/canvas/primitives";
import { Badge } from "@/components/canvas/ui/badge";
import { Select } from "@/components/canvas/ui/input";
import type { DealForecastPeriod } from "@/lib/canvas/types";
import { fmt } from "@/lib/canvas/format";

export interface FinanceScreenData {
  filters: {
    channels: string[];
    selectedChannel?: string;
    owners: { id: string; name: string }[];
    selectedOwner?: string;
  };
  kpis: {
    deviceRevenue: number;
    serviceRevenue: number;
    netSales: number;
    grossMargin: number;
    grossMarginPercent: number;
    weighted: number;
    trends?: Record<string, number[]>;
  };
  /** 12 quarters (3 years). */
  forecast: DealForecastPeriod[];
  contractsExpiring: { id: string; accountName: string; expiresOn: string; arr: number; risk: "low" | "medium" | "high" }[];
  arAging: { bucket: string; amount: number }[];
}

export function FinanceScreen({ data }: { data: FinanceScreenData }) {
  const max = Math.max(...data.forecast.map((p) => p.totalRevenue), 1);
  const t = data.kpis.trends ?? {};
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <SectionHeader
        title="Finance"
        subtitle="Revenue, margin & forecast"
        action={
          <div className="flex items-center gap-2">
            <form action="/finance" method="get" className="flex items-center gap-2">
              <Select name="channel" defaultValue={data.filters.selectedChannel} aria-label="Channel">
                <option value="">All channels</option>
                {data.filters.channels.map((c) => <option key={c} value={c}>{c === "DIRECT" ? "Direct" : c === "RESELLER" ? "Reseller" : c}</option>)}
              </Select>
              <Select name="owner" defaultValue={data.filters.selectedOwner} aria-label="Owner">
                <option value="">All owners</option>
                {data.filters.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
              <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent">Apply</button>
            </form>
            <a href="/api/export/forecast" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs"><Download className="h-3.5 w-3.5" /> Export forecast CSV</a>
            <a href="/api/export/cases" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs"><Download className="h-3.5 w-3.5" /> Export cases CSV</a>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Device revenue" value={fmt(data.kpis.deviceRevenue)} trend={t.deviceRevenue} />
        <KpiTile label="Service revenue" value={fmt(data.kpis.serviceRevenue)} trend={t.serviceRevenue} />
        <KpiTile label="Net sales" value={fmt(data.kpis.netSales)} trend={t.netSales} />
        <KpiTile label="Gross margin" value={fmt(data.kpis.grossMargin)} trend={t.grossMargin} />
        <KpiTile label="GM %" value={`${data.kpis.grossMarginPercent.toFixed(1)}%`} trend={t.grossMarginPercent} />
        <KpiTile label="Weighted pipe" value={fmt(data.kpis.weighted)} trend={t.weighted} />
      </div>

      <GlassCard className="p-0">
        <div className="border-b border-border px-5 py-3 font-medium text-sm">3-year quarterly forecast</div>
        <div className="p-6">
          <div className="flex items-end gap-1 h-64">
            {data.forecast.map((p) => {
              const dev = (p.deviceRevenue / max) * 100;
              const svc = (p.serviceRevenue / max) * 100;
              const weighted = (p.weightedRevenue / max) * 100;
              return (
                <div key={p.periodLabel} className="group flex flex-1 flex-col items-center gap-1">
                  <div className="relative flex w-full flex-col-reverse" style={{ height: "200px" }}>
                    <div className="w-full bg-gradient-to-t from-primary to-primary-glow rounded-t-sm" style={{ height: `${dev}%` }} />
                    <div className="w-full bg-gradient-to-t from-chart-3 to-chart-2 opacity-80" style={{ height: `${svc}%` }} />
                    <div className="absolute left-0 right-0 border-t-2 border-dashed border-warning" style={{ bottom: `${weighted}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground -rotate-45 origin-top-left whitespace-nowrap mt-2">{p.periodLabel}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-12 flex gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-gradient-to-t from-primary to-primary-glow" /> Device</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-gradient-to-t from-chart-3 to-chart-2" /> Service</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 border-t-2 border-dashed border-warning" /> Weighted</span>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-0">
        <div className="border-b border-border px-5 py-3 font-medium text-sm">Forecast table</div>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-0">
          <div className="border-b border-border px-5 py-3 font-medium text-sm">AR aging</div>
          <div className="p-5 space-y-3">
            {data.arAging.map((r) => {
              const max = Math.max(...data.arAging.map((x) => x.amount), 1);
              return (
                <div key={r.bucket} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{r.bucket}</span>
                    <span className="tnum font-medium">{fmt(r.amount)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full ai-gradient" style={{ width: `${(r.amount / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard className="p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="font-medium text-sm">Contracts expiring</div>
            <Badge variant="warning">{data.contractsExpiring.length}</Badge>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-5 py-2 text-left font-medium">Account</th>
                <th className="px-3 py-2 text-left font-medium">Expires</th>
                <th className="px-3 py-2 text-right font-medium">ARR</th>
                <th className="px-5 py-2 text-left font-medium">Risk</th>
              </tr>
            </thead>
            <tbody>
              {data.contractsExpiring.map((c) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-2.5 font-medium">{c.accountName}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.expiresOn}</td>
                  <td className="px-3 py-2.5 text-right tnum">{fmt(c.arr)}</td>
                  <td className="px-5 py-2.5"><Badge variant={c.risk === "high" ? "destructive" : c.risk === "medium" ? "warning" : "success"}>{c.risk}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      </div>
    </div>
  );
}
