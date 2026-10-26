"use client";

import { useState } from "react";
import { errorMessage, query, useResource } from "@/components/data";
import { Alert, Badge, Button, ICONS, Icon, Select, Skeleton, cx } from "@/components/ui";
import { WhatsAppButton, WhatsAppDrawer } from "@/components/whatsapp-send";
import { api } from "@/lib/api";
import { formatDay, localToday, type ClassSummary } from "@/lib/attendance";
import { formatPct, gradeTone, type ClassMonthlyReport } from "@/lib/exams";
import { downloadSpreadsheet } from "@/lib/spreadsheet";
import { MonthlyReportDrawer } from "./report-card";

const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

export function MonthlyReports() {
  const classes = useResource(() => api<{ classes: ClassSummary[] }>(`/api/attendance/classes?date=${localToday()}`), "classes");
  const options = classes.data?.classes ?? [];
  const [key, setKey] = useState("");
  const [month, setMonth] = useState(() => localToday().slice(0, 7));
  const [openStudent, setOpenStudent] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = options.find((c) => `${c.grade}|${c.section}` === key) ?? options[0];
  const path = selected ? `/api/exams/reports/class${query({ grade: selected.grade, section: selected.section, month })}` : "";
  const report = useResource(() => (path ? api<ClassMonthlyReport>(path) : Promise.resolve(null)), path || "none");
  const data = report.data;
  const reportable = data?.students.filter((s) => s.tests.some((t) => t.status !== "pending") || s.attendance.days > 0) ?? [];

  async function exportFile() {
    if (!data) return;
    setError(null);
    try {
      const header = ["Roll no", "Admission no", "Name", ...data.exams.map((e) => `${e.name} (%)`), "Average %", "Grade", "Present", "Absent", "Late", "Leave", "Attendance %"];
      const rows = data.students.map((s) => [
        s.student.rollNo,
        s.student.admissionNo,
        s.student.fullName,
        ...data.exams.map((e) => {
          const t = s.tests.find((x) => x.examId === e.id);
          return !t ? "—" : t.status === "absent" ? "AB" : t.percent === null ? "" : String(t.percent);
        }),
        s.average === null ? "" : String(s.average),
        s.grade ?? "",
        String(s.attendance.present),
        String(s.attendance.absent),
        String(s.attendance.late),
        String(s.attendance.leave),
        s.attendance.rate === null ? "" : String(s.attendance.rate),
      ]);
      await downloadSpreadsheet(`progress-${data.grade}${data.section}-${month}`, [header, ...rows], "xlsx", { sheetName: `Class ${data.grade}${data.section} ${month}` });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (classes.data && options.length === 0) {
    return <p className="rounded-xl border border-border bg-surface px-6 py-14 text-center text-sm text-muted">No classes yet. Give students a class on their profile first.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="min-w-36 flex-1 sm:w-48 sm:flex-none">
          <Select aria-label="Class" value={selected ? `${selected.grade}|${selected.section}` : ""} onChange={(e) => setKey(e.target.value)}>
            {options.map((c) => (
              <option key={`${c.grade}|${c.section}`} value={`${c.grade}|${c.section}`}>
                Class {c.section ? `${c.grade} - ${c.section}` : c.grade}
              </option>
            ))}
          </Select>
        </div>
        <input
          type="month"
          aria-label="Month"
          value={month}
          max={localToday().slice(0, 7)}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="h-10 flex-1 rounded-lg border border-border bg-surface px-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:flex-none sm:text-sm"
        />
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <WhatsAppButton onClick={() => setSharing(true)} disabled={!reportable.length}>
            Send to parents
          </WhatsAppButton>
          <Button variant="secondary" onClick={exportFile} disabled={!data?.students.length}>
            <Icon d={ICONS.download} />
            Excel
          </Button>
        </div>
      </div>
      {error && <div className="mb-3"><Alert>{error}</Alert></div>}

      {report.error ? (
        <Alert>{report.error}</Alert>
      ) : !data || report.loading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : data.students.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-6 py-14 text-center text-sm text-muted">No active students in this class.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {data.exams.length ? `${data.exams.length} test${data.exams.length === 1 ? "" : "s"} in ${monthName(month)}: ${data.exams.map((e) => `${e.name} (${formatDay(e.date, "short").replace(/^\w+,?\s*/, "")})`).join(", ")}` : `No tests in ${monthName(month)}; reports will show attendance only.`}
          </p>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-border bg-surface-muted/50 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-3 py-3 text-right font-medium">Tests</th>
                  <th className="px-3 py-3 text-right font-medium">Average</th>
                  <th className="px-3 py-3 font-medium">Grade</th>
                  <th className="px-3 py-3 text-right font-medium">Attendance</th>
                  <th className="w-24 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.students.map((s) => {
                  const done = s.tests.filter((t) => t.status !== "pending").length;
                  return (
                    <tr key={s.student.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => setOpenStudent(s.student.id)}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-right font-mono text-xs text-muted">{s.student.rollNo || "–"}</span>
                          <div>
                            <div className="font-medium">{s.student.fullName}</div>
                            <div className="font-mono text-xs text-muted">{s.student.admissionNo}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                        {done}/{s.tests.length}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatPct(s.average)}</td>
                      <td className="px-3 py-2.5">{s.grade ? <Badge tone={gradeTone(s.grade, data.grading.scale)}>{s.grade}</Badge> : <span className="text-muted">—</span>}</td>
                      <td className={cx("px-3 py-2.5 text-right tabular-nums", s.attendance.rate !== null && s.attendance.rate < 75 && "text-danger")}>
                        {formatPct(s.attendance.rate)}
                        {s.attendance.days > 0 && <span className="text-xs text-muted"> · {s.attendance.days}d</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-sm font-medium text-accent">Report →</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ul className="divide-y divide-border md:hidden">
              {data.students.map((s) => (
                <li key={s.student.id}>
                  <button onClick={() => setOpenStudent(s.student.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-surface-muted">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.student.fullName}</span>
                      <span className="block text-xs text-muted">
                        Attendance {formatPct(s.attendance.rate)} · {s.tests.filter((t) => t.status !== "pending").length} tests
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-medium tabular-nums">{formatPct(s.average)}</span>
                      {s.grade && <Badge tone={gradeTone(s.grade, data.grading.scale)}>{s.grade}</Badge>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {openStudent && <MonthlyReportDrawer studentId={openStudent} month={month} onClose={() => setOpenStudent(null)} />}
      {sharing && data && (
        <WhatsAppDrawer
          type="progress_report"
          refs={reportable.map((s) => ({ studentId: s.student.id, month }))}
          title={`Progress reports · Class ${data.section ? `${data.grade} - ${data.section}` : data.grade}`}
          description={`Each parent gets their child's tests and attendance for ${monthName(month)}.`}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
}
