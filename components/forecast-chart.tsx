// Forecast chart (dependency-free SVG). Stacked device + service revenue per quarter, with a
// stage-weighted line on top. Makes the 3-year time-phased forecast legible on a projector.

import type { QuarterAggregate } from "@/lib/forecast";

const eur = (n: number) => "€" + Math.round(n / 1000).toLocaleString("en-IE") + "k";

export function ForecastChart({ quarters }: { quarters: QuarterAggregate[] }) {
  const data = quarters.slice(0, 12);
  if (data.length === 0) return null;

  const W = 760, H = 260, padL = 8, padR = 8, padT = 16, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = Math.max(1, ...data.map((q) => q.totalRevenue));
  const band = plotW / data.length;
  const barW = band * 0.6;
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const xCenter = (i: number) => padL + band * i + band / 2;

  const linePts = data.map((q, i) => `${xCenter(i)},${y(q.weightedRevenue)}`).join(" ");

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--chart-device, #0284c7)" }} /> Device revenue</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--chart-service, #2dd4bf)" }} /> Service revenue</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: "var(--chart-weighted, #f59e0b)" }} /> Stage-weighted</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="3-year quarterly forecast: device and service revenue stacked, with the stage-weighted total as a line.">
        {/* baseline */}
        <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="currentColor" strokeOpacity="0.15" />
        {data.map((q, i) => {
          const x = padL + band * i + (band - barW) / 2;
          const devH = (q.deviceRevenue / max) * plotH;
          const svcH = (q.serviceRevenue / max) * plotH;
          const devY = padT + plotH - devH;
          const svcY = devY - svcH;
          return (
            <g key={q.label}>
              <rect x={x} y={devY} width={barW} height={Math.max(0, devH)} rx="2" style={{ fill: "var(--chart-device, #0284c7)" }} />
              <rect x={x} y={svcY} width={barW} height={Math.max(0, svcH)} rx="2" style={{ fill: "var(--chart-service, #2dd4bf)" }} />
              <text x={x + barW / 2} y={H - 10} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9 }}>
                {q.label.replace("20", "'")}
              </text>
            </g>
          );
        })}
        {/* weighted line */}
        <polyline points={linePts} fill="none" stroke="var(--chart-weighted, #f59e0b)" strokeWidth="2" />
        {data.map((q, i) => (
          <circle key={q.label} cx={xCenter(i)} cy={y(q.weightedRevenue)} r="2.5" style={{ fill: "var(--chart-weighted, #f59e0b)" }} />
        ))}
        {/* max label */}
        <text x={padL} y={padT - 4} className="fill-muted-foreground" style={{ fontSize: 9 }}>{eur(max)}</text>
      </svg>
    </div>
  );
}
