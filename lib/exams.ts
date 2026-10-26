// Tests, marks and report cards. Results (totals, grades, ranks) are computed by the API.

export interface Subject {
  id: string;
  name: string;
  maxMarks: number;
  passMarks: number | null;
}

export interface Exam {
  id: string;
  name: string;
  grade: string;
  /** "" = the whole class (every section) */
  section: string;
  date: string;
  description: string;
  subjects: Subject[];
  maxTotal: number;
}

export interface SubjectResult {
  subjectId: string;
  marks: number | null;
  absent: boolean;
  percent: number | null;
  grade: string | null;
  passed: boolean | null;
}

export type ResultStatus = "pending" | "absent" | "pass" | "fail";

export interface Result {
  subjects: SubjectResult[];
  total: number | null;
  max: number;
  percent: number | null;
  grade: string | null;
  status: ResultStatus;
  failedSubjects: number;
  entered: number;
  rank: number | null;
}

export interface ExamRow {
  student: { id: string; fullName: string; admissionNo: string; rollNo: string; grade: string; section: string; current: boolean };
  remarks: string;
  updatedAt: string | null;
  result: Result;
}

export interface ExamStats {
  students: number;
  completed: number;
  pending: number;
  absent: number;
  passed: number;
  failed: number;
  average: number | null;
  highest: number | null;
  lowest: number | null;
  passRate: number | null;
  distribution: Record<string, number>;
  subjects: { subjectId: string; average: number | null; highest: number | null }[];
}

export interface Grading {
  scale: "cbse" | "simple";
  passPercent: number;
}

export interface ExamView {
  exam: Exam;
  grading: Grading;
  students: ExamRow[];
  stats: ExamStats;
}

export interface ExamListItem extends Exam {
  stats: { students: number; completed: number; average: number | null; passed: number };
}

export interface AttendanceMonth {
  present: number;
  absent: number;
  late: number;
  leave: number;
  days: number;
  rate: number | null;
}

export interface StudentMonthlyReport {
  school: { name: string };
  student: { id: string; fullName: string; admissionNo: string; rollNo: string; grade: string; section: string; guardianName: string };
  month: string;
  grading: Grading;
  tests: { exam: Exam; result: Result; remarks: string }[];
  summary: { tests: number; completed: number; average: number | null; grade: string | null };
  attendance: AttendanceMonth;
}

export interface ClassMonthlyReport {
  grade: string;
  section: string;
  month: string;
  grading: Grading;
  exams: Exam[];
  students: {
    student: { id: string; fullName: string; admissionNo: string; rollNo: string; grade: string; section: string };
    tests: { examId: string; percent: number | null; grade: string | null; status: ResultStatus }[];
    average: number | null;
    grade: string | null;
    attendance: AttendanceMonth;
  }[];
}

export const SCALE_BANDS: Record<Grading["scale"], { grade: string; min: number }[]> = {
  cbse: [
    { grade: "A1", min: 91 },
    { grade: "A2", min: 81 },
    { grade: "B1", min: 71 },
    { grade: "B2", min: 61 },
    { grade: "C1", min: 51 },
    { grade: "C2", min: 41 },
    { grade: "D", min: 33 },
    { grade: "E", min: 0 },
  ],
  simple: [
    { grade: "A+", min: 90 },
    { grade: "A", min: 80 },
    { grade: "B+", min: 70 },
    { grade: "B", min: 60 },
    { grade: "C", min: 50 },
    { grade: "D", min: 40 },
    { grade: "E", min: 33 },
    { grade: "F", min: 0 },
  ],
};

/** Common subjects offered as one-tap chips when creating a test. */
export const SUBJECT_PRESETS = ["English", "Hindi", "Mathematics", "Science", "Social Science", "Sanskrit", "Urdu", "Computer", "EVS", "Drawing"];

export const classLabel = (grade: string, section: string) => (section ? `${grade} - ${section}` : `${grade} (all sections)`);

export const formatPct = (p: number | null | undefined) => (p === null || p === undefined ? "—" : `${p % 1 === 0 ? p : p.toFixed(1)}%`);

export const formatMark = (m: number | null | undefined) => (m === null || m === undefined ? "—" : String(Math.round(m * 100) / 100));

/** Badge colour for a letter grade: top bands green, middle neutral, bottom red. */
export function gradeTone(grade: string | null, scale: Grading["scale"]): "success" | "accent" | "neutral" | "danger" {
  if (!grade || grade === "AB") return "neutral";
  const bands = SCALE_BANDS[scale];
  const i = bands.findIndex((b) => b.grade === grade);
  if (i < 0) return "neutral";
  if (i <= 1) return "success";
  if (i >= bands.length - 1) return "danger";
  return i <= 3 ? "accent" : "neutral";
}

export const STATUS_TEXT: Record<ResultStatus, string> = {
  pending: "Marks pending",
  absent: "Absent",
  pass: "Pass",
  fail: "Needs improvement",
};
