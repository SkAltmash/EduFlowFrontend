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
  createdAt: string;
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
