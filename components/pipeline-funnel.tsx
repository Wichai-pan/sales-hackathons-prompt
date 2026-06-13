// Pipeline funnel (dependency-free SVG). The active sales stages top→bottom, bar width ∝ deal count,
// so you see where deals pile up and where they thin out. Contract negotiation is flagged direct-only.

import { DIRECT_STAGES, STAGE_LABEL, STAGE_PROBABILITY } from "@/lib/forecast";
import { formatEUR } from "@/lib/utils";
import type { StagePipelineRow } from "@/lib/reporting";
import type { DealStage } from "@prisma/client";

const ACTIVE: DealStage[] = DIRECT_STAGES.filter((s) => s !== "WON" && s !== "LOST");

export function PipelineFunnel({ rows }: { rows: StagePipelineRow[] }) {
  const by = new Map(rows.map((r) => [r.stage, r]));
  const maxCount = Math.max(1, ...ACTIVE.map((s) => by.get(s)?.count ?? 0));

  const W = 760, rowH = 46, gap = 8, padT = 8;
  const H = padT + ACTIVE.length * (rowH + gap);
  const maxBarW = W * 0.62;
  const minBarW = W * 0.14;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Sales pipeline funnel by stage, bar width proportional to deal count.">
        {ACTIVE.map((stage, i) => {
          const r = by.get(stage);
          const count = r?.count ?? 0;
          const weighted = r?.weightedRevenue ?? 0;
          const w = minBarW + (maxBarW - minBarW) * (count / maxCount);
          const x = (W - w) / 2;
          const y = padT + i * (rowH + gap);
          // later stages = higher win-signal = stronger fill opacity
          const opacity = 0.25 + 0.6 * (STAGE_PROBABILITY[stage] / 100);
          return (
            <g key={stage}>
              <rect x={x} y={y} width={w} height={rowH} rx="6" style={{ fill: "var(--chart-funnel, #4f46e5)", fillOpacity: opacity }} />
              <text x={W / 2} y={y + 19} textAnchor="middle" className="fill-white" style={{ fontSize: 12, fontWeight: 500 }}>
                {STAGE_LABEL[stage]}{stage === "CONTRACT_NEGOTIATION" ? "  ·  direct only" : ""}
              </text>
              <text x={W / 2} y={y + 35} textAnchor="middle" className="fill-white" style={{ fontSize: 10, fillOpacity: 0.9 }}>
                {count} {count === 1 ? "deal" : "deals"} · {formatEUR(weighted)} weighted
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-xs text-muted-foreground">Reseller deals skip Contract negotiation — Customer test goes straight to Won/Lost.</p>
    </div>
  );
}
