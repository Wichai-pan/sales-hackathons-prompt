// New service case (Rep persona #5 — open a case from inside an account).
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { createCase } from "@/app/cases/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string }>;
}) {
  const { accountId } = await searchParams;
  if (!accountId) notFound();
  const [account, services] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId }, include: { assignedTam: true } }),
    prisma.service.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);
  if (!account) notFound();

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href={`/accounts/${account.id}`} className="text-sm text-muted-foreground hover:underline">
        ← {account.name}
      </Link>
      <h1 className="mt-1 mb-6 text-2xl font-semibold">Open a service case</h1>
      <form action={createCase}>
        <input type="hidden" name="accountId" value={account.id} />
        <Card>
          <CardHeader><CardTitle>New case · {account.name}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <input name="title" required placeholder="e.g. Devices failing MDM check-in" className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea name="description" rows={3} placeholder="What's happening?" className={inputCls} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Priority</label>
                <select name="priority" defaultValue="MEDIUM" className={inputCls}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Linked service</label>
                <select name="serviceId" defaultValue="" className={inputCls}>
                  <option value="">— none —</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Will be assigned to {account.assignedTam?.name ?? "the account TAM"} with an SLA due date from priority.
            </p>
            <div className="flex justify-end">
              <Button type="submit">Open case</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </main>
  );
}
