// P2 #23 — AI forecast narrative card for Finance / Manager. Gathers the aggregated forecast +
// risk counts and renders a 2-3 sentence health summary. Wrap in <Suspense> so the page paints first.

import { threeYearForecast, stalledDeals, pastCloseDeals } from "@/lib/reporting";
import { forecastNarrative } from "@/lib/ai/forecast-narrative";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ForecastNarrativeSkeleton() {
  return (
    <Card className="border-primary/40">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Pipeline health</CardTitle>
        <Badge variant="secondary">AI</Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
          <div className="h-3 w-4/6 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

export async function ForecastNarrativeCard() {
  const [forecast, stalled, pastClose] = await Promise.all([
    threeYearForecast(),
    stalledDeals(),
    pastCloseDeals(),
  ]);
  const nearTermWeighted = forecast.quarters.slice(0, 2).reduce((s, q) => s + q.weightedRevenue, 0);

  const { text, source } = await forecastNarrative({
    weightedTotal: forecast.totals.weightedRevenue,
    totalRevenue: forecast.totals.totalRevenue,
    deviceRevenue: forecast.totals.deviceRevenue,
    serviceRevenue: forecast.totals.serviceRevenue,
    nearTermWeighted,
    quartersCount: forecast.quarters.length,
    stalledCount: stalled.length,
    pastCloseCount: pastClose.length,
  });

  return (
    <Card className="border-primary/40">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Pipeline health</CardTitle>
        <Badge variant="secondary">{source === "ai" ? "AI" : "AI · rules"}</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed">{text}</p>
      </CardContent>
    </Card>
  );
}
