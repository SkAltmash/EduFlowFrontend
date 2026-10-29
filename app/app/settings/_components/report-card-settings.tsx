"use client";

import { useState } from "react";
import { ExamReportDocument, MonthlyReportDocument } from "@/app/app/exams/_components/report-card";
import { errorMessage, useResource } from "@/components/data";
import { Alert, Button, Field, Input, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import type { Exam, ExamRow, Result, StudentMonthlyReport } from "@/lib/exams";
import { RECEIPT_ACCENTS, REPORT_SHOW, loadSchool, reportCardSettings, setCachedSchool, type ReceiptAccent, type ReportCardSettings, type School } from "@/lib/school";
import { SettingsCard } from "./card";

// A made-up student and test to preview with
const SUBJECTS = [
  { id: "en", name: "English", maxMarks: 100, passMarks: 33, marks: 86, grade: "A2" },
  { id: "ma", name: "Mathematics", maxMarks: 100, passMarks: 33, marks: 92, grade: "A1" },
  { id: "sc", name: "Science", maxMarks: 100, passMarks: 33, marks: 78, grade: "B1" },
  { id: "ss", name: "Social Science", maxMarks: 100, passMarks: 33, marks: 81, grade: "A2" },
  { id: "hi", name: "Hindi", maxMarks: 100, passMarks: 33, marks: 74, grade: "B1" },
];
const today = new Date().toISOString().slice(0, 10);
const EXAM: Exam = {
  id: "preview",
  name: "Half-yearly exam",
  grade: "5",
  section: "A",
  date: today,
  description: "",
  subjects: SUBJECTS.map(({ id, name, maxMarks, passMarks }) => ({ id, name, maxMarks, passMarks })),
  maxTotal: 500,
};
const RESULT: Result = {
  subjects: SUBJECTS.map((s) => ({ subjectId: s.id, marks: s.marks, absent: false, percent: s.marks, grade: s.grade, passed: true })),
  total: 411,
  max: 500,
  percent: 82.2,
  grade: "A2",
  status: "pass",
  failedSubjects: 0,
  entered: 5,
  rank: 4,
};
const ROW: ExamRow = {
  student: { id: "preview", fullName: "Aarav Sharma", admissionNo: "ADM-0142", rollNo: "12", grade: "5", section: "A", current: true },
  remarks: "Consistent effort. Keep practising Science diagrams.",
  updatedAt: null,
  result: RESULT,
};
const monthly = (school: string): StudentMonthlyReport => ({
  school: { name: school },
  student: { id: "preview", fullName: "Aarav Sharma", admissionNo: "ADM-0142", rollNo: "12", grade: "5", section: "A", guardianName: "Rohit Sharma" },
  month: today.slice(0, 7),
  grading: { scale: "cbse", passPercent: 33 },
  tests: [
    { exam: { ...EXAM, id: "preview-1", name: "Unit test 1" }, result: { ...RESULT, total: 41, max: 50, percent: 82, grade: "A2" }, remarks: "" },
    { exam: { ...EXAM, id: "preview-2", name: "Unit test 2" }, result: { ...RESULT, total: 44, max: 50, percent: 88, grade: "A2" }, remarks: "" },
  ],
  summary: { tests: 2, completed: 2, average: 85, grade: "A2" },
  attendance: { present: 21, absent: 1, late: 1, leave: 1, days: 24, rate: 91.7 },
});

/** How report cards and monthly progress reports look. */
export function ReportCardSettingsCard() {
  const loaded = useResource(loadSchool, "school-profile");
  const [draft, setDraft] = useState<ReportCardSettings | null>(null);
  const [preview, setPreview] = useState<"test" | "monthly">("test");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  if (loaded.error) return <Alert>{loaded.error}</Alert>;
  const school = loaded.data;
  if (!school) return <Skeleton className="h-[36rem] rounded-2xl" />;

  const saved = reportCardSettings(school.reportCard);
  const v = draft ?? saved;
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const set = (patch: Partial<ReportCardSettings>) => setDraft({ ...v, ...patch });
  const signatures = [0, 1, 2].map((i) => v.signatures[i] ?? "");

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const { school: next } = await api<{ school: School }>("/api/school/report-card", { method: "PUT", body: { ...v, signatures: v.signatures.map((x) => x.trim()) } });
      setCachedSchool(next);
      loaded.setData(next);
      setDraft(null);
      setMessage({ tone: "success", text: "Saved. Report cards and progress reports (screen, PDF, image and print) now look like this." });
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <SettingsCard
        title="Report cards"
        description="Choose how test report cards and monthly progress reports look. The preview updates as you change things."
        footer={
          <>
            {dirty && (
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Discard
              </Button>
            )}
            <Button onClick={save} loading={busy} disabled={!dirty || v.title.trim().length < 2 || v.monthlyTitle.trim().length < 2}>
              Save changes
            </Button>
          </>
        }
      >
        {message && <Alert tone={message.tone}>{message.text}</Alert>}

        <div>
          <p className="mb-2 text-sm font-medium">Colour</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(RECEIPT_ACCENTS) as ReceiptAccent[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => set({ accent: a })}
                aria-pressed={v.accent === a}
                className={cx("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors", v.accent === a ? "border-accent bg-accent-soft font-medium" : "border-border hover:bg-surface-muted")}
              >
                <span className={cx("size-4 rounded-full", RECEIPT_ACCENTS[a].swatch)} />
                {RECEIPT_ACCENTS[a].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Test report title" htmlFor="rp-title" hint="e.g. Report card, Result, Marksheet">
            <Input id="rp-title" value={v.title} maxLength={60} disabled={!v.show.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Monthly report title" htmlFor="rp-mtitle" hint="e.g. Monthly progress report">
            <Input id="rp-mtitle" value={v.monthlyTitle} maxLength={60} disabled={!v.show.title} onChange={(e) => set({ monthlyTitle: e.target.value })} />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Signatures</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {signatures.map((label, i) => (
              <Input
                key={i}
                aria-label={`Signature ${i + 1}`}
                value={label}
                maxLength={40}
                placeholder={["Class teacher", "Principal", "Parent"][i]}
                onChange={(e) => {
                  const next = [...signatures];
                  next[i] = e.target.value;
                  set({ signatures: next });
                }}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">Leave a box empty to drop that signature line; all empty hides them.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Note at the bottom" htmlFor="rp-note" hint={`Optional. ${300 - v.note.length} characters left.`}>
            <Input id="rp-note" value={v.note} maxLength={300} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. Results are provisional." />
          </Field>
          <Field label="PDF paper size" htmlFor="rp-paper">
            <div className="flex rounded-lg border border-border p-0.5 text-sm" id="rp-paper" role="group">
              {(["a4", "a5"] as const).map((pp) => (
                <button
                  key={pp}
                  type="button"
                  onClick={() => set({ paper: pp })}
                  aria-pressed={v.paper === pp}
                  className={cx("flex-1 rounded-md px-3 py-1.5", v.paper === pp ? "bg-surface-muted font-medium" : "text-muted")}
                >
                  {pp === "a4" ? "A4 (full page)" : "A5 (half page)"}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Show on report cards</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {REPORT_SHOW.map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-muted">
                <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={v.show[key]} onChange={(e) => set({ show: { ...v.show, [key]: e.target.checked } })} />
                {label}
                {key === "logo" && !school.logoUrl && <span className="text-xs text-muted">(no logo yet)</span>}
              </label>
            ))}
          </div>
        </div>
      </SettingsCard>

      <div className="xl:sticky xl:top-20 xl:self-start">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Preview</p>
          <div className="flex rounded-lg border border-border p-0.5 text-xs" role="group" aria-label="Preview">
            {(
              [
                ["test", "Test report"],
                ["monthly", "Monthly report"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} onClick={() => setPreview(id)} aria-pressed={preview === id} className={cx("rounded-md px-2.5 py-1", preview === id ? "bg-surface-muted font-medium" : "text-muted")}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface-muted/60 p-3 sm:p-5">
          {preview === "test" ? (
            <ExamReportDocument school={school.name} exam={EXAM} row={ROW} ranked={38} settings={v} />
          ) : (
            <MonthlyReportDocument report={monthly(school.name)} settings={v} />
          )}
        </div>
      </div>
    </div>
  );
}
