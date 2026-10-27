"use client";

import { useCallback, useRef, useState } from "react";
import { useResource } from "@/components/data";
import { Alert, Button, ICONS, Icon, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatRate, localToday, type ClassSummary } from "@/lib/attendance";
import { ClassGrid } from "./_components/class-grid";
import { DayPicker } from "./_components/day-picker";
import { Register } from "./_components/register";
import { Report } from "./_components/report";

type View = { tab: "mark"; open: { grade: string; section: string } | null } | { tab: "report" };

export default function AttendancePage() {
  const { session } = useAuth();
  if (session.status === "authenticated" && session.role === "accountant") {
    return <p className="rounded-xl border border-border bg-surface px-6 py-14 text-center text-sm text-muted">Attendance is for teachers and admins. Accountants don&apos;t have access.</p>;
  }
  return <AttendanceWorkspace />;
}

function AttendanceWorkspace() {
  const [date, setDate] = useState(localToday);
  const [view, setView] = useState<View>({ tab: "mark", open: null });
  const dirtyRef = useRef(false);

  const path = `/api/attendance/classes?date=${date}`;
  const overview = useResource(() => api<{ classes: ClassSummary[]; unassigned: number; limited?: boolean }>(path), path);
  const classes = overview.data?.classes;
  const [showOthers, setShowOthers] = useState(false);
  const limited = Boolean(overview.data?.limited);
  const mine = limited ? classes?.filter((c) => c.mine) : classes;
  const others = limited ? (classes?.filter((c) => !c.mine) ?? []) : [];

  const onDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  /** Switching day or tab throws away unsaved marks, so ask first. */
  const guard = (action: () => void) => {
    if (dirtyRef.current && !confirm("You have unsaved attendance. Discard it?")) return;
    dirtyRef.current = false;
    action();
  };

  const totals = classes?.reduce(
    (t, c) => ({ students: t.students + c.students, marked: t.marked + c.marked, present: t.present + c.counts.present + c.counts.late, absent: t.absent + c.counts.absent }),
    { students: 0, marked: 0, present: 0, absent: 0 }
  );
  const schoolRate = totals && totals.present + totals.absent ? Math.round((totals.present / (totals.present + totals.absent)) * 1000) / 10 : null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent to-[color-mix(in_oklab,var(--accent)_70%,var(--brand-green))] text-accent-foreground shadow-lg shadow-accent/20 sm:grid">
            <Icon d={ICONS.calendarCheck} className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
            <p className="mt-1 text-sm text-muted">{limited ? "Your classes first. Mark each one daily and track who needs attention." : "Mark each class daily and track who needs attention."}</p>
          </div>
        </div>
        <div role="tablist" className="inline-flex w-full rounded-lg border border-border bg-surface p-0.5 text-sm sm:w-auto">
          {(
            [
              ["mark", "Mark attendance"],
              ["report", "Monthly report"],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              role="tab"
              aria-selected={view.tab === tab}
              onClick={() => guard(() => setView(tab === "mark" ? { tab: "mark", open: null } : { tab: "report" }))}
              className={cx(
                "flex-1 rounded-md px-4 py-2 transition-colors sm:flex-none",
                view.tab === tab ? "bg-surface-muted font-medium" : "text-muted hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view.tab === "report" ? (
        <Report classes={classes} />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <DayPicker value={date} onChange={(d) => guard(() => setDate(d))} />
            {totals && totals.students > 0 && !view.open && (
              <p className="text-sm text-muted">
                <span className="font-medium text-foreground">{totals.marked}</span> of {totals.students} students marked
                {schoolRate !== null && (
                  <>
                    {" "}· <span className="font-medium text-foreground">{formatRate(schoolRate)}</span> present
                  </>
                )}
              </p>
            )}
          </div>

          {view.open ? (
            <Register
              date={date}
              grade={view.open.grade}
              section={view.open.section}
              onBack={() => {
                dirtyRef.current = false;
                setView({ tab: "mark", open: null });
              }}
              onDirtyChange={onDirtyChange}
              onSaved={overview.reload}
            />
          ) : overview.error ? (
            <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center">
              <p className="text-sm text-danger">{overview.error}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={overview.reload}>
                Try again
              </Button>
            </div>
          ) : classes && classes.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center">
              <p className="font-medium">No classes yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                Classes come from each student&apos;s Class and Section. Add students with a class to start taking attendance.
              </p>
            </div>
          ) : (
            <>
              {overview.data && overview.data.unassigned > 0 && (
                <div className="mb-4">
                  <Alert tone="warning">
                    {overview.data.unassigned} active student{overview.data.unassigned === 1 ? " has" : "s have"} no class, so they
                    won&apos;t appear in any register. Set their Class on the Students page.
                  </Alert>
                </div>
              )}
              {limited && <h2 className="mb-3 text-sm font-semibold">My classes</h2>}
              <ClassGrid
                classes={mine}
                loading={overview.loading}
                onOpen={(c) => setView({ tab: "mark", open: { grade: c.grade, section: c.section } })}
              />
              {others.length > 0 && (
                <div className="mt-6">
                  <button onClick={() => setShowOthers((v) => !v)} className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
                    <Icon d={ICONS.chevronRight} className={cx("transition-transform", showOthers && "rotate-90")} />
                    Other classes ({others.length}) · view only
                  </button>
                  {showOthers && <ClassGrid classes={others} loading={overview.loading} onOpen={(c) => setView({ tab: "mark", open: { grade: c.grade, section: c.section } })} />}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
