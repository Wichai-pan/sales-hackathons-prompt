import { Download } from "lucide-react";
import { GlassCard, SectionHeader, SparkLine } from "@/components/canvas/primitives";

export interface ReportItem {
  id: string;
  title: string;
  description?: string;
  trend?: number[];
  /** href for export/download. */
  exportHref?: string;
}

export interface ReportsScreenData {
  reports: ReportItem[];
}

export function ReportsScreen({ data }: { data: ReportsScreenData }) {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <SectionHeader title="Reports" subtitle="Pre-built reports you can export" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data.reports.map((r) => (
          <GlassCard key={r.id} className="flex flex-col gap-3">
            <div>
              <div className="font-medium">{r.title}</div>
              {r.description && <div className="mt-1 text-xs text-muted-foreground">{r.description}</div>}
            </div>
            {r.trend && r.trend.length > 1 && <SparkLine data={r.trend} className="self-start" />}
            <div className="mt-auto flex items-center justify-end">
              {r.exportHref && (
                <a href={r.exportHref} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary">
                  <Download className="h-3 w-3" /> CSV
                </a>
              )}
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
