"use client";

import { useState } from "react";
import { Drawer, Section, errorMessage, query } from "@/components/data";
import { Alert, Button, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { downloadSpreadsheet, type SpreadsheetFormat } from "@/lib/spreadsheet";
import { DATE_FIELDS, STUDENT_FIELDS, studentsToRows, type Student, type StudentField } from "@/lib/students";
import { STATUS_LABEL } from "./bits";

export interface ExportFilters {
  search: string;
  grade: string;
  section: string;
  status: string;
  sort: string;
}

const ALL_FIELDS = STUDENT_FIELDS.map((f) => f.key) as StudentField[];

const GROUPS: { title: string; fields: StudentField[] }[] = [
  { title: "Student", fields: ["admissionNo", "firstName", "lastName", "gender", "dateOfBirth", "status"] },
  { title: "Class", fields: ["grade", "section", "rollNo", "admissionDate"] },
  { title: "Guardian", fields: ["guardianName", "guardianPhone", "guardianEmail"] },
  { title: "Contact & notes", fields: ["phone", "email", "address", "notes"] },
];

const PRESETS: { label: string; fields: StudentField[] }[] = [
  { label: "All columns", fields: ALL_FIELDS },
  { label: "Guardian contacts", fields: ["admissionNo", "firstName", "lastName", "grade", "section", "guardianName", "guardianPhone", "guardianEmail"] },
  { label: "Class roster", fields: ["admissionNo", "firstName", "lastName", "gender", "grade", "section", "rollNo"] },
];

const PREFS_KEY = "eduflow-export-prefs";

function loadPrefs(): { format: SpreadsheetFormat; fields: StudentField[] } {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
    if (saved && (saved.format === "csv" || saved.format === "xlsx") && Array.isArray(saved.fields)) {
      const fields = ALL_FIELDS.filter((f) => saved.fields.includes(f));
      if (fields.length) return { format: saved.format, fields };
    }
  } catch {
    // Storage blocked or bad JSON: use defaults
  }
  return { format: "xlsx", fields: ALL_FIELDS };
}

const sameSet = (a: StudentField[], b: StudentField[]) => a.length === b.length && a.every((f) => b.includes(f));

export function ExportDrawer({
  filters,
  filteredCount,
  totalCount,
  onClose,
}: {
  filters: ExportFilters;
  filteredCount?: number;
  totalCount?: number;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const [prefs] = useState(loadPrefs);
  const [format, setFormat] = useState<SpreadsheetFormat>(prefs.format);
  const [fields, setFields] = useState<StudentField[]>(prefs.fields);
  const isFiltered = Boolean(filters.search || filters.grade || filters.section || filters.status !== "all");
  const [scope, setScope] = useState<"filtered" | "all">(isFiltered ? "filtered" : "all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filterSummary = [
    filters.status !== "all" && STATUS_LABEL[filters.status as keyof typeof STATUS_LABEL],
    filters.grade && `Class ${filters.grade}`,
    filters.section && `Section ${filters.section}`,
    filters.search && `“${filters.search}”`,
  ].filter(Boolean);

  const toggle = (field: StudentField) =>
    setFields((current) =>
      current.includes(field) ? current.filter((f) => f !== field) : ALL_FIELDS.filter((f) => current.includes(f) || f === field)
    );

  const reimportable = fields.includes("admissionNo") && fields.includes("firstName");

  async function download() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const params = scope === "filtered" ? filters : { status: "all", sort: filters.sort };
      const res = await api<{ students: Student[]; total: number; truncated: boolean }>(
        `/api/students/export${query(params as Record<string, string>)}`
      );
      if (res.students.length === 0) {
        setError("No students to export.");
        return;
      }

      const ordered = ALL_FIELDS.filter((f) => fields.includes(f));
      const slug = session.status === "authenticated" && session.tenant ? session.tenant.slug : "eduflow";
      const day = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
      await downloadSpreadsheet(`${slug}-students-${day}`, studentsToRows(res.students, ordered), format, {
        dateColumns: ordered.flatMap((f, i) => (DATE_FIELDS.includes(f) ? [i] : [])),
        sheetName: "Students",
      });

      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({ format, fields: ordered }));
      } catch {
        // Not critical
      }
      setNotice(
        res.truncated
          ? `Downloaded the first ${res.students.length.toLocaleString()} of ${res.total.toLocaleString()} students. Narrow the filters to export the rest.`
          : `Downloaded ${res.students.length.toLocaleString()} students.`
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const count = scope === "filtered" ? filteredCount : totalCount;

  return (
    <Drawer
      title="Export students"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">
            {fields.length} column{fields.length === 1 ? "" : "s"}
            {count !== undefined && ` · ${count.toLocaleString()} students`}
          </span>
          <Button onClick={download} loading={busy} disabled={fields.length === 0 || count === 0}>
            Download {format === "xlsx" ? "Excel" : "CSV"}
          </Button>
        </div>
      }
    >
      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <Section title="Format">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["xlsx", "Excel", ".xlsx · dates and filters ready"],
              ["csv", "CSV", ".csv · opens anywhere"],
            ] as const
          ).map(([value, label, hint]) => (
            <Choice key={value} name="format" checked={format === value} onChange={() => setFormat(value)} label={label} hint={hint} />
          ))}
        </div>
      </Section>

      <Section title="Students">
        <div className="space-y-2">
          <Choice
            name="scope"
            checked={scope === "filtered"}
            onChange={() => setScope("filtered")}
            disabled={!isFiltered}
            label={`Current view${filteredCount !== undefined ? ` (${filteredCount.toLocaleString()})` : ""}`}
            hint={isFiltered ? filterSummary.join(" · ") : "No filters applied"}
          />
          <Choice
            name="scope"
            checked={scope === "all"}
            onChange={() => setScope("all")}
            label={`All students${totalCount !== undefined ? ` (${totalCount.toLocaleString()})` : ""}`}
            hint="Every status: active, inactive, graduated and left"
          />
        </div>
      </Section>

      <Section title="Columns">
        <div className="mb-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setFields(ALL_FIELDS.filter((f) => p.fields.includes(f)))}
              className={cx(
                "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
                sameSet(fields, p.fields) ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface hover:bg-surface-muted"
              )}
            >
              {p.label}
            </button>
          ))}
          <button onClick={() => setFields([])} className="h-8 px-2 text-xs font-medium text-muted hover:text-foreground">
            Clear
          </button>
        </div>
        <div className="space-y-4">
          {GROUPS.map((g) => (
            <fieldset key={g.title}>
              <legend className="mb-2 text-sm font-medium">{g.title}</legend>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {g.fields.map((key) => (
                  <label key={key} className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-1 text-sm hover:bg-surface-muted">
                    <input type="checkbox" checked={fields.includes(key)} onChange={() => toggle(key)} className="size-4 accent-accent" />
                    {STUDENT_FIELDS.find((f) => f.key === key)!.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        {fields.length > 0 && !reimportable && (
          <p className="mt-3 text-xs text-warning">Include Admission no and First name if you want to edit this file and import it back.</p>
        )}
      </Section>
    </Drawer>
  );
}

function Choice({
  name,
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cx(
        "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors",
        checked ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-muted",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} className="mt-0.5 accent-accent" />
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </label>
  );
}
