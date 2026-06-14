// Entity types — bind your Prisma rows to these shapes in your server pages.

export type Role = "REP" | "TAM" | "SALES_MANAGER" | "FINANCE";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarHue?: number;
}

export type AccountStatus = "ACTIVE" | "PROSPECT" | "CHURNED";
export interface Account {
  id: string;
  name: string;
  domain?: string;
  address?: string;
  vatId?: string;
  region?: string;
  segment?: string;
  industry?: string;
  status?: AccountStatus;
  ownerId?: string;
  ownerName?: string;
  tamId?: string;
  tamName?: string;
}

export type DecisionRole = "FINANCIAL" | "BUDGET" | "TECH" | "INFLUENCER";
export interface Contact {
  id: string;
  accountId: string;
  name: string;
  title?: string;
  decisionRole?: DecisionRole;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

export type DealChannel = "DIRECT" | "RESELLER";
export type DealStage =
  | "LEAD"
  | "DISCOVERY"
  | "QUALIFIED"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "CLOSED_WON"
  | "CLOSED_LOST";
export type DealStatus = "OPEN" | "WON" | "LOST" | "STALLED";
export type ServiceModel = "DEVICE_ONLY" | "DEVICE_PLUS_SERVICES" | "SERVICES_ONLY";
export interface Deal {
  id: string;
  accountId: string;
  accountName?: string;
  name: string;
  channel: DealChannel;
  stage: DealStage;
  probability: number; // 0-100
  expectedCloseDate?: string;
  lastActivityAt?: string;
  status: DealStatus;
  serviceModel: ServiceModel;
  ownerId?: string;
  ownerName?: string;
  amount?: number;
  aiSummary?: string;
}

export interface DealForecastPeriod {
  periodLabel: string; // e.g. "2026 Q3"
  deviceUnits: number;
  deviceRevenue: number;
  serviceRevenue: number;
  totalRevenue: number;
  weightedRevenue: number;
}

export type ProductStatus = "ACTIVE" | "RETIRED";
export interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string;
  unitPrice: number;
  gmPercent: number;
  currency: string;
  status: ProductStatus;
}

export type ProviderType = "INTERNAL" | "THIRD_PARTY";
export type InvoicingModel = "ONE_OFF" | "FIXED_TERM" | "MONTHLY_RECURRING";
export interface Service {
  id: string;
  name: string;
  providerType: ProviderType;
  invoicingModel: InvoicingModel;
  basePrice: number;
  gmPercent: number;
  currency: string;
  status: ProductStatus;
}

export type CaseStatus = "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED";
export type CasePriority = "P1" | "P2" | "P3" | "P4";
export interface Case {
  id: string;
  accountId: string;
  accountName?: string;
  title: string;
  description?: string;
  status: CaseStatus;
  priority: CasePriority;
  dueDate?: string;
  closedAt?: string;
  ownerId?: string;
  ownerName?: string;
  contactName?: string;
  serviceName?: string;
}

export type OfferStatus = "DRAFT" | "PENDING_SM" | "PENDING_FINANCE" | "APPROVED" | "REJECTED";
export interface Offer {
  id: string;
  dealId?: string;
  accountName?: string;
  title?: string;
  version: number;
  status: OfferStatus;
  subtotal: number;
  discountPercent: number;
  discountJustification?: string;
  total: number;
  locked: boolean;
  currency: string;
  preparedBy?: string;
  validUntil?: string;
}

export type OfferLineItemType = "PRODUCT" | "SERVICE";
export interface OfferLineItem {
  id: string;
  offerId: string;
  itemType: OfferLineItemType;
  nameSnapshot: string;
  skuSnapshot?: string;
  unitPriceSnapshot: number;
  quantity: number;
  lineTotal: number;
}

export type ApprovalStep = "SALES_MANAGER" | "FINANCE";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export interface Approval {
  id: string;
  offerId: string;
  step: ApprovalStep;
  status: ApprovalStatus;
  approverId?: string;
  approverName?: string;
  comment?: string;
  decidedAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body?: string;
  readAt?: string | null;
  createdAt: string;
}

export type ActivityType =
  | "EMAIL"
  | "CALL"
  | "MEETING"
  | "NOTE"
  | "STAGE_CHANGE"
  | "AI_INSIGHT"
  | "SYSTEM";
export interface ActivityEvent {
  id: string;
  accountId?: string;
  dealId?: string;
  caseId?: string;
  type: ActivityType;
  summary: string;
  actorName?: string;
  createdAt: string;
}

/** Server-action signature used by every form prop. */
export type ServerAction = (formData: FormData) => void | Promise<void>;
export const noopAction: ServerAction = () => {};
