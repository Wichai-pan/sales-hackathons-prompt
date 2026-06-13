// P2 #22 — AI case summary card. Render only for cases with >= MIN_NOTES_FOR_SUMMARY notes.
// Wrap in <Suspense> on the case page so the AI call doesn't block first paint.

import { caseSummary } from "@/lib/ai/case-summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function CaseSummarySkeleton() {
  return (
    <Card className="border-primary/40">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Case summary</CardTitle>
        <Badge variant="secondary">AI</Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

export async function CaseSummaryCard({
  title,
  description,
  notes,
}: {
  title: string;
  description?: string | null;
  notes: string[];
}) {
  const { text, source } = await caseSummary({ title, description, notes });
  return (
    <Card className="border-primary/40">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Case summary</CardTitle>
        <Badge variant="secondary">{source === "ai" ? "AI" : "AI · rules"}</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed">{text}</p>
      </CardContent>
    </Card>
  );
}
