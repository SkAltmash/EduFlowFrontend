// Student performance leaderboard (GET /api/performance).

export interface PerformanceRow {
  id: string;
  fullName: string;
  admissionNo: string;
  grade: string;
  section: string;
  rollNo: string;
  marks: { average: number | null; grade: string | null; tests: number; passed: number; failed: number; best: { name: string; date: string; percent: number } | null };
  attendance: { rate: number | null; present: number; absent: number; late: number; leave: number; days: number };
  /** 70% marks + 30% attendance; null without test marks */
  score: number | null;
  previous: { marks: number | null; attendance: number | null; score: number | null };
  /** Score change since the previous period of the same length */
  change: number | null;
  rank: { overall: number | null; marks: number | null; attendance: number | null; inClass: number | null };
}

export interface Performance {
  range: { from: string; to: string };
  previous: { from: string; to: string };
  weights: { marks: number; attendance: number };
  passPercent: number;
  lowAttendance: number;
  summary: { students: number; ranked: number; tests: number; marks: number | null; attendance: number | null; perfectAttendance: number };
  students: PerformanceRow[];
  classes: { grade: string; section: string; students: number; marks: number | null; attendance: number | null; score: number | null; toppers: string[] }[];
  /** Average per subject across the period's tests, weakest first; below = students under the pass mark */
  subjects: { name: string; average: number; entries: number; tests: number; below: string[] }[];
  generatedAt: string;
}

export type Board = "overall" | "marks" | "attendance";

export const BOARD_VALUE: Record<Board, (r: PerformanceRow) => number | null> = {
  overall: (r) => r.score,
  marks: (r) => r.marks.average,
  attendance: (r) => r.attendance.rate,
};

export const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${n % 1 === 0 ? n : n.toFixed(1)}%`);

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
