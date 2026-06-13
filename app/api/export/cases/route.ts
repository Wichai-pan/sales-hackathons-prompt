// P2 #19 — CSV export of all cases (Finance / ops). One row per case with account, service, TAM.
import { prisma } from "@/lib/db";

function esc(v: unknown): string {
  return '"' + String(v ?? "").replace(/"/g, '""') + '"';
}

export async function GET() {
  const cases = await prisma.case.findMany({
    include: { account: true, service: true, assignedTam: true },
    orderBy: { createdAt: "desc" },
  });
  const header = "title,account,status,priority,service,tam,created,closed";
  const rows = cases.map((c) =>
    [
      c.title,
      c.account.name,
      c.status,
      c.priority,
      c.service?.name ?? "",
      c.assignedTam?.name ?? "",
      c.createdAt.toISOString().slice(0, 10),
      c.closedAt ? c.closedAt.toISOString().slice(0, 10) : "",
    ]
      .map(esc)
      .join(","),
  );
  const csv = [header, ...rows].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="hmd-cases.csv"',
    },
  });
}
