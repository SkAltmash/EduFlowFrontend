// Home-screen summary (GET /api/dashboard). Sections the role can't see are null.
import type { StatusCounts } from "@/lib/attendance";
import type { Payment } from "@/lib/fees";

export interface Dashboard {
  date: string;
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
