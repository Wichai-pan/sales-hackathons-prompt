// New deal page (Owner / SA-O2). Reached from the account page / rep dashboard.

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { DealForm } from "@/components/deal-form";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string }>;
}) {
  const { accountId } = await searchParams;
  if (!accountId) notFound();
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href={`/accounts/${account.id}`} className="text-sm text-muted-foreground hover:underline">
        ← {account.name}
      </Link>
      <h1 className="mt-1 mb-6 text-2xl font-semibold">New deal</h1>
      <DealForm accountId={account.id} accountName={account.name} />
    </main>
  );
}
