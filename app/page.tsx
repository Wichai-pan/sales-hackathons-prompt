// Foundation overview/home (V-owned). Role-aware header + a live listing of every
// core entity so WAVE 0 verifies the seed end-to-end. WAVE 1 owners add the rich
// role dashboards (/rep by Owner, /tam by SA-V3, /manager + /finance by SA-V4).

import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { STAGE_LABEL } from "@/lib/forecast";
import { formatEUR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import type { Role } from "@prisma/client";

const ROLE_BLURB: Record<Role, string> = {
  REP: "Your accounts, open deals, and offers awaiting approval.",
  TAM: "Your assigned cases and the service history behind them.",
  SALES_MANAGER: "Team pipeline, stalled deals, and the approval queue.",
  FINANCE: "The 3-year weighted forecast, catalog, and finance approvals.",
};

export default async function HomePage() {
  const user = await currentUser();

  const [
    accounts,
    deals,
    cases,
    products,
    services,
    offers,
    counts,
  ] = await Promise.all([
    prisma.account.findMany({ include: { ownerRep: true }, orderBy: { name: "asc" } }),
    prisma.deal.findMany({ include: { account: true }, orderBy: { lastActivityAt: "desc" }, take: 12 }),
    prisma.case.findMany({ include: { account: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.service.findMany({ orderBy: { name: "asc" } }),
    prisma.offer.findMany({ include: { account: true }, orderBy: { updatedAt: "desc" } }),
    Promise.all([
      prisma.account.count(),
      prisma.deal.count(),
      prisma.case.count(),
      prisma.offer.count(),
      prisma.dealForecastPeriod.count(),
    ]),
  ]);

  const [aCount, dCount, cCount, oCount, fCount] = counts;

  const stats = [
    { label: "Accounts", value: aCount },
    { label: "Deals", value: dCount },
    { label: "Cases", value: cCount },
    { label: "Offers", value: oCount },
    { label: "Forecast rows", value: fCount },
  ];

  const channelBadge = (c: string) =>
    c === "RESELLER" ? <Badge variant="outline">Reseller</Badge> : <Badge variant="secondary">Direct</Badge>;

  const offerStatusBadge = (s: string) => {
    const variant =
      s === "APPROVED" ? "success" : s === "REJECTED" ? "destructive" : s.startsWith("PENDING") ? "warning" : "secondary";
    return <Badge variant={variant as never}>{s.replaceAll("_", " ")}</Badge>;
  };

  const caseBadge = (s: string) => {
    const variant = s === "CLOSED" ? "secondary" : s === "ESCALATED" ? "destructive" : "warning";
    return <Badge variant={variant as never}>{s.replaceAll("_", " ")}</Badge>;
  };

  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">
          {user ? `Welcome, ${user.name.split(" ")[0]}` : "HMD Secure CRM"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user ? ROLE_BLURB[user.role] : "Sign in to continue."}{" "}
          <Link href="/role-switch" className="text-primary hover:underline">Switch role</Link>.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Foundation overview — WAVE 1 adds the role dashboards, account 360, offer builder, and AI.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="text-2xl font-semibold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Accounts ({accounts.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Name</TH><TH>Region</TH><TH>Segment</TH><TH>Owner</TH></TR></THead>
              <TBody>
                {accounts.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-medium">{a.name}</TD>
                    <TD>{a.region}</TD>
                    <TD>{a.segment}</TD>
                    <TD className="text-muted-foreground">{a.ownerRep.name}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent deals</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Deal</TH><TH>Account</TH><TH>Channel</TH><TH>Stage</TH><TH>Prob</TH></TR></THead>
              <TBody>
                {deals.map((d) => (
                  <TR key={d.id}>
                    <TD className="font-medium">{d.name}</TD>
                    <TD className="text-muted-foreground">{d.account.name}</TD>
                    <TD>{channelBadge(d.channel)}</TD>
                    <TD>{STAGE_LABEL[d.stage]}</TD>
                    <TD>{d.probability}%</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cases</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Title</TH><TH>Account</TH><TH>Status</TH><TH>Priority</TH></TR></THead>
              <TBody>
                {cases.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">{c.title}</TD>
                    <TD className="text-muted-foreground">{c.account.name}</TD>
                    <TD>{caseBadge(c.status)}</TD>
                    <TD>{c.priority}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Offers</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Account</TH><TH>Status</TH><TH>Disc.</TH><TH>Total</TH><TH>Lock</TH></TR></THead>
              <TBody>
                {offers.map((o) => (
                  <TR key={o.id}>
                    <TD className="font-medium">{o.account.name}</TD>
                    <TD>{offerStatusBadge(o.status)}</TD>
                    <TD>{o.discountPercent}%</TD>
                    <TD>{formatEUR(o.total)}</TD>
                    <TD>{o.locked ? "🔒" : "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Product catalog</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>SKU</TH><TH>Name</TH><TH>Price</TH><TH>Status</TH></TR></THead>
              <TBody>
                {products.map((p) => (
                  <TR key={p.id}>
                    <TD className="text-muted-foreground">{p.sku}</TD>
                    <TD className="font-medium">{p.name}</TD>
                    <TD>{formatEUR(p.unitPrice)}</TD>
                    <TD>{p.status === "RETIRED" ? <Badge variant="outline">Retired</Badge> : <Badge variant="success">Active</Badge>}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Service catalog</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Name</TH><TH>Provider</TH><TH>Invoicing</TH><TH>Base</TH></TR></THead>
              <TBody>
                {services.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-medium">{s.name}</TD>
                    <TD>{s.providerType === "INTERNAL" ? "Internal" : "3rd-party"}</TD>
                    <TD className="text-muted-foreground">{s.invoicingModel.replaceAll("_", " ").toLowerCase()}</TD>
                    <TD>{formatEUR(s.basePrice)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
