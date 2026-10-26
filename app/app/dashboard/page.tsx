"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useResource } from "@/components/data";
import { Alert, Badge, Button, ICONS, Icon, Skeleton, buttonClass, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { STATUS_META, className, formatDay, formatRate, localToday, LOW_ATTENDANCE } from "@/lib/attendance";
import { useAuth } from "@/lib/auth";
import type { Dashboard } from "@/lib/dashboard";
import { classLabel } from "@/lib/exams";
import { MODE_LABEL, formatMoney } from "@/lib/fees";

const TEST_ICON = "M9 4h6M8 4H6v16h12V4h-2M9 10h6M9 14h6M9 18h3";
const FEE_ICON = "M7 4h10M7 8h10M7 4c4 0 6 2 6 4s-2 4-6 4l7 8";
const ALERT_ICON = "M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

function Panel({ title, action, children, className: extra }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("flex flex-col rounded-xl border border-border bg-surface", extra)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="shrink-0 text-xs font-medium text-accent hover:underline">
      {children}
    </Link>
  );
}

function Kpi({ href, icon, label, value, hint, tone }: { href: string; icon: string; label: string; value: string; hint: ReactNode; tone?: string }) {
  return (
    <Link href={href} className="group rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/50">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <Icon d={icon} className="size-3.5" />
        </span>
      </div>
      <p className={cx("mt-1 text-2xl font-semibold tabular-nums tracking-tight", tone)}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </Link>
  );
}

/** Attendance rate per day; days nobody marked (weekends, holidays) show as a gap. */
function Trend({ trend, today }: { trend: NonNullable<Dashboard["attendance"]>["trend"]; today: string }) {
  const marked = trend.filter((d) => d.rate !== null);
  const avg = marked.length ? Math.round((marked.reduce((n, d) => n + (d.rate ?? 0), 0) / marked.length) * 10) / 10 : null;
  return (
    <div className="px-4 pb-4 pt-3">
      <div className="mb-2 flex items-baseline justify-between text-xs text-muted">
        <span>Last {trend.length} days</span>
        <span>
          Average <span className="font-medium text-foreground tabular-nums">{formatRate(avg)}</span>
        </span>
      </div>
      <div className="flex h-20 items-end gap-1" role="img" aria-label={`Attendance over the last ${trend.length} days, average ${formatRate(avg)}`}>
        {trend.map((d) => (
          <div key={d.date} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
            {d.rate === null ? (
              <div className="h-0.5 rounded-full bg-border" />
            ) : (
              <div
                className={cx("rounded-t-[3px] transition-opacity group-hover:opacity-80", d.rate < LOW_ATTENDANCE ? "bg-warning" : "bg-success", d.date === today && "ring-2 ring-accent ring-offset-1 ring-offset-surface")}
                style={{ height: `max(3px, ${d.rate}%)` }}
              />
            )}
            <div className={cx("pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg border border-border bg-background px-2 py-1 text-xs shadow-lg group-hover:block", d.date < trend[7]?.date ? "left-0" : "right-0")}>
              <p className="text-muted">{formatDay(d.date, "short")}</p>
              <p className="font-semibold tabular-nums">{d.rate === null ? "Not marked" : formatRate(d.rate)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{formatDay(trend[0].date, "short")}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function AttendanceToday({ a }: { a: NonNullable<Dashboard["attendance"]> }) {
  const total = a.counts.present + a.counts.absent + a.counts.late + a.counts.leave;
  const pending = a.classes.filter((c) => c.marked === 0);
  return (
    <Panel title="Attendance today" action={<PanelLink href="/app/attendance">{pending.length ? "Mark now →" : "Open register →"}</PanelLink>} className="lg:col-span-2">
      {a.classesTotal === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">No classes yet. Give students a class to start marking attendance.</p>
      ) : (
        <>
          <div className="space-y-3 px-4 pt-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <p>
                <span className="text-3xl font-semibold tabular-nums tracking-tight">{formatRate(a.rate)}</span>
                <span className="ml-2 text-sm text-muted">present</span>
              </p>
              <p className="text-sm text-muted">
                <span className="font-medium text-foreground">{a.classesMarked}</span> of {plural(a.classesTotal, "class", "classes")} marked
              </p>
            </div>
            {/* Share of each status among students marked today */}
            <div className="flex h-2 overflow-hidden rounded-full bg-surface-muted">
              {total > 0 &&
                (["present", "late", "leave", "absent"] as const).map((s) =>
                  a.counts[s] ? <div key={s} className={STATUS_META[s].dot} style={{ width: `${(a.counts[s] / total) * 100}%` }} /> : null
                )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {(["present", "absent", "late", "leave"] as const).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className={cx("size-2 rounded-full", STATUS_META[s].dot)} />
                  {STATUS_META[s].label} <span className="font-medium tabular-nums text-foreground">{a.counts[s]}</span>
                </span>
              ))}
            </div>
          </div>

          {pending.length > 0 && (
            <div className="mx-4 mt-4 rounded-lg bg-warning-soft px-3 py-2.5 text-sm">
              <p className="font-medium text-warning">Not marked yet</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {pending.map((c) => (
                  <Link
                    key={`${c.grade}|${c.section}`}
                    href="/app/attendance"
                    className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-medium hover:border-accent"
                  >
                    {className(c.grade, c.section)} <span className="text-muted">· {c.students}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <Trend trend={a.trend} today={a.date} />
        </>
      )}
    </Panel>
  );
}

function AbsentToday({ a }: { a: NonNullable<Dashboard["attendance"]> }) {
  return (
    <Panel title="Absent today" action={a.absentTotal ? <Badge tone="danger">{a.absentTotal}</Badge> : undefined}>
      {a.absentTotal === 0 ? (
        <div className="grid h-full place-items-center px-4 py-8 text-center">
          <p className="text-sm text-muted">{a.classesMarked ? "Nobody is marked absent today." : "Nothing marked yet today."}</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {a.absent.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate font-medium">{s.fullName}</span>
                <span className="shrink-0 text-xs text-muted">{className(s.grade, s.section)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 py-3">
            {a.absentTotal > a.absent.length && <p className="mb-2 text-xs text-muted">and {a.absentTotal - a.absent.length} more</p>}
            <Link href="/app/attendance" className={cx(buttonClass("secondary", "sm"), "w-full")}>
              <Icon d={ICONS.message} />
              Notify parents
            </Link>
          </div>
        </>
      )}
    </Panel>
  );
}

function RecentTests({ tests }: { tests: NonNullable<Dashboard["tests"]> }) {
  return (
    <Panel title="Recent tests" action={<PanelLink href="/app/exams">All tests →</PanelLink>}>
      {tests.recent.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">No tests yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {tests.recent.map((t) => {
            const pct = t.students ? Math.min(100, Math.round((t.marked / t.students) * 100)) : 0;
            const done = t.students > 0 && t.marked >= t.students;
            return (
              <li key={t.id}>
                <Link href="/app/exams" className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-surface-muted">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{t.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {classLabel(t.grade, t.section)} · {formatDay(t.date, "short")} · {plural(t.subjects, "subject")}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="hidden h-1.5 w-14 rounded-full bg-surface-muted sm:block">
                      <span className={cx("block h-full rounded-full", done ? "bg-success" : "bg-accent")} style={{ width: `${pct}%` }} />
                    </span>
                    <span className={cx("text-xs tabular-nums", done ? "text-success" : "text-muted")}>
                      {done ? "Marked" : `${t.marked}/${t.students}`}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function RecentPayments({ fees }: { fees: NonNullable<Dashboard["fees"]> }) {
  return (
    <Panel title="Recent payments" action={<PanelLink href="/app/fees">Fees →</PanelLink>}>
      {fees.recent.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">No payments yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {fees.recent.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.student.fullName}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="font-mono">{p.receiptNo}</span> · {formatDay(p.date, "short")} · {MODE_LABEL[p.mode]}
                  {p.voided && <Badge tone="danger">Void</Badge>}
                </span>
              </span>
              <span className={cx("shrink-0 font-medium tabular-nums", p.voided && "text-muted line-through")}>{formatMoney(p.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** First steps for a new school, until it has students. */
function GettingStarted({ canManage, canMark, seesFees }: { canManage: boolean; canMark: boolean; seesFees: boolean }) {
  const steps = [
    { href: "/app/students", title: "Add your students", text: "One by one, or import an Excel or CSV file.", show: true },
    { href: "/app/attendance", title: "Mark today's attendance", text: "Pick a class and tap present or absent.", show: canMark },
    { href: "/app/fees", title: "Set up fee plans", text: "Create a plan, assign it to a class, collect and print receipts.", show: seesFees },
    { href: "/app/settings", title: "Connect WhatsApp", text: "Send receipts, reminders and report cards to parents.", show: canManage },
  ].filter((s) => s.show);
  return (
    <section className="rounded-xl border border-accent/30 bg-accent-soft/50 p-4 sm:p-5">
      <h2 className="font-semibold">Get your school ready</h2>
      <p className="mt-0.5 text-sm text-muted">A few steps and EduFlow is running.</p>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.href}>
            <Link href={s.href} className="flex h-full gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-accent">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{i + 1}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{s.title}</span>
                <span className="block text-xs text-muted">{s.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[6.5rem] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { session } = useAuth();
  const role = session.status === "authenticated" ? session.role : undefined;
  const firstName = session.status === "authenticated" ? session.user.name.split(/\s+/)[0] : "";
  const canManage = role === "owner" || role === "admin";
  const canMark = role !== "accountant";
  const today = localToday();
  const path = `/api/dashboard?date=${today}`;
  const { data, error, loading, reload } = useResource(() => api<Dashboard>(path), path);

  const actions = [
    canMark && { href: "/app/attendance", label: "Mark attendance", icon: ICONS.calendarCheck },
    data?.fees && { href: "/app/fees", label: "Collect fee", icon: FEE_ICON },
    canManage && { href: "/app/students", label: "Add student", icon: ICONS.plus },
    data?.tests && { href: "/app/exams", label: "New test", icon: TEST_ICON },
  ].filter((a): a is { href: string; label: string; icon: string } => Boolean(a));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{formatDay(today)}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
            {greeting()}
            {firstName && `, ${firstName}`}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((a, i) => (
            <Link key={a.href + a.label} href={a.href} className={buttonClass(i === 0 ? "primary" : "secondary", "sm")}>
              <Icon d={a.icon} />
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      {error ? (
        <div className="space-y-3">
          <Alert>{error}</Alert>
          <Button variant="secondary" size="sm" onClick={reload} loading={loading}>
            Try again
          </Button>
        </div>
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-4">
          {data.students.total === 0 && <GettingStarted canManage={canManage} canMark={canMark} seesFees={Boolean(data.fees)} />}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              href="/app/students"
              icon={ICONS.users}
              label="Active students"
              value={data.students.active.toLocaleString("en-IN")}
              hint={data.students.newThisMonth ? `+${data.students.newThisMonth} added this month` : `${data.students.total.toLocaleString("en-IN")} on record`}
            />
            {data.attendance ? (
              <Kpi
                href="/app/attendance"
                icon={ICONS.calendarCheck}
                label="Present today"
                value={formatRate(data.attendance.rate)}
                tone={data.attendance.rate !== null && data.attendance.rate < LOW_ATTENDANCE ? "text-warning" : undefined}
                hint={`${data.attendance.classesMarked}/${data.attendance.classesTotal} classes marked`}
              />
            ) : (
              data.fees && (
                <Kpi
                  href="/app/fees"
                  icon={FEE_ICON}
                  label="Outstanding fees"
                  value={formatMoney(data.fees.outstanding)}
                  hint={`${formatMoney(data.fees.upcoming.amount)} due in next 30 days`}
                />
              )
            )}
            {data.fees ? (
              <>
                <Kpi
                  href="/app/fees"
                  icon={FEE_ICON}
                  label="Collected this month"
                  value={formatMoney(data.fees.collectedMonth.amount)}
                  tone="text-success"
                  hint={`${formatMoney(data.fees.collectedToday)} today · ${plural(data.fees.collectedMonth.count, "receipt")}`}
                />
                <Kpi
                  href="/app/fees"
                  icon={ALERT_ICON}
                  label="Overdue fees"
                  value={formatMoney(data.fees.overdue)}
                  tone={data.fees.overdue ? "text-danger" : undefined}
                  hint={data.fees.overdueStudents ? plural(data.fees.overdueStudents, "student") : `${formatMoney(data.fees.outstanding)} outstanding`}
                />
              </>
            ) : (
              data.attendance && (
                <>
                  <Kpi
                    href="/app/attendance"
                    icon={ALERT_ICON}
                    label="Absent today"
                    value={String(data.attendance.counts.absent)}
                    tone={data.attendance.counts.absent ? "text-danger" : undefined}
                    hint={`${data.attendance.counts.late} late · ${data.attendance.counts.leave} on leave`}
                  />
                  <Kpi
                    href="/app/exams"
                    icon={TEST_ICON}
                    label="Tests to mark"
                    value={String(data.tests?.recent.filter((t) => t.students > 0 && t.marked < t.students).length ?? 0)}
                    hint="among recent tests"
                  />
                </>
              )
            )}
          </div>

          {data.attendance && (
            <div className="grid gap-4 lg:grid-cols-3">
              <AttendanceToday a={data.attendance} />
              <AbsentToday a={data.attendance} />
            </div>
          )}

          {(data.fees || data.tests) && (
            <div className={cx("grid gap-4", data.fees && data.tests && "lg:grid-cols-2")}>
              {data.fees && <RecentPayments fees={data.fees} />}
              {data.tests && <RecentTests tests={data.tests} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
