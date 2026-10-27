// Teaching assignments: which classes and subjects the signed-in member teaches.
import { api } from "@/lib/api";

export interface MyClass {
  grade: string;
  section: string;
  classTeacher: boolean;
  subjects: string[];
}

export interface MyClasses {
  /** false = not limited (admins, or a teacher not assigned yet): every class */
  limited: boolean;
  classes: MyClass[];
}

let cached: Promise<MyClasses> | null = null;

/** One request per page load. */
export function loadMyClasses() {
  cached ??= api<MyClasses>("/api/teaching/me").catch((err) => {
    cached = null;
    throw err;
  });
  return cached;
}

export const classKey = (grade: string, section: string) => `${grade}|${section}`;
export const classText = (grade: string, section: string) => (section ? `${grade} - ${section}` : grade);

/** Does an assignment cover this class/section ("" section on either side = whole class)? */
export function teaches(my: MyClasses | null | undefined, grade: string, section = "") {
  if (!my || !my.limited) return true;
  return my.classes.some((c) => c.grade === grade && (!c.section || !section || c.section === section));
}

/** Subjects the member may teach in a class; null = any. */
export function subjectsIn(my: MyClasses | null | undefined, grade: string, section = "") {
  if (!my || !my.limited) return null;
  const covering = my.classes.filter((c) => c.grade === grade && (!c.section || !section || c.section === section));
  if (covering.some((c) => c.classTeacher)) return null;
  return [...new Set(covering.flatMap((c) => c.subjects))];
}

export interface Assignment {
  grade: string;
  section: string;
  subject: string;
}

export interface AllAssignments {
  teachers: { userId: string; classes: MyClass[] }[];
  classTeachers: { userId: string; grade: string; section: string }[];
}
