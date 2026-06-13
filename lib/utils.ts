import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn-style className combiner. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const EUR = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Format a number as EUR (no decimals) — used across dashboards. */
export function formatEUR(amount: number, currency = "EUR"): string {
  if (currency === "EUR") return EUR.format(amount);
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Whole days between now and `date` (negative = in the past). */
export function daysFromNow(date: Date): number {
  const ms = date.getTime() - Date.now();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/** Whole days since `date` (positive = in the past). */
export function daysSince(date: Date): number {
  return Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}
