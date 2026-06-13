// Offer detail (Owner / SA-O3). Shows line items, discount + justification, status, and the
// approval history. The Approve/Reject controls live in V's SM/Finance queues (SA-V2).

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatEUR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PENDING_SM: "Pending Sales Manager",
  SM_APPROVED: "SM approved",
  PENDING_FINANCE: "Pending Finance",
  FINANCE_APPROVED: "Finance approved",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

function statusVariant(s: string): "default" | "secondary" | "outline" | "destructive" {
  if (s === "APPROVED") return "default";
  if (s === "REJECTED") return "destructive";
  if (s === "DRAFT") return "outline";
  return "secondary";
}

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: {
      account: true,
      deal: true,
      createdBy: true,
      lineItems: true,
      approvals: { include: { approver: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!offer) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href={`/accounts/${offer.accountId}`} className="text-sm text-muted-foreground hover:underline">
        ← {offer.account.name}
      </Link>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{offer.deal?.name ?? "Offer"} · v{offer.version}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Created by {offer.createdBy.name}</p>
        </div>
        <div className="text-right">
          <Badge variant={statusVariant(offer.status)}>{STATUS_LABEL[offer.status] ?? offer.status}</Badge>
          {offer.locked && <div className="mt-1 text-xs text-muted-foreground">🔒 locked while in approval</div>}
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Line items</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead><TR><TH>Item</TH><TH>Type</TH><TH className="text-right">Unit</TH><TH className="text-right">Qty</TH><TH className="text-right">Line</TH></TR></THead>
            <TBody>
              {offer.lineItems.map((li) => (
                <TR key={li.id}>
                  <TD className="font-medium">{li.nameSnapshot}</TD>
                  <TD>{li.itemType === "PRODUCT" ? "Device" : "Service"}</TD>
                  <TD className="text-right">{formatEUR(li.unitPriceSnapshot)}</TD>
                  <TD className="text-right">{li.quantity}</TD>
                  <TD className="text-right">{formatEUR(li.lineTotal)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatEUR(offer.subtotal)}</span></div>
              {offer.discountPercent > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>−{offer.discountPercent}%</span></div>
              )}
              <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>Total</span><span>{formatEUR(offer.total)}</span></div>
            </div>
          </div>
          {offer.discountPercent > 0 && offer.discountJustification && (
            <div className="mt-4 rounded-md bg-muted p-3 text-sm">
              <span className="font-medium">Discount justification: </span>{offer.discountJustification}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Approval history</CardTitle></CardHeader>
        <CardContent>
          {offer.approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approvals needed (no discount).</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {offer.approvals.map((a) => (
                <li key={a.id} className="flex items-center justify-between">
                  <span>
                    {a.step === "SALES_MANAGER" ? "Sales Manager" : "Finance"}
                    {a.approver ? ` · ${a.approver.name}` : ""}
                    {a.comment ? ` — ${a.comment}` : ""}
                  </span>
                  <Badge variant={a.status === "APPROVED" ? "default" : a.status === "REJECTED" ? "destructive" : "secondary"}>
                    {a.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
