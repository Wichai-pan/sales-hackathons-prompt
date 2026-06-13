// Account 360 — the most important page (Owner / SA-O1).
// Account summary + contacts + open deals + active cases + offers + activity timeline + notes,
// with a slot for the AI Next Best Action panel (wired live in SA-O4).

import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { STAGE_LABEL } from "@/lib/forecast";
import { formatEUR, daysSince } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { NbaPanel, NbaSkeleton } from "@/components/nba-panel";
import { addAccountNote } from "./actions";

const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  LOW: "outline",
  MEDIUM: "secondary",
  HIGH: "destructive",
  CRITICAL: "destructive",
};

const OFFER_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PENDING_SM: "Pending SM",
  SM_APPROVED: "SM approved",
  PENDING_FINANCE: "Pending Finance",
  FINANCE_APPROVED: "Finance approved",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

function channelBadge(c: string) {
  return c === "RESELLER" ? <Badge variant="outline">Reseller</Badge> : <Badge variant="secondary">Direct</Badge>;
}

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      ownerRep: true,
      assignedTam: true,
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      deals: { orderBy: { lastActivityAt: "desc" } },
      cases: { include: { service: true, assignedTam: true }, orderBy: { createdAt: "desc" } },
      offers: { include: { deal: true }, orderBy: { updatedAt: "desc" } },
      activityEvents: { include: { actor: true }, orderBy: { createdAt: "desc" }, take: 15 },
    },
  });
  if (!account) notFound();

  const notes = await prisma.note.findMany({
    where: { parentType: "ACCOUNT", parentId: id },
    include: { author: true },
    orderBy: { createdAt: "desc" },
  });

  const openDeals = account.deals.filter((d) => d.status === "OPEN");
  const activeCases = account.cases.filter((c) => c.status !== "CLOSED");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/rep" className="text-sm text-muted-foreground hover:underline">
            ← Back to dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{account.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {account.industry} · {account.segment} · {account.region}
          </p>
        </div>
        <div className="text-right text-sm">
          <div>Owner: <span className="font-medium">{account.ownerRep.name}</span></div>
          {account.assignedTam && <div>TAM: <span className="font-medium">{account.assignedTam.name}</span></div>}
          <div className="mt-1 flex justify-end gap-2">
            <Link href={`/deals/new?accountId=${account.id}`}><Button size="sm">New deal</Button></Link>
            <Link href={`/offers/new?accountId=${account.id}`}><Button size="sm" variant="secondary">New offer</Button></Link>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Open deals + active cases TOGETHER (demo step: "deals + cases together") */}
          <Card>
            <CardHeader><CardTitle>Open deals ({openDeals.length})</CardTitle></CardHeader>
            <CardContent>
              {openDeals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open deals.</p>
              ) : (
                <Table>
                  <THead><TR><TH>Deal</TH><TH>Channel</TH><TH>Stage</TH><TH>Close</TH><TH className="text-right">Stale</TH></TR></THead>
                  <TBody>
                    {openDeals.map((d) => (
                      <TR key={d.id}>
                        <TD><Link href={`/deals/${d.id}`} className="font-medium hover:underline">{d.name}</Link></TD>
                        <TD>{channelBadge(d.channel)}</TD>
                        <TD>{STAGE_LABEL[d.stage]}</TD>
                        <TD>{d.expectedCloseDate ? d.expectedCloseDate.toISOString().slice(0, 10) : "—"}</TD>
                        <TD className="text-right">{daysSince(d.lastActivityAt) >= 14 ? <Badge variant="destructive">{daysSince(d.lastActivityAt)}d</Badge> : `${daysSince(d.lastActivityAt)}d`}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Active cases ({activeCases.length})</CardTitle></CardHeader>
            <CardContent>
              {activeCases.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active cases.</p>
              ) : (
                <Table>
                  <THead><TR><TH>Case</TH><TH>Priority</TH><TH>Status</TH><TH>Service</TH></TR></THead>
                  <TBody>
                    {activeCases.map((c) => (
                      <TR key={c.id}>
                        <TD><Link href={`/cases/${c.id}`} className="font-medium hover:underline">{c.title}</Link></TD>
                        <TD><Badge variant={PRIORITY_VARIANT[c.priority]}>{c.priority}</Badge></TD>
                        <TD>{c.status.replace("_", " ")}</TD>
                        <TD>{c.service?.name ?? "—"}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Offers */}
          <Card>
            <CardHeader><CardTitle>Offers ({account.offers.length})</CardTitle></CardHeader>
            <CardContent>
              {account.offers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No offers yet.</p>
              ) : (
                <Table>
                  <THead><TR><TH>Offer</TH><TH>Status</TH><TH className="text-right">Discount</TH><TH className="text-right">Total</TH></TR></THead>
                  <TBody>
                    {account.offers.map((o) => (
                      <TR key={o.id}>
                        <TD><Link href={`/offers/${o.id}`} className="font-medium hover:underline">{o.deal?.name ?? "Offer"} v{o.version}</Link></TD>
                        <TD><Badge variant={o.status === "APPROVED" ? "default" : o.status === "REJECTED" ? "destructive" : "secondary"}>{OFFER_LABEL[o.status] ?? o.status}</Badge></TD>
                        <TD className="text-right">{o.discountPercent > 0 ? `${o.discountPercent}%` : "—"}</TD>
                        <TD className="text-right">{formatEUR(o.total)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Activity timeline */}
          <Card>
            <CardHeader><CardTitle>Activity timeline</CardTitle></CardHeader>
            <CardContent>
              {account.activityEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ul className="space-y-3">
                  {account.activityEvents.map((e) => (
                    <li key={e.id} className="flex gap-3 text-sm">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                      <div>
                        <div>{e.summary}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.actor?.name ? `${e.actor.name} · ` : ""}{e.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Notes + add note */}
          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent>
              <form action={addAccountNote} className="flex gap-2">
                <input type="hidden" name="accountId" value={account.id} />
                <input
                  name="body"
                  placeholder="Add a note…"
                  required
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <Button type="submit" size="sm">Add</Button>
              </form>
              <ul className="mt-4 space-y-3">
                {notes.length === 0 && <li className="text-sm text-muted-foreground">No notes yet.</li>}
                {notes.map((n) => (
                  <li key={n.id} className="rounded-md border border-border p-3 text-sm">
                    <div>{n.body}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {n.author.name} · {n.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* AI Next Best Action — streamed via Suspense so the page paints instantly
              while the LLM (a few seconds) resolves in the background. */}
          <Suspense fallback={<NbaSkeleton />}>
            <NbaPanel accountId={account.id} />
          </Suspense>

          {/* Contacts */}
          <Card>
            <CardHeader><CardTitle>Contacts ({account.contacts.length})</CardTitle></CardHeader>
            <CardContent>
              {account.contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contacts.</p>
              ) : (
                <ul className="space-y-3">
                  {account.contacts.map((c) => (
                    <li key={c.id} className="text-sm">
                      <div className="font-medium">
                        {c.name} {c.isPrimary && <Badge variant="secondary" className="ml-1">Primary</Badge>}
                      </div>
                      {c.title && <div className="text-xs text-muted-foreground">{c.title}</div>}
                      {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
