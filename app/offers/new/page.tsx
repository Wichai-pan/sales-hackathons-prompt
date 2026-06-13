// Build-offer page (Owner / SA-O3). Loads active catalog + the account/deal context.

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { OfferBuilder } from "@/components/offer-builder";

const INVOICING_LABEL: Record<string, string> = {
  ONE_OFF: "one-off",
  FIXED_TERM: "fixed-term",
  MONTHLY_RECURRING: "monthly recurring",
};

export default async function NewOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string; dealId?: string; error?: string }>;
}) {
  const { accountId, dealId, error } = await searchParams;
  if (!accountId) notFound();

  const [account, deal, products, services] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId } }),
    dealId ? prisma.deal.findUnique({ where: { id: dealId } }) : Promise.resolve(null),
    prisma.product.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.service.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);
  if (!account) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href={`/accounts/${account.id}`} className="text-sm text-muted-foreground hover:underline">
        ← {account.name}
      </Link>
      <h1 className="mt-1 mb-6 text-2xl font-semibold">Build offer</h1>
      <OfferBuilder
        accountId={account.id}
        dealId={deal?.id}
        dealName={deal?.name}
        error={error}
        products={products.map((p) => ({ id: p.id, name: p.name, price: p.unitPrice, meta: p.category }))}
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          price: s.basePrice,
          meta: `${s.providerType === "THIRD_PARTY" ? "3rd-party" : "internal"} · ${INVOICING_LABEL[s.invoicingModel] ?? s.invoicingModel}`,
        }))}
      />
    </main>
  );
}
