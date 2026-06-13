// Reports (SLICE SA-V4). Dense tables + simple bars for Sales Manager / Finance.
// Cases by status, cases by service, deals by stage x owner, and close rate.

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted">
      <div
        className="h-1.5 rounded-full bg-primary"
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

  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cases, pipeline distribution, and win rate across the team.
        </p>
      </section>

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold">{ratePct}%</div>
            <div className="text-xs text-muted-foreground">
              Close rate (won / decided)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-green-600">
              {close.won}
            </div>
            <div className="text-xs text-muted-foreground">Won</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-red-600">
              {close.lost}
            </div>
            <div className="text-xs text-muted-foreground">Lost</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold">{close.open}</div>
            <div className="text-xs text-muted-foreground">Open</div>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cases by status */}
        <Card>
          <CardHeader>
            <CardTitle>Cases by status</CardTitle>
          </CardHeader>
          <CardContent>
            {byStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cases.</p>
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
                      <TD className="font-medium capitalize">
                        {r.label.toLowerCase()}
                      </TD>
                      <TD>
                        <Bar value={r.count} max={statusMax} />
                      </TD>
                      <TD className="text-right tabular-nums">{r.count}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Cases by service */}
        <Card>
          <CardHeader>
            <CardTitle>Cases by service</CardTitle>
          </CardHeader>
          <CardContent>
            {byService.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cases.</p>
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
                      <TD className="text-right tabular-nums">{r.count}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deals by stage x owner */}
      <Card>
        <CardHeader>
          <CardTitle>Open deals by stage and owner</CardTitle>
        </CardHeader>
        <CardContent>
          {stageOwner.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open deals.</p>
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
                      <TD key={s.stage} className="text-right tabular-nums">
                        {row.byStage[s.stage] || (
                          <span className="text-muted-foreground">·</span>
                        )}
                      </TD>
                    ))}
                    <TD className="text-right font-semibold tabular-nums">
                      {row.total}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pipeline value by stage */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Pipeline value by stage (weighted)</CardTitle>
          <Badge variant="secondary">
            {byStage.reduce((s, r) => s + r.count, 0)} open deals
          </Badge>
        </CardHeader>
        <CardContent>
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
                  <TD className="text-right tabular-nums">{s.count}</TD>
                  <TD className="text-right tabular-nums text-muted-foreground">
                    {formatEUR(s.totalRevenue)}
                  </TD>
                  <TD className="text-right font-semibold tabular-nums">
                    {formatEUR(s.weightedRevenue)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
