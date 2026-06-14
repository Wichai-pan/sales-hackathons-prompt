// Deal detail (Owner / SA-O2) — rendered through the canvas DealDetailScreen.
// The time-phased forecast (hero #3: device vs service split + weighted) plus the move-stage
// and add-note forms are wired to the real server actions via adapter actions.

import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { STAGE_LABEL, DIRECT_STAGES, RESELLER_STAGES, aggregateByQuarter } from "@/lib/forecast";
import { updateDealStage, addDealNote } from "../actions";
import { DealDetailScreen, type DealDetailScreenData } from "@/components/canvas/screens/DealDetailScreen";
import type { Deal as CanvasDeal } from "@/lib/canvas/types";

export const dynamic = "force-dynamic";

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
  const stageOptions = (deal.channel === "RESELLER" ? RESELLER_STAGES : DIRECT_STAGES).map((s) => ({
    value: s,
    label: STAGE_LABEL[s],
  }));

  // ---- Adapter actions: wire the canvas forms to the real server actions ----
  async function changeStageAction(formData: FormData) {
    "use server";
    const stage = String(formData.get("stage") ?? "");
    if (!stage) return;
    const fd = new FormData();
    fd.set("dealId", id);
    fd.set("stage", stage);
    await updateDealStage(fd);
  }
  async function addNoteAction(formData: FormData) {
    "use server";
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    const fd = new FormData();
    fd.set("dealId", id);
    fd.set("body", body);
    await addDealNote(fd);
  }

  const data: DealDetailScreenData = {
    deal: {
      id: deal.id,
      accountId: deal.accountId,
      accountName: deal.account.name,
      name: deal.name,
      channel: deal.channel as CanvasDeal["channel"],
      stage: deal.stage as unknown as CanvasDeal["stage"],
      probability: deal.probability,
      expectedCloseDate: deal.expectedCloseDate?.toISOString(),
      lastActivityAt: deal.lastActivityAt.toISOString(),
      status: deal.status as unknown as CanvasDeal["status"],
      serviceModel: deal.serviceModel as unknown as CanvasDeal["serviceModel"],
      ownerName: deal.ownerRep.name,
    },
    forecast: quarters.map((q) => ({
      periodLabel: q.label,
      deviceUnits: q.deviceUnits,
      deviceRevenue: q.deviceRevenue,
      serviceRevenue: q.serviceRevenue,
      totalRevenue: q.totalRevenue,
      weightedRevenue: q.weightedRevenue,
    })),
    notes: notes.map((n) => ({
      id: n.id,
      body: n.body,
      authorName: n.author.name,
      createdAt: n.createdAt.toISOString(),
    })),
    stageOptions,
    stageLabel: STAGE_LABEL[deal.stage],
    changeStageAction,
    addNoteAction,
  };

  return <DealDetailScreen data={data} />;
}
