// Catalog query helpers (SLICE SA-V1, Finance-owned).
// The offer builder (Owner) MUST reuse activeProducts()/activeServices() so RETIRED
// items never appear in NEW offers, while the catalog "all" view and historical
// offer snapshots keep retired items visible (BUILD-SPEC: retire ≠ hard-delete).

import type { Product, Service } from "@prisma/client";
import { prisma } from "./db";

/** ACTIVE products only — the source of truth for NEW offer line items. */
export function activeProducts(): Promise<Product[]> {
  return prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

/** ACTIVE services only — the source of truth for NEW offer line items. */
export function activeServices(): Promise<Service[]> {
  return prisma.service.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
  });
}

/** Every product (ACTIVE + RETIRED) — the catalog management "all" view. */
export function allProducts(): Promise<Product[]> {
  return prisma.product.findMany({
    orderBy: [{ status: "asc" }, { category: "asc" }, { name: "asc" }],
  });
}

/** Every service (ACTIVE + RETIRED) — the catalog management "all" view. */
export function allServices(): Promise<Service[]> {
  return prisma.service.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}
