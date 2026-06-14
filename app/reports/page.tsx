// Reports (SLICE SA-V4) — now rendered through the canvas ReportsScreen.
// The canvas ReportsScreen only models a "report catalog" (title/desc/sparkline/
// export link). It has NO slots for our real aggregate tables, so we render the
// screen for the catalog/header AND keep ALL of our existing data tables below it
// (restyled with canvas classes) — functionality is never dropped.
//
// Server-side data + role guard stay here; reuse lib/reporting.ts helpers as-is.

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { formatEUR } from "@/lib/utils";
import {
  casesByStatus,
  casesByService,
  dealsByStageOwner,
  closeRate,
  pipelineByStage,
} from "@/lib/reporting";
import { ReportsScreen, type ReportsScreenData } from "@/components/canvas/screens/ReportsScreen";
import { GlassCard, SectionHeader } from "@/components/canvas/primitives";
import { Badge } from "@/components/canvas/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/canvas/ui/table";

export const dynamic = "force-dynamic";

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-secondary">
      <div
        className="h-1.5 rounded-full ai-gradient"
        style={{ width: `${(value / Math.max(1, max)) * 100}%` }}
      />
    </div>
  );
}

export default async function ReportsPage() {
  const user = await currentUser();
  if (!user) redirect("/role-switch");

  const [byStatus, byService, stageOwner, close, byStage] = await Promise.all([
    casesByStatus(),
    casesByService(),
    dealsByStageOwner(),
    closeRate(),
    pipelineByStage(),
  ]);

  const statusMax = Math.max(1, ...byStatus.map((r) => r.count));
  const serviceMax = Math.max(1, ...byService.map((r) => r.count));
  const ratePct = Math.round(close.rate * 100);

  // Canvas ReportsScreen catalog: each card maps to a real CSV export endpoint.
  // Trends are derived from our real aggregates (visual-only sparkline shapes).
  const data: ReportsScreenData = {
    reports: [
      {
        id: "forecast",
        title: "3-year weighted forecast",
        description: "Time-phased pipeline by quarter, device/service split, weighted by stage.",
        trend: byStage.map((s) => Math.round(s.weightedRevenue)),
        exportHref: "/api/export/forecast",
      },
      {
        id: "cases",
        title: "Support cases",
        description: "All cases with status, priority, owner and linked service.",
        trend: byStatus.map((r) => r.count),
        exportHref: "/api/export/cases",
      },
      {
        id: "pipeline-by-stage",
        title: "Pipeline by stage",
        description: "Open deal counts and weighted value per pipeline stage.",
        trend: byStage.map((s) => s.count),
      },
    ],
  };

  return (
    <div>
      <ReportsScreen data={data} />

      {/* Full reporting detail — preserved from the original page, restyled with
          canvas classes. The ReportsScreen catalog has no slots for these. */}
      <div className="p-6 lg:p-8 pt-0 space-y-6">
        <SectionHeader
          title="Live report data"
          subtitle="Cases, pipeline distribution, and win rate across the team."
        />

        {/* KPI strip */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <GlassCard>
            <div className="font-display text-2xl font-semibold tnum">{ratePct}%</div>
            <div className="text-xs text-muted-foreground">Close rate (won / decided)</div>
          </GlassCard>
          <GlassCard>
            <div className="font-display text-2xl font-semibold tnum text-success">{close.won}</div>
            <div className="text-xs text-muted-foreground">Won</div>
          </GlassCard>
          <GlassCard>
            <div className="font-display text-2xl font-semibold tnum text-destructive">{close.lost}</div>
            <div className="text-xs text-muted-foreground">Lost</div>
          </GlassCard>
          <GlassCard>
            <div className="font-display text-2xl font-semibold tnum">{close.open}</div>
            <div className="text-xs text-muted-foreground">Open</div>
          </GlassCard>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Cases by status */}
          <GlassCard className="p-0">
            <div className="border-b border-border px-5 py-3 font-medium text-sm">Cases by status</div>
            <div className="p-2">
              {byStatus.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">No cases.</p>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Status</TH>
                      <TH className="w-1/2">Share</TH>
                      <TH className="text-right">Count</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {byStatus.map((r) => (
                      <TR key={r.key}>
                        <TD className="font-medium capitalize">{r.label.toLowerCase()}</TD>
                        <TD>
                          <Bar value={r.count} max={statusMax} />
                        </TD>
                        <TD className="text-right tnum">{r.count}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>
          </GlassCard>

          {/* Cases by service */}
          <GlassCard className="p-0">
            <div className="border-b border-border px-5 py-3 font-medium text-sm">Cases by service</div>
            <div className="p-2">
              {byService.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">No cases.</p>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Service</TH>
                      <TH className="w-1/2">Share</TH>
                      <TH className="text-right">Count</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {byService.map((r) => (
                      <TR key={r.key}>
                        <TD className="font-medium">{r.label}</TD>
                        <TD>
                          <Bar value={r.count} max={serviceMax} />
                        </TD>
                        <TD className="text-right tnum">{r.count}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Deals by stage x owner */}
        <GlassCard className="p-0">
          <div className="border-b border-border px-5 py-3 font-medium text-sm">Open deals by stage and owner</div>
          <div className="p-2">
            {stageOwner.rows.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No open deals.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Rep</TH>
                    {stageOwner.stages.map((s) => (
                      <TH key={s.stage} className="text-right">
                        {s.label}
                      </TH>
                    ))}
                    <TH className="text-right">Total</TH>
                  </TR>
                </THead>
                <TBody>
                  {stageOwner.rows.map((row) => (
                    <TR key={row.ownerRepId}>
                      <TD className="font-medium">{row.ownerName}</TD>
                      {stageOwner.stages.map((s) => (
                        <TD key={s.stage} className="text-right tnum">
                          {row.byStage[s.stage] || <span className="text-muted-foreground">·</span>}
                        </TD>
                      ))}
                      <TD className="text-right font-semibold tnum">{row.total}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </div>
        </GlassCard>

        {/* Pipeline value by stage */}
        <GlassCard className="p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="font-medium text-sm">Pipeline value by stage (weighted)</div>
            <Badge variant="secondary">{byStage.reduce((s, r) => s + r.count, 0)} open deals</Badge>
          </div>
          <div className="p-2">
            <Table>
              <THead>
                <TR>
                  <TH>Stage</TH>
                  <TH className="text-right">Deals</TH>
                  <TH className="text-right">Total €</TH>
                  <TH className="text-right">Weighted €</TH>
                </TR>
              </THead>
              <TBody>
                {byStage.map((s) => (
                  <TR key={s.stage}>
                    <TD className="font-medium">{s.label}</TD>
                    <TD className="text-right tnum">{s.count}</TD>
                    <TD className="text-right tnum text-muted-foreground">{formatEUR(s.totalRevenue)}</TD>
                    <TD className="text-right font-semibold tnum">{formatEUR(s.weightedRevenue)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
