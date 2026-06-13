"use server";

// Deal create/edit server actions (Owner / SA-O2).
// Writes the deal + its time-phased DealForecastPeriod rows (device vs service kept SEPARATE),
// enforces the reseller stage rule, and lands an activity event. Year-1 is rep-entered (4 quarters);
// years 2-3 are projected from year-1 so the deal shows across the Finance 3-year view.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { createActivityEvent } from "@/lib/activity";
import {
  probabilityForStage,
  weightedRevenue,
  quartersFrom,
  RESELLER_STAGES,
  STAGE_LABEL,
} from "@/lib/forecast";
import type { Channel, DealStage, InvoicingModel } from "@prisma/client";

// Projected expansion multipliers for years 2 and 3 (CONFIGURABLE ASSUMPTION).
const YEAR2_GROWTH = 1.2;
const YEAR3_GROWTH = 1.35;

function num(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function createDeal(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/role-switch");

  const accountId = String(formData.get("accountId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const channel = String(formData.get("channel") ?? "DIRECT") as Channel;
  let stage = String(formData.get("stage") ?? "INTEREST_SHOWN") as DealStage;
  const serviceModel = String(formData.get("serviceModel") ?? "MONTHLY_RECURRING") as InvoicingModel;
  const closeRaw = String(formData.get("expectedCloseDate") ?? "");
  if (!accountId || !name) return;

  // Reseller stage rule: CONTRACT_NEGOTIATION does not exist for reseller deals.
  if (channel === "RESELLER" && !RESELLER_STAGES.includes(stage)) {
    stage = "CUSTOMER_TEST";
  }

  const probability = probabilityForStage(stage);
  const expectedCloseDate = closeRaw ? new Date(closeRaw) : null;

  // Year-1 quarterly input: q1..q4 of deviceUnits / deviceRevenue / serviceRevenue.
  const year1 = [1, 2, 3, 4].map((q) => ({
    deviceUnits: num(formData.get(`q${q}_units`)),
    deviceRevenue: num(formData.get(`q${q}_device`)),
    serviceRevenue: num(formData.get(`q${q}_service`)),
  }));

  // 12 consecutive quarters from today; year-1 from input, years 2-3 projected.
  const quarters = quartersFrom(new Date(), 12);
  const rows = quarters.map((qtr, i) => {
    const base = year1[i % 4];
    const growth = i < 4 ? 1 : i < 8 ? YEAR2_GROWTH : YEAR3_GROWTH;
    const deviceUnits = Math.round(base.deviceUnits * growth);
    const deviceRevenue = Math.round(base.deviceRevenue * growth);
    const serviceRevenue = Math.round(base.serviceRevenue * growth);
    const totalRevenue = deviceRevenue + serviceRevenue;
    return {
      periodStart: qtr.start,
      periodEnd: qtr.end,
      periodLabel: qtr.label,
      deviceUnits,
      deviceRevenue,
      serviceRevenue,
      totalRevenue,
      weightedRevenue: weightedRevenue(probability, totalRevenue),
    };
  });

  // Service-invoicing model (brief 2.2) — the SAME service value is RECOGNISED differently per model,
  // so the three models produce different service-revenue curves (never flattened to one shape):
  //   ONE_OFF        -> recognised at a single point (all in the first quarter)
  //   FIXED_TERM     -> contract value spread evenly across the term (here: the 12 quarters)
  //   MONTHLY_RECURRING -> scales with the active-device trajectory (per-quarter device share)
  const totalService = rows.reduce((s, r) => s + r.serviceRevenue, 0);
  const totalUnits = rows.reduce((s, r) => s + r.deviceUnits, 0) || 1;
  rows.forEach((r, i) => {
    if (serviceModel === "ONE_OFF") r.serviceRevenue = i === 0 ? totalService : 0;
    else if (serviceModel === "FIXED_TERM") r.serviceRevenue = Math.round(totalService / rows.length);
    else r.serviceRevenue = Math.round(totalService * (r.deviceUnits / totalUnits)); // MONTHLY_RECURRING
    r.totalRevenue = r.deviceRevenue + r.serviceRevenue;
    r.weightedRevenue = weightedRevenue(probability, r.totalRevenue);
  });

  const deal = await prisma.deal.create({
    data: {
      accountId,
      ownerRepId: user.id,
      name,
      channel,
      stage,
      probability,
      serviceModel,
      expectedCloseDate,
      status: "OPEN",
      forecastPeriods: { create: rows },
    },
  });

  await createActivityEvent({
    accountId,
    actorId: user.id,
    type: "deal_created",
    summary: `${user.name} created deal "${name}" (${STAGE_LABEL[stage]}, ${channel.toLowerCase()})`,
    linkedRecordType: "DEAL",
    linkedRecordId: deal.id,
  });

  revalidatePath(`/accounts/${accountId}`);
  redirect(`/deals/${deal.id}`);
}

export async function addDealNote(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/role-switch");
  const dealId = String(formData.get("dealId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!dealId || !body) return;

  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) return;

  await prisma.note.create({ data: { parentType: "DEAL", parentId: dealId, authorId: user.id, body } });
  await createActivityEvent({
    accountId: deal.accountId,
    actorId: user.id,
    type: "deal_note_added",
    summary: `${user.name} noted on "${deal.name}"`,
    linkedRecordType: "DEAL",
    linkedRecordId: dealId,
  });
  revalidatePath(`/deals/${dealId}`);
}

export async function updateDealStage(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/role-switch");

  const dealId = String(formData.get("dealId") ?? "");
  let stage = String(formData.get("stage") ?? "") as DealStage;
  if (!dealId || !stage) return;

  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) return;
  if (deal.channel === "RESELLER" && !RESELLER_STAGES.includes(stage)) stage = "CUSTOMER_TEST";

  const probability = probabilityForStage(stage);
  const status = stage === "WON" ? "WON" : stage === "LOST" ? "LOST" : "OPEN";

  await prisma.deal.update({
    where: { id: dealId },
    data: { stage, probability, status, lastActivityAt: new Date() },
  });
  // Re-weight existing forecast rows at the new stage probability.
  const rows = await prisma.dealForecastPeriod.findMany({ where: { dealId } });
  await Promise.all(
    rows.map((r) =>
      prisma.dealForecastPeriod.update({
        where: { id: r.id },
        data: { weightedRevenue: weightedRevenue(probability, r.totalRevenue) },
      }),
    ),
  );

  await createActivityEvent({
    accountId: deal.accountId,
    actorId: user.id,
    type: "deal_stage_changed",
    summary: `${user.name} moved "${deal.name}" to ${STAGE_LABEL[stage]}`,
    linkedRecordType: "DEAL",
    linkedRecordId: dealId,
  });

  revalidatePath(`/deals/${dealId}`);
  revalidatePath(`/accounts/${deal.accountId}`);
}
