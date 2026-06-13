// Forecast engine — shared by seed, Rep 12-month input (Owner), and Manager/Finance views (V).
// Device vs service revenue is kept SEPARATE everywhere (BUILD-SPEC hard rule).
// Stage probabilities are a CONFIGURABLE ASSUMPTION — the brief does not fix them.

import type { DealStage } from "@prisma/client";

/** Weighted-pipeline stage probabilities, in percent. Tune here only. */
export const STAGE_PROBABILITY: Record<DealStage, number> = {
  INTEREST_SHOWN: 10,
  RFI_ANSWERED: 25,
  RFP_OFFER_GIVEN: 45,
  CUSTOMER_TEST: 70,
  CONTRACT_NEGOTIATION: 90,
  WON: 100,
  LOST: 0,
};

/** Human-readable stage labels for UI. */
export const STAGE_LABEL: Record<DealStage, string> = {
  INTEREST_SHOWN: "Interest shown",
  RFI_ANSWERED: "RFI answered",
  RFP_OFFER_GIVEN: "RFP / offer given",
  CUSTOMER_TEST: "Customer test",
  CONTRACT_NEGOTIATION: "Contract negotiation",
  WON: "Won",
  LOST: "Lost",
};

/** Stages a RESELLER deal may use — CONTRACT_NEGOTIATION is excluded by rule. */
export const RESELLER_STAGES: DealStage[] = [
  "INTEREST_SHOWN",
  "RFI_ANSWERED",
  "RFP_OFFER_GIVEN",
  "CUSTOMER_TEST",
  "WON",
  "LOST",
];

export const DIRECT_STAGES: DealStage[] = [
  "INTEREST_SHOWN",
  "RFI_ANSWERED",
  "RFP_OFFER_GIVEN",
  "CUSTOMER_TEST",
  "CONTRACT_NEGOTIATION",
  "WON",
  "LOST",
];

export function probabilityForStage(stage: DealStage): number {
  return STAGE_PROBABILITY[stage] ?? 0;
}

/** Core weighting: weighted = total * (stageProb / 100). stageProb is a percent. */
export function weightedRevenue(stageProb: number, totalRevenue: number): number {
  return Math.round(totalRevenue * (stageProb / 100));
}

// ----------------------------- Period helpers -----------------------------

export interface Quarter {
  label: string; // "2026-Q3"
  year: number;
  quarter: 1 | 2 | 3 | 4;
  start: Date;
  end: Date;
}

export function quarterOf(date: Date): 1 | 2 | 3 | 4 {
  return (Math.floor(date.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;
}

export function quarterLabel(date: Date): string {
  return `${date.getUTCFullYear()}-Q${quarterOf(date)}`;
}

export function makeQuarter(year: number, quarter: 1 | 2 | 3 | 4): Quarter {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0)); // last day of quarter
  return { label: `${year}-Q${quarter}`, year, quarter, start, end };
}

/** Enumerate `count` consecutive quarters starting at the quarter containing `from`. */
export function quartersFrom(from: Date, count: number): Quarter[] {
  let year = from.getUTCFullYear();
  let q = quarterOf(from);
  const out: Quarter[] = [];
  for (let i = 0; i < count; i++) {
    out.push(makeQuarter(year, q));
    q = (q === 4 ? 1 : ((q + 1) as 1 | 2 | 3 | 4)) as 1 | 2 | 3 | 4;
    if (q === 1) year += 1;
  }
  return out;
}

// ----------------------------- Aggregation -----------------------------

/** Shape of a stored forecast row (mirrors DealForecastPeriod scalar fields). */
export interface ForecastRow {
  periodLabel: string;
  deviceUnits: number;
  deviceRevenue: number;
  serviceRevenue: number;
  totalRevenue: number;
  weightedRevenue: number;
}

export interface QuarterAggregate {
  label: string;
  deviceUnits: number;
  deviceRevenue: number;
  serviceRevenue: number;
  totalRevenue: number;
  weightedRevenue: number;
}

/**
 * Aggregate forecast rows into per-quarter buckets, keeping device/service split.
 * Used by Manager/Finance 3-year views.
 */
export function aggregateByQuarter(rows: ForecastRow[]): QuarterAggregate[] {
  const map = new Map<string, QuarterAggregate>();
  for (const r of rows) {
    const agg =
      map.get(r.periodLabel) ??
      {
        label: r.periodLabel,
        deviceUnits: 0,
        deviceRevenue: 0,
        serviceRevenue: 0,
        totalRevenue: 0,
        weightedRevenue: 0,
      };
    agg.deviceUnits += r.deviceUnits;
    agg.deviceRevenue += r.deviceRevenue;
    agg.serviceRevenue += r.serviceRevenue;
    agg.totalRevenue += r.totalRevenue;
    agg.weightedRevenue += r.weightedRevenue;
    map.set(r.periodLabel, agg);
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export type Granularity = "quarter" | "half" | "year";

/** Roll quarterly aggregates up to half-year or full-year buckets (Manager toggle, BUILD-SPEC P1). */
export function rollUp(
  quarters: QuarterAggregate[],
  granularity: Granularity
): QuarterAggregate[] {
  if (granularity === "quarter") return quarters;
  const map = new Map<string, QuarterAggregate>();
  for (const q of quarters) {
    const [yearStr, qStr] = q.label.split("-Q");
    const qNum = Number(qStr);
    const bucket =
      granularity === "year"
        ? yearStr
        : `${yearStr}-H${qNum <= 2 ? 1 : 2}`;
    const agg =
      map.get(bucket) ??
      {
        label: bucket,
        deviceUnits: 0,
        deviceRevenue: 0,
        serviceRevenue: 0,
        totalRevenue: 0,
        weightedRevenue: 0,
      };
    agg.deviceUnits += q.deviceUnits;
    agg.deviceRevenue += q.deviceRevenue;
    agg.serviceRevenue += q.serviceRevenue;
    agg.totalRevenue += q.totalRevenue;
    agg.weightedRevenue += q.weightedRevenue;
    map.set(bucket, agg);
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}
