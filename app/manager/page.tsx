// Sales Manager dashboard (SLICE SA-V4).
// Shows immediately: stalled deals (>14d, flagged), deals past expected close,
// pipeline by stage, pipeline by owner, and the 3-year WEIGHTED pipeline with a
// quarter / half / year granularity toggle (?granularity=). Links to the
// approval queue. Optional inline deal reassignment.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { rollUp, type Granularity } from "@/lib/forecast";
import { formatEUR } from "@/lib/utils";
import {
  threeYearForecast,
  pipelineByStage,
  pipelineByOwner,
  stalledDeals,
  pastCloseDeals,
  listReps,
} from "@/lib/reporting";
import { reassignDeal } from "./actions";
import { Suspense } from "react";
import { ForecastNarrativeCard, ForecastNarrativeSkeleton } from "@/components/forecast-narrative-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const GRANULARITIES: Granularity[] = ["quarter", "half", "year"];

function parseGranularity(v: string | undefined): Granularity {
  return v === "half" || v === "year" ? v : "quarter";
}

export default async function ManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ granularity?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/role-switch");

  const sp = await searchParams;
  const granularity = parseGranularity(sp.granularity);

  const [forecast, byStage, byOwner, stalled, pastClose, reps] =
    await Promise.all([
      threeYearForecast(),
      pipelineByStage(),
      pipelineByOwner(),
      stalledDeals(),
      pastCloseDeals(),
      listReps(),
    ]);

  const buckets = rollUp(forecast.quarters, granularity);
  const stageMax = Math.max(1, ...byStage.map((s) => s.weightedRevenue));
  const ownerMax = Math.max(1, ...byOwner.map((o) => o.weightedRevenue));

  return (
    <main className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sales Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Team pipeline, stalled deals, and weighted 3-year forecast.
          </p>
        </div>
        <Link href="/approvals">
          <Button variant="outline" size="sm">
            Approval queue
          </Button>
        </Link>
      </section>

      {/* AI pipeline-health narrative (P2 #23) */}
      <Suspense fallback={<ForecastNarrativeSkeleton />}>
        <ForecastNarrativeCard />
      </Suspense>

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold">
              {formatEUR(forecast.totals.weightedRevenue)}
            </div>
            <div className="text-xs text-muted-foreground">
              Weighted pipeline (3yr)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold">
              {byStage.reduce((s, r) => s + r.count, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Open deals</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-amber-600">
              {stalled.length}
            </div>
            <div className="text-xs text-muted-foreground">
              Stalled (14+ days)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-red-600">
              {pastClose.length}
            </div>
            <div className="text-xs text-muted-foreground">Past close date</div>
          </CardContent>
        </Card>
      </section>

      {/* Stalled deals */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Stalled deals — no activity in 14+ days</CardTitle>
          <Badge variant="warning">{stalled.length} flagged</Badge>
        </CardHeader>
        <CardContent>
          {stalled.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No stalled deals. Every open deal has recent activity.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Deal</TH>
                  <TH>Account</TH>
                  <TH>Owner</TH>
                  <TH>Stage</TH>
                  <TH className="text-right">Stalled</TH>
                  <TH className="text-right">Weighted</TH>
                  <TH>Reassign</TH>
                </TR>
              </THead>
              <TBody>
                {stalled.map((d) => (
                  <TR key={d.id}>
                    <TD className="font-medium">{d.name}</TD>
                    <TD className="text-muted-foreground">{d.accountName}</TD>
                    <TD className="text-muted-foreground">{d.ownerName}</TD>
                    <TD>{d.stageLabel}</TD>
                    <TD className="text-right">
                      <Badge variant="destructive">{d.daysStalled}d</Badge>
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatEUR(d.weightedRevenue)}
                    </TD>
                    <TD>
                      <form action={reassignDeal} className="flex items-center gap-1">
                        <input type="hidden" name="dealId" value={d.id} />
                        <select
                          name="newRepId"
                          defaultValue=""
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="" disabled>
                            Choose rep…
                          </option>
                          {reps.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" size="sm" variant="outline">
                          Go
                        </Button>
                      </form>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Past expected close date */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Deals past expected close date</CardTitle>
          <Badge variant="destructive">{pastClose.length}</Badge>
        </CardHeader>
        <CardContent>
          {pastClose.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No open deals are past their expected close date.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Deal</TH>
                  <TH>Account</TH>
                  <TH>Owner</TH>
                  <TH>Stage</TH>
                  <TH>Expected close</TH>
                  <TH className="text-right">Weighted</TH>
                </TR>
              </THead>
              <TBody>
                {pastClose.map((d) => (
                  <TR key={d.id}>
                    <TD className="font-medium">{d.name}</TD>
                    <TD className="text-muted-foreground">{d.accountName}</TD>
                    <TD className="text-muted-foreground">{d.ownerName}</TD>
                    <TD>{d.stageLabel}</TD>
                    <TD className="text-red-600">
                      {d.expectedCloseDate
                        ? d.expectedCloseDate.toISOString().slice(0, 10)
                        : "—"}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatEUR(d.weightedRevenue)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline by stage */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline by stage (weighted)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Stage</TH>
                  <TH className="text-right">Prob</TH>
                  <TH className="text-right">Deals</TH>
                  <TH className="text-right">Weighted</TH>
                </TR>
              </THead>
              <TBody>
                {byStage.map((s) => (
                  <TR key={s.stage}>
                    <TD>
                      <div className="font-medium">{s.label}</div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{
                            width: `${(s.weightedRevenue / stageMax) * 100}%`,
                          }}
                        />
                      </div>
                    </TD>
                    <TD className="text-right text-muted-foreground">
                      {s.probability}%
                    </TD>
                    <TD className="text-right">{s.count}</TD>
                    <TD className="text-right tabular-nums">
                      {formatEUR(s.weightedRevenue)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pipeline by owner */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline by owner (weighted)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Rep</TH>
                  <TH className="text-right">Deals</TH>
                  <TH className="text-right">Weighted</TH>
                </TR>
              </THead>
              <TBody>
                {byOwner.map((o) => (
                  <TR key={o.ownerRepId}>
                    <TD>
                      <div className="font-medium">{o.ownerName}</div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{
                            width: `${(o.weightedRevenue / ownerMax) * 100}%`,
                          }}
                        />
                      </div>
                    </TD>
                    <TD className="text-right">{o.count}</TD>
                    <TD className="text-right tabular-nums">
                      {formatEUR(o.weightedRevenue)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* 3-year weighted forecast with granularity toggle */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>3-year weighted pipeline</CardTitle>
          <div className="flex items-center gap-1">
            {GRANULARITIES.map((g) => (
              <Link key={g} href={`/manager?granularity=${g}`} scroll={false}>
                <Badge variant={g === granularity ? "default" : "outline"}>
                  {g === "quarter" ? "Quarter" : g === "half" ? "Half-year" : "Year"}
                </Badge>
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {buckets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No forecast periods yet.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Period</TH>
                  <TH className="text-right">Device €</TH>
                  <TH className="text-right">Service €</TH>
                  <TH className="text-right">Total €</TH>
                  <TH className="text-right">Weighted €</TH>
                </TR>
              </THead>
              <TBody>
                {buckets.map((b) => (
                  <TR key={b.label}>
                    <TD className="font-medium">{b.label}</TD>
                    <TD className="text-right tabular-nums">
                      {formatEUR(b.deviceRevenue)}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatEUR(b.serviceRevenue)}
                    </TD>
                    <TD className="text-right tabular-nums text-muted-foreground">
                      {formatEUR(b.totalRevenue)}
                    </TD>
                    <TD className="text-right font-semibold tabular-nums">
                      {formatEUR(b.weightedRevenue)}
                    </TD>
                  </TR>
                ))}
                <TR className="border-t-2 font-semibold">
                  <TD>Total</TD>
                  <TD className="text-right tabular-nums">
                    {formatEUR(forecast.totals.deviceRevenue)}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {formatEUR(forecast.totals.serviceRevenue)}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {formatEUR(forecast.totals.totalRevenue)}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {formatEUR(forecast.totals.weightedRevenue)}
                  </TD>
                </TR>
              </TBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Time-phased rows, weighted by stage probability. Device and service
            revenue kept separate.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
