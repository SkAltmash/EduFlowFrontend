// The school's profile (GET /api/school), shared by Settings and every printed letterhead.
import { api, type Role } from "@/lib/api";

export const SCHOOL_TYPES = [
  ["school", "School"],
  ["tuition", "Tuition centre"],
  ["coaching", "Coaching institute"],
  ["other", "Other"],
] as const;
export type SchoolType = (typeof SCHOOL_TYPES)[number][0];

export interface School {
  id: string;
  name: string;
  slug: string;
  type: SchoolType;
  board: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  academicYearStart: number;
  receiptNote: string;
  /** Logo on Cloudinary ("" = none) */
  logoUrl: string;
  /** Whether logo upload is available (set up by EduFlow) */
  logoUploads?: boolean;
  /** How fee receipts look (Settings → Receipts) */
  receipt?: ReceiptSettings;
  /** How report cards look (Settings → Report cards) */
  reportCard?: ReportCardSettings;
  createdAt: string;
}

export const RECEIPT_SHOW = [
  ["logo", "Logo"],
  ["schoolName", "School name (turn off if your logo has it)"],
  ["title", "Title (e.g. \u201cFee receipt\u201d)"],
  ["contact", "School address & contact"],
  ["guardian", "Guardian name"],
  ["amountInWords", "Amount in words"],
  ["summary", "Fee summary (total, paid, balance)"],
  ["concessions", "Concession details"],
  ["receivedBy", "Received by (staff name)"],
  ["signature", "Signature line"],
  ["footer", "\u201cComputer-generated receipt\u201d line"],
] as const;
export type ReceiptShowKey = (typeof RECEIPT_SHOW)[number][0];

export type ReceiptAccent = "indigo" | "emerald" | "teal" | "maroon" | "orange" | "slate";

export interface ReceiptSettings {
  title: string;
  accent: ReceiptAccent;
  prefix: string;
  signatureLabel: string;
  paper: "a5" | "a4";
  twoCopies: boolean;
  show: Record<ReceiptShowKey, boolean>;
}

export const RECEIPT_DEFAULTS: ReceiptSettings = {
  title: "Fee receipt",
  accent: "indigo",
  prefix: "R",
  signatureLabel: "Authorised signature",
  paper: "a5",
  twoCopies: false,
  show: Object.fromEntries(RECEIPT_SHOW.map(([k]) => [k, true])) as Record<ReceiptShowKey, boolean>,
};

/** Fixed paper colours per accent (full class names so Tailwind keeps them). */
export const RECEIPT_ACCENTS: Record<ReceiptAccent, { label: string; swatch: string; strip: string; rule: string; box: string; badge: string; text: string }> = {
  indigo: { label: "Indigo", swatch: "bg-indigo-700", strip: "from-indigo-700 via-indigo-500 to-emerald-500", rule: "border-indigo-900", box: "border-indigo-200 bg-indigo-50", badge: "bg-indigo-700", text: "text-indigo-800" },
  emerald: { label: "Green", swatch: "bg-emerald-700", strip: "from-emerald-700 via-emerald-500 to-lime-400", rule: "border-emerald-900", box: "border-emerald-200 bg-emerald-50", badge: "bg-emerald-600", text: "text-emerald-800" },
  teal: { label: "Teal", swatch: "bg-teal-700", strip: "from-teal-700 via-teal-500 to-cyan-400", rule: "border-teal-900", box: "border-teal-200 bg-teal-50", badge: "bg-teal-600", text: "text-teal-800" },
  maroon: { label: "Maroon", swatch: "bg-rose-900", strip: "from-rose-900 via-rose-700 to-amber-500", rule: "border-rose-950", box: "border-rose-200 bg-rose-50", badge: "bg-rose-800", text: "text-rose-900" },
  orange: { label: "Saffron", swatch: "bg-orange-600", strip: "from-orange-600 via-amber-500 to-yellow-400", rule: "border-orange-900", box: "border-orange-200 bg-orange-50", badge: "bg-orange-600", text: "text-orange-800" },
  slate: { label: "Black", swatch: "bg-zinc-900", strip: "from-zinc-900 via-zinc-700 to-zinc-500", rule: "border-zinc-900", box: "border-zinc-300 bg-zinc-50", badge: "bg-zinc-800", text: "text-zinc-900" },
};

/** The school's receipt settings with defaults filled in. */
export function receiptSettings(s?: Partial<ReceiptSettings> | null): ReceiptSettings {
  return { ...RECEIPT_DEFAULTS, ...(s ?? {}), show: { ...RECEIPT_DEFAULTS.show, ...(s?.show ?? {}) } };
}

export const REPORT_SHOW = [
  ["logo", "Logo"],
  ["schoolName", "School name (turn off if your logo has it)"],
  ["title", "Title (e.g. \u201cReport card\u201d)"],
  ["contact", "School address & contact"],
  ["admissionNo", "Admission no"],
  ["rollNo", "Roll no"],
  ["gradeColumn", "Grade per subject"],
  ["resultColumn", "Pass / below pass per subject"],
  ["percentage", "Percentage"],
  ["rank", "Rank in class"],
  ["resultBox", "Overall result (Pass / Fail)"],
  ["remarks", "Teacher\u2019s remarks"],
  ["attendance", "Attendance (monthly report)"],
] as const;
export type ReportShowKey = (typeof REPORT_SHOW)[number][0];

export interface ReportCardSettings {
  title: string;
  monthlyTitle: string;
  accent: ReceiptAccent;
  signatures: string[];
  note: string;
  paper: "a5" | "a4";
  show: Record<ReportShowKey, boolean>;
}

export const REPORT_DEFAULTS: ReportCardSettings = {
  title: "Report card",
  monthlyTitle: "Monthly progress report",
  accent: "indigo",
  signatures: ["Class teacher", "Principal", "Parent"],
  note: "",
  paper: "a4",
  show: Object.fromEntries(REPORT_SHOW.map(([k]) => [k, true])) as Record<ReportShowKey, boolean>,
};

/** The school's report card settings with defaults filled in. */
export function reportCardSettings(s?: Partial<ReportCardSettings> | null): ReportCardSettings {
  return { ...REPORT_DEFAULTS, ...(s ?? {}), show: { ...REPORT_DEFAULTS.show, ...(s?.show ?? {}) } };
}

export interface Member {
  userId: string;
  name: string;
  email: string;
  isActive: boolean;
  role: Role;
  joinedAt: string;
}

export const ROLE_INFO: Record<Role, { label: string; text: string }> = {
  owner: { label: "Owner", text: "Everything, including adding other owners" },
  admin: { label: "Admin", text: "Everything except owner and admin access" },
  teacher: { label: "Teacher", text: "Students, attendance and tests. No fees" },
  accountant: { label: "Accountant", text: "Students and fees only. No attendance or tests" },
};

/** "12 MG Road, Pune, Maharashtra 411001" from whatever parts are filled in. */
export function addressLine(s: Pick<School, "address" | "city" | "state" | "pincode">) {
  const region = [s.state, s.pincode].filter(Boolean).join(" ");
  return [s.address, s.city, region].filter(Boolean).join(", ");
}

// One request per page load, shared by every letterhead on screen
let cached: Promise<School> | null = null;

export function loadSchool() {
  cached ??= api<{ school: School }>("/api/school")
    .then((r) => r.school)
    .catch((err) => {
      cached = null;
      throw err;
    });
  return cached;
}

/** After a save: later reads get the saved profile without another request. */
export function setCachedSchool(school: School) {
  cached = Promise.resolve(school);
}

/** Forget the loaded profile (a super admin switching schools). */
export function forgetSchool() {
  cached = null;
}
