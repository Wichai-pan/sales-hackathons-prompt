// Reporting / aggregation helpers — Manager + Finance + Reports (SLICE SA-V4).
// Reuses lib/forecast.ts for all bucketing & weighting; never re-implements it.
// Hard rules baked in here:
//   - Forecast is TIME-PHASED (per-period rows), never a single deal amount.
//   - Device vs service revenue stay SEPARATE in every aggregate.
//   - Weighted by stage probability (stored weightedRevenue, with a stage fallback).
//   - Stalled = OPEN deal not updated in 14+ days.

import { prisma } from "@/lib/db";
import {
  aggregateByQuarter,
  weightedRevenue,
  STAGE_PROBABILITY,
  STAGE_LABEL,
  type ForecastRow,
  type QuarterAggregate,
} from "@/lib/forecast";
import { daysSince } from "@/lib/utils";
import type { Channel, DealStage } from "@prisma/client";

// ----------------------------- 3-year forecast -----------------------------

export interface ThreeYearForecast {
  quarters: QuarterAggregate[];
  totals: {
    deviceUnits: number;
    deviceRevenue: number;
    serviceRevenue: number;
    totalRevenue: number;
    weightedRevenue: number;
  };
}

export interface ForecastFilter {
  ownerRepId?: string;
  channel?: Channel;
}

/**
 * Every DealForecastPeriod row -> ForecastRow shape -> aggregateByQuarter.
 * Returns up to 12 quarters, device/service kept separate, weighted total SEPARATE.
 * Optional owner/channel filters are applied to the parent deal.
 */
export async function threeYearForecast(
  filter: ForecastFilter = {}
): Promise<ThreeYearForecast> {
  const periods = await prisma.dealForecastPeriod.findMany({
    where: {
      deal: {
        status: "OPEN",
        ...(filter.ownerRepId ? { ownerRepId: filter.ownerRepId } : {}),
        ...(filter.channel ? { channel: filter.channel } : {}),
      },
    },
    orderBy: { periodLabel: "asc" },
  });

  const rows: ForecastRow[] = periods.map((p) => ({
    periodLabel: p.periodLabel,
    deviceUnits: p.deviceUnits,
    deviceRevenue: p.deviceRevenue,
    serviceRevenue: p.serviceRevenue,
    totalRevenue: p.totalRevenue,
    weightedRevenue: p.weightedRevenue,
  }));

  const quarters = aggregateByQuarter(rows).slice(0, 12);

  const totals = quarters.reduce(
    (acc, q) => {
      acc.deviceUnits += q.deviceUnits;
      acc.deviceRevenue += q.deviceRevenue;
      acc.serviceRevenue += q.serviceRevenue;
      acc.totalRevenue += q.totalRevenue;
      acc.weightedRevenue += q.weightedRevenue;
      return acc;
    },
    {
      deviceUnits: 0,
      deviceRevenue: 0,
      serviceRevenue: 0,
      totalRevenue: 0,
      weightedRevenue: 0,
    }
  );

  return { quarters, totals };
}

// ----------------------------- Pipeline weighting helpers ------------------

/**
 * Weighted value of a single deal.
 * Prefer the sum of its stored forecast weightedRevenue (time-phased, already
 * stage-weighted at write time). Fall back to probability * total estimate when
 * a deal has no forecast rows, using the live stage probability.
 */
function dealWeighted(deal: {
  stage: DealStage;
  probability: number;
  forecastPeriods: { totalRevenue: number; weightedRevenue: number }[];
}): { weighted: number; total: number } {
  const total = deal.forecastPeriods.reduce((s, p) => s + p.totalRevenue, 0);
  const storedWeighted = deal.forecastPeriods.reduce(
    (s, p) => s + p.weightedRevenue,
    0
  );

  if (deal.forecastPeriods.length > 0 && storedWeighted > 0) {
    return { weighted: storedWeighted, total };
  }

  // Fallback: live stage probability (or the deal's own probability if set).
  const prob = deal.probability || STAGE_PROBABILITY[deal.stage] || 0;
  return { weighted: weightedRevenue(prob, total), total };
}

// ----------------------------- Pipeline by stage ---------------------------

export interface StagePipelineRow {
  stage: DealStage;
  label: string;
  probability: number;
  count: number;
  totalRevenue: number;
  weightedRevenue: number;
}

/** OPEN deals grouped by stage -> count + weighted sum + total. */
export async function pipelineByStage(): Promise<StagePipelineRow[]> {
  const deals = await prisma.deal.findMany({
    where: { status: "OPEN" },
    include: {
      forecastPeriods: { select: { totalRevenue: true, weightedRevenue: true } },
    },
  });

  const map = new Map<DealStage, StagePipelineRow>();
  for (const d of deals) {
    const row =
      map.get(d.stage) ??
      {
        stage: d.stage,
        label: STAGE_LABEL[d.stage],
        probability: STAGE_PROBABILITY[d.stage] ?? 0,
        count: 0,
        totalRevenue: 0,
        weightedRevenue: 0,
      };
    const { weighted, total } = dealWeighted(d);
    row.count += 1;
    row.totalRevenue += total;
    row.weightedRevenue += weighted;
    map.set(d.stage, row);
  }

  // Stable, demo-friendly order: by ascending stage probability.
  return [...map.values()].sort((a, b) => a.probability - b.probability);
}

// ----------------------------- Pipeline by owner ---------------------------

export interface OwnerPipelineRow {
  ownerRepId: string;
  ownerName: string;
  count: number;
  totalRevenue: number;
  weightedRevenue: number;
}

/** OPEN deals grouped by owning rep (with name) -> count + weighted sum. */
export async function pipelineByOwner(): Promise<OwnerPipelineRow[]> {
  const deals = await prisma.deal.findMany({
    where: { status: "OPEN" },
    include: {
      ownerRep: { select: { id: true, name: true } },
      forecastPeriods: { select: { totalRevenue: true, weightedRevenue: true } },
    },
  });

  const map = new Map<string, OwnerPipelineRow>();
  for (const d of deals) {
    const row =
      map.get(d.ownerRepId) ??
      {
        ownerRepId: d.ownerRepId,
        ownerName: d.ownerRep.name,
        count: 0,
        totalRevenue: 0,
        weightedRevenue: 0,
      };
    const { weighted, total } = dealWeighted(d);
    row.count += 1;
    row.totalRevenue += total;
    row.weightedRevenue += weighted;
    map.set(d.ownerRepId, row);
  }

  return [...map.values()].sort((a, b) => b.weightedRevenue - a.weightedRevenue);
}

// ----------------------------- Stalled / past-close ------------------------

export interface DealRow {
  id: string;
  name: string;
  stage: DealStage;
  stageLabel: string;
  channel: Channel;
  accountName: string;
  ownerName: string;
  expectedCloseDate: Date | null;
  lastActivityAt: Date;
  daysStalled: number;
  weightedRevenue: number;
}

async function openDealRows(): Promise<
  (DealRow & { _expectedCloseDate: Date | null })[]
> {
  const deals = await prisma.deal.findMany({
    where: { status: "OPEN" },
    include: {
      account: { select: { name: true } },
      ownerRep: { select: { name: true } },
      forecastPeriods: { select: { totalRevenue: true, weightedRevenue: true } },
    },
    orderBy: { lastActivityAt: "asc" },
  });

  return deals.map((d) => {
    const { weighted } = dealWeighted(d);
    return {
      id: d.id,
      name: d.name,
      stage: d.stage,
      stageLabel: STAGE_LABEL[d.stage],
      channel: d.channel,
      accountName: d.account.name,
      ownerName: d.ownerRep.name,
      expectedCloseDate: d.expectedCloseDate,
      _expectedCloseDate: d.expectedCloseDate,
      lastActivityAt: d.lastActivityAt,
      daysStalled: daysSince(d.lastActivityAt),
      weightedRevenue: weighted,
    };
  });
}

/** OPEN deals not touched in 14+ days, most stale first. */
export async function stalledDeals(): Promise<DealRow[]> {
  const rows = await openDealRows();
  return rows
    .filter((r) => r.daysStalled >= 14)
    .sort((a, b) => b.daysStalled - a.daysStalled);
}

/** OPEN deals whose expected close date is already in the past. */
export async function pastCloseDeals(): Promise<DealRow[]> {
  const now = Date.now();
  const rows = await openDealRows();
  return rows
    .filter(
      (r) =>
        r._expectedCloseDate !== null &&
        r._expectedCloseDate.getTime() < now
    )
    .sort((a, b) => {
      const at = a._expectedCloseDate?.getTime() ?? 0;
      const bt = b._expectedCloseDate?.getTime() ?? 0;
      return at - bt;
    });
}

// ----------------------------- Close rate ----------------------------------

export interface CloseRate {
  won: number;
  lost: number;
  open: number;
  decided: number;
  rate: number; // 0..1; WON / (WON + LOST)
}

/** WON / (WON + LOST) from deal.status. */
export async function closeRate(): Promise<CloseRate> {
  const [won, lost, open] = await Promise.all([
    prisma.deal.count({ where: { status: "WON" } }),
    prisma.deal.count({ where: { status: "LOST" } }),
    prisma.deal.count({ where: { status: "OPEN" } }),
  ]);
  const decided = won + lost;
  return { won, lost, open, decided, rate: decided === 0 ? 0 : won / decided };
}

// ----------------------------- Reports: cases ------------------------------

export interface CountRow {
  key: string;
  label: string;
  count: number;
}

/** Cases grouped by status. */
export async function casesByStatus(): Promise<CountRow[]> {
  const grouped = await prisma.case.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  return grouped
    .map((g) => ({
      key: g.status,
      label: g.status.replaceAll("_", " "),
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Cases grouped by linked service (un-linked grouped as "Unassigned"). */
export async function casesByService(): Promise<CountRow[]> {
  const grouped = await prisma.case.groupBy({
    by: ["serviceId"],
    _count: { _all: true },
  });

  const serviceIds = grouped
    .map((g) => g.serviceId)
    .filter((id): id is string => id !== null);

  const services = serviceIds.length
    ? await prisma.service.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(services.map((s) => [s.id, s.name]));

  return grouped
    .map((g) => ({
      key: g.serviceId ?? "none",
      label: g.serviceId ? nameById.get(g.serviceId) ?? "Unknown service" : "Unassigned",
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count);
}

// ----------------------------- Reports: deals by stage/owner ---------------

export interface StageOwnerRow {
  ownerRepId: string;
  ownerName: string;
  byStage: Record<DealStage, number>;
  total: number;
}

/**
 * OPEN deal counts in a stage x owner matrix (for the reports page).
 * Every stage key is present (0-filled) so the table renders uniformly.
 */
export async function dealsByStageOwner(): Promise<{
  rows: StageOwnerRow[];
  stages: { stage: DealStage; label: string }[];
}> {
  const deals = await prisma.deal.findMany({
    where: { status: "OPEN" },
    select: {
      stage: true,
      ownerRepId: true,
      ownerRep: { select: { name: true } },
    },
  });

  const stageOrder = (Object.keys(STAGE_PROBABILITY) as DealStage[]).filter(
    (s) => s !== "WON" && s !== "LOST"
  );

  const emptyByStage = (): Record<DealStage, number> =>
    stageOrder.reduce(
      (acc, s) => {
        acc[s] = 0;
        return acc;
      },
      {} as Record<DealStage, number>
    );

  const map = new Map<string, StageOwnerRow>();
  for (const d of deals) {
    const row =
      map.get(d.ownerRepId) ??
      {
        ownerRepId: d.ownerRepId,
        ownerName: d.ownerRep.name,
        byStage: emptyByStage(),
        total: 0,
      };
    row.byStage[d.stage] = (row.byStage[d.stage] ?? 0) + 1;
    row.total += 1;
    map.set(d.ownerRepId, row);
  }

  return {
    rows: [...map.values()].sort((a, b) => b.total - a.total),
    stages: stageOrder.map((s) => ({ stage: s, label: STAGE_LABEL[s] })),
  };
}

// ----------------------------- Reps (reassign target list) -----------------

/** Sales reps available as deal-reassignment targets. */
export async function listReps(): Promise<{ id: string; name: string }[]> {
  return prisma.user.findMany({
    where: { role: "REP" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
