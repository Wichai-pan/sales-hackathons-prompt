// Catalog management (SLICE SA-V1, Finance-owned). Route: /catalog.
// Now rendered through the canvas CatalogScreen for the read-only product/service
// tables + the inline "Add" forms. The screen has NO slots for edit / retire /
// reactivate / show-retired, so those wired forms are KEPT below the screen
// (restyled with canvas classes) — functionality is never dropped.
//
// Finance can Add / Edit / Retire / Reactivate products & services WITHOUT a developer.
// RETIRE sets status=RETIRED (never hard-delete): retired items are hidden from NEW
// offers (see lib/catalog.ts activeProducts/activeServices) but stay visible here and
// in historical offer snapshots. The "Show retired" toggle reveals retired rows.

import Link from "next/link";
import { redirect } from "next/navigation";
import type {
  InvoicingModel,
  Product as PrismaProduct,
  ProviderType,
  Service as PrismaService,
} from "@prisma/client";
import { currentRole } from "@/lib/session";
import { allProducts, allServices } from "@/lib/catalog";
import { formatEUR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/canvas/primitives";
import {
  createProduct,
  createService,
  reactivateProduct,
  reactivateService,
  retireProduct,
  retireService,
  updateProduct,
  updateService,
} from "./actions";

export const dynamic = "force-dynamic";

const PROVIDER_LABEL: Record<ProviderType, string> = {
  INTERNAL: "Internal",
  THIRD_PARTY: "3rd-party",
};

const INVOICING_LABEL: Record<InvoicingModel, string> = {
  ONE_OFF: "One-off",
  FIXED_TERM: "Fixed term",
  MONTHLY_RECURRING: "Monthly recurring",
};

const inputCls =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function StatusBadge({ status }: { status: PrismaProduct["status"] }) {
  return status === "RETIRED" ? (
    <Badge variant="outline">Retired</Badge>
  ) : (
    <Badge variant="success">Active</Badge>
  );
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ retired?: string }>;
}) {
  const role = await currentRole();
  if (role !== "FINANCE") {
    redirect("/role-switch");
  }

  const params = await searchParams;
  const showRetired = params.retired === "1";

  const [products, services] = await Promise.all([allProducts(), allServices()]);

  const visibleProducts = showRetired
    ? products
    : products.filter((p) => p.status === "ACTIVE");
  const visibleServices = showRetired
    ? services
    : services.filter((s) => s.status === "ACTIVE");

  const retiredProductCount = products.filter((p) => p.status === "RETIRED").length;
  const retiredServiceCount = services.filter((s) => s.status === "RETIRED").length;

  return (
    <main>
      {/* Single source of truth: one editable Products table + one Services table, each
          with an inline Add row. (Previously the read-only CatalogScreen tables were
          rendered ABOVE these, duplicating every product/service — removed.) */}
      <div className="p-6 lg:p-8 space-y-6">
        <SectionHeader title="Catalog" subtitle="Products & services available to quote — Finance-managed" />

        <section className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Finance-owned management — retiring an item hides it from new offers but
            keeps it in historical offers and this view.
          </p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              {retiredProductCount + retiredServiceCount} retired
            </span>
            <Link href={showRetired ? "/catalog" : "/catalog?retired=1"}>
              <Button variant={showRetired ? "secondary" : "outline"} size="sm">
                {showRetired ? "Hide retired" : "Show retired"}
              </Button>
            </Link>
          </div>
        </section>

        {/* ----------------------------- Products: edit / retire / reactivate ----------------------------- */}
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-5 py-3 font-medium text-sm">
            Manage products ({visibleProducts.length}
            {showRetired ? "" : " active"})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-2.5 text-left font-medium">SKU</th>
                  <th className="px-4 py-2.5 text-left font-medium">Name</th>
                  <th className="px-4 py-2.5 text-left font-medium">Category</th>
                  <th className="px-4 py-2.5 text-left font-medium">Unit price</th>
                  <th className="px-4 py-2.5 text-right font-medium">GM %</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.length === 0 && (
                  <tr>
                    <td className="px-5 py-3 text-muted-foreground" colSpan={7}>
                      No products to show.
                    </td>
                  </tr>
                )}
                {visibleProducts.map((p) => (
                  <ProductRow key={p.id} product={p} />
                ))}
                <tr className="bg-secondary/20">
                  <td colSpan={7} className="px-5 py-3">
                    <form action={createProduct} className="flex flex-wrap items-end gap-2">
                      <input name="sku" placeholder="SKU" required className={`${inputCls} w-28`} />
                      <input name="name" placeholder="Name" required className={`${inputCls} flex-1 min-w-[8rem]`} />
                      <input name="category" placeholder="Category" required className={`${inputCls} w-32`} />
                      <input name="unitPrice" type="number" min="0" step="0.01" placeholder="Price" required className={`${inputCls} w-24`} />
                      <input name="currency" defaultValue="EUR" className={`${inputCls} w-16`} />
                      <Button type="submit" size="sm">Add product</Button>
                    </form>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ----------------------------- Services: edit / retire / reactivate ----------------------------- */}
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-5 py-3 font-medium text-sm">
            Manage services ({visibleServices.length}
            {showRetired ? "" : " active"})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-2.5 text-left font-medium">Name</th>
                  <th className="px-4 py-2.5 text-left font-medium">Provider</th>
                  <th className="px-4 py-2.5 text-left font-medium">Invoicing</th>
                  <th className="px-4 py-2.5 text-left font-medium">Base price</th>
                  <th className="px-4 py-2.5 text-right font-medium">GM %</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleServices.length === 0 && (
                  <tr>
                    <td className="px-5 py-3 text-muted-foreground" colSpan={7}>
                      No services to show.
                    </td>
                  </tr>
                )}
                {visibleServices.map((s) => (
                  <ServiceRow key={s.id} service={s} />
                ))}
                <tr className="bg-secondary/20">
                  <td colSpan={7} className="px-5 py-3">
                    <form action={createService} className="flex flex-wrap items-end gap-2">
                      <input name="name" placeholder="Name" required className={`${inputCls} flex-1 min-w-[8rem]`} />
                      <select name="providerType" defaultValue="INTERNAL" className={`${inputCls} w-32`}>
                        <option value="INTERNAL">Internal</option>
                        <option value="THIRD_PARTY">3rd-party</option>
                      </select>
                      <select name="invoicingModel" defaultValue="ONE_OFF" className={`${inputCls} w-40`}>
                        <option value="ONE_OFF">One-off</option>
                        <option value="FIXED_TERM">Fixed term</option>
                        <option value="MONTHLY_RECURRING">Monthly recurring</option>
                      </select>
                      <input name="basePrice" type="number" min="0" step="0.01" placeholder="Price" required className={`${inputCls} w-24`} />
                      <input name="currency" defaultValue="EUR" className={`${inputCls} w-16`} />
                      <Button type="submit" size="sm">Add service</Button>
                    </form>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

// ----------------------------- Product row -----------------------------

function ProductRow({ product: p }: { product: PrismaProduct }) {
  const retired = p.status === "RETIRED";
  return (
    <tr className={`border-b border-border/60 last:border-0 ${retired ? "opacity-60" : ""}`}>
      <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">{p.sku}</td>
      <td className="px-4 py-2.5 min-w-[10rem]">
        <input form={`prod-${p.id}`} name="name" defaultValue={p.name} className={inputCls} />
      </td>
      <td className="px-4 py-2.5 min-w-[8rem]">
        <input form={`prod-${p.id}`} name="category" defaultValue={p.category} className={inputCls} />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1">
          <input
            form={`prod-${p.id}`}
            name="unitPrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={p.unitPrice}
            className={`${inputCls} w-24`}
          />
          <input form={`prod-${p.id}`} name="currency" defaultValue={p.currency} className={`${inputCls} w-14`} />
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {formatEUR(p.unitPrice, p.currency)}
        </div>
      </td>
      <td className="px-4 py-2.5 text-right tnum text-muted-foreground">
        {Math.round(p.gmPercent * 100)}%
      </td>
      <td className="px-4 py-2.5">
        <StatusBadge status={p.status} />
      </td>
      <td className="px-5 py-2.5">
        <div className="flex items-center justify-end gap-2">
          {/* Edit form (hidden id + the named inputs above via form attr) */}
          <form id={`prod-${p.id}`} action={updateProduct}>
            <input type="hidden" name="id" value={p.id} />
            <Button type="submit" size="sm" variant="outline">
              Save
            </Button>
          </form>
          {retired ? (
            <form action={reactivateProduct}>
              <input type="hidden" name="id" value={p.id} />
              <Button type="submit" size="sm" variant="secondary">
                Reactivate
              </Button>
            </form>
          ) : (
            <form action={retireProduct}>
              <input type="hidden" name="id" value={p.id} />
              <Button type="submit" size="sm" variant="destructive">
                Retire
              </Button>
            </form>
          )}
        </div>
      </td>
    </tr>
  );
}

// ----------------------------- Service row -----------------------------

function ServiceRow({ service: s }: { service: PrismaService }) {
  const retired = s.status === "RETIRED";
  return (
    <tr className={`border-b border-border/60 last:border-0 ${retired ? "opacity-60" : ""}`}>
      <td className="px-5 py-2.5 min-w-[10rem]">
        <input form={`svc-${s.id}`} name="name" defaultValue={s.name} className={inputCls} />
      </td>
      <td className="px-4 py-2.5 min-w-[8rem]">
        <select form={`svc-${s.id}`} name="providerType" defaultValue={s.providerType} className={inputCls}>
          <option value="INTERNAL">{PROVIDER_LABEL.INTERNAL}</option>
          <option value="THIRD_PARTY">{PROVIDER_LABEL.THIRD_PARTY}</option>
        </select>
      </td>
      <td className="px-4 py-2.5 min-w-[9rem]">
        <select form={`svc-${s.id}`} name="invoicingModel" defaultValue={s.invoicingModel} className={inputCls}>
          <option value="ONE_OFF">{INVOICING_LABEL.ONE_OFF}</option>
          <option value="FIXED_TERM">{INVOICING_LABEL.FIXED_TERM}</option>
          <option value="MONTHLY_RECURRING">{INVOICING_LABEL.MONTHLY_RECURRING}</option>
        </select>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1">
          <input
            form={`svc-${s.id}`}
            name="basePrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={s.basePrice}
            className={`${inputCls} w-24`}
          />
          <input form={`svc-${s.id}`} name="currency" defaultValue={s.currency} className={`${inputCls} w-14`} />
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {formatEUR(s.basePrice, s.currency)}
        </div>
      </td>
      <td className="px-4 py-2.5 text-right tnum text-muted-foreground">
        {Math.round(s.gmPercent * 100)}%
      </td>
      <td className="px-4 py-2.5">
        <StatusBadge status={s.status} />
      </td>
      <td className="px-5 py-2.5">
        <div className="flex items-center justify-end gap-2">
          <form id={`svc-${s.id}`} action={updateService}>
            <input type="hidden" name="id" value={s.id} />
            <Button type="submit" size="sm" variant="outline">
              Save
            </Button>
          </form>
          {retired ? (
            <form action={reactivateService}>
              <input type="hidden" name="id" value={s.id} />
              <Button type="submit" size="sm" variant="secondary">
                Reactivate
              </Button>
            </form>
          ) : (
            <form action={retireService}>
              <input type="hidden" name="id" value={s.id} />
              <Button type="submit" size="sm" variant="destructive">
                Retire
              </Button>
            </form>
          )}
        </div>
      </td>
    </tr>
  );
}
