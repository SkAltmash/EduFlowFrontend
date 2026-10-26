// Classes (with sections and subjects), academic years and year-end promotion (/api/academics).
import { api } from "@/lib/api";

export interface SchoolClass {
  id: string;
  name: string;
  order: number;
  sections: string[];
  subjects: { id: string; name: string; maxMarks: number | null }[];
  /** Active students */
  students: number;
  sectionCounts: Record<string, number>;
}

export interface ClassList {
  classes: SchoolClass[];
  /** Class names on students that aren't in the list ("Class 5" when the list has "5") */
  unknown: { grade: string; students: number; sections: string[]; suggestion: string | null }[];
  /** Sections used by students but missing from their class */
  strays: { grade: string; section: string; students: number }[];
  unassigned: number;
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface PromotionPreview {
  currentYear: AcademicYear;
  nextYear: { name: string; startDate: string; endDate: string };
  classes: (SchoolClass & {
    suggestedTarget: string;
    roster: { id: string; fullName: string; admissionNo: string; section: string; rollNo: string }[];
  })[];
  unknown: ClassList["unknown"];
  unassigned: number;
}

export type Outcome = "promoted" | "retained" | "graduated" | "left";

export interface PromotionSummary {
  id: string;
  fromYear: string;
  toYear: string;
  counts: Record<Outcome, number>;
  students: number;
  createdAt: string;
  createdByName: string;
  undone: { at: string; byName: string; restored: number; skipped: number } | null;
  canUndo?: boolean;
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  promoted: "Promoted",
  retained: "Repeated the year",
  graduated: "Graduated",
  left: "Left",
};

export const loadClassList = () => api<ClassList>("/api/academics/classes");
export const loadYears = () => api<{ years: AcademicYear[]; current: AcademicYear }>("/api/academics/years");

/** Ready-made class lists for a new school. */
export const CLASS_TEMPLATES: { id: string; label: string; names: string[] }[] = [
  { id: "n-10", label: "Nursery to 10", names: ["Nursery", "LKG", "UKG", ...Array.from({ length: 10 }, (_, i) => String(i + 1))] },
  { id: "n-12", label: "Nursery to 12", names: ["Nursery", "LKG", "UKG", ...Array.from({ length: 12 }, (_, i) => String(i + 1))] },
  { id: "1-10", label: "1 to 10", names: Array.from({ length: 10 }, (_, i) => String(i + 1)) },
  { id: "1-12", label: "1 to 12", names: Array.from({ length: 12 }, (_, i) => String(i + 1)) },
  { id: "6-12", label: "6 to 12 (coaching)", names: Array.from({ length: 7 }, (_, i) => String(i + 6)) },
];

/** "A, B , c" → ["A", "B", "C"] (single letters upper-cased, duplicates dropped). */
export function parseSections(text: string) {
  const out: string[] = [];
  for (const raw of text.split(/[,\n]/)) {
    const s = raw.trim();
    const v = s.length <= 2 ? s.toUpperCase() : s;
    if (v && !out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v);
  }
  return out;
}
