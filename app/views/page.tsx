// Smart views (BUILD-SPEC P1a) — 3 one-click preset query chips. Each applies a predefined
// filter and renders its results. No open-ended NLP; demo-visible "saved views".

import Link from "next/link";
import { Zap } from "lucide-react";
import {
  SMART_VIEWS,
  type SmartViewKey,
  atRiskDachEnterprise,
  offersPendingFinance,
  casesBlockingCustomerTests,
} from "@/lib/views";
import { STAGE_LABEL } from "@/lib/forecast";
import { formatEUR, daysSince } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

function isViewKey(v: string | undefined): v is SmartViewKey {
  return !!v && SMART_VIEWS.some((s) => s.key === v);
}

export default async function ViewsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const active: SmartViewKey | null = isViewKey(view) ? view : null;
  const meta = SMART_VIEWS.find((s) => s.key === active);

  return (
    <main className="space-y-6">
      <section>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Zap className="h-6 w-6 text-primary" /> Smart views
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One-click saved queries — the answers reps and managers ask for most.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {SMART_VIEWS.map((s) => (
            <Link
              key={s.key}
              href={`/views?view=${s.key}`}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                active === s.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
        {meta && <p className="mt-3 text-sm text-muted-foreground">{meta.hint}</p>}
      </section>

      {!active ? (
        <p className="text-sm text-muted-foreground">Pick a view above to run it.</p>
      ) : (
        <Card>
          <CardContent className="p-4">
            {active === "at-risk-dach" && <AtRiskDach />}
            {active === "offers-finance" && <OffersFinance />}
            {active === "cases-blocking" && <CasesBlocking />}
          </CardContent>
        </Card>
      )}
    </main>
  );
}

async function AtRiskDach() {
  const deals = await atRiskDachEnterprise();
  if (deals.length === 0) return <Empty />;
  return (
    <Table>
      <THead><TR><TH>Deal</TH><TH>Account</TH><TH>Stage</TH><TH>Owner</TH><TH>Last activity</TH></TR></THead>
      <TBody>
        {deals.map((d) => (
          <TR key={d.id}>
            <TD className="font-medium"><Link href={`/deals/${d.id}`} className="text-primary hover:underline">{d.name}</Link></TD>
            <TD className="text-muted-foreground">{d.account.name} · {d.account.region}</TD>
            <TD>{STAGE_LABEL[d.stage]}</TD>
            <TD className="text-muted-foreground">{d.ownerRep.name}</TD>
            <TD><Badge variant="warning">{daysSince(d.lastActivityAt)}d ago</Badge></TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

async function OffersFinance() {
  const offers = await offersPendingFinance();
  if (offers.length === 0) return <Empty />;
  return (
    <Table>
      <THead><TR><TH>Account</TH><TH>Discount</TH><TH>Total</TH><TH>Submitted</TH><TH></TH></TR></THead>
      <TBody>
        {offers.map((o) => (
          <TR key={o.id}>
            <TD className="font-medium">{o.account.name}</TD>
            <TD>{o.discountPercent}%</TD>
            <TD>{formatEUR(o.total)}</TD>
            <TD className="text-muted-foreground">{daysSince(o.updatedAt)}d ago</TD>
            <TD><Link href={`/approvals/${o.id}`} className="text-primary hover:underline">Review</Link></TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

async function CasesBlocking() {
  const cases = await casesBlockingCustomerTests();
  if (cases.length === 0) return <Empty />;
  return (
    <Table>
      <THead><TR><TH>Case</TH><TH>Account</TH><TH>Service</TH><TH>Status</TH><TH>Priority</TH></TR></THead>
      <TBody>
        {cases.map((c) => (
          <TR key={c.id}>
            <TD className="font-medium"><Link href={`/cases/${c.id}`} className="text-primary hover:underline">{c.title}</Link></TD>
            <TD className="text-muted-foreground">{c.account.name}</TD>
            <TD>{c.service?.name ?? "—"}</TD>
            <TD><Badge variant={c.status === "ESCALATED" ? "destructive" : "warning"}>{c.status.replaceAll("_", " ")}</Badge></TD>
            <TD>{c.priority}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground">No records match this view right now.</p>;
}
