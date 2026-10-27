// EduFlow subscription (what a school's plan allows) and the super admin console's data.

export type SubStatus = "none" | "trial" | "active" | "overdue" | "expired" | "suspended";
export type Feature = "whatsappApi" | "homework" | "timetable" | "performance";

export interface Access {
  status: SubStatus;
  planId: string | null;
  planName: string | null;
  cycle: "monthly" | "yearly";
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  endsAt: string | null;
  daysLeft: number | null;
  readOnly: boolean;
  /** 0 = unlimited */
  studentLimit: number;
  features: Record<Feature, boolean>;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  tone: "info" | "warning" | "success";
  linkUrl: string;
  linkLabel: string;
  startsAt: string;
  endsAt: string | null;
  active: boolean;
  createdAt: string;
}

export interface TenantStatus {
  subscription: Access;
  announcements: Announcement[];
  plans: Omit<PlatformPlan, "schools">[];
  support: { whatsapp: string; email: string };
}

export const FEATURE_LABEL: Record<Feature, string> = {
  whatsappApi: "Automatic WhatsApp",
  homework: "Homework & syllabus",
  timetable: "Timetable",
  performance: "Performance & leaderboards",
};

export const STATUS_META: Record<SubStatus, { label: string; tone: "neutral" | "accent" | "success" | "danger" }> = {
  none: { label: "No plan", tone: "neutral" },
  trial: { label: "Trial", tone: "accent" },
  active: { label: "Active", tone: "success" },
  overdue: { label: "Payment due", tone: "danger" },
  expired: { label: "Expired", tone: "danger" },
  suspended: { label: "Suspended", tone: "danger" },
};

export interface PlatformPlan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  studentLimit: number;
  features: Record<Feature, boolean>;
  isDefault: boolean;
  archived: boolean;
  order: number;
  schools: number;
}

export interface SchoolRow {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  health: "active" | "quiet" | "never" | "new";
  subscription: Access;
  mrr: number;
  students?: number;
  members?: number;
}

export interface SchoolDetail {
  school: SchoolRow & { profile: Record<string, string | number>; studentLimitOverride: number | null; featureOverrides: Partial<Record<Feature, boolean>> };
  members: { userId: string; name: string; email: string; isActive: boolean; role: string; joinedAt: string }[];
  usage: { studentsActive: number; studentsTotal: number; staff: number; attendanceLast7Days: number; feesThisMonth: number; receiptsThisMonth: number; whatsappLast30Days: number; tests: number; activeDaysLast30: number };
  payments: { id: string; planName: string; amount: number; method: string; reference: string; cycle: string; periods: number; periodStart: string; periodEnd: string; note: string; recordedByName: string; createdAt: string }[];
  notes: { id: string; text: string; byName: string; at: string }[];
  audit: { id: string; action: string; actor: { name: string; email: string } | null; metadata: unknown; createdAt: string }[];
}

export interface Dashboard {
  totals: { schools: number; byStatus: Partial<Record<SubStatus, number>>; mrr: number; arr: number; lifetimeRevenue: number; conversion: number | null; activeThisWeek: number; activeLastWeek: number; newThisMonth: number };
  signups: { week: string; count: number }[];
  revenue: { month: string; amount: number }[];
  funnel: { step: string; count: number }[];
  topSchools: { id: string; name: string; students: number }[];
  lists: { trialsEnding: SchoolRow[]; renewalsDue: SchoolRow[]; expired: SchoolRow[]; quiet: SchoolRow[] };
}

export const HEALTH_META: Record<SchoolRow["health"], { label: string; dot: string }> = {
  active: { label: "Active", dot: "bg-success" },
  quiet: { label: "Quiet 7+ days", dot: "bg-warning" },
  never: { label: "Never used", dot: "bg-danger" },
  new: { label: "New", dot: "bg-accent" },
};

/** "Ends in 3 days", "Ended 2 days ago", "No end date" */
export function endsText(a: Access) {
  if (a.daysLeft === null) return a.status === "none" ? "No plan set" : "No end date";
  if (a.daysLeft > 1) return `${a.daysLeft} days left`;
  if (a.daysLeft === 1) return "Ends tomorrow";
  if (a.daysLeft === 0) return "Ends today";
  return `Ended ${-a.daysLeft} day${a.daysLeft === -1 ? "" : "s"} ago`;
}
