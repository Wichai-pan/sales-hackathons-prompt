import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { GlassCard, SectionHeader } from "@/components/canvas/primitives";
import { Badge } from "@/components/canvas/ui/badge";

export interface SavedView {
  id: string;
  name: string;
  entity: "deals" | "accounts" | "cases" | "offers" | "contacts";
  ownerName?: string;
  shared?: boolean;
  filterSummary?: string;
}

export interface ViewsScreenData {
  views: SavedView[];
}

export function ViewsScreen({ data }: { data: ViewsScreenData }) {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <SectionHeader
        title="Saved views"
        subtitle="Filtered lists you can share with the team"
        action={
          <Link href="/views/new" className="inline-flex items-center gap-1.5 rounded-lg ai-gradient px-3 py-1.5 text-xs font-medium text-white">
            <Plus className="h-3.5 w-3.5" /> New view
          </Link>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data.views.map((v) => (
          <Link key={v.id} href={`/views?view=${v.id}`}>
            <GlassCard className="transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elegant">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary-glow" /><span className="font-medium">{v.name}</span></div>
                <Badge variant="outline">{v.entity}</Badge>
              </div>
              {v.filterSummary && <div className="mt-2 text-xs text-muted-foreground">{v.filterSummary}</div>}
              <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{v.ownerName ?? "—"}</span>
                {v.shared && <Badge variant="info">Shared</Badge>}
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
