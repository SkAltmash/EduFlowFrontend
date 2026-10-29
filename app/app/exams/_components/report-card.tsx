"use client";

import { useRef, useState, type Ref } from "react";
import { Drawer, useResource } from "@/components/data";
import { DocShareBar } from "@/components/doc-share";
import { SchoolLetterhead, useSchoolProfile } from "@/components/letterhead";
import { PRINT_ICON, PrintPortal } from "@/components/share";
import { Alert, Button, Icon, Spinner, cx } from "@/components/ui";
import { WhatsAppButton, WhatsAppDrawer } from "@/components/whatsapp-send";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDay } from "@/lib/attendance";
import { STATUS_TEXT, formatMark, formatPct, type Exam, type ExamRow, type StudentMonthlyReport } from "@/lib/exams";
import { RECEIPT_ACCENTS, reportCardSettings, type ReportCardSettings } from "@/lib/school";

/** The school's saved report card settings, or the ones being edited (preview). */
function useReportSettings(override?: ReportCardSettings) {
  const saved = useSchoolProfile()?.reportCard;
  return override ?? reportCardSettings(saved);
}

const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
const cls = (grade: string, section: string) => (grade ? (section ? `${grade} - ${section}` : grade) : "—");

/** Paper-style wrapper: fixed light colours so screen, dark mode, print and PDF all match. */
function Paper({ children, innerRef, cfg }: { children: React.ReactNode; innerRef?: Ref<HTMLDivElement>; cfg: ReportCardSettings }) {
  return (
    <div
      ref={innerRef}
      className="relative mx-auto w-full max-w-xl overflow-hidden rounded-lg border border-zinc-300 bg-white p-6 text-[13px] leading-relaxed text-zinc-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      <div aria-hidden className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${RECEIPT_ACCENTS[cfg.accent].strip} print:hidden`} />
      {children}
      {cfg.note && <p className="mt-5 border-t border-dashed border-zinc-300 pt-2 text-[11px] text-zinc-600">{cfg.note}</p>}
    </div>
  );
}

function Header({ school, title, right, cfg }: { school: string; title: string; right: React.ReactNode; cfg: ReportCardSettings }) {
  const accent = RECEIPT_ACCENTS[cfg.accent];
  return (
    <SchoolLetterhead
      name={school}
      title={cfg.show.title ? title : ""}
      showLogo={cfg.show.logo}
      showName={cfg.show.schoolName}
      showContact={cfg.show.contact}
      ruleClass={accent.rule}
      titleClass={accent.text}
      right={right}
    />
  );
}

function StudentBlock({ name, admissionNo, className, roll, cfg }: { name: string; admissionNo: string; className: string; roll: string; cfg: ReportCardSettings }) {
  const rows = [
    ["Student", name, "font-semibold", true],
    ["Admission no", admissionNo, "font-mono", cfg.show.admissionNo],
    ["Class", className, "", true],
    ["Roll no", roll || "—", "", cfg.show.rollNo],
  ] as const;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 py-3">
      {rows
        .filter(([, , , on]) => on)
        .map(([k, v, c]) => (
          <div key={k}>
            <dt className="text-[11px] uppercase tracking-wide text-zinc-500">{k}</dt>
            <dd className={cx("break-words", c)}>{v}</dd>
          </div>
        ))}
    </dl>
  );
}

function Signatures({ cfg }: { cfg: ReportCardSettings }) {
  const labels = cfg.signatures.map((x) => x.trim()).filter(Boolean);
  if (!labels.length) return null;
  return (
    <div className={cx("mt-10 flex items-end gap-4 text-xs text-zinc-500", labels.length === 1 ? "justify-end" : "justify-between")}>
      {labels.map((l, i) => (
        <span key={i} className="min-w-24 border-t border-zinc-400 pt-1 text-center">
          {l}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One test
// ---------------------------------------------------------------------------

export function ExamReportDocument({
  school,
  exam,
  row,
  ranked,
  innerRef,
  settings,
}: {
  school: string;
  exam: Exam;
  row: ExamRow;
  ranked: number;
  innerRef?: Ref<HTMLDivElement>;
  settings?: ReportCardSettings;
}) {
  const r = row.result;
  const cfg = useReportSettings(settings);
  const show = cfg.show;
  const boxes = [
    show.percentage && { label: "Percentage", value: formatPct(r.percent), tone: "" },
    show.rank && { label: "Rank", value: r.rank ? `${r.rank} / ${ranked}` : "—", tone: "" },
    show.resultBox && { label: "Result", value: STATUS_TEXT[r.status], tone: r.status },
  ].filter((b): b is { label: string; value: string; tone: string } => Boolean(b));
  return (
    <Paper innerRef={innerRef} cfg={cfg}>
      <Header
        cfg={cfg}
        school={school}
        title={cfg.title}
        right={
          <>
            <p className="text-base font-semibold">{exam.name}</p>
            <p className="text-xs text-zinc-500">{formatDay(exam.date)}</p>
          </>
        }
      />
      <StudentBlock cfg={cfg} name={row.student.fullName} admissionNo={row.student.admissionNo} className={cls(row.student.grade || exam.grade, row.student.section)} roll={row.student.rollNo} />
      <table className="w-full border-y border-zinc-300">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
            <th className="py-2 font-medium">Subject</th>
            <th className="py-2 text-right font-medium">Marks</th>
            <th className="py-2 text-right font-medium">Max</th>
            {show.gradeColumn && <th className="py-2 text-right font-medium">Grade</th>}
            {show.resultColumn && <th className="py-2 text-right font-medium">Result</th>}
          </tr>
        </thead>
        <tbody>
          {exam.subjects.map((s, i) => {
            const sr = r.subjects[i];
            return (
              <tr key={s.id} className="border-t border-zinc-200">
                <td className="py-1.5">{s.name}</td>
                <td className="py-1.5 text-right tabular-nums">{sr?.absent ? "AB" : formatMark(sr?.marks)}</td>
                <td className="py-1.5 text-right tabular-nums text-zinc-500">{s.maxMarks}</td>
                {show.gradeColumn && <td className="py-1.5 text-right font-medium">{sr?.grade ?? "—"}</td>}
                {show.resultColumn && (
                  <td className={cx("py-1.5 text-right text-xs", sr?.passed === false ? "font-semibold text-red-700" : "text-zinc-500")}>
                    {sr?.absent ? "Absent" : sr?.passed === null ? "—" : sr?.passed ? "Pass" : "Below pass"}
                  </td>
                )}
              </tr>
            );
          })}
          <tr className="border-t-2 border-zinc-900 font-bold">
            <td className="py-2">Total</td>
            <td className="py-2 text-right tabular-nums">{formatMark(r.total)}</td>
            <td className="py-2 text-right tabular-nums">{r.max}</td>
            {show.gradeColumn && <td className="py-2 text-right">{r.grade ?? "—"}</td>}
            {show.resultColumn && <td className="py-2 text-right">{show.percentage ? formatPct(r.percent) : ""}</td>}
          </tr>
        </tbody>
      </table>
      {boxes.length > 0 && (
        <dl className={cx("mt-3 grid gap-3 text-center", boxes.length === 3 ? "grid-cols-3" : boxes.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
          {boxes.map((b) => (
            <div key={b.label} className={cx("rounded border p-2", b.tone === "fail" ? "border-red-300 bg-red-50" : b.tone === "pass" ? "border-emerald-300 bg-emerald-50" : "border-zinc-200")}>
              <dt className="text-[11px] uppercase tracking-wide text-zinc-500">{b.label}</dt>
              <dd className={cx("text-base font-bold", b.tone === "fail" ? "text-red-700" : b.tone === "pass" ? "text-emerald-700" : "")}>{b.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {show.remarks && row.remarks && (
        <p className="mt-3 text-sm">
          <span className="text-zinc-500">Remarks: </span>
          {row.remarks}
        </p>
      )}
      <Signatures cfg={cfg} />
    </Paper>
  );
}

export function ExamReportDrawer({ exam, row, ranked, onClose }: { exam: Exam; row: ExamRow; ranked: number; onClose: () => void }) {
  const { session } = useAuth();
  const school = session.status === "authenticated" && session.tenant ? session.tenant.name : "";
  const ref = useRef<HTMLDivElement>(null);
  const [wa, setWa] = useState(false);
  const pending = row.result.status === "pending";
  const cfg = useReportSettings();

  return (
    <Drawer
      title={`${row.student.fullName} · ${exam.name}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <Button onClick={() => window.print()}>
            <Icon d={PRINT_ICON} />
            Print
          </Button>
        </div>
      }
    >
      {pending ? (
        <Alert tone="warning">Some marks are still missing, so the total, grade and rank aren&apos;t final.</Alert>
      ) : (
        <div className="space-y-2">
          <WhatsAppButton onClick={() => setWa(true)}>Send on WhatsApp</WhatsAppButton>
          <DocShareBar docRef={ref} paper={cfg.paper} fileName={`report-${row.student.admissionNo}-${exam.name.replace(/\s+/g, "-")}`} title={`${exam.name} — ${row.student.fullName}`} />
        </div>
      )}
      <ExamReportDocument school={school} exam={exam} row={row} ranked={ranked} innerRef={ref} />
      <PrintPortal>
        <ExamReportDocument school={school} exam={exam} row={row} ranked={ranked} />
      </PrintPortal>
      {wa && (
        <WhatsAppDrawer type="exam_result" refs={[{ examId: exam.id, studentId: row.student.id }]} title={`${exam.name} result on WhatsApp`} onClose={() => setWa(false)} />
      )}
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Monthly progress report
// ---------------------------------------------------------------------------

export function MonthlyReportDocument({ report, innerRef, settings }: { report: StudentMonthlyReport; innerRef?: Ref<HTMLDivElement>; settings?: ReportCardSettings }) {
  const { student, tests, summary, attendance } = report;
  const cfg = useReportSettings(settings);
  const show = cfg.show;
  return (
    <Paper innerRef={innerRef} cfg={cfg}>
      <Header
        cfg={cfg}
        school={report.school.name}
        title={cfg.monthlyTitle}
        right={<p className="text-base font-semibold">{monthName(report.month)}</p>}
      />
      <StudentBlock cfg={cfg} name={student.fullName} admissionNo={student.admissionNo} className={cls(student.grade, student.section)} roll={student.rollNo} />

      <p className="mb-1 mt-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Tests</p>
      {tests.length === 0 ? (
        <p className="border-y border-zinc-300 py-3 text-zinc-500">No tests this month.</p>
      ) : (
        <table className="w-full border-y border-zinc-300">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="py-2 font-medium">Test</th>
              <th className="py-2 font-medium">Date</th>
              <th className="py-2 text-right font-medium">Marks</th>
              {show.percentage && <th className="py-2 text-right font-medium">%</th>}
              {show.gradeColumn && <th className="py-2 text-right font-medium">Grade</th>}
            </tr>
          </thead>
          <tbody>
            {tests.map((t) => (
              <tr key={t.exam.id} className="border-t border-zinc-200">
                <td className="py-1.5">{t.exam.name}</td>
                <td className="py-1.5 text-zinc-500">{formatDay(t.exam.date, "short").replace(/^\w+,?\s*/, "")}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {t.result.status === "absent" ? "AB" : t.result.status === "pending" ? "—" : `${formatMark(t.result.total)}/${t.result.max}`}
                </td>
                {show.percentage && <td className="py-1.5 text-right tabular-nums">{formatPct(t.result.percent)}</td>}
                {show.gradeColumn && <td className="py-1.5 text-right font-medium">{t.result.status === "pending" ? "Pending" : (t.result.grade ?? "—")}</td>}
              </tr>
            ))}
            <tr className="border-t-2 border-zinc-900 font-bold">
              <td className="py-2" colSpan={3}>
                Average ({summary.completed} of {summary.tests} tests)
              </td>
              {show.percentage && <td className="py-2 text-right">{formatPct(summary.average)}</td>}
              {show.gradeColumn && <td className="py-2 text-right">{summary.grade ?? "—"}</td>}
            </tr>
          </tbody>
        </table>
      )}

      {show.attendance && (
        <>
          <p className="mb-1 mt-4 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Attendance</p>
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              ["Present", attendance.present],
              ["Late", attendance.late],
              ["Absent", attendance.absent],
              ["Leave", attendance.leave],
              ["Rate", formatPct(attendance.rate)],
            ].map(([k, v]) => (
              <div key={k} className="rounded border border-zinc-200 p-2">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">{k}</p>
                <p className="text-base font-bold tabular-nums">{v}</p>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">{attendance.days ? `${attendance.days} school days recorded. Leave is not counted against attendance.` : "No attendance recorded this month."}</p>
        </>
      )}
      <Signatures cfg={cfg} />
    </Paper>
  );
}

export function MonthlyReportDrawer({ studentId, month, onClose }: { studentId: string; month: string; onClose: () => void }) {
  const path = `/api/exams/reports/students/${studentId}?month=${month}`;
  const { data, error } = useResource(() => api<StudentMonthlyReport>(path), path);
  const ref = useRef<HTMLDivElement>(null);
  const [wa, setWa] = useState(false);
  const cfg = useReportSettings();

  return (
    <Drawer
      title={data ? `${data.student.fullName} · ${monthName(month)}` : "Progress report"}
      onClose={onClose}
      footer={
        data && (
          <div className="flex justify-end">
            <Button onClick={() => window.print()}>
              <Icon d={PRINT_ICON} />
              Print
            </Button>
          </div>
        )
      }
    >
      {error ? (
        <Alert>{error}</Alert>
      ) : !data ? (
        <Spinner className="mx-auto my-16" />
      ) : (
        <>
          <div className="space-y-2">
            <WhatsAppButton onClick={() => setWa(true)}>Send on WhatsApp</WhatsAppButton>
            <DocShareBar docRef={ref} paper={cfg.paper} fileName={`progress-${data.student.admissionNo}-${month}`} title={`Progress report — ${data.student.fullName}, ${monthName(month)}`} />
          </div>
          <MonthlyReportDocument report={data} innerRef={ref} />
          <PrintPortal>
            <MonthlyReportDocument report={data} />
          </PrintPortal>
          {wa && <WhatsAppDrawer type="progress_report" refs={[{ studentId, month }]} title="Progress report on WhatsApp" onClose={() => setWa(false)} />}
        </>
      )}
    </Drawer>
  );
}
