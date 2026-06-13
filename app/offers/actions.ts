"use server";

// Offer builder server actions (Owner / SA-O3) — the CREATE + SUBMIT side of the offer workflow.
// V's SA-V2 owns the APPROVE/REJECT queue actions. Handoff contract (so the state machines agree):
//
//   submit, discount > 0  -> Offer.status = PENDING_SM, locked = true,
//                            Approval{ step: SALES_MANAGER, status: PENDING } created, all SMs notified.
//   submit, discount == 0 -> Offer.status = APPROVED, locked = true (no approval needed), rep notified.
//   [V] SM approve        -> Approval(SALES_MANAGER)=APPROVED, Offer.status=PENDING_FINANCE,
//                            Approval{ step: FINANCE, PENDING } created, Finance notified.
//   [V] Finance approve   -> Approval(FINANCE)=APPROVED, Offer.status=APPROVED, rep notified.
//   [V] reject (any step) -> Approval=REJECTED, Offer.status=REJECTED, locked=false, rep notified.
//
// Discount > 0 ALWAYS requires a justification (enforced here). Catalog prices are snapshotted onto
// the line items so retired items stay correct on historical offers.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { submitForApproval } from "@/lib/approval";

type DraftItem = { itemType: "PRODUCT" | "SERVICE"; itemId: string; nameSnapshot: string; unitPriceSnapshot: number; quantity: number };

export async function createOffer(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/role-switch");

  const accountId = String(formData.get("accountId") ?? "");
  const dealId = String(formData.get("dealId") ?? "") || null;
  const discountPercent = Math.max(0, Math.min(100, Number(formData.get("discountPercent") ?? 0)));
  const discountJustification = String(formData.get("discountJustification") ?? "").trim();
  const intent = String(formData.get("intent") ?? "submit"); // "draft" | "submit"
  if (!accountId) redirect("/rep");

  // Discount requires justification — hard rule.
  if (discountPercent > 0 && !discountJustification) {
    redirect(`/offers/new?accountId=${accountId}${dealId ? `&dealId=${dealId}` : ""}&error=justification`);
  }

  // Resolve selected catalog items (qty_PRODUCT_<id> / qty_SERVICE_<id> > 0), snapshot their prices.
  const [products, services] = await Promise.all([
    prisma.product.findMany({ where: { status: "ACTIVE" } }),
    prisma.service.findMany({ where: { status: "ACTIVE" } }),
  ]);
  const items: DraftItem[] = [];
  for (const p of products) {
    const qty = Number(formData.get(`qty_PRODUCT_${p.id}`) ?? 0);
    if (qty > 0) items.push({ itemType: "PRODUCT", itemId: p.id, nameSnapshot: p.name, unitPriceSnapshot: p.unitPrice, quantity: qty });
  }
  for (const s of services) {
    const qty = Number(formData.get(`qty_SERVICE_${s.id}`) ?? 0);
    if (qty > 0) items.push({ itemType: "SERVICE", itemId: s.id, nameSnapshot: s.name, unitPriceSnapshot: s.basePrice, quantity: qty });
  }
  if (items.length === 0) {
    redirect(`/offers/new?accountId=${accountId}${dealId ? `&dealId=${dealId}` : ""}&error=empty`);
  }

  const subtotal = items.reduce((s, it) => s + it.unitPriceSnapshot * it.quantity, 0);
  const total = Math.round(subtotal * (1 - discountPercent / 100));

  // Always create as DRAFT; the state machine (lib/approval.ts, V/SA-V2) owns every transition.
  const offer = await prisma.offer.create({
    data: {
      accountId,
      dealId,
      createdById: user.id,
      status: "DRAFT",
      locked: false,
      subtotal,
      discountPercent,
      discountJustification: discountPercent > 0 ? discountJustification : null,
      total,
      lineItems: {
        create: items.map((it) => ({
          itemType: it.itemType,
          itemId: it.itemId,
          nameSnapshot: it.nameSnapshot,
          unitPriceSnapshot: it.unitPriceSnapshot,
          quantity: it.quantity,
          lineTotal: Math.round(it.unitPriceSnapshot * it.quantity),
        })),
      },
    },
  });

  // Delegate submit to the single-source state machine: discount>0 -> PENDING_SM + notify SMs;
  // discount==0 -> auto-approved. (Owner builds the offer; V owns the approval chain.)
  if (intent === "submit") {
    await submitForApproval(offer.id);
  }

  revalidatePath(`/accounts/${accountId}`);
  redirect(`/offers/${offer.id}`);
}
