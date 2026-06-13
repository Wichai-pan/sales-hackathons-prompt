// Catalog management (SLICE SA-V1, Finance-owned). Route: /catalog.
// Finance can Add / Edit / Retire / Reactivate products & services WITHOUT a developer.
// RETIRE sets status=RETIRED (never hard-delete): retired items are hidden from NEW
// offers (see lib/catalog.ts activeProducts/activeServices) but stay visible here and
// in historical offer snapshots. The "Show retired" toggle reveals retired rows.

import Link from "next/link";
import { redirect } from "next/navigation";
import type {
  InvoicingModel,
  Product,
  ProviderType,
  Service,
} from "@prisma/client";
import { currentRole } from "@/lib/session";
import { allProducts, allServices } from "@/lib/catalog";
import { formatEUR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
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

function StatusBadge({ status }: { status: Product["status"] }) {
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
    <main className="space-y-6">
      <section className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Finance-owned products &amp; services. Retiring an item hides it from new
            offers but keeps it in historical offers and this view.
          </p>
        </div>
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

      {/* ----------------------------- Products ----------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>
            Products ({visibleProducts.length}
            {showRetired ? "" : ` active`})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Name</TH>
                <TH>Category</TH>
                <TH>Unit price</TH>
                <TH className="text-right">GM %</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {visibleProducts.length === 0 && (
                <TR>
                  <TD className="text-muted-foreground" colSpan={7}>
                    No products to show.
                  </TD>
                </TR>
              )}
              {visibleProducts.map((p) => (
                <ProductRow key={p.id} product={p} />
              ))}
            </TBody>
          </Table>

          {/* Add product */}
          <form
            action={createProduct}
            className="grid grid-cols-1 items-end gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-6"
          >
            <div className="sm:col-span-1">
              <label className="mb-1 block text-[11px] text-muted-foreground">SKU</label>
              <input name="sku" required className={inputCls} placeholder="HMD-XXX" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] text-muted-foreground">Name</label>
              <input name="name" required className={inputCls} placeholder="Device / accessory" />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-[11px] text-muted-foreground">Category</label>
              <input name="category" required className={inputCls} placeholder="Handset" />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-[11px] text-muted-foreground">Unit price</label>
              <input
                name="unitPrice"
                type="number"
                step="0.01"
                min="0"
                required
                className={inputCls}
                placeholder="0"
              />
            </div>
            <div className="sm:col-span-1 flex gap-2">
              <input name="currency" defaultValue="EUR" className={`${inputCls} w-16`} />
              <Button type="submit" size="sm" className="whitespace-nowrap">
                Add product
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ----------------------------- Services ----------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>
            Services ({visibleServices.length}
            {showRetired ? "" : ` active`})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Provider</TH>
                <TH>Invoicing</TH>
                <TH>Base price</TH>
                <TH className="text-right">GM %</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {visibleServices.length === 0 && (
                <TR>
                  <TD className="text-muted-foreground" colSpan={7}>
                    No services to show.
                  </TD>
                </TR>
              )}
              {visibleServices.map((s) => (
                <ServiceRow key={s.id} service={s} />
              ))}
            </TBody>
          </Table>

          {/* Add service */}
          <form
            action={createService}
            className="grid grid-cols-1 items-end gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-6"
          >
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] text-muted-foreground">Name</label>
              <input name="name" required className={inputCls} placeholder="Managed service" />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-[11px] text-muted-foreground">Provider</label>
              <select name="providerType" className={inputCls} defaultValue="INTERNAL">
                <option value="INTERNAL">Internal</option>
                <option value="THIRD_PARTY">3rd-party</option>
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-[11px] text-muted-foreground">Invoicing</label>
              <select name="invoicingModel" className={inputCls} defaultValue="ONE_OFF">
                <option value="ONE_OFF">One-off</option>
                <option value="FIXED_TERM">Fixed term</option>
                <option value="MONTHLY_RECURRING">Monthly recurring</option>
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-[11px] text-muted-foreground">Base price</label>
              <input
                name="basePrice"
                type="number"
                step="0.01"
                min="0"
                required
                className={inputCls}
                placeholder="0"
              />
            </div>
            <div className="sm:col-span-1 flex gap-2">
              <input name="currency" defaultValue="EUR" className={`${inputCls} w-16`} />
              <Button type="submit" size="sm" className="whitespace-nowrap">
                Add service
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

// ----------------------------- Product row -----------------------------

function ProductRow({ product: p }: { product: Product }) {
  const retired = p.status === "RETIRED";
  return (
    <TR className={retired ? "opacity-60" : undefined}>
      <TD className="text-muted-foreground">{p.sku}</TD>
      <TD className="min-w-[10rem]">
        <input
          form={`prod-${p.id}`}
          name="name"
          defaultValue={p.name}
          className={inputCls}
        />
      </TD>
      <TD className="min-w-[8rem]">
        <input
          form={`prod-${p.id}`}
          name="category"
          defaultValue={p.category}
          className={inputCls}
        />
      </TD>
      <TD>
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
          <input
            form={`prod-${p.id}`}
            name="currency"
            defaultValue={p.currency}
            className={`${inputCls} w-14`}
          />
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {formatEUR(p.unitPrice, p.currency)}
        </div>
      </TD>
      <TD className="text-right tabular-nums text-muted-foreground">
        {Math.round(p.gmPercent * 100)}%
      </TD>
      <TD>
        <StatusBadge status={p.status} />
      </TD>
      <TD>
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
      </TD>
    </TR>
  );
}

// ----------------------------- Service row -----------------------------

function ServiceRow({ service: s }: { service: Service }) {
  const retired = s.status === "RETIRED";
  return (
    <TR className={retired ? "opacity-60" : undefined}>
      <TD className="min-w-[10rem]">
        <input
          form={`svc-${s.id}`}
          name="name"
          defaultValue={s.name}
          className={inputCls}
        />
      </TD>
      <TD className="min-w-[8rem]">
        <select
          form={`svc-${s.id}`}
          name="providerType"
          defaultValue={s.providerType}
          className={inputCls}
        >
          <option value="INTERNAL">{PROVIDER_LABEL.INTERNAL}</option>
          <option value="THIRD_PARTY">{PROVIDER_LABEL.THIRD_PARTY}</option>
        </select>
      </TD>
      <TD className="min-w-[9rem]">
        <select
          form={`svc-${s.id}`}
          name="invoicingModel"
          defaultValue={s.invoicingModel}
          className={inputCls}
        >
          <option value="ONE_OFF">{INVOICING_LABEL.ONE_OFF}</option>
          <option value="FIXED_TERM">{INVOICING_LABEL.FIXED_TERM}</option>
          <option value="MONTHLY_RECURRING">{INVOICING_LABEL.MONTHLY_RECURRING}</option>
        </select>
      </TD>
      <TD>
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
          <input
            form={`svc-${s.id}`}
            name="currency"
            defaultValue={s.currency}
            className={`${inputCls} w-14`}
          />
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {formatEUR(s.basePrice, s.currency)}
        </div>
      </TD>
      <TD className="text-right tabular-nums text-muted-foreground">
        {Math.round(s.gmPercent * 100)}%
      </TD>
      <TD>
        <StatusBadge status={s.status} />
      </TD>
      <TD>
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
      </TD>
    </TR>
  );
}
