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
import {
  CatalogScreen,
  type CatalogScreenData,
} from "@/components/canvas/screens/CatalogScreen";
import type {
  Product as CanvasProduct,
  Service as CanvasService,
} from "@/lib/canvas/types";
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

// Prisma stores gmPercent as a fraction 0..1; the canvas Product/Service type
// expects a 0..100 percent (screen renders gmPercent.toFixed(1)%).
function toCanvasProduct(p: PrismaProduct): CanvasProduct {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    unitPrice: p.unitPrice,
    gmPercent: p.gmPercent * 100,
    currency: p.currency,
    status: p.status,
  };
}

function toCanvasService(s: PrismaService): CanvasService {
  return {
    id: s.id,
    name: s.name,
    providerType: s.providerType,
    invoicingModel: s.invoicingModel,
    basePrice: s.basePrice,
    gmPercent: s.gmPercent * 100,
    currency: s.currency,
    status: s.status,
  };
}

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

  // Read-only presentation (tables + inline Add forms) goes through the canvas screen.
  // createProduct/createService already match the ServerAction (FormData)=>void slot
  // shape, so they wire directly; the screen's extra gmPercent/status inputs are
  // harmlessly ignored by our actions (gmPercent defaults in Prisma).
  const screenData: CatalogScreenData = {
    products: visibleProducts.map(toCanvasProduct),
    services: visibleServices.map(toCanvasService),
    saveProductAction: createProduct,
    saveServiceAction: createService,
  };

  return (
    <main>
      <CatalogScreen data={screenData} />

      {/* ---------- KEPT wired forms (no canvas slot): toggle + edit/retire/reactivate ---------- */}
      <div className="p-6 lg:p-8 pt-0 space-y-6">
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
