// Smart views (BUILD-SPEC P1a) — 3 one-click preset query chips, now rendered through the
// canvas ViewsScreen for the saved-view cards. The ?view= behavior + live inline result
// tables (the working feature) are preserved below, since the screen has no slot for them.

import Link from "next/link";
import {
  SMART_VIEWS,
  type SmartViewKey,
  atRiskDachEnterprise,
  offersPendingFinance,
  casesBlockingCustomerTests,
} from "@/lib/views";
import { STAGE_LABEL } from "@/lib/forecast";
import { formatEUR, daysSince } from "@/lib/utils";
import { ViewsScreen, type SavedView, type ViewsScreenData } from "@/components/canvas/screens/ViewsScreen";
import { GlassCard } from "@/components/canvas/primitives";
import { Badge } from "@/components/canvas/ui/badge";

export const dynamic = "force-dynamic";

// Each preset view maps to the canvas SavedView card. entity drives the card badge;
// filterSummary reuses our human-readable hint.
const VIEW_ENTITY: Record<SmartViewKey, SavedView["entity"]> = {
  "at-risk-dach": "deals",
  "offers-finance": "offers",
  "cases-blocking": "cases",
};

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

  const data: ViewsScreenData = {
    views: SMART_VIEWS.map((s) => ({
      id: s.key,
      name: s.label,
      entity: VIEW_ENTITY[s.key],
      ownerName: "Team preset",
      shared: true,
      filterSummary: s.hint,
    })),
  };

  return (
    <div className="space-y-2">
      <ViewsScreen data={data} />

      {/* Wired ?view= result tables — no slot for these on the canvas screen, kept verbatim. */}
      <div className="px-6 lg:px-8 pb-8 space-y-4">
        {!active ? (
          <p className="text-sm text-muted-foreground">Pick a view above to run it.</p>
        ) : (
          <GlassCard className="p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="font-medium text-sm">{meta?.label}</div>
              <Badge variant="outline">{VIEW_ENTITY[active]}</Badge>
            </div>
            {meta && <div className="px-5 pt-3 text-xs text-muted-foreground">{meta.hint}</div>}
            <div className="p-4">
              {active === "at-risk-dach" && <AtRiskDach />}
              {active === "offers-finance" && <OffersFinance />}
              {active === "cases-blocking" && <CasesBlocking />}
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

async function AtRiskDach() {
  const deals = await atRiskDachEnterprise();
  if (deals.length === 0) return <Empty />;
  return (
    <table className="w-full text-sm">
      <thead className="text-xs uppercase tracking-wider text-muted-foreground">
        <tr className="border-b border-border">
          <th className="px-4 py-2.5 text-left font-medium first:pl-5">Deal</th>
          <th className="px-4 py-2.5 text-left font-medium">Account</th>
          <th className="px-4 py-2.5 text-left font-medium">Stage</th>
          <th className="px-4 py-2.5 text-left font-medium">Owner</th>
          <th className="px-4 py-2.5 text-left font-medium last:pr-5">Last activity</th>
        </tr>
      </thead>
      <tbody>
        {deals.map((d) => (
          <tr key={d.id} className="border-b border-border/60 last:border-0">
            <td className="px-5 py-2.5 font-medium">
              <Link href={`/deals/${d.id}`} className="text-primary hover:underline">{d.name}</Link>
            </td>
            <td className="px-4 py-2.5 text-muted-foreground">{d.account.name} · {d.account.region}</td>
            <td className="px-4 py-2.5">{STAGE_LABEL[d.stage]}</td>
            <td className="px-4 py-2.5 text-muted-foreground">{d.ownerRep.name}</td>
            <td className="px-5 py-2.5"><Badge variant="warning">{daysSince(d.lastActivityAt)}d ago</Badge></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function OffersFinance() {
  const offers = await offersPendingFinance();
  if (offers.length === 0) return <Empty />;
  return (
    <table className="w-full text-sm">
      <thead className="text-xs uppercase tracking-wider text-muted-foreground">
        <tr className="border-b border-border">
          <th className="px-4 py-2.5 text-left font-medium first:pl-5">Account</th>
          <th className="px-4 py-2.5 text-left font-medium">Discount</th>
          <th className="px-4 py-2.5 text-left font-medium">Total</th>
          <th className="px-4 py-2.5 text-left font-medium">Submitted</th>
          <th className="px-4 py-2.5 text-left font-medium last:pr-5"></th>
        </tr>
      </thead>
      <tbody>
        {offers.map((o) => (
          <tr key={o.id} className="border-b border-border/60 last:border-0">
            <td className="px-5 py-2.5 font-medium">{o.account.name}</td>
            <td className="px-4 py-2.5">{o.discountPercent}%</td>
            <td className="px-4 py-2.5 tnum">{formatEUR(o.total)}</td>
            <td className="px-4 py-2.5 text-muted-foreground">{daysSince(o.updatedAt)}d ago</td>
            <td className="px-5 py-2.5"><Link href={`/approvals/${o.id}`} className="text-primary hover:underline">Review</Link></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function CasesBlocking() {
  const cases = await casesBlockingCustomerTests();
  if (cases.length === 0) return <Empty />;
  return (
    <table className="w-full text-sm">
      <thead className="text-xs uppercase tracking-wider text-muted-foreground">
        <tr className="border-b border-border">
          <th className="px-4 py-2.5 text-left font-medium first:pl-5">Case</th>
          <th className="px-4 py-2.5 text-left font-medium">Account</th>
          <th className="px-4 py-2.5 text-left font-medium">Service</th>
          <th className="px-4 py-2.5 text-left font-medium">Status</th>
          <th className="px-4 py-2.5 text-left font-medium last:pr-5">Priority</th>
        </tr>
      </thead>
      <tbody>
        {cases.map((c) => (
          <tr key={c.id} className="border-b border-border/60 last:border-0">
            <td className="px-5 py-2.5 font-medium">
              <Link href={`/cases/${c.id}`} className="text-primary hover:underline">{c.title}</Link>
            </td>
            <td className="px-4 py-2.5 text-muted-foreground">{c.account.name}</td>
            <td className="px-4 py-2.5">{c.service?.name ?? "—"}</td>
            <td className="px-4 py-2.5"><Badge variant={c.status === "ESCALATED" ? "destructive" : "warning"}>{c.status.replaceAll("_", " ")}</Badge></td>
            <td className="px-5 py-2.5">{c.priority}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground">No records match this view right now.</p>;
}
