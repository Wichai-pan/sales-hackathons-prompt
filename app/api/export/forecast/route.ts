// P2 #19 — CSV export of the 3-year time-phased forecast (Finance). Device vs service kept separate.
import { threeYearForecast } from "@/lib/reporting";

export async function GET() {
  const { quarters, totals } = await threeYearForecast();
  const header = "quarter,device_units,device_revenue,service_revenue,total_revenue,weighted_revenue";
  const rows = quarters.map((q) =>
    [q.label, q.deviceUnits, q.deviceRevenue, q.serviceRevenue, q.totalRevenue, q.weightedRevenue].join(","),
  );
  const totalRow = ["TOTAL", totals.deviceUnits, totals.deviceRevenue, totals.serviceRevenue, totals.totalRevenue, totals.weightedRevenue].join(",");
  const csv = [header, ...rows, totalRow].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="hmd-forecast.csv"',
    },
  });
}
