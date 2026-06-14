// HMD Secure CRM — seed data (BUILD-SPEC "Seed Data Requirements").
// An empty DB is a losing demo. This builds a believable HMD world.
// Run: npm run db:seed   (tsx prisma/seed.ts)

import {
  PrismaClient,
  type DealStage,
  type Product,
  type Service,
  type Account,
  type Deal,
  type OfferStatus,
} from "@prisma/client";
import {
  STAGE_PROBABILITY,
  quartersFrom,
  weightedRevenue,
} from "../lib/forecast";

const prisma = new PrismaClient();

const NOW = new Date();
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000);
const daysAhead = (d: number) => new Date(NOW.getTime() + d * 86400000);

// Tagged-union offer item — discriminates cleanly so TypeScript narrows product vs service.
type OfferItemInput =
  | { kind: "PRODUCT"; product: Product; qty: number }
  | { kind: "SERVICE"; service: Service; qty: number };

/** Create an Offer + immutable line-item snapshots, computing subtotal/total. */
async function buildOffer(opts: {
  accountId: string;
  dealId: string;
  createdById: string;
  status: OfferStatus;
  discountPercent: number;
  discountJustification?: string;
  locked: boolean;
  items: OfferItemInput[];
}) {
  const priced = opts.items.map((i) =>
    i.kind === "PRODUCT"
      ? { type: "PRODUCT" as const, id: i.product.id, name: i.product.name, price: i.product.unitPrice, qty: i.qty }
      : { type: "SERVICE" as const, id: i.service.id, name: i.service.name, price: i.service.basePrice, qty: i.qty }
  );
  const subtotal = Math.round(priced.reduce((s, p) => s + p.price * p.qty, 0));
  const total = Math.round(subtotal * (1 - opts.discountPercent / 100));
  const offer = await prisma.offer.create({
    data: {
      accountId: opts.accountId,
      dealId: opts.dealId,
      createdById: opts.createdById,
      version: 1,
      status: opts.status,
      subtotal,
      discountPercent: opts.discountPercent,
      discountJustification: opts.discountJustification ?? null,
      total,
      locked: opts.locked,
    },
  });
  for (const p of priced) {
    await prisma.offerLineItem.create({
      data: {
        offerId: offer.id,
        itemType: p.type,
        itemId: p.id,
        nameSnapshot: p.name,
        unitPriceSnapshot: p.price,
        quantity: p.qty,
        lineTotal: p.price * p.qty,
      },
    });
  }
  return offer;
}

async function wipe() {
  // FK-safe delete order (children first).
  await prisma.notification.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.offerLineItem.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.note.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.case.deleteMany();
  await prisma.dealForecastPeriod.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.account.deleteMany();
  await prisma.service.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await wipe();

  // ----------------------------- Users (demo role-switch) -----------------------------
  const sofia = await prisma.user.create({
    data: { name: "Sofia Rep", email: "sofia@hmd.demo", role: "REP" },
  });
  const raj = await prisma.user.create({
    data: { name: "Raj Rep", email: "raj@hmd.demo", role: "REP" },
  });
  const timo = await prisma.user.create({
    data: { name: "Timo TAM", email: "timo@hmd.demo", role: "TAM" },
  });
  const lena = await prisma.user.create({
    data: { name: "Lena TAM", email: "lena@hmd.demo", role: "TAM" },
  });
  const mira = await prisma.user.create({
    data: { name: "Mira Sales Manager", email: "mira@hmd.demo", role: "SALES_MANAGER" },
  });
  const fiona = await prisma.user.create({
    data: { name: "Fiona Finance", email: "fiona@hmd.demo", role: "FINANCE" },
  });

  // ----------------------------- Products (catalog) -----------------------------
  const productSpecs = [
    { sku: "HMD-PRO-001", name: "HMD Secure Pro Device", category: "Device", unitPrice: 749, gmPercent: 0.35 },
    { sku: "HMD-RUG-002", name: "HMD Secure Rugged Device", category: "Device", unitPrice: 899, gmPercent: 0.4 },
    { sku: "HMD-TAB-003", name: "HMD Secure Tablet", category: "Device", unitPrice: 629, gmPercent: 0.33 },
    { sku: "HMD-LITE-004", name: "HMD Secure Lite Device", category: "Device", unitPrice: 449, gmPercent: 0.3 },
    { sku: "HMD-ENR-010", name: "Device Enrollment Pack", category: "Accessory", unitPrice: 39, gmPercent: 0.55 },
    { sku: "HMD-WAR-011", name: "Extended Warranty", category: "Accessory", unitPrice: 89, gmPercent: 0.7 },
    { sku: "HMD-DOCK-012", name: "USB-C Secure Dock", category: "Accessory", unitPrice: 119, gmPercent: 0.45 },
    // RETIRED: must be hidden from NEW offers but stay visible in historical snapshots.
    { sku: "HMD-LEG-099", name: "HMD Legacy Secure Phone", category: "Device", unitPrice: 399, gmPercent: 0.25, status: "RETIRED" as const },
  ];
  const products: Product[] = [];
  for (const p of productSpecs) {
    products.push(
      await prisma.product.create({
        data: {
          sku: p.sku,
          name: p.name,
          category: p.category,
          unitPrice: p.unitPrice,
          gmPercent: p.gmPercent,
          currency: "EUR",
          status: p.status ?? "ACTIVE",
        },
      })
    );
  }
  const byProduct = (name: string) => products.find((p) => p.name === name)!;

  // ----------------------------- Services (catalog) — all 3 invoicing models -----------------------------
  const serviceSpecs = [
    { name: "Secure Device Management", providerType: "INTERNAL" as const, invoicingModel: "MONTHLY_RECURRING" as const, basePrice: 9, gmPercent: 0.72 },
    { name: "24/7 Premium Support", providerType: "INTERNAL" as const, invoicingModel: "MONTHLY_RECURRING" as const, basePrice: 14, gmPercent: 0.65 },
    { name: "Deployment Workshop", providerType: "INTERNAL" as const, invoicingModel: "ONE_OFF" as const, basePrice: 4500, gmPercent: 0.55 },
    { name: "Compliance Audit Package", providerType: "THIRD_PARTY" as const, invoicingModel: "FIXED_TERM" as const, basePrice: 12000, gmPercent: 0.3 },
    { name: "MDM Integration Support", providerType: "INTERNAL" as const, invoicingModel: "FIXED_TERM" as const, basePrice: 8000, gmPercent: 0.6 },
    { name: "Third-party Incident Response", providerType: "THIRD_PARTY" as const, invoicingModel: "ONE_OFF" as const, basePrice: 6500, gmPercent: 0.28 },
  ];
  const services: Service[] = [];
  for (const s of serviceSpecs) {
    services.push(await prisma.service.create({ data: { ...s, currency: "EUR", status: "ACTIVE" } }));
  }
  const byService = (name: string) => services.find((s) => s.name === name)!;

  // ----------------------------- Accounts + contacts -----------------------------
  type AccSpec = {
    name: string; region: string; segment: string; industry: string;
    owner: string; tam: string; contacts: { name: string; title: string; email: string; primary?: boolean }[];
  };
  const accountSpecs: AccSpec[] = [
    { name: "NordSec Logistics", region: "DACH", segment: "Enterprise", industry: "Logistics", owner: sofia.id, tam: timo.id,
      contacts: [{ name: "Anke Vogel", title: "Head of IT", email: "anke.vogel@nordsec.example", primary: true }, { name: "Markus Bauer", title: "Security Lead", email: "markus.bauer@nordsec.example" }] },
    { name: "Aurora Health Systems", region: "Nordics", segment: "Enterprise", industry: "Healthcare", owner: sofia.id, tam: timo.id,
      contacts: [{ name: "Elin Sandberg", title: "CISO", email: "elin.sandberg@aurorahealth.example", primary: true }] },
    { name: "Baltic Field Services", region: "Baltics", segment: "Mid-market", industry: "Field Services", owner: raj.id, tam: lena.id,
      contacts: [{ name: "Janis Ozols", title: "Operations Director", email: "janis.ozols@balticfield.example", primary: true }] },
    { name: "RheinWerk Manufacturing", region: "DACH", segment: "Enterprise", industry: "Manufacturing", owner: raj.id, tam: lena.id,
      contacts: [{ name: "Stefan Krause", title: "IT Procurement", email: "stefan.krause@rheinwerk.example", primary: true }, { name: "Petra Lang", title: "Plant Manager", email: "petra.lang@rheinwerk.example" }] },
    { name: "FinGov Mobility", region: "Finland", segment: "Public Sector", industry: "Government", owner: sofia.id, tam: timo.id,
      contacts: [{ name: "Aino Korhonen", title: "Procurement Officer", email: "aino.korhonen@fingov.example", primary: true }] },
    { name: "Alpine Utilities", region: "Central Europe", segment: "Enterprise", industry: "Energy", owner: raj.id, tam: timo.id,
      contacts: [{ name: "Luca Moser", title: "Head of Field Ops", email: "luca.moser@alpineutil.example", primary: true }] },
    { name: "Nordic Retail Group", region: "Nordics", segment: "Mid-market", industry: "Retail", owner: sofia.id, tam: lena.id,
      contacts: [{ name: "Freja Nilsson", title: "Store Tech Manager", email: "freja.nilsson@nordicretail.example", primary: true }] },
    { name: "Helvetia Secure Bank", region: "Central Europe", segment: "Enterprise", industry: "Finance", owner: raj.id, tam: timo.id,
      contacts: [{ name: "Daniel Frei", title: "Head of Endpoint Security", email: "daniel.frei@helvetiabank.example", primary: true }] },
    { name: "Helsinki Transit Authority", region: "Finland", segment: "Public Sector", industry: "Transportation", owner: sofia.id, tam: timo.id,
      contacts: [{ name: "Mikael Virtanen", title: "Fleet IT Lead", email: "mikael.virtanen@hsltransit.example", primary: true }] },
    { name: "Iberia Logistics Group", region: "Iberia", segment: "Mid-market", industry: "Logistics", owner: raj.id, tam: lena.id,
      contacts: [{ name: "Sofia Marquez", title: "Procurement Manager", email: "sofia.marquez@iberialog.example", primary: true }] },
    { name: "Benelux MedTech", region: "Benelux", segment: "Enterprise", industry: "Healthcare", owner: sofia.id, tam: timo.id,
      contacts: [{ name: "Lars Janssen", title: "CISO", email: "lars.janssen@beneluxmed.example", primary: true }, { name: "Marie Dubois", title: "Head of Procurement", email: "marie.dubois@beneluxmed.example" }] },
    { name: "DACH Automotive Parts", region: "DACH", segment: "Enterprise", industry: "Automotive", owner: raj.id, tam: lena.id,
      contacts: [{ name: "Thomas Bauer", title: "IT Procurement Lead", email: "thomas.bauer@dachauto.example", primary: true }] },
    { name: "Polar Energy Networks", region: "Nordics", segment: "Enterprise", industry: "Energy", owner: raj.id, tam: timo.id,
      contacts: [{ name: "Ingrid Halvorsen", title: "Head of Field Operations", email: "ingrid.halvorsen@polarenergy.example", primary: true }] },
    { name: "Adriatic Telecom", region: "Central Europe", segment: "Mid-market", industry: "Telecom", owner: sofia.id, tam: lena.id,
      contacts: [{ name: "Marko Petrovic", title: "Network IT Manager", email: "marko.petrovic@adriatictel.example", primary: true }] },
  ];

  // HMD asked for customer basics (domain/address/VAT) + a contact decision-role.
  const VAT_PREFIX: Record<string, string> = { DACH: "DE", Nordics: "SE", Baltics: "LV", Finland: "FI", "Central Europe": "CH" };
  const roleFromTitle = (title: string): "FINANCIAL" | "BUDGET" | "TECH" | "INFLUENCER" | "OTHER" => {
    const t = title.toLowerCase();
    if (/cfo|finance|financial/.test(t)) return "FINANCIAL";
    if (/procurement|purchas|budget/.test(t)) return "BUDGET";
    if (/ciso|security|it|cto|tech|endpoint/.test(t)) return "TECH";
    if (/head|director|manager|officer|lead/.test(t)) return "INFLUENCER";
    return "OTHER";
  };

  const accounts: Account[] = [];
  const primaryContactByAccount = new Map<string, string>();
  let accIdx = 0;
  for (const a of accountSpecs) {
    accIdx++;
    const domain = a.contacts[0]?.email.split("@")[1] ?? null;
    const acc = await prisma.account.create({
      data: {
        name: a.name, region: a.region, segment: a.segment, industry: a.industry,
        domain,
        address: `${a.name.split(" ")[0]} House, ${a.region}`,
        vatId: `${VAT_PREFIX[a.region] ?? "EU"}${(20000000 + accIdx * 137).toString()}`,
        ownerRepId: a.owner, assignedTamId: a.tam, status: "ACTIVE",
      },
    });
    accounts.push(acc);
    for (const c of a.contacts) {
      const contact = await prisma.contact.create({
        data: { accountId: acc.id, name: c.name, title: c.title, email: c.email, isPrimary: !!c.primary, decisionRole: roleFromTitle(c.title) },
      });
      if (c.primary) primaryContactByAccount.set(acc.id, contact.id);
    }
  }
  const byAccount = (name: string) => accounts.find((a) => a.name === name)!;

  // ----------------------------- Deals (18) — mix channel/stage, stalled + overdue -----------------------------
  type DealSpec = {
    account: string; name: string; channel: "DIRECT" | "RESELLER"; stage: DealStage;
    closeInDays: number; lastActivityDaysAgo: number; status?: "OPEN" | "WON" | "LOST";
    forecast?: { devicesYr1: number; devicePrice: number; monthlyServicePerDevice: number };
  };
  const dealSpecs: DealSpec[] = [
    { account: "NordSec Logistics", name: "NordSec fleet rollout 4k units", channel: "DIRECT", stage: "CUSTOMER_TEST", closeInDays: 60, lastActivityDaysAgo: 2, forecast: { devicesYr1: 1600, devicePrice: 749, monthlyServicePerDevice: 9 } },
    { account: "NordSec Logistics", name: "NordSec rugged expansion", channel: "DIRECT", stage: "RFP_OFFER_GIVEN", closeInDays: 95, lastActivityDaysAgo: 6, forecast: { devicesYr1: 600, devicePrice: 899, monthlyServicePerDevice: 14 } },
    { account: "Aurora Health Systems", name: "Aurora clinical tablet pilot", channel: "DIRECT", stage: "CONTRACT_NEGOTIATION", closeInDays: 30, lastActivityDaysAgo: 3, forecast: { devicesYr1: 900, devicePrice: 629, monthlyServicePerDevice: 14 } },
    { account: "Aurora Health Systems", name: "Aurora ward expansion", channel: "DIRECT", stage: "INTEREST_SHOWN", closeInDays: 150, lastActivityDaysAgo: 21 }, // STALLED
    { account: "Baltic Field Services", name: "Baltic reseller bundle", channel: "RESELLER", stage: "CUSTOMER_TEST", closeInDays: 45, lastActivityDaysAgo: 5, forecast: { devicesYr1: 400, devicePrice: 449, monthlyServicePerDevice: 9 } },
    { account: "Baltic Field Services", name: "Baltic seasonal top-up", channel: "RESELLER", stage: "RFI_ANSWERED", closeInDays: 80, lastActivityDaysAgo: 18 }, // STALLED
    { account: "RheinWerk Manufacturing", name: "RheinWerk plant rollout", channel: "RESELLER", stage: "RFP_OFFER_GIVEN", closeInDays: 70, lastActivityDaysAgo: 4, forecast: { devicesYr1: 1200, devicePrice: 899, monthlyServicePerDevice: 9 } },
    { account: "RheinWerk Manufacturing", name: "RheinWerk warehouse scanners", channel: "RESELLER", stage: "INTEREST_SHOWN", closeInDays: 120, lastActivityDaysAgo: 30 }, // STALLED
    { account: "FinGov Mobility", name: "FinGov public-sector framework", channel: "DIRECT", stage: "RFI_ANSWERED", closeInDays: 110, lastActivityDaysAgo: 7, forecast: { devicesYr1: 2000, devicePrice: 629, monthlyServicePerDevice: 9 } },
    { account: "FinGov Mobility", name: "FinGov pilot batch", channel: "DIRECT", stage: "WON", closeInDays: -20, lastActivityDaysAgo: 25, status: "WON", forecast: { devicesYr1: 300, devicePrice: 629, monthlyServicePerDevice: 9 } },
    { account: "Alpine Utilities", name: "Alpine field crew devices", channel: "DIRECT", stage: "CUSTOMER_TEST", closeInDays: -8, lastActivityDaysAgo: 9, forecast: { devicesYr1: 700, devicePrice: 899, monthlyServicePerDevice: 14 } }, // PAST CLOSE
    { account: "Alpine Utilities", name: "Alpine substation tablets", channel: "DIRECT", stage: "RFP_OFFER_GIVEN", closeInDays: 65, lastActivityDaysAgo: 11, forecast: { devicesYr1: 350, devicePrice: 629, monthlyServicePerDevice: 9 } },
    { account: "Nordic Retail Group", name: "Nordic Retail POS refresh", channel: "RESELLER", stage: "CUSTOMER_TEST", closeInDays: 40, lastActivityDaysAgo: 6, forecast: { devicesYr1: 500, devicePrice: 449, monthlyServicePerDevice: 9 } },
    { account: "Nordic Retail Group", name: "Nordic Retail back-office", channel: "RESELLER", stage: "LOST", closeInDays: -40, lastActivityDaysAgo: 35, status: "LOST" },
    { account: "Helvetia Secure Bank", name: "Helvetia branch security devices", channel: "DIRECT", stage: "CONTRACT_NEGOTIATION", closeInDays: 25, lastActivityDaysAgo: 1, forecast: { devicesYr1: 1100, devicePrice: 749, monthlyServicePerDevice: 14 } },
    { account: "Helvetia Secure Bank", name: "Helvetia executive fleet", channel: "DIRECT", stage: "RFP_OFFER_GIVEN", closeInDays: -5, lastActivityDaysAgo: 16, forecast: { devicesYr1: 200, devicePrice: 899, monthlyServicePerDevice: 14 } }, // PAST CLOSE + STALLED
    { account: "NordSec Logistics", name: "NordSec accessory framework", channel: "DIRECT", stage: "INTEREST_SHOWN", closeInDays: 130, lastActivityDaysAgo: 3 },
    { account: "FinGov Mobility", name: "FinGov disaster-recovery kit", channel: "DIRECT", stage: "RFI_ANSWERED", closeInDays: 90, lastActivityDaysAgo: 4, forecast: { devicesYr1: 250, devicePrice: 449, monthlyServicePerDevice: 9 } },
    { account: "Helsinki Transit Authority", name: "Helsinki bus fleet tablets", channel: "DIRECT", stage: "CUSTOMER_TEST", closeInDays: 50, lastActivityDaysAgo: 4, forecast: { devicesYr1: 800, devicePrice: 629, monthlyServicePerDevice: 9 } },
    { account: "Helsinki Transit Authority", name: "Helsinki metro rollout", channel: "DIRECT", stage: "RFI_ANSWERED", closeInDays: 120, lastActivityDaysAgo: 9, forecast: { devicesYr1: 1500, devicePrice: 749, monthlyServicePerDevice: 9 } },
    { account: "Iberia Logistics Group", name: "Iberia warehouse scanners", channel: "RESELLER", stage: "RFP_OFFER_GIVEN", closeInDays: 70, lastActivityDaysAgo: 5, forecast: { devicesYr1: 600, devicePrice: 449, monthlyServicePerDevice: 9 } },
    { account: "Benelux MedTech", name: "Benelux clinical devices", channel: "DIRECT", stage: "CONTRACT_NEGOTIATION", closeInDays: 28, lastActivityDaysAgo: 2, forecast: { devicesYr1: 1000, devicePrice: 629, monthlyServicePerDevice: 14 } },
    { account: "Benelux MedTech", name: "Benelux compliance bundle", channel: "DIRECT", stage: "INTEREST_SHOWN", closeInDays: 140, lastActivityDaysAgo: 24 }, // STALLED
    { account: "DACH Automotive Parts", name: "DACH plant floor rugged", channel: "RESELLER", stage: "CUSTOMER_TEST", closeInDays: 45, lastActivityDaysAgo: 6, forecast: { devicesYr1: 900, devicePrice: 899, monthlyServicePerDevice: 9 } },
    { account: "DACH Automotive Parts", name: "DACH logistics expansion", channel: "RESELLER", stage: "INTEREST_SHOWN", closeInDays: 110, lastActivityDaysAgo: 28 }, // STALLED (DACH enterprise -> smart view)
    { account: "Polar Energy Networks", name: "Polar grid field devices", channel: "DIRECT", stage: "RFP_OFFER_GIVEN", closeInDays: 60, lastActivityDaysAgo: 7, forecast: { devicesYr1: 700, devicePrice: 899, monthlyServicePerDevice: 14 } },
    { account: "Polar Energy Networks", name: "Polar offshore pilot", channel: "DIRECT", stage: "WON", closeInDays: -15, lastActivityDaysAgo: 20, status: "WON", forecast: { devicesYr1: 200, devicePrice: 899, monthlyServicePerDevice: 14 } },
    { account: "Adriatic Telecom", name: "Adriatic field tech tablets", channel: "RESELLER", stage: "CUSTOMER_TEST", closeInDays: 40, lastActivityDaysAgo: 5, forecast: { devicesYr1: 500, devicePrice: 449, monthlyServicePerDevice: 9 } },
    { account: "Helvetia Secure Bank", name: "Helvetia compliance tablets", channel: "DIRECT", stage: "RFI_ANSWERED", closeInDays: 95, lastActivityDaysAgo: 8, forecast: { devicesYr1: 400, devicePrice: 749, monthlyServicePerDevice: 14 } },
    { account: "Aurora Health Systems", name: "Aurora pharmacy handhelds", channel: "DIRECT", stage: "RFP_OFFER_GIVEN", closeInDays: 55, lastActivityDaysAgo: 6, forecast: { devicesYr1: 350, devicePrice: 629, monthlyServicePerDevice: 9 } },
  ];

  const deals: { deal: Deal; spec: DealSpec; accountId: string }[] = [];
  for (const d of dealSpecs) {
    const acc = byAccount(d.account);
    const deal = await prisma.deal.create({
      data: {
        accountId: acc.id,
        ownerRepId: acc.ownerRepId,
        name: d.name,
        channel: d.channel,
        stage: d.stage,
        probability: STAGE_PROBABILITY[d.stage],
        expectedCloseDate: daysAhead(d.closeInDays),
        lastActivityAt: daysAgo(d.lastActivityDaysAgo),
        status: d.status ?? "OPEN",
        notes: null,
      },
    });
    deals.push({ deal, spec: d, accountId: acc.id });

    // Full 3-year (12-quarter) forecast rows for deals that carry a forecast profile.
    if (d.forecast) {
      const quarters = quartersFrom(NOW, 12);
      const f = d.forecast;
      const prob = STAGE_PROBABILITY[d.stage];
      const rows = quarters.map((q, i) => {
        // Year 1 ramps; years 2-3 are projected expansion (fewer new-device adds, growing recurring base).
        const yearIndex = Math.floor(i / 4);
        const rampFactor = [1, 0.55, 0.4][yearIndex] ?? 0.3;
        const deviceUnits = Math.round((f.devicesYr1 / 4) * rampFactor);
        const deviceRevenue = deviceUnits * f.devicePrice;
        // Recurring service revenue grows with cumulative active devices.
        const cumulativeDevices = Math.round((f.devicesYr1 / 4) * (i + 1) * 0.8);
        const serviceRevenue = cumulativeDevices * f.monthlyServicePerDevice * 3; // 3 months / quarter
        const totalRevenue = deviceRevenue + serviceRevenue;
        return {
          dealId: deal.id,
          periodStart: q.start,
          periodEnd: q.end,
          periodLabel: q.label,
          deviceUnits,
          deviceRevenue,
          serviceRevenue,
          totalRevenue,
          weightedRevenue: weightedRevenue(prob, totalRevenue),
        };
      });
      await prisma.dealForecastPeriod.createMany({ data: rows });
    }
  }
  const dealByName = (name: string) => deals.find((d) => d.deal.name === name)!.deal;

  // ----------------------------- Cases (12) across statuses/priorities -----------------------------
  type CaseSpec = {
    account: string; service: string; tam: string; title: string; description: string;
    status: "OPEN" | "IN_PROGRESS" | "ESCALATED" | "CLOSED"; priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    ageDays: number; closedDaysAgo?: number;
  };
  const caseSpecs: CaseSpec[] = [
    { account: "NordSec Logistics", service: "Secure Device Management", tam: timo.id, title: "Devices failing MDM check-in", description: "~40 units not reporting compliance.", status: "ESCALATED", priority: "CRITICAL", ageDays: 5 },
    { account: "NordSec Logistics", service: "24/7 Premium Support", tam: timo.id, title: "Battery drain after firmware update", description: "Fleet-wide battery complaints.", status: "IN_PROGRESS", priority: "HIGH", ageDays: 9 },
    { account: "Aurora Health Systems", service: "Compliance Audit Package", tam: timo.id, title: "Audit evidence export blocked", description: "Customer test gated on audit logs.", status: "OPEN", priority: "HIGH", ageDays: 3 },
    { account: "Aurora Health Systems", service: "Secure Device Management", tam: timo.id, title: "Ward tablets need re-enrollment", description: "Re-enroll 120 tablets.", status: "OPEN", priority: "MEDIUM", ageDays: 12 },
    { account: "Baltic Field Services", service: "MDM Integration Support", tam: lena.id, title: "Integration with legacy ERP", description: "ERP webhook intermittently fails.", status: "IN_PROGRESS", priority: "MEDIUM", ageDays: 7 },
    { account: "RheinWerk Manufacturing", service: "Third-party Incident Response", tam: lena.id, title: "Suspicious access on 3 devices", description: "Escalated to 3rd-party IR.", status: "ESCALATED", priority: "CRITICAL", ageDays: 2 },
    { account: "FinGov Mobility", service: "Deployment Workshop", tam: timo.id, title: "Workshop scheduling conflict", description: "Reschedule onboarding workshop.", status: "OPEN", priority: "LOW", ageDays: 6 },
    { account: "Alpine Utilities", service: "Secure Device Management", tam: timo.id, title: "Rugged devices overheating in field", description: "Thermal shutdowns reported.", status: "OPEN", priority: "HIGH", ageDays: 4 },
    { account: "Nordic Retail Group", service: "24/7 Premium Support", tam: lena.id, title: "POS app crash on scan", description: "Barcode scan crashes app.", status: "IN_PROGRESS", priority: "MEDIUM", ageDays: 8 },
    { account: "Helvetia Secure Bank", service: "Compliance Audit Package", tam: timo.id, title: "Quarterly compliance review", description: "Routine compliance review.", status: "CLOSED", priority: "LOW", ageDays: 30, closedDaysAgo: 4 },
    { account: "RheinWerk Manufacturing", service: "Secure Device Management", tam: lena.id, title: "Warehouse Wi-Fi handoff drops", description: "Devices drop between APs.", status: "CLOSED", priority: "MEDIUM", ageDays: 22, closedDaysAgo: 6 },
    { account: "FinGov Mobility", service: "MDM Integration Support", tam: timo.id, title: "SSO token expiry too aggressive", description: "Users re-auth too often.", status: "OPEN", priority: "MEDIUM", ageDays: 10 },
    { account: "Helsinki Transit Authority", service: "Deployment Workshop", tam: timo.id, title: "Driver tablets won't pair with ticketing", description: "Pairing fails on the ticketing dock.", status: "OPEN", priority: "HIGH", ageDays: 4 },
    { account: "Iberia Logistics Group", service: "MDM Integration Support", tam: lena.id, title: "Scanner sync delays in warehouse", description: "Inventory sync lags by minutes.", status: "IN_PROGRESS", priority: "MEDIUM", ageDays: 7 },
    { account: "Benelux MedTech", service: "Compliance Audit Package", tam: timo.id, title: "Audit log gap on clinical devices", description: "Missing entries fail the compliance review.", status: "ESCALATED", priority: "CRITICAL", ageDays: 3 },
    { account: "DACH Automotive Parts", service: "Secure Device Management", tam: lena.id, title: "Rugged units fail drop-test recert", description: "Recertification batch failing.", status: "OPEN", priority: "MEDIUM", ageDays: 9 },
    { account: "Polar Energy Networks", service: "Third-party Incident Response", tam: timo.id, title: "Phishing on 2 field accounts", description: "Credential phishing under investigation.", status: "ESCALATED", priority: "HIGH", ageDays: 2 },
    { account: "Adriatic Telecom", service: "24/7 Premium Support", tam: lena.id, title: "VPN drops on 4G handoff", description: "Daily VPN drops on cellular handoff.", status: "OPEN", priority: "MEDIUM", ageDays: 6 },
  ];
  // SLA window in days by priority (mirrors lib/sla.ts SLA_DAYS) — P2 #18.
  const SLA_DAYS: Record<string, number> = { CRITICAL: 2, HIGH: 4, MEDIUM: 8, LOW: 15 };
  const createdCases: { id: string; tam: string; ageDays: number; accountId: string; title: string }[] = [];
  for (const c of caseSpecs) {
    const acc = byAccount(c.account);
    const createdAt = daysAgo(c.ageDays);
    const dueDate = new Date(createdAt.getTime() + (SLA_DAYS[c.priority] ?? 8) * 86400000);
    const created = await prisma.case.create({
      data: {
        accountId: acc.id,
        serviceId: byService(c.service).id,
        assignedTamId: c.tam,
        customerContactId: primaryContactByAccount.get(acc.id) ?? null,
        title: c.title,
        description: c.description,
        status: c.status,
        priority: c.priority,
        createdAt,
        dueDate,
        closedAt: c.closedDaysAgo != null ? daysAgo(c.closedDaysAgo) : null,
      },
    });
    createdCases.push({ id: created.id, tam: c.tam, ageDays: c.ageDays, accountId: acc.id, title: c.title });
    // Service-history timeline event so the TAM "reads the account history" demo beat is populated.
    await prisma.activityEvent.create({
      data: { accountId: acc.id, actorId: c.tam, type: "CASE_OPENED", summary: `Case opened: ${c.title}`, linkedRecordType: "CASE", linkedRecordId: created.id, createdAt },
    });
    if (c.closedDaysAgo != null) {
      await prisma.activityEvent.create({
        data: { accountId: acc.id, actorId: c.tam, type: "CASE_CLOSED", summary: `Case closed: ${c.title}`, linkedRecordType: "CASE", linkedRecordId: created.id, createdAt: daysAgo(c.closedDaysAgo) },
      });
    }
  }

  // Threaded notes on the first two cases (>=5 each) so the AI case summary (P2 #22) has material.
  const noteThreads = [
    [
      "Customer reports ~40 units failing the MDM compliance check-in.",
      "Narrowed it down to devices on firmware 4.2.1 only.",
      "Opened vendor ticket HMD-4471; they suspect a certificate-rotation bug.",
      "Workaround confirmed: a manual re-enrol clears it temporarily.",
      "Vendor committed to a hotfix in the next release.",
      "Rolled the workaround to the worst-affected site; complaints dropping.",
    ],
    [
      "Fleet-wide battery-drain complaints started right after the firmware update.",
      "Reproduced on a test unit — idle drain roughly doubled.",
      "Logs point at a background sync loop that never backs off.",
      "Gave the customer a config to throttle sync as a stopgap.",
      "Engineering has a candidate fix in QA; targeting next patch.",
    ],
  ];
  for (let i = 0; i < Math.min(2, createdCases.length); i++) {
    const cc = createdCases[i];
    for (let j = 0; j < noteThreads[i].length; j++) {
      const noteAt = daysAgo(Math.max(0, cc.ageDays - j));
      // Seed the two note tiers (TAM #5): make the vendor/internal coordination notes internal.
      const internal = /vendor|engineering|qa|hotfix|internal/i.test(noteThreads[i][j]);
      await prisma.note.create({
        data: { parentType: "CASE", parentId: cc.id, authorId: cc.tam, body: noteThreads[i][j], internal, createdAt: noteAt },
      });
      // Each note also lands on the account service-history timeline.
      await prisma.activityEvent.create({
        data: { accountId: cc.accountId, actorId: cc.tam, type: "CASE_NOTE_ADDED", summary: `Note on "${cc.title}"`, linkedRecordType: "CASE", linkedRecordId: cc.id, createdAt: noteAt },
      });
    }
  }

  // ----------------------------- Offers (5) in every approval state -----------------------------
  const prod = (name: string, qty: number): OfferItemInput => ({ kind: "PRODUCT", product: byProduct(name), qty });
  const svc = (name: string, qty: number): OfferItemInput => ({ kind: "SERVICE", service: byService(name), qty });

  // (1) DRAFT — no discount, not locked.
  {
    const deal = dealByName("NordSec accessory framework");
    await buildOffer({
      accountId: deal.accountId, dealId: deal.id, createdById: sofia.id,
      status: "DRAFT", discountPercent: 0, locked: false,
      items: [prod("Device Enrollment Pack", 200), prod("USB-C Secure Dock", 150)],
    });
  }

  // (2) PENDING_SM — discount + justification, LOCKED, SM approval pending, SM notified.
  {
    const deal = dealByName("NordSec fleet rollout 4k units");
    const offer = await buildOffer({
      accountId: deal.accountId, dealId: deal.id, createdById: sofia.id,
      status: "PENDING_SM", discountPercent: 12,
      discountJustification: "Strategic flagship account; 12% to beat incumbent in customer test.",
      locked: true,
      items: [prod("HMD Secure Pro Device", 1600), svc("Secure Device Management", 1600)],
    });
    await prisma.approval.create({ data: { offerId: offer.id, step: "SALES_MANAGER", status: "PENDING" } });
    await prisma.activityEvent.create({ data: { accountId: deal.accountId, actorId: sofia.id, type: "OFFER_SUBMITTED", summary: "Offer submitted for SM approval (12% discount)", linkedRecordType: "OFFER", linkedRecordId: offer.id } });
    await prisma.notification.create({ data: { recipientId: mira.id, title: "Discounted offer awaiting your approval", body: "NordSec fleet rollout — 12% discount needs Sales Manager sign-off.", linkedRecordType: "OFFER", linkedRecordId: offer.id } });
  }

  // (3) PENDING_FINANCE — SM already approved, Finance pending, Finance notified.
  {
    const deal = dealByName("Aurora clinical tablet pilot");
    const offer = await buildOffer({
      accountId: deal.accountId, dealId: deal.id, createdById: sofia.id,
      status: "PENDING_FINANCE", discountPercent: 8,
      discountJustification: "Healthcare framework pricing; 8% volume discount agreed with SM.",
      locked: true,
      items: [prod("HMD Secure Tablet", 900), svc("24/7 Premium Support", 900), svc("Compliance Audit Package", 1)],
    });
    await prisma.approval.create({ data: { offerId: offer.id, step: "SALES_MANAGER", status: "APPROVED", approverId: mira.id, comment: "Approved — strategic healthcare logo.", decidedAt: daysAgo(1) } });
    await prisma.approval.create({ data: { offerId: offer.id, step: "FINANCE", status: "PENDING" } });
    await prisma.activityEvent.create({ data: { accountId: deal.accountId, actorId: mira.id, type: "OFFER_SM_APPROVED", summary: "Sales Manager approved offer; routed to Finance", linkedRecordType: "OFFER", linkedRecordId: offer.id } });
    await prisma.notification.create({ data: { recipientId: fiona.id, title: "Offer awaiting Finance approval", body: "Aurora clinical tablet pilot — SM approved, 8% discount, needs Finance sign-off.", linkedRecordType: "OFFER", linkedRecordId: offer.id } });
  }

  // (4) APPROVED — both approvals done, unlocked, includes a RETIRED product snapshot (historical visibility).
  {
    const deal = dealByName("FinGov pilot batch");
    const offer = await buildOffer({
      accountId: deal.accountId, dealId: deal.id, createdById: sofia.id,
      status: "APPROVED", discountPercent: 5,
      discountJustification: "Public-sector framework discount, pre-approved.",
      locked: false,
      // HMD Legacy Secure Phone is RETIRED but stays valid in this historical snapshot.
      items: [prod("HMD Legacy Secure Phone", 300), svc("Deployment Workshop", 1)],
    });
    await prisma.approval.create({ data: { offerId: offer.id, step: "SALES_MANAGER", status: "APPROVED", approverId: mira.id, comment: "Approved.", decidedAt: daysAgo(26) } });
    await prisma.approval.create({ data: { offerId: offer.id, step: "FINANCE", status: "APPROVED", approverId: fiona.id, comment: "Finance approved; framework pricing confirmed.", decidedAt: daysAgo(25) } });
    await prisma.activityEvent.create({ data: { accountId: deal.accountId, actorId: fiona.id, type: "OFFER_APPROVED", summary: "Offer fully approved (SM + Finance)", linkedRecordType: "OFFER", linkedRecordId: offer.id } });
    await prisma.notification.create({ data: { recipientId: sofia.id, title: "Your offer was approved", body: "FinGov pilot batch — fully approved by SM and Finance.", linkedRecordType: "OFFER", linkedRecordId: offer.id } });
  }

  // (5) REJECTED — rejection reason stored, unlocked for revision.
  {
    const deal = dealByName("Helvetia executive fleet");
    const offer = await buildOffer({
      accountId: deal.accountId, dealId: deal.id, createdById: raj.id,
      status: "REJECTED", discountPercent: 22,
      discountJustification: "Customer pushing hard on price.",
      locked: false,
      items: [prod("HMD Secure Rugged Device", 200)],
    });
    await prisma.approval.create({ data: { offerId: offer.id, step: "SALES_MANAGER", status: "REJECTED", approverId: mira.id, comment: "22% too deep; cap at 12% and resubmit with justification.", decidedAt: daysAgo(2) } });
    await prisma.activityEvent.create({ data: { accountId: deal.accountId, actorId: mira.id, type: "OFFER_REJECTED", summary: "Sales Manager rejected offer (discount too deep)", linkedRecordType: "OFFER", linkedRecordId: offer.id } });
    await prisma.notification.create({ data: { recipientId: raj.id, title: "Your offer was rejected", body: "Helvetia executive fleet — SM rejected 22% discount. See comment and resubmit.", linkedRecordType: "OFFER", linkedRecordId: offer.id } });
  }

  // ----------------------------- Per-role notifications + TAM case assignment + timeline -----------------------------
  await prisma.notification.create({ data: { recipientId: timo.id, title: "Critical case assigned", body: "NordSec Logistics — devices failing MDM check-in (CRITICAL).", linkedRecordType: "CASE", linkedRecordId: null } });
  await prisma.notification.create({ data: { recipientId: lena.id, title: "Case escalated to 3rd party", body: "RheinWerk Manufacturing — suspicious access escalated to incident response.", linkedRecordType: "CASE", linkedRecordId: null } });

  // A little account-timeline texture so the Account 360 page isn't empty.
  for (const a of accounts.slice(0, 5)) {
    await prisma.activityEvent.create({ data: { accountId: a.id, actorId: a.ownerRepId, type: "ACCOUNT_NOTE", summary: "Quarterly review scheduled with account.", linkedRecordType: "ACCOUNT", linkedRecordId: a.id, createdAt: daysAgo(8) } });
  }

  // ----------------------------- Summary -----------------------------
  const counts = {
    users: await prisma.user.count(),
    accounts: await prisma.account.count(),
    contacts: await prisma.contact.count(),
    deals: await prisma.deal.count(),
    forecastRows: await prisma.dealForecastPeriod.count(),
    products: await prisma.product.count(),
    services: await prisma.service.count(),
    cases: await prisma.case.count(),
    offers: await prisma.offer.count(),
    approvals: await prisma.approval.count(),
    notifications: await prisma.notification.count(),
    activity: await prisma.activityEvent.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
