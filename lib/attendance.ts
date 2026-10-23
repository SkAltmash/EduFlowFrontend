// Attendance types, status styling and calendar-day helpers.
// Days are "YYYY-MM-DD" strings in the school's local calendar, never Date objects in transit.

export const ATTENDANCE_STATUSES = ["present", "absent", "late", "leave"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const STATUS_META: Record<
  AttendanceStatus,
  { label: string; short: string; key: string; dot: string; selected: string; text: string }
> = {
  present: { label: "Present", short: "P", key: "p", dot: "bg-success", selected: "bg-success text-background border-success", text: "text-success" },
  absent: { label: "Absent", short: "A", key: "a", dot: "bg-danger", selected: "bg-danger text-background border-danger", text: "text-danger" },
  late: { label: "Late", short: "L", key: "l", dot: "bg-warning", selected: "bg-warning text-background border-warning", text: "text-warning" },
  leave: { label: "Leave", short: "LV", key: "v", dot: "bg-accent", selected: "bg-accent text-accent-foreground border-accent", text: "text-accent" },
};

export type StatusCounts = Record<AttendanceStatus, number>;

export interface ClassSummary {
  grade: string;
  section: string;
  students: number;
  marked: number;
  counts: StatusCounts;
  rate: number | null;
}

export interface RegisterStudent {
  id: string;
  admissionNo: string;
  fullName: string;
  rollNo: string;
  /** false = no longer in this class (moved or left) but marked here that day */
  current: boolean;
  attendance: { status: AttendanceStatus; note: string } | null;
}

export interface Register {
  date: string;
  grade: string;
  section: string;
  students: RegisterStudent[];
  summary: StatusCounts & { total: number; marked: number; unmarked: number; rate: number | null };
  lastMarked: { at: string; by: string | null } | null;
  canEdit: boolean;
  reason: string | null;
  teacherEditWindowDays: number;
}

export interface ClassReport {
  grade: string;
  section: string;
  from: string;
  to: string;
  dates: string[];
  students: {
    student: { id: string; admissionNo: string; fullName: string; rollNo: string; status: string };
    counts: StatusCounts;
    days: Record<string, AttendanceStatus>;
    marked: number;
    rate: number | null;
  }[];
  summary: StatusCounts & { days: number; rate: number | null };
}

export interface StudentAttendance {
  records: { date: string; status: AttendanceStatus; note: string }[];
  summary: StatusCounts & { marked: number; rate: number | null };
}

/** Below this rate a student is flagged (a common minimum attendance rule). */
export const LOW_ATTENDANCE = 75;

export const className = (grade: string, section: string) => (section ? `${grade} - ${section}` : grade);

// ---------------------------------------------------------------------------
// Calendar days
// ---------------------------------------------------------------------------

/** Today in the browser's time zone, as YYYY-MM-DD. */
export function localToday() {
  return new Date().toLocaleDateString("en-CA");
}

export function addDays(day: string, n: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

export function formatDay(day: string, style: "long" | "short" = "long") {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: style === "long" ? "long" : "short",
    day: "numeric",
    month: style === "long" ? "long" : "short",
  });
}

/** First and last day of a "YYYY-MM" month; the last day is capped at today. */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const today = localToday();
  return { from, to: last < today ? last : today };
}

export function formatRate(rate: number | null) {
  return rate === null ? "—" : `${rate % 1 === 0 ? rate : rate.toFixed(1)}%`;
}
