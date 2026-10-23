"use client";

import { useState } from "react";
import { errorMessage, query, useResource } from "@/components/data";
import { Alert, Badge, Button, ICONS, Icon, Select, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import {
  LOW_ATTENDANCE,
  STATUS_META,
  className,
  formatDay,
  formatRate,
  localToday,
  monthRange,
  type ClassReport,
  type ClassSummary,
} from "@/lib/attendance";
import { downloadSpreadsheet, type SpreadsheetFormat } from "@/lib/spreadsheet";
import { useAuth } from "@/lib/auth";
import { WhatsAppButton, WhatsAppDrawer } from "@/components/whatsapp-send";

function RateBar({ rate }: { rate: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-muted">
        {rate !== null && (
          <div className={cx("h-full rounded-full", rate < LOW_ATTENDANCE ? "bg-danger" : "bg-success")} style={{ width: `${rate}%` }} />
        )}
      </div>
      <span className={cx("w-12 text-right tabular-nums text-sm font-medium", rate !== null && rate < LOW_ATTENDANCE && "text-danger")}>
        {formatRate(rate)}
      </span>
    </div>
  );
}

export function Report({ classes }: { classes: ClassSummary[] | undefined }) {
  const [classKey, setClassKey] = useState("");
  const [month, setMonth] = useState(() => localToday().slice(0, 7));
  const [exporting, setExporting] = useState<SpreadsheetFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const { session } = useAuth();
  const role = session.status === "authenticated" ? session.role : undefined;
  const canMessage = role === "owner" || role === "admin" || role === "teacher";

  // Default to the first class once the list arrives
  const selected = classes?.find((c) => `${c.grade}|${c.section}` === classKey) ?? classes?.[0];
  const { from, to } = monthRange(month);
  const future = from > localToday();

  const path = selected && !future ? `/api/attendance/report${query({ grade: selected.grade, section: selected.section, from, to })}` : "";
  const report = useResource(() => (path ? api<ClassReport>(path) : Promise.resolve(null)), path || "none");
  const data = report.data;
  const low = data?.students.filter((r) => r.rate !== null && r.rate < LOW_ATTENDANCE).length ?? 0;

  async function exportGrid(format: SpreadsheetFormat) {
    if (!data) return;
    setExporting(format);
    setExportError(null);
    try {
      const header = ["Roll no", "Admission no", "Name", ...data.dates.map((d) => d.slice(5).split("-").reverse().join("/")), "Present", "Absent", "Late", "Leave", "Attendance %"];
      const rows = data.students.map((r) => [
        r.student.rollNo,
        r.student.admissionNo,
        r.student.fullName,
        ...data.dates.map((d) => (r.days[d] ? STATUS_META[r.days[d]].short : "")),
        String(r.counts.present),
        String(r.counts.absent),
        String(r.counts.late),
        String(r.counts.leave),
        r.rate === null ? "" : String(r.rate),
      ]);
      const name = `attendance-${className(data.grade, data.section).replace(/\s+/g, "")}-${month}`;
      await downloadSpreadsheet(name, [header, ...rows], format, { sheetName: `Class ${className(data.grade, data.section)} ${month}` });
    } catch (err) {
      setExportError(errorMessage(err));
    } finally {
      setExporting(null);
    }
  }

  if (classes && classes.length === 0) {
    return <p className="rounded-xl border border-border bg-surface px-6 py-14 text-center text-sm text-muted">No classes yet. Give students a class on their profile first.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Wrapper sets the width: Select itself is always w-full */}
        <div className="min-w-36 flex-1 sm:w-44 sm:flex-none">
          <Select
            aria-label="Class"
            value={selected ? `${selected.grade}|${selected.section}` : ""}
            onChange={(e) => setClassKey(e.target.value)}
          >
            {classes?.map((c) => (
              <option key={`${c.grade}|${c.section}`} value={`${c.grade}|${c.section}`}>
                Class {className(c.grade, c.section)}
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
          {canMessage && (
            <WhatsAppButton onClick={() => setSharing(true)} disabled={!data || data.dates.length === 0}>
              Send to parents
            </WhatsAppButton>
          )}
          <Button variant="secondary" onClick={() => exportGrid("xlsx")} loading={exporting === "xlsx"} disabled={!data || data.dates.length === 0 || exporting !== null}>
            <Icon d={ICONS.download} />
            Excel
          </Button>
          <Button variant="secondary" onClick={() => exportGrid("csv")} loading={exporting === "csv"} disabled={!data || data.dates.length === 0 || exporting !== null}>
            CSV
          </Button>
        </div>
      </div>

      {exportError && <div className="mb-4"><Alert>{exportError}</Alert></div>}
      {sharing && data && (
        <WhatsAppDrawer
          type="attendance_summary"
          refs={data.students.filter((r) => r.marked > 0).map((r) => ({ studentId: r.student.id, month }))}
          title={`Attendance report · Class ${className(data.grade, data.section)}`}
          description={`Each parent gets their child's attendance for ${new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}.`}
          onClose={() => setSharing(false)}
        />
      )}

      {report.error ? (
        <Alert>{report.error}</Alert>
      ) : !data || report.loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Days recorded" value={String(data.summary.days)} hint={`${formatDay(from, "short")} – ${formatDay(to, "short")}`} />
            <Tile label="Class attendance" value={formatRate(data.summary.rate)} hint="Leave not counted" />
            <Tile label="Absences" value={String(data.summary.absent)} hint={`${data.summary.late} late · ${data.summary.leave} leave`} />
            <Tile label={`Below ${LOW_ATTENDANCE}%`} value={String(low)} hint={low ? "students need attention" : "Everyone on track"} danger={low > 0} />
          </div>

          {data.summary.days === 0 ? (
            <p className="rounded-xl border border-border bg-surface px-6 py-14 text-center text-sm text-muted">
              No attendance recorded for Class {className(data.grade, data.section)} this month.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              {/* Desktop table */}
              <table className="hidden w-full text-sm md:table">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/50 text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3 font-medium">Student</th>
                    {(["present", "absent", "late", "leave"] as const).map((s) => (
                      <th key={s} className="px-3 py-3 text-right font-medium">{STATUS_META[s].label}</th>
                    ))}
                    <th className="px-4 py-3 text-right font-medium">Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.students.map((r) => (
                    <tr key={r.student.id} className={cx(r.rate !== null && r.rate < LOW_ATTENDANCE && "bg-danger-soft/40")}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-right font-mono text-xs text-muted">{r.student.rollNo || "–"}</span>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{r.student.fullName}</div>
                            <div className="font-mono text-xs text-muted">{r.student.admissionNo}</div>
                          </div>
                        </div>
                      </td>
                      {(["present", "absent", "late", "leave"] as const).map((s) => (
                        <td key={s} className={cx("px-3 py-2.5 text-right tabular-nums", r.counts[s] ? STATUS_META[s].text : "text-muted")}>
                          {r.counts[s]}
                        </td>
                      ))}
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end">
                          <RateBar rate={r.rate} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile list */}
              <ul className="divide-y divide-border md:hidden">
                {data.students.map((r) => (
                  <li key={r.student.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {r.student.rollNo && <span className="mr-2 font-mono text-xs text-muted">{r.student.rollNo}</span>}
                          {r.student.fullName}
                        </p>
                      </div>
                      <RateBar rate={r.rate} />
                    </div>
                    <div className="mt-1.5 flex gap-3 text-xs">
                      {(["present", "absent", "late", "leave"] as const).map((s) => (
                        <span key={s} className={r.counts[s] ? STATUS_META[s].text : "text-muted"}>
                          {r.counts[s]} {STATUS_META[s].short}
                        </span>
                      ))}
                      {r.rate !== null && r.rate < LOW_ATTENDANCE && <Badge tone="danger">Low</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Tile({ label, value, hint, danger }: { label: string; value: string; hint: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cx("mt-1 text-2xl font-semibold tabular-nums tracking-tight", danger && "text-danger")}>{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>
    </div>
  );
}
