// Offer approval detail (SLICE SA-V2 / V).
// Shows the line-item snapshots, pricing (subtotal / discount + justification / total),
// lock state, the FULL approval history (SM + Finance rows), and — only for the role that
// can act on the current status — the Approve/Reject decision panel.

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentRole } from "@/lib/session";
import { formatEUR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import type { OfferStatus, ApprovalStep, ApprovalStatus } from "@prisma/client";
import { DecisionPanel } from "../decision-panel";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<OfferStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PENDING_SM: "Pending Sales Manager",
  SM_APPROVED: "Sales Manager approved",
  PENDING_FINANCE: "Pending Finance",
  FINANCE_APPROVED: "Finance approved",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const STEP_LABEL: Record<ApprovalStep, string> = {
  SALES_MANAGER: "Sales Manager",
  FINANCE: "Finance",
};

function statusVariant(s: OfferStatus): "success" | "destructive" | "warning" | "secondary" {
  if (s === "APPROVED") return "success";
  if (s === "REJECTED") return "destructive";
  if (s.startsWith("PENDING")) return "warning";
  return "secondary";
}

function approvalVariant(s: ApprovalStatus): "success" | "destructive" | "warning" {
  if (s === "APPROVED") return "success";
  if (s === "REJECTED") return "destructive";
  return "warning";
}

function fmtDateTime(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default async function OfferApprovalDetailPage({
  params,
}: {
  params: Promise<{ offerId: string }>;
}) {
  const { offerId } = await params;
  const role = await currentRole();

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      account: true,
      deal: true,
      createdBy: true,
      lineItems: true,
      approvals: {
        include: { approver: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!offer) notFound();

  // Who can act right now?
  const canActAsSM = role === "SALES_MANAGER" && offer.status === "PENDING_SM";
  const canActAsFinance = role === "FINANCE" && offer.status === "PENDING_FINANCE";

  return (
    <main className="space-y-6">
      <section>
        <Link href="/approvals" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to approvals
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{offer.account.name}</h1>
          <Badge variant={statusVariant(offer.status)}>{STATUS_LABEL[offer.status]}</Badge>
          {offer.locked ? (
            <Badge variant="secondary">🔒 Locked</Badge>
          ) : (
            <Badge variant="outline">Unlocked</Badge>
          )}
          <Badge variant="outline">v{offer.version}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {offer.deal ? `Deal: ${offer.deal.name} · ` : ""}Created by {offer.createdBy.name}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Line items + pricing */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Offer line items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <THead>
                <TR>
                  <TH>Item</TH>
                  <TH>Type</TH>
                  <TH className="text-right">Unit price</TH>
                  <TH className="text-right">Qty</TH>
                  <TH className="text-right">Line total</TH>
                </TR>
              </THead>
              <TBody>
                {offer.lineItems.length === 0 ? (
                  <TR>
                    <TD className="text-muted-foreground" colSpan={5}>
                      No line items on this offer.
                    </TD>
                  </TR>
                ) : (
                  offer.lineItems.map((li) => (
                    <TR key={li.id}>
                      <TD className="font-medium">{li.nameSnapshot}</TD>
                      <TD>
                        <Badge variant="outline">
                          {li.itemType === "PRODUCT" ? "Product" : "Service"}
                        </Badge>
                      </TD>
                      <TD className="text-right">{formatEUR(li.unitPriceSnapshot)}</TD>
                      <TD className="text-right">{li.quantity}</TD>
                      <TD className="text-right font-medium">{formatEUR(li.lineTotal)}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>

            <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatEUR(offer.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span>
                  {offer.discountPercent}%{" "}
                  {offer.discountPercent > 0 && (
                    <span>(−{formatEUR(offer.subtotal - offer.total)})</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1 text-base font-semibold">
                <span>Total</span>
                <span>{formatEUR(offer.total)}</span>
              </div>
            </div>

            {offer.discountPercent > 0 && (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-xs font-medium text-muted-foreground">
                  Discount justification
                </div>
                <p className="mt-1 text-sm">
                  {offer.discountJustification?.trim() || (
                    <span className="text-destructive">Missing — required for any discount.</span>
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Decision panel (role + status gated) */}
        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
          </CardHeader>
          <CardContent>
            {canActAsSM ? (
              <DecisionPanel offerId={offer.id} step="SM" />
            ) : canActAsFinance ? (
              <DecisionPanel offerId={offer.id} step="FINANCE" />
            ) : (
              <p className="text-sm text-muted-foreground">
                {offer.status === "APPROVED"
                  ? "This offer is fully approved. No further action needed."
                  : offer.status === "REJECTED"
                    ? "This offer was rejected and unlocked for revision."
                    : offer.status === "PENDING_SM"
                      ? "Awaiting Sales Manager approval. Only a Sales Manager can act here."
                      : offer.status === "PENDING_FINANCE"
                        ? "Awaiting Finance approval. Only Finance can act here."
                        : "No approval action is available for this offer's current status."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full approval history */}
      <Card>
        <CardHeader>
          <CardTitle>Approval history</CardTitle>
        </CardHeader>
        <CardContent>
          {offer.approvals.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No approval steps yet — this offer has not entered the approval chain.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Step</TH>
                  <TH>Status</TH>
                  <TH>Approver</TH>
                  <TH>Comment</TH>
                  <TH>Decided</TH>
                </TR>
              </THead>
              <TBody>
                {offer.approvals.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-medium">{STEP_LABEL[a.step]}</TD>
                    <TD>
                      <Badge variant={approvalVariant(a.status)}>{a.status}</Badge>
                    </TD>
                    <TD className="text-muted-foreground">{a.approver?.name ?? "—"}</TD>
                    <TD className="max-w-[20rem] text-muted-foreground">
                      {a.comment?.trim() || "—"}
                    </TD>
                    <TD className="text-muted-foreground">{fmtDateTime(a.decidedAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
