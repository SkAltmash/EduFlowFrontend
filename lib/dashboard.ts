// Home-screen summary (GET /api/dashboard). Sections the role can't see are null.
import type { StatusCounts } from "@/lib/attendance";
import type { Slot } from "@/lib/classroom";
import type { Payment } from "@/lib/fees";
import type { MyClass } from "@/lib/teaching";

export interface Dashboard {
  date: string;
  /** A teacher's assigned classes ("My day"); limited = numbers cover only these */
  scope: { limited: boolean; classes: MyClass[] };
  today: {
    periods: Slot[];
    birthdays: { id: string; fullName: string; grade: string; section: string; date: string; age: number; today: boolean }[];
    leaves: { id: string; studentId: string; fullName: string; grade: string; section: string; reason: string; until: string }[];
    homeworkPosted: number;
  };
  notices: { unread: number; latest: { id: string; title: string; audience: "staff" | "parents"; pinned: boolean; createdAt: string; createdByName: string; read: boolean }[] };
  /** Open correction requests from teachers (owners/admins) */
  corrections: number;
  students: { active: number; total: number; newThisMonth: number };
  attendance: {
    date: string;
    counts: StatusCounts;
    rate: number | null;
    classes: { grade: string; section: string; students: number; marked: number; rate: number | null }[];
    classesMarked: number;
    classesTotal: number;
    absent: { id: string; fullName: string; grade: string; section: string; hasPhone: boolean }[];
    absentTotal: number;
    trend: { date: string; rate: number | null; marked: number }[];
  } | null;
  tests: {
    recent: { id: string; name: string; grade: string; section: string; date: string; subjects: number; marked: number; students: number }[];
  } | null;
  fees: {
    collectedToday: number;
    collectedMonth: { amount: number; count: number };
    outstanding: number;
    overdue: number;
    overdueStudents: number;
    collectionRate: number | null;
    upcoming: { amount: number; students: number };
    recent: Payment[];
  } | null;
}
