export function fmt(n: number, ccy = "EUR", locale = "en-EU") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: ccy,
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtPct(n: number, digits = 0) {
  return `${n.toFixed(digits)}%`;
}

export function fmtDate(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-EU", { year: "numeric", month: "short", day: "2-digit" });
}

/** "in 2h 14m" / "12d overdue" — caller decides the threshold. */
export function slaLabel(ms: number) {
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const txt = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`;
  return overdue ? `${txt} overdue` : txt;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}
