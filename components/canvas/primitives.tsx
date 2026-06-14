import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/canvas/utils";

/* ----------------------------- GlassCard ----------------------------- */
export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cn("glass-card p-5", className)}>{children}</div>;
}

/* ------------------------------ SparkLine ----------------------------- */
export function SparkLine({ data, className = "" }: { data: number[]; className?: string }) {
  const w = 120, h = 36, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / Math.max(data.length - 1, 1);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.68 0.2 280)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="oklch(0.68 0.2 280)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke="oklch(0.78 0.18 280)" strokeWidth="1.5" strokeLinecap="round" />
      <polygon points={`${pad},${h - pad} ${pts} ${w - pad},${h - pad}`} fill="url(#sg)" />
    </svg>
  );
}

/* ------------------------------- KpiTile ------------------------------ */
export interface KpiTileProps {
  label: string;
  value: string;
  delta?: number;
  trend?: number[];
}
export function KpiTile({ label, value, delta = 0, trend = [] }: KpiTileProps) {
  const up = delta >= 0;
  return (
    <div className="glass-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-end justify-between">
        <div className="font-display text-3xl font-semibold tnum">{value}</div>
        {trend.length > 1 && <SparkLine data={trend} />}
      </div>
      {delta !== 0 && (
        <div className={cn("mt-2 inline-flex items-center gap-1 text-xs", up ? "text-success" : "text-destructive")}>
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {up ? "+" : ""}{delta.toFixed(1)}% vs last period
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Avatar ------------------------------- */
export function Avatar({ initials, hue = 280, size = 28 }: { initials: string; hue?: number; size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, oklch(0.65 0.18 ${hue}), oklch(0.55 0.22 ${(hue + 40) % 360}))`,
      }}
    >
      {initials}
    </div>
  );
}

export function AvatarStack({ items }: { items: { initials: string; hue?: number }[] }) {
  return (
    <div className="flex -space-x-2">
      {items.map((a, i) => (
        <div key={i} className="ring-2 ring-card rounded-full">
          <Avatar {...a} size={24} />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ HealthRing ---------------------------- */
export function HealthRing({ value, size = 56 }: { value: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  const color =
    value >= 80 ? "oklch(var(--success))" : value >= 60 ? "oklch(var(--warning))" : "oklch(var(--destructive))";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="oklch(var(--border))" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center font-display text-sm font-semibold tnum">{value}</div>
    </div>
  );
}

/* ------------------------------- AIChip ------------------------------- */
export function AIChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-accent/50 px-2 py-0.5 text-[11px] font-medium ai-gradient-text">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inset-0 rounded-full bg-primary-glow ai-pulse" />
      </span>
      {children}
    </span>
  );
}

/* ---------------------------- SectionHeader --------------------------- */
export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
