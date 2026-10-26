// Student types plus CSV parsing / column mapping for the import screen.

export const STUDENT_STATUSES = ["active", "inactive", "graduated", "left"] as const;
export const GENDERS = ["male", "female", "other"] as const;

export type StudentStatus = (typeof STUDENT_STATUSES)[number];
export type Gender = (typeof GENDERS)[number];

export interface Student {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  fullName: string;
  gender: Gender | null;
  dateOfBirth: string | null;
  grade: string;
  section: string;
  rollNo: string;
  email: string;
  phone: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  address: string;
  admissionDate: string | null;
  status: StudentStatus;
  notes: string;
  /** One entry per finished academic year (written by year-end promotion), oldest first */
  classHistory?: { year: string; grade: string; section: string; rollNo: string; outcome: "promoted" | "retained" | "graduated" | "left" }[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentFilters {
  grades: string[];
  sections: string[];
  counts: Partial<Record<StudentStatus, number>> & { total: number };
}

export interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: { row: number; admissionNo: string; errors: { field: string; message: string }[] }[];
}

/** Fields that can be written through the API, in template/column order. */
export const STUDENT_FIELDS = [
  { key: "admissionNo", label: "Admission no", required: true },
  { key: "firstName", label: "First name", required: true },
  { key: "lastName", label: "Last name" },
  { key: "gender", label: "Gender" },
  { key: "dateOfBirth", label: "Date of birth" },
  { key: "grade", label: "Class" },
  { key: "section", label: "Section" },
  { key: "rollNo", label: "Roll no" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "guardianName", label: "Guardian name" },
  { key: "guardianPhone", label: "Guardian phone" },
  { key: "guardianEmail", label: "Guardian email" },
  { key: "address", label: "Address" },
  { key: "admissionDate", label: "Admission date" },
  { key: "status", label: "Status" },
  { key: "notes", label: "Notes" },
] as const;

export type StudentField = (typeof STUDENT_FIELDS)[number]["key"];

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** RFC 4180 parser: quoted fields, escaped quotes (""), commas/newlines in quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Drop blank lines
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function csvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: string[][]) {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Header + two example rows, used for the downloadable CSV / Excel template. */
export function templateRows(): string[][] {
  return [
    STUDENT_FIELDS.map((f) => f.label),
    ["ADM-001", "Aarav", "Sharma", "male", "2014-03-21", "5", "A", "12", "", "", "Rohit Sharma", "9876543210", "rohit@example.com", "12 MG Road, Pune", "2024-04-01", "active", ""],
    ["ADM-002", "Zara", "Khan", "female", "2013-08-21", "6", "B", "4", "", "", "Imran Khan", "9123456780", "", "", "", "", "Scholarship"],
  ];
}

export const DATE_FIELDS: StudentField[] = ["dateOfBirth", "admissionDate"];

/**
 * Students as spreadsheet rows. Headers and values match the import format,
 * so an exported file can be edited and imported again.
 */
export function studentsToRows(students: Student[], fields: StudentField[]): string[][] {
  const header = fields.map((key) => STUDENT_FIELDS.find((f) => f.key === key)!.label);
  const rows = students.map((s) =>
    fields.map((key) => {
      const value = s[key];
      if (value === null || value === undefined) return "";
      return DATE_FIELDS.includes(key) ? String(value).slice(0, 10) : String(value);
    })
  );
  return [header, ...rows];
}

// Header aliases, compared after lowercasing and removing everything but letters/digits
const ALIASES: Record<StudentField, string[]> = {
  admissionNo: ["admissionno", "admissionnumber", "admno", "admissionid", "studentid", "regno", "registrationno", "enrollmentno"],
  firstName: ["firstname", "fname", "givenname", "studentfirstname"],
  lastName: ["lastname", "lname", "surname", "familyname", "studentlastname"],
  gender: ["gender", "sex"],
  dateOfBirth: ["dateofbirth", "dob", "birthdate", "birthday"],
  grade: ["class", "grade", "standard", "std", "batch", "course"],
  section: ["section", "division", "div"],
  rollNo: ["rollno", "rollnumber", "roll"],
  email: ["email", "studentemail", "emailaddress"],
  phone: ["phone", "mobile", "studentphone", "studentmobile", "contact", "contactno", "phoneno", "mobileno"],
  guardianName: ["guardianname", "guardian", "parentname", "parent", "fathername", "mothername"],
  guardianPhone: ["guardianphone", "guardianmobile", "parentphone", "parentmobile", "parentcontact", "fatherphone", "fathermobile", "motherphone"],
  guardianEmail: ["guardianemail", "parentemail", "fatheremail", "motheremail"],
  address: ["address", "residentialaddress", "homeaddress"],
  admissionDate: ["admissiondate", "joiningdate", "dateofadmission", "joindate", "enrolleddate"],
  status: ["status"],
  notes: ["notes", "remarks", "note", "comments"],
};

const FULL_NAME_HEADERS = ["name", "fullname", "studentname"];

const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface ColumnMapping {
  /** Index of each recognised field in the CSV row */
  columns: Partial<Record<StudentField, number>>;
  /** A single "Name" column split into first/last when no first-name column exists */
  fullNameColumn: number | null;
  ignored: string[];
}

export function mapColumns(header: string[]): ColumnMapping {
  const columns: Partial<Record<StudentField, number>> = {};
  let fullNameColumn: number | null = null;
  const ignored: string[] = [];

  header.forEach((raw, index) => {
    const h = normalizeHeader(raw);
    const field = (Object.keys(ALIASES) as StudentField[]).find((f) => f.toLowerCase() === h || ALIASES[f].includes(h));
    if (field && columns[field] === undefined) columns[field] = index;
    else if (FULL_NAME_HEADERS.includes(h) && fullNameColumn === null) fullNameColumn = index;
    else if (raw.trim()) ignored.push(raw.trim());
  });

  if (columns.firstName !== undefined && fullNameColumn !== null) {
    ignored.push(header[fullNameColumn].trim());
    fullNameColumn = null;
  }
  return { columns, fullNameColumn, ignored };
}

/** DD/MM/YYYY, DD-MM-YYYY and DD.MM.YYYY become YYYY-MM-DD; other values are passed through. */
function normalizeDate(value: string) {
  const m = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return value;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function normalizeGender(value: string) {
  const v = value.toLowerCase();
  if (v === "m" || v === "boy") return "male";
  if (v === "f" || v === "girl") return "female";
  return v;
}

/** Turns CSV rows into API payloads. Empty cells are left out so they never overwrite data. */
export function rowsToStudents(rows: string[][], mapping: ColumnMapping) {
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const [field, index] of Object.entries(mapping.columns) as [StudentField, number][]) {
      let value = (row[index] ?? "").trim();
      if (!value) continue;
      if (field === "dateOfBirth" || field === "admissionDate") value = normalizeDate(value);
      if (field === "gender") value = normalizeGender(value);
      if (field === "status") value = value.toLowerCase();
      out[field] = value;
    }
    if (mapping.fullNameColumn !== null) {
      const parts = (row[mapping.fullNameColumn] ?? "").trim().split(/\s+/).filter(Boolean);
      if (parts.length) {
        out.firstName = parts[0];
        if (parts.length > 1) out.lastName = parts.slice(1).join(" ");
      }
    }
    return out;
  });
}

export function downloadFile(name: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
