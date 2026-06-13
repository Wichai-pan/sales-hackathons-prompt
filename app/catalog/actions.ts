"use server";

// Catalog mutations (SLICE SA-V1, Finance-owned).
// Each mutation: prisma write -> createActivityEvent -> revalidatePath("/catalog").
// RETIRE sets status=RETIRED (never hard-delete) so historical offer snapshots and
// the catalog "all/retired" view keep showing the item.

import { revalidatePath } from "next/cache";
import type { InvoicingModel, ProviderType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { createActivityEvent } from "@/lib/activity";
import { formatEUR } from "@/lib/utils";

// ----------------------------- helpers -----------------------------

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string): number {
  return Number(formData.get(key) ?? 0);
}

const PROVIDER_TYPES: ProviderType[] = ["INTERNAL", "THIRD_PARTY"];
const INVOICING_MODELS: InvoicingModel[] = [
  "ONE_OFF",
  "FIXED_TERM",
  "MONTHLY_RECURRING",
];

function parseProviderType(value: string): ProviderType {
  return PROVIDER_TYPES.includes(value as ProviderType)
    ? (value as ProviderType)
    : "INTERNAL";
}

function parseInvoicingModel(value: string): InvoicingModel {
  return INVOICING_MODELS.includes(value as InvoicingModel)
    ? (value as InvoicingModel)
    : "ONE_OFF";
}

// ----------------------------- products -----------------------------

export async function createProduct(formData: FormData): Promise<void> {
  const actor = await currentUser();

  const sku = str(formData, "sku");
  const name = str(formData, "name");
  const category = str(formData, "category");
  const unitPrice = num(formData, "unitPrice");
  const currency = str(formData, "currency") || "EUR";

  if (!sku || !name || !category) return;

  const product = await prisma.product.create({
    data: { sku, name, category, unitPrice, currency },
  });

  await createActivityEvent({
    actorId: actor?.id ?? null,
    accountId: null,
    type: "PRODUCT_CREATED",
    summary: `Added product ${product.name} (${product.sku}) at ${formatEUR(product.unitPrice, product.currency)}`,
    linkedRecordType: "PRODUCT",
    linkedRecordId: product.id,
  });

  revalidatePath("/catalog");
}

export async function updateProduct(formData: FormData): Promise<void> {
  const actor = await currentUser();

  const id = str(formData, "id");
  if (!id) return;

  const name = str(formData, "name");
  const category = str(formData, "category");
  const unitPrice = num(formData, "unitPrice");
  const currency = str(formData, "currency") || "EUR";

  if (!name || !category) return;

  const product = await prisma.product.update({
    where: { id },
    data: { name, category, unitPrice, currency },
  });

  await createActivityEvent({
    actorId: actor?.id ?? null,
    accountId: null,
    type: "PRODUCT_UPDATED",
    summary: `Updated product ${product.name} (${product.sku}) — ${formatEUR(product.unitPrice, product.currency)}`,
    linkedRecordType: "PRODUCT",
    linkedRecordId: product.id,
  });

  revalidatePath("/catalog");
}

export async function retireProduct(formData: FormData): Promise<void> {
  const actor = await currentUser();

  const id = str(formData, "id");
  if (!id) return;

  const product = await prisma.product.update({
    where: { id },
    data: { status: "RETIRED" },
  });

  await createActivityEvent({
    actorId: actor?.id ?? null,
    accountId: null,
    type: "PRODUCT_RETIRED",
    summary: `Retired product ${product.name} (${product.sku}) — hidden from new offers`,
    linkedRecordType: "PRODUCT",
    linkedRecordId: product.id,
  });

  revalidatePath("/catalog");
}

export async function reactivateProduct(formData: FormData): Promise<void> {
  const actor = await currentUser();

  const id = str(formData, "id");
  if (!id) return;

  const product = await prisma.product.update({
    where: { id },
    data: { status: "ACTIVE" },
  });

  await createActivityEvent({
    actorId: actor?.id ?? null,
    accountId: null,
    type: "PRODUCT_REACTIVATED",
    summary: `Reactivated product ${product.name} (${product.sku}) — available for new offers`,
    linkedRecordType: "PRODUCT",
    linkedRecordId: product.id,
  });

  revalidatePath("/catalog");
}

// ----------------------------- services -----------------------------

export async function createService(formData: FormData): Promise<void> {
  const actor = await currentUser();

  const name = str(formData, "name");
  const providerType = parseProviderType(str(formData, "providerType"));
  const invoicingModel = parseInvoicingModel(str(formData, "invoicingModel"));
  const basePrice = num(formData, "basePrice");
  const currency = str(formData, "currency") || "EUR";

  if (!name) return;

  const service = await prisma.service.create({
    data: { name, providerType, invoicingModel, basePrice, currency },
  });

  await createActivityEvent({
    actorId: actor?.id ?? null,
    accountId: null,
    type: "SERVICE_CREATED",
    summary: `Added service ${service.name} (${service.providerType}) at ${formatEUR(service.basePrice, service.currency)}`,
    linkedRecordType: "SERVICE",
    linkedRecordId: service.id,
  });

  revalidatePath("/catalog");
}

export async function updateService(formData: FormData): Promise<void> {
  const actor = await currentUser();

  const id = str(formData, "id");
  if (!id) return;

  const name = str(formData, "name");
  const providerType = parseProviderType(str(formData, "providerType"));
  const invoicingModel = parseInvoicingModel(str(formData, "invoicingModel"));
  const basePrice = num(formData, "basePrice");
  const currency = str(formData, "currency") || "EUR";

  if (!name) return;

  const service = await prisma.service.update({
    where: { id },
    data: { name, providerType, invoicingModel, basePrice, currency },
  });

  await createActivityEvent({
    actorId: actor?.id ?? null,
    accountId: null,
    type: "SERVICE_UPDATED",
    summary: `Updated service ${service.name} — ${formatEUR(service.basePrice, service.currency)}`,
    linkedRecordType: "SERVICE",
    linkedRecordId: service.id,
  });

  revalidatePath("/catalog");
}

export async function retireService(formData: FormData): Promise<void> {
  const actor = await currentUser();

  const id = str(formData, "id");
  if (!id) return;

  const service = await prisma.service.update({
    where: { id },
    data: { status: "RETIRED" },
  });

  await createActivityEvent({
    actorId: actor?.id ?? null,
    accountId: null,
    type: "SERVICE_RETIRED",
    summary: `Retired service ${service.name} — hidden from new offers`,
    linkedRecordType: "SERVICE",
    linkedRecordId: service.id,
  });

  revalidatePath("/catalog");
}

export async function reactivateService(formData: FormData): Promise<void> {
  const actor = await currentUser();

  const id = str(formData, "id");
  if (!id) return;

  const service = await prisma.service.update({
    where: { id },
    data: { status: "ACTIVE" },
  });

  await createActivityEvent({
    actorId: actor?.id ?? null,
    accountId: null,
    type: "SERVICE_REACTIVATED",
    summary: `Reactivated service ${service.name} — available for new offers`,
    linkedRecordType: "SERVICE",
    linkedRecordId: service.id,
  });

  revalidatePath("/catalog");
}
