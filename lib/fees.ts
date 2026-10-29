// Fees types and money helpers. The API sends and receives amounts as integer paise.

export const PAYMENT_MODES = ["cash", "upi", "card", "bank", "cheque", "other"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const MODE_LABEL: Record<PaymentMode, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank: "Bank transfer",
  cheque: "Cheque",
  other: "Other",
};

/** What the "reference" field means for each mode (empty = not asked). */
export const MODE_REFERENCE: Record<PaymentMode, string> = {
  cash: "",
  upi: "UPI transaction ID",
  card: "Card transaction ID",
  bank: "UTR / reference no",
  cheque: "Cheque no & bank",
  other: "Reference",
};

export type DueStatus = "paid" | "partial" | "due" | "overdue";

export interface FeeItem {
  name: string;
  amount: number;
}

export interface Installment {
  id: string;
  label: string;
  dueDate: string;
  items: FeeItem[];
  total: number;
}

export interface FeePlan {
  id: string;
  name: string;
  academicYear: string;
  grade: string;
  description: string;
  installments: Installment[];
  total: number;
  archived: boolean;
  stats?: { students: number; billed: number; paid: number; /** Active students of the plan's class without it (e.g. new admissions) */ missing?: number };
}

export interface Due {
  id: string;
  planId: string;
  planName: string;
  label: string;
  dueDate: string;
  items: FeeItem[];
  amount: number;
  discount: number;
  discountReason: string;
  discountSource?: "concession" | "manual" | "";
  paid: number;
  balance: number;
  status: DueStatus;
}

export interface Payment {
  id: string;
  receiptNo: string;
  studentId: string;
  student: { fullName: string; admissionNo: string; grade: string; section: string; guardianName: string };
  date: string;
  amount: number;
  /** "opening": paid before the school used EduFlow (not counted in collections) */
  kind?: "receipt" | "opening";
  /** Part of this payment not on any due yet */
  advance?: number;
  mode: PaymentMode;
  reference: string;
  note: string;
  allocations: { invoiceId: string; label: string; planName: string; amount: number }[];
  receivedByName: string;
  createdAt: string;
  voided: { at: string; byName: string; reason: string } | null;
}

export type ConcessionType = "percent" | "amount" | "fixed" | "free";

/** A standing concession on a student (amounts in paise). */
export interface Concession {
  type: ConcessionType;
  value: number;
  reason: string;
  presetId?: string | null;
  label?: string;
  updatedByName?: string;
  updatedAt?: string | null;
}

export interface ConcessionPreset {
  id: string | null;
  name: string;
  type: ConcessionType;
  value: number;
}

/** Discount on one installment; mirrors the server. */
export function concessionDiscount(amount: number, c: Pick<Concession, "type" | "value"> | null | undefined) {
  if (!c) return 0;
  if (c.type === "free") return amount;
  if (c.type === "percent") return Math.min(amount, Math.round((amount * c.value) / 100));
  if (c.type === "amount") return Math.min(amount, c.value);
  return Math.max(0, amount - c.value);
}

/** "10% off", "₹500 off", "pays ₹1,000", "Free" */
export function concessionShort(c: Pick<Concession, "type" | "value">) {
  if (c.type === "free") return "Free";
  if (c.type === "percent") return `${c.value}% off`;
  if (c.type === "amount") return `${formatMoney(c.value)} off`;
  return `Pays ${formatMoney(c.value)}`;
}

export interface Receipt {
  payment: Payment;
  school: { name: string };
  currentBalance: number;
  /** The student's advance right now */
  currentAdvance?: number;
  /** Their whole fee account right now */
  account?: { fee: number; paid: number; balance: number; advance: number };
  /** Concessions on the dues this payment went to */
  concessions?: { label: string; planName: string; fee: number; discount: number; reason: string }[];
}

export interface FeeTotals {
  billed: number;
  discount: number;
  paid: number;
  balance: number;
  overdue: number;
}

export interface RegisterRow extends FeeTotals {
  id: string;
  fullName: string;
  admissionNo: string;
  grade: string;
  section: string;
  rollNo: string;
  studentStatus: string;
  guardianName: string;
  guardianPhone: string;
  dues: number;
  /** Paid but not on any due yet */
  advance?: number;
  nextDue: string | null;
}

export interface Ledger {
  student: { id: string; fullName: string; admissionNo: string; grade: string; section: string; guardianName: string; guardianPhone: string; status: string; concession?: Concession | null };
  dues: Due[];
  payments: Payment[];
  totals: FeeTotals & { advance?: number };
}

export interface FeeSummary {
  range: { from: string; to: string };
  collected: { amount: number; count: number };
  byMode: { mode: PaymentMode; amount: number; count: number }[];
  byDay: { date: string; amount: number }[];
  dues: FeeTotals & { overdueStudents: number; collectionRate: number | null };
  upcoming: { amount: number; students: number };
  byClass: { grade: string; section: string; billed: number; paid: number; balance: number; overdue: number }[];
  recent: Payment[];
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrCompact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });

/** ₹12,34,567 (paise shown only when present). */
export function formatMoney(paise: number) {
  return (paise % 100 ? inrPaise : inr).format(paise / 100);
}

/** ₹12.3L style for tight spaces like chart axes. */
export function formatMoneyCompact(paise: number) {
  return inrCompact.format(paise / 100);
}

/** "1,500.50" → 150050; empty or invalid → null. */
export function parseMoney(input: string): number | null {
  const clean = input.replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

/** Paise as an editable rupee string: 150050 → "1500.50", 150000 → "1500". */
export function moneyInput(paise: number) {
  return paise % 100 ? (paise / 100).toFixed(2) : String(paise / 100);
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? " " + ONES[r % 10] : ""}`;
  return [h ? `${ONES[h]} Hundred` : "", rest].filter(Boolean).join(" ");
}

/** Indian numbering in words, as printed on receipts: "Rupees One Lakh Twenty Thousand Only". */
export function amountInWords(paise: number) {
  let rupees = Math.floor(paise / 100);
  const p = paise % 100;
  if (rupees === 0) return p ? `${below1000(p)} Paise Only` : "Rupees Zero Only";
  const parts: string[] = [];
  const crore = Math.floor(rupees / 1e7);
  rupees %= 1e7;
  const lakh = Math.floor(rupees / 1e5);
  rupees %= 1e5;
  const thousand = Math.floor(rupees / 1e3);
  rupees %= 1e3;
  if (crore) parts.push(`${crore >= 1000 ? amountInWords(crore * 100).replace(/^Rupees | Only$/g, "") : below1000(crore)} Crore`);
  if (lakh) parts.push(`${below1000(lakh)} Lakh`);
  if (thousand) parts.push(`${below1000(thousand)} Thousand`);
  if (rupees) parts.push(below1000(rupees));
  const words = parts.join(" ");
  return `Rupees ${words || "Zero"}${p ? ` and ${below1000(p)} Paise` : ""} Only`;
}

export const STATUS_BADGE: Record<DueStatus, { label: string; tone: "success" | "accent" | "neutral" | "danger" }> = {
  paid: { label: "Paid", tone: "success" },
  partial: { label: "Part paid", tone: "accent" },
  due: { label: "Due", tone: "neutral" },
  overdue: { label: "Overdue", tone: "danger" },
};
