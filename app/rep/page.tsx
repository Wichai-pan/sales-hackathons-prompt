// Rep dashboard (Owner / SA-O1). The Sales Rep's home: my accounts, open deals by stage,
// offers awaiting approval, at-risk deals, recent activity. Lands here from the role switch.

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { STAGE_LABEL, DIRECT_STAGES } from "@/lib/forecast";
import { formatEUR, daysSince } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { IntakePanel } from "@/components/intake-panel";

export default async function RepDashboard() {
  const user = await currentUser();
  if (!user) redirect("/role-switch");

  const [accounts, deals, pendingOffers, activity] = await Promise.all([
    prisma.account.findMany({
      where: { ownerRepId: user.id },
      include: { _count: { select: { deals: true, cases: true, offers: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.deal.findMany({
      where: { ownerRepId: user.id, status: "OPEN" },
      include: { account: true },
      orderBy: { lastActivityAt: "desc" },
    }),
    prisma.offer.findMany({
      where: { createdById: user.id, status: { in: ["PENDING_SM", "PENDING_FINANCE", "SM_APPROVED"] } },
      include: { account: true, deal: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.activityEvent.findMany({
      where: { account: { ownerRepId: user.id } },
      include: { account: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const atRisk = deals.filter(
    (d) => daysSince(d.lastActivityAt) >= 14 || (d.expectedCloseDate && d.expectedCloseDate.getTime() < Date.now()),
  );

  // deals grouped by stage for a quick pipeline glance
  const byStage = DIRECT_STAGES.filter((s) => s !== "WON" && s !== "LOST").map((stage) => ({
    stage,
    deals: deals.filter((d) => d.stage === stage),
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hi {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {accounts.length} accounts · {deals.length} open deals · {pendingOffers.length} offers in approval
          </p>
        </div>
      </div>

      {/* AI-assisted intake — demo opener */}
      <div className="mt-6">
        <IntakePanel />
      </div>

      {/* At-risk callout */}
      {atRisk.length > 0 && (
        <Card className="mt-6 border-destructive/40">
          <CardHeader><CardTitle className="text-base">⚠ At-risk deals ({atRisk.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Deal</TH><TH>Account</TH><TH>Stage</TH><TH className="text-right">Reason</TH></TR></THead>
              <TBody>
                {atRisk.map((d) => (
                  <TR key={d.id}>
                    <TD><Link href={`/deals/${d.id}`} className="font-medium hover:underline">{d.name}</Link></TD>
                    <TD><Link href={`/accounts/${d.accountId}`} className="hover:underline">{d.account.name}</Link></TD>
                    <TD>{STAGE_LABEL[d.stage]}</TD>
                    <TD className="text-right">
                      {d.expectedCloseDate && d.expectedCloseDate.getTime() < Date.now()
                        ? <Badge variant="destructive">past close</Badge>
                        : <Badge variant="destructive">{daysSince(d.lastActivityAt)}d stale</Badge>}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* My accounts */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>My accounts</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Account</TH><TH>Region</TH><TH className="text-right">Deals</TH><TH className="text-right">Cases</TH><TH className="text-right">Offers</TH></TR></THead>
              <TBody>
                {accounts.map((a) => (
                  <TR key={a.id}>
                    <TD><Link href={`/accounts/${a.id}`} className="font-medium hover:underline">{a.name}</Link></TD>
                    <TD className="text-muted-foreground">{a.region}</TD>
                    <TD className="text-right">{a._count.deals}</TD>
                    <TD className="text-right">{a._count.cases}</TD>
                    <TD className="text-right">{a._count.offers}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        {/* Offers in approval */}
        <Card>
          <CardHeader><CardTitle>Offers in approval</CardTitle></CardHeader>
          <CardContent>
            {pendingOffers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing awaiting approval.</p>
            ) : (
              <ul className="space-y-3">
                {pendingOffers.map((o) => (
                  <li key={o.id} className="text-sm">
                    <Link href={`/offers/${o.id}`} className="font-medium hover:underline">
                      {o.deal?.name ?? o.account.name} v{o.version}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {o.account.name} · {formatEUR(o.total)} · <Badge variant="secondary">{o.status.replace("_", " ")}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline by stage */}
      <Card className="mt-6">
        <CardHeader><CardTitle>Open pipeline by stage</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {byStage.map(({ stage, deals: ds }) => (
              <div key={stage} className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">{STAGE_LABEL[stage]}</div>
                <div className="mt-1 text-2xl font-semibold">{ds.length}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card className="mt-6">
        <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <ul className="space-y-2">
              {activity.map((e) => (
                <li key={e.id} className="flex justify-between text-sm">
                  <span>{e.summary}{e.account ? <> · <Link href={`/accounts/${e.accountId}`} className="text-muted-foreground hover:underline">{e.account.name}</Link></> : null}</span>
                  <span className="text-xs text-muted-foreground">{e.createdAt.toISOString().slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
