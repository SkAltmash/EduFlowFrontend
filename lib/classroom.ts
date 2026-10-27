// Homework, leave, notes, notices, timetable, syllabus and correction requests.

export interface Homework {
  id: string;
  grade: string;
  section: string;
  subject: string;
  title: string;
  details: string;
  date: string;
  dueDate: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface Leave {
  id: string;
  studentId: string;
  studentName: string;
  grade: string;
  section: string;
  from: string;
  to: string;
  reason: string;
  createdBy: string;
  createdByName: string;
}

export type NoteKind = "note" | "praise" | "concern" | "meeting";
export interface StudentNote {
  id: string;
  studentId: string;
  kind: NoteKind;
  text: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}
export const NOTE_META: Record<NoteKind, { label: string; tone: "neutral" | "success" | "danger" | "accent"; icon: string }> = {
  note: { label: "Note", tone: "neutral", icon: "M4 4h16v12H8l-4 4V4z" },
  praise: { label: "Praise", tone: "success", icon: "M12 17.3l-6.2 3.6 1.6-7L2 9.2l7.1-.6L12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7z" },
  concern: { label: "Concern", tone: "danger", icon: "M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" },
  meeting: { label: "Parent meeting", tone: "accent", icon: "M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4M12 12a3 3 0 100-6 3 3 0 000 6zM20 18c0-1.7-1-3.1-2.5-3.7M17 6.3a3 3 0 010 5.4" },
};

export interface Notice {
  id: string;
  audience: "staff" | "parents";
  title: string;
  body: string;
  classes: { grade: string; section: string }[];
  pinned: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  read: boolean;
}

export interface Slot {
  id: string;
  grade: string;
  section: string;
  day: number;
  start: string;
  end: string;
  subject: string;
  teacherId: string | null;
  teacherName: string;
}
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
/** 1 = Monday … 7 = Sunday, for a YYYY-MM-DD day. */
export const weekdayOf = (day: string) => ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

export interface Topic {
  id: string;
  title: string;
  order: number;
  completed: { section: string; date: string; byName: string }[];
}

export interface CorrectionRequest {
  id: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  grade: string;
  section: string;
  message: string;
  status: "open" | "resolved";
  createdByName: string;
  createdAt: string;
  resolvedByName: string | null;
  resolvedAt: string | null;
}

/** Fired after notices are read or changed, so the bell recounts. */
export const NOTICES_CHANGED_EVENT = "eduflow:notices";

export const NAV_ICONS = {
  homework: "M4 19.5V5a2 2 0 012-2h13v16H6.5a2.5 2.5 0 000 5H19M8 7h7M8 11h5",
  notices: "M4 10v4a1 1 0 001 1h2l5 4V5L7 9H5a1 1 0 00-1 1zM16 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12",
  timetable: "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",
  bell: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-3.5-3.5",
};
