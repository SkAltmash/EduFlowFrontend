"use client";

import { useRef, useState } from "react";
import { Drawer } from "@/components/data";
import { Alert, Button, ICONS, Icon, cx } from "@/components/ui";
import { classLabel, type ExamView } from "@/lib/exams";
import { SPREADSHEET_ACCEPT, downloadSpreadsheet, readSpreadsheet } from "@/lib/spreadsheet";

export type MarksDraft = { marks: Record<string, string>; remarks: string };

interface Problem {
  row: number;
  who: string;
  text: string;
}

interface Parsed {
  fileName: string;
  /** Student id → the row's values on top of what's on the sheet now */
  next: Record<string, MarksDraft>;
  marks: number;
  absent: number;
  remarks: number;
  students: number;
  problems: Problem[];
  ignoredColumns: string[];
}

const ABSENT = /^(a|ab|abs|absent)$/i;
const normal = (h: string) => h.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");

/**
 * Marks from Excel: download a template for the whole class, fill it, upload it,
 * check what will change, then fill the marks sheet (saved with the sheet's Save button).
 */
export function ImportMarksDrawer({
  view,
  canMark,
  canRemark,
  draftOf,
  onApply,
  onClose,
}: {
  view: ExamView;
  canMark: (subjectId: string) => boolean;
  canRemark: boolean;
  /** What's on the sheet now (saved or typed) for a student */
  draftOf: (studentId: string) => MarksDraft;
  onApply: (next: Record<string, MarksDraft>, summary: string) => void;
  onClose: () => void;
}) {
  const { exam, students } = view;
  const subjects = exam.subjects.filter((s) => canMark(s.id));
  const [withMarks, setWithMarks] = useState(false);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const baseName = `marks-${exam.name}-${exam.grade}${exam.section}`.replace(/[^\w-]+/g, "-");

  async function downloadTemplate() {
    const header = ["Roll no", "Admission no", "Name", ...subjects.map((s) => `${s.name} (max ${s.maxMarks})`), ...(canRemark ? ["Remarks"] : [])];
    const rows = students.map((r) => {
      const d = draftOf(r.student.id);
      return [
        r.student.rollNo,
        r.student.admissionNo,
        r.student.fullName,
        ...subjects.map((s) => (withMarks ? (d.marks[s.id] ?? "") : "")),
        ...(canRemark ? [withMarks ? d.remarks : ""] : []),
      ];
    });
    const help = [
      [`${exam.name} · Class ${classLabel(exam.grade, exam.section)} · how to fill`],
      [""],
      ["1. Type each student's marks under the subject. Don't go above the maximum shown in the heading."],
      ["2. Write AB for a student who was absent. Leave a cell empty to keep what's already in EduFlow."],
      ["3. Half marks are fine (e.g. 42.5)."],
      ["4. Don't change the Admission no column: it's how each row is matched to the student."],
      [canRemark ? "5. Remarks (optional) appear on the student's report card." : "5. Only the subjects you teach are in this file."],
      ["6. Save the file, then in EduFlow open the test → Import marks → Upload."],
    ];
    await downloadSpreadsheet(`${baseName}-template`, [header, ...rows], "xlsx", { sheetName: "Marks", extraSheets: [{ name: "How to fill", rows: help }] });
  }

  async function read(file: File) {
    setReading(true);
    setError(null);
    setParsed(null);
    try {
      const [sheet] = await readSpreadsheet(file);
      if (!sheet || sheet.rows.length < 2) throw new Error("The file has no student rows.");
      const header = sheet.rows[0].map((h) => String(h ?? ""));
      const keys = header.map(normal);
      const admCol = keys.findIndex((h) => h.startsWith("admission") || h === "admno");
      const nameCol = keys.findIndex((h) => h === "name" || h === "studentname");
      if (admCol < 0 && nameCol < 0) throw new Error("Couldn't find an “Admission no” column. Download the template and fill that.");
      const cols = subjects.map((s) => ({ s, col: keys.findIndex((h) => h === normal(s.name) || h.startsWith(normal(s.name))) })).filter((c) => c.col >= 0);
      const remarksCol = canRemark ? keys.findIndex((h) => h === "remarks" || h === "remark") : -1;
      if (!cols.length && remarksCol < 0) throw new Error("No subject columns were found. The headings must start with the subject name, as in the template.");
      const used = new Set([admCol, nameCol, keys.findIndex((h) => h.startsWith("roll")), remarksCol, ...cols.map((c) => c.col)]);
      const ignoredColumns = header.filter((h, i) => h.trim() && !used.has(i));

      const byAdm = new Map(students.map((r) => [r.student.admissionNo.trim().toLowerCase(), r]));
      const byName = new Map(students.map((r) => [r.student.fullName.trim().toLowerCase(), r]));
      const result: Parsed = { fileName: file.name, next: {}, marks: 0, absent: 0, remarks: 0, students: 0, problems: [], ignoredColumns };

      sheet.rows.slice(1).forEach((cells, i) => {
        const rowNo = i + 2; // as Excel shows it, after the heading row
        const adm = admCol >= 0 ? String(cells[admCol] ?? "").trim() : "";
        const name = nameCol >= 0 ? String(cells[nameCol] ?? "").trim() : "";
        if (!adm && !name) return;
        const r = (adm && byAdm.get(adm.toLowerCase())) || (!adm && name ? byName.get(name.toLowerCase()) : undefined);
        if (!r) {
          result.problems.push({ row: rowNo, who: adm || name, text: "isn't a student in this test" });
          return;
        }
        const base = result.next[r.student.id] ?? draftOf(r.student.id);
        const marks = { ...base.marks };
        let touched = false;
        for (const { s, col } of cols) {
          const raw = String(cells[col] ?? "").trim();
          if (!raw || raw === "-") continue;
          if (ABSENT.test(raw)) {
            marks[s.id] = "AB";
            result.absent += 1;
            touched = true;
            continue;
          }
          const n = Number(raw.replace(",", "."));
          if (!/^\d+([.,]\d+)?$/.test(raw) || Number.isNaN(n)) result.problems.push({ row: rowNo, who: r.student.fullName, text: `${s.name}: “${raw}” isn't a number (use AB for absent)` });
          else if (n > s.maxMarks) result.problems.push({ row: rowNo, who: r.student.fullName, text: `${s.name}: ${raw} is above the maximum ${s.maxMarks}` });
          else if (Math.round(n * 100) !== n * 100) result.problems.push({ row: rowNo, who: r.student.fullName, text: `${s.name}: ${raw} has more than 2 decimals` });
          else {
            marks[s.id] = String(n);
            result.marks += 1;
            touched = true;
          }
        }
        let remarks = base.remarks;
        if (remarksCol >= 0) {
          const text = String(cells[remarksCol] ?? "").trim();
          if (text) {
            remarks = text.slice(0, 300);
            result.remarks += 1;
            touched = true;
          }
        }
        if (touched) {
          if (!result.next[r.student.id]) result.students += 1;
          result.next[r.student.id] = { marks, remarks };
        }
      });
      if (!result.students && !result.problems.length) throw new Error("No marks were found in the file. Fill the subject columns, then upload again.");
      setParsed(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setReading(false);
    }
  }

  function apply() {
    if (!parsed) return;
    const bits = [`${parsed.marks} mark${parsed.marks === 1 ? "" : "s"}`];
    if (parsed.absent) bits.push(`${parsed.absent} absent`);
    if (parsed.remarks) bits.push(`${parsed.remarks} remark${parsed.remarks === 1 ? "" : "s"}`);
    onApply(parsed.next, `Filled ${bits.join(", ")} for ${parsed.students} student${parsed.students === 1 ? "" : "s"} from ${parsed.fileName}. Check them, then Save.`);
  }

  return (
    <Drawer
      title="Import marks from Excel"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!parsed || parsed.students === 0}>
            Fill the marks sheet
          </Button>
        </div>
      }
    >
      <Step n={1} title="Download the template" done={false}>
        <p className="text-sm text-muted">
          All {students.length} students of Class {classLabel(exam.grade, exam.section)} with a column for {subjects.length === exam.subjects.length ? "every subject" : "each subject you teach"}
          {canRemark ? " and remarks" : ""}.
        </p>
        <div className="flex rounded-lg border border-border p-0.5 text-sm" role="group" aria-label="Template">
          {(
            [
              [false, "Blank"],
              [true, "With marks entered so far"],
            ] as const
          ).map(([v, label]) => (
            <button key={label} type="button" onClick={() => setWithMarks(v)} aria-pressed={withMarks === v} className={cx("flex-1 rounded-md px-3 py-1.5", withMarks === v ? "bg-surface-muted font-medium" : "text-muted")}>
              {label}
            </button>
          ))}
        </div>
        <Button variant="secondary" onClick={downloadTemplate}>
          <Icon d={ICONS.download} />
          Download template (Excel)
        </Button>
      </Step>

      <Step n={2} title="Fill it in Excel or Google Sheets" done={false}>
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted">
          <li>Type marks under each subject, up to the maximum in the heading.</li>
          <li>
            Write <strong className="text-foreground">AB</strong> for absent. Empty cells keep what&apos;s already here.
          </li>
          <li>Don&apos;t change the Admission no column.</li>
        </ul>
      </Step>

      <Step n={3} title="Upload it" done={Boolean(parsed)}>
        <input
          ref={fileRef}
          type="file"
          accept={SPREADSHEET_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) read(f);
          }}
        />
        <Button onClick={() => fileRef.current?.click()} loading={reading}>
          <Icon d={ICONS.upload} />
          {parsed ? "Upload another file" : "Upload filled file"}
        </Button>
        {error && <Alert>{error}</Alert>}
        {parsed && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Students", parsed.students],
                ["Marks", parsed.marks + parsed.absent],
                ["Problems", parsed.problems.length],
              ].map(([label, v]) => (
                <div key={label} className="rounded-xl border border-border bg-surface px-2 py-2">
                  <p className="text-xs text-muted">{label}</p>
                  <p className={cx("text-xl font-semibold tabular-nums", label === "Problems" && Number(v) > 0 && "text-danger")}>{v}</p>
                </div>
              ))}
            </div>
            {parsed.problems.length > 0 && (
              <div className="rounded-xl border border-danger/30 bg-danger-soft/50 p-3">
                <p className="mb-1.5 text-sm font-medium">These cells were skipped. Fix them in the file and upload again, or type them on the sheet:</p>
                <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                  {parsed.problems.slice(0, 50).map((p, i) => (
                    <li key={i}>
                      <span className="font-mono text-muted">Row {p.row}</span> · {p.who}: {p.text}
                    </li>
                  ))}
                  {parsed.problems.length > 50 && <li className="text-muted">…and {parsed.problems.length - 50} more</li>}
                </ul>
              </div>
            )}
            {parsed.ignoredColumns.length > 0 && <p className="text-xs text-muted">Not used: {parsed.ignoredColumns.join(", ")}</p>}
            {parsed.students > 0 && (
              <p className="text-sm text-muted">
                Next: <strong className="text-foreground">Fill the marks sheet</strong>, check the marks, then press <strong className="text-foreground">Save</strong>.
              </p>
            )}
          </div>
        )}
      </Step>
    </Drawer>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="flex gap-3">
      <span className={cx("grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold", done ? "bg-success text-white" : "bg-accent-soft text-accent")}>{done ? "✓" : n}</span>
      <div className="min-w-0 flex-1 space-y-2.5">
        <h3 className="font-semibold">{title}</h3>
        {children}
      </div>
    </section>
  );
}
