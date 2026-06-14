import { Search } from "lucide-react";
import Link from "next/link";
import { SectionHeader, Avatar } from "@/components/canvas/primitives";
import { Badge } from "@/components/canvas/ui/badge";
import { initials } from "@/lib/canvas/format";

export type SearchHit =
  | { kind: "account"; id: string; name: string; subtitle?: string }
  | { kind: "deal"; id: string; name: string; subtitle?: string }
  | { kind: "case"; id: string; name: string; subtitle?: string }
  | { kind: "contact"; id: string; name: string; subtitle?: string }
  | { kind: "offer"; id: string; name: string; subtitle?: string };

export interface SearchScreenData {
  query: string;
  hits: SearchHit[];
}

const hrefForHit = (h: SearchHit) =>
  h.kind === "case" ? `/cases/${h.id}` : h.kind === "contact" ? `/accounts/${h.id}` : `/${h.kind}s/${h.id}`;

export function SearchScreen({ data }: { data: SearchScreenData }) {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <SectionHeader title="Search" subtitle={data.query ? `${data.hits.length} results for "${data.query}"` : "Search across the CRM"} />
      <form action="/search" method="get" className="relative max-w-2xl">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input
          name="q"
          defaultValue={data.query}
          autoFocus
          placeholder="Search accounts, deals, cases, contacts, offers…"
          className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm focus:border-primary focus:outline-none"
        />
      </form>

      <div className="glass-card p-0">
        <ul className="divide-y divide-border">
          {data.hits.map((h) => (
            <li key={`${h.kind}-${h.id}`}>
              <Link href={hrefForHit(h)} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30">
                <Avatar initials={initials(h.name)} hue={(h.id.length * 37) % 360} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{h.name}</div>
                  {h.subtitle && <div className="text-xs text-muted-foreground">{h.subtitle}</div>}
                </div>
                <Badge variant="outline">{h.kind}</Badge>
              </Link>
            </li>
          ))}
          {data.hits.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-muted-foreground">No results.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
