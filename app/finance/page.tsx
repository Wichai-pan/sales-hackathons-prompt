// Finance dashboard (SLICE SA-V4).
// The 3-year QUARTERLY forecast as a table with DEVICE and SERVICE revenue in
// SEPARATE columns, a weighted total per quarter, and grand totals. Optional
// owner / channel filters via searchParams. Links to the finance approval queue
// and catalog management.

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser, dashboardPathForRole } from "@/lib/session";
import { formatEUR } from "@/lib/utils";
import { threeYearForecast } from "@/lib/reporting";
import { grossMargin, DEVICE_GM_PCT, SERVICE_GM_PCT } from "@/lib/forecast";
import { Suspense } from "react";
import { ForecastNarrativeCard, ForecastNarrativeSkeleton } from "@/components/forecast-narrative-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import type { Channel } from "@prisma/client";

export const dynamic = "force-dynamic";

const CHANNELS: Channel[] = ["DIRECT", "RESELLER"];

function parseChannel(v: string | undefined): Channel | undefined {
  return v === "DIRECT" || v === "RESELLER" ? v : undefined;
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; channel?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/role-switch");
  // Role guard: only leadership sees org-wide forecast (Rep/TAM bounce to their own view).
  if (user.role === "REP" || user.role === "TAM") redirect(dashboardPathForRole(user.role));

  const sp = await searchParams;
  const channel = parseChannel(sp.channel);
  const ownerRepId = sp.owner && sp.owner !== "all" ? sp.owner : undefined;

  const [forecast, reps] = await Promise.all([
    threeYearForecast({ ownerRepId, channel }),
    prisma.user.findMany({
      where: { role: "REP" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const { quarters, totals } = forecast;
  const gmPct = totals.totalRevenue > 0 ? (totals.grossMargin / totals.totalRevenue) * 100 : 0;

  // Build filter links that preserve the other dimension.
  const ownerHref = (id: string) => {
    const params = new URLSearchParams();
    if (id !== "all") params.set("owner", id);
    if (channel) params.set("channel", channel);
    const qs = params.toString();
    return qs ? `/finance?${qs}` : "/finance";
  };
  const channelHref = (c: string) => {
    const params = new URLSearchParams();
    if (ownerRepId) params.set("owner", ownerRepId);
    if (c !== "all") params.set("channel", c);
    const qs = params.toString();
    return qs ? `/finance?${qs}` : "/finance";
  };

  return (
    <main className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Finance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            3-year time-phased forecast — net sales split device vs service,
            gross margin (GM), and stage-weighted pipeline. Maps to HMD&apos;s funnel:
            Opportunity → Pipeline → Committed → Confirmed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/export/forecast">
            <Button variant="outline" size="sm">Export forecast CSV</Button>
          </a>
          <a href="/api/export/cases">
            <Button variant="outline" size="sm">Export cases CSV</Button>
          </a>
          <Link href="/approvals">
            <Button variant="outline" size="sm">
              Finance approvals
            </Button>
          </Link>
          <Link href="/catalog">
            <Button variant="outline" size="sm">
              Catalog
            </Button>
          </Link>
        </div>
      </section>

      {/* AI pipeline-health narrative (P2 #23) */}
      <Suspense fallback={<ForecastNarrativeSkeleton />}>
        <ForecastNarrativeCard />
      </Suspense>

      {/* Grand-total KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums">
              {formatEUR(totals.deviceRevenue)}
            </div>
            <div className="text-xs text-muted-foreground">Device revenue</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums">
              {formatEUR(totals.serviceRevenue)}
            </div>
            <div className="text-xs text-muted-foreground">Service revenue</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums">
              {formatEUR(totals.totalRevenue)}
            </div>
            <div className="text-xs text-muted-foreground">Net sales (total)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums">
              {formatEUR(totals.grossMargin)}
            </div>
            <div className="text-xs text-muted-foreground">Gross margin</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums">{gmPct.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">GM %</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums">
              {formatEUR(totals.weightedRevenue)}
            </div>
            <div className="text-xs text-muted-foreground">Weighted total</div>
          </CardContent>
        </Card>
      </section>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Channel:
            </span>
            <Link href={channelHref("all")} scroll={false}>
              <Badge variant={!channel ? "default" : "outline"}>All</Badge>
            </Link>
            {CHANNELS.map((c) => (
              <Link key={c} href={channelHref(c)} scroll={false}>
                <Badge variant={channel === c ? "default" : "outline"}>
                  {c === "DIRECT" ? "Direct" : "Reseller"}
                </Badge>
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Owner:
            </span>
            <Link href={ownerHref("all")} scroll={false}>
              <Badge variant={!ownerRepId ? "default" : "outline"}>All reps</Badge>
            </Link>
            {reps.map((r) => (
              <Link key={r.id} href={ownerHref(r.id)} scroll={false}>
                <Badge variant={ownerRepId === r.id ? "default" : "outline"}>
                  {r.name}
                </Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 3-year quarterly forecast */}
      <Card>
        <CardHeader>
          <CardTitle>3-year quarterly forecast</CardTitle>
        </CardHeader>
        <CardContent>
          {quarters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No forecast periods match the current filters.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Quarter</TH>
                  <TH className="text-right">Device units</TH>
                  <TH className="text-right">Device €</TH>
                  <TH className="text-right">Service €</TH>
                  <TH className="text-right">Net sales €</TH>
                  <TH className="text-right">GM €</TH>
                  <TH className="text-right">Weighted €</TH>
                </TR>
              </THead>
              <TBody>
                {quarters.map((q) => (
                  <TR key={q.label}>
                    <TD className="font-medium">{q.label}</TD>
                    <TD className="text-right tabular-nums">{q.deviceUnits}</TD>
                    <TD className="text-right tabular-nums">
                      {formatEUR(q.deviceRevenue)}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatEUR(q.serviceRevenue)}
                    </TD>
                    <TD className="text-right tabular-nums text-muted-foreground">
                      {formatEUR(q.totalRevenue)}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatEUR(grossMargin(q.deviceRevenue, q.serviceRevenue))}
                    </TD>
                    <TD className="text-right font-semibold tabular-nums">
                      {formatEUR(q.weightedRevenue)}
                    </TD>
                  </TR>
                ))}
                <TR className="border-t-2 font-semibold">
                  <TD>Grand total</TD>
                  <TD className="text-right tabular-nums">{totals.deviceUnits}</TD>
                  <TD className="text-right tabular-nums">
                    {formatEUR(totals.deviceRevenue)}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {formatEUR(totals.serviceRevenue)}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {formatEUR(totals.totalRevenue)}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {formatEUR(totals.grossMargin)}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {formatEUR(totals.weightedRevenue)}
                  </TD>
                </TR>
              </TBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Showing {quarters.length} quarter(s). Forecast is time-phased — never a
            single deal amount. GM uses blended device {Math.round(DEVICE_GM_PCT * 100)}% /
            service {Math.round(SERVICE_GM_PCT * 100)}% margins (configurable assumption).
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
