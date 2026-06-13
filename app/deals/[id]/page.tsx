// Deal detail (Owner / SA-O2). Header + change-stage control + the time-phased forecast
// (per-quarter device vs service split + weighted) + a link to build an offer.

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { STAGE_LABEL, DIRECT_STAGES, RESELLER_STAGES, aggregateByQuarter } from "@/lib/forecast";
import { formatEUR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { updateDealStage, addDealNote } from "../actions";
import type { DealStage } from "@prisma/client";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: { account: true, ownerRep: true, forecastPeriods: { orderBy: { periodLabel: "asc" } } },
  });
  if (!deal) notFound();

  const notes = await prisma.note.findMany({
    where: { parentType: "DEAL", parentId: id },
    include: { author: true },
    orderBy: { createdAt: "desc" },
  });

  const quarters = aggregateByQuarter(deal.forecastPeriods);
  const total = quarters.reduce((s, q) => s + q.totalRevenue, 0);
  const weighted = quarters.reduce((s, q) => s + q.weightedRevenue, 0);
  const stageOptions = (deal.channel === "RESELLER" ? RESELLER_STAGES : DIRECT_STAGES);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href={`/accounts/${deal.accountId}`} className="text-sm text-muted-foreground hover:underline">
        ← {deal.account.name}
      </Link>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{deal.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {deal.channel === "RESELLER" ? <Badge variant="outline">Reseller</Badge> : <Badge variant="secondary">Direct</Badge>}{" "}
            · {STAGE_LABEL[deal.stage]} · {deal.probability}% · owner {deal.ownerRep.name}
            {deal.expectedCloseDate ? ` · close ${deal.expectedCloseDate.toISOString().slice(0, 10)}` : ""}
          </p>
        </div>
        <Link href={`/offers/new?accountId=${deal.accountId}&dealId=${deal.id}`}>
          <Button size="sm">Build offer</Button>
        </Link>
      </div>

      {/* 3-year totals */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="3-yr total" value={formatEUR(total)} />
        <Stat label="Weighted" value={formatEUR(weighted)} />
        <Stat label="Quarters" value={String(quarters.length)} />
        <Stat label="Stage prob." value={`${deal.probability}%`} />
      </div>

      {/* Change stage */}
      <Card className="mt-6">
        <CardHeader><CardTitle className="text-base">Move stage</CardTitle></CardHeader>
        <CardContent>
          <form action={updateDealStage} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="dealId" value={deal.id} />
            <select name="stage" defaultValue={deal.stage} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              {stageOptions.map((s: DealStage) => (
                <option key={s} value={s}>{STAGE_LABEL[s]}</option>
              ))}
            </select>
            <Button type="submit" size="sm" variant="secondary">Update</Button>
            <span className="text-xs text-muted-foreground">Re-weights the forecast at the new stage probability.</span>
          </form>
        </CardContent>
      </Card>

      {/* Time-phased forecast */}
      <Card className="mt-6">
        <CardHeader><CardTitle>3-year time-phased forecast</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Quarter</TH>
                <TH className="text-right">Device units</TH>
                <TH className="text-right">Device €</TH>
                <TH className="text-right">Service €</TH>
                <TH className="text-right">Total €</TH>
                <TH className="text-right">Weighted €</TH>
              </TR>
            </THead>
            <TBody>
              {quarters.map((q) => (
                <TR key={q.label}>
                  <TD className="font-medium">{q.label}</TD>
                  <TD className="text-right">{q.deviceUnits}</TD>
                  <TD className="text-right">{formatEUR(q.deviceRevenue)}</TD>
                  <TD className="text-right">{formatEUR(q.serviceRevenue)}</TD>
                  <TD className="text-right">{formatEUR(q.totalRevenue)}</TD>
                  <TD className="text-right">{formatEUR(q.weightedRevenue)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Deal notes */}
      <Card className="mt-6">
        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
        <CardContent>
          <form action={addDealNote} className="flex gap-2">
            <input type="hidden" name="dealId" value={deal.id} />
            <input name="body" placeholder="Add a note…" required className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <Button type="submit" size="sm">Add</Button>
          </form>
          <ul className="mt-4 space-y-3">
            {notes.length === 0 && <li className="text-sm text-muted-foreground">No notes yet.</li>}
            {notes.map((n) => (
              <li key={n.id} className="rounded-md border border-border p-3 text-sm">
                <div>{n.body}</div>
                <div className="mt-1 text-xs text-muted-foreground">{n.author.name} · {n.createdAt.toISOString().slice(0, 16).replace("T", " ")}</div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
