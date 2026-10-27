"use client";

import { Alert, Badge, Icon, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { formatMoney, formatMoneyCompact } from "@/lib/fees";
import { HEALTH_META, STATUS_META, endsText, type Dashboard as DashboardData, type SchoolRow, type SubStatus } from "@/lib/platform";
import { PageHeader, useResource } from "./shared";
import type { ConsoleTab } from "./shell";

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
const weekLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** Growth at a glance: revenue, signups, how far schools get, and who needs a call today. */
export function Dashboard({ onOpenSchool, onGo }: { onOpenSchool: (id: string) => void; onGo: (tab: ConsoleTab) => void }) {
  const res = useResource(() => api<DashboardData>("/api/admin/dashboard"), "console-dashboard");
  const d = res.data;
  const t = d?.totals;
  const weekDelta = t ? t.activeThisWeek - t.activeLastWeek : 0;
  const paying = t ? (t.byStatus.active ?? 0) + (t.byStatus.overdue ?? 0) : 0;

  return (
    <>
      <PageHeader title="Dashboard" description="How EduFlow is growing, and which schools need attention." icon="M4 13h6V4H4zM14 20h6v-9h-6zM14 4v3h6V4zM4 20h6v-3H4z" />
      {res.error && <Alert>{res.error}</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Monthly revenue (MRR)" value={t ? formatMoney(t.mrr) : null} sub={t ? `${formatMoneyCompact(t.arr)} a year · ${paying} paying` : ""} tone="success" />
        <Kpi label="Schools" value={t ? t.schools.toLocaleString("en-IN") : null} sub={t ? `+${t.newThisMonth} this month` : ""} />
        <Kpi
          label="Active this week"
          value={t ? t.activeThisWeek.toLocaleString("en-IN") : null}
          sub={t ? `${weekDelta >= 0 ? "▲" : "▼"} ${Math.abs(weekDelta)} vs last week` : ""}
          subTone={weekDelta >= 0 ? "text-success" : "text-danger"}
        />
        <Kpi label="Trial → paid" value={t ? (t.conversion === null ? "—" : `${t.conversion}%`) : null} sub={t ? `${formatMoneyCompact(t.lifetimeRevenue)} collected all time` : ""} />
      </div>

      {t && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(STATUS_META) as SubStatus[])
            .filter((s) => t.byStatus[s])
            .map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs">
                <Badge tone={STATUS_META[s].tone}>{STATUS_META[s].label}</Badge>
                <span className="font-semibold tabular-nums">{t.byStatus[s]}</span>
              </span>
            ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Revenue" hint="Payments recorded, last 12 months">
          {d ? <Bars data={d.revenue.map((r) => ({ label: monthLabel(r.month), value: r.amount, text: formatMoney(r.amount) }))} tone="bg-success" /> : <Skeleton className="h-40" />}
        </Panel>
        <Panel title="Signups" hint="New schools per week">
          {d ? <Bars data={d.signups.map((s) => ({ label: weekLabel(s.week), value: s.count, text: String(s.count) }))} tone="bg-accent" /> : <Skeleton className="h-40" />}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Setup funnel" hint="How far schools get" className="lg:col-span-2">
          {d ? (
            <ul className="space-y-2.5">
              {d.funnel.map((f, i) => {
                const top = d.funnel[0]?.count || 1;
                const pct = Math.round((f.count / top) * 100);
                const prev = i ? d.funnel[i - 1].count : 0;
                return (
                  <li key={f.step}>
                    <div className="flex justify-between text-sm">
                      <span>{f.step}</span>
                      <span className="tabular-nums">
                        <strong>{f.count}</strong> <span className="text-xs text-muted">· {pct}%{i > 0 && prev ? ` (${Math.round((f.count / prev) * 100)}% of previous)` : ""}</span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent to-[color-mix(in_oklab,var(--accent)_60%,var(--brand-green))]" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Skeleton className="h-36" />
          )}
        </Panel>
        <Panel title="Biggest schools" hint="By active students">
          {d ? (
            d.topSchools.length ? (
              <ol className="space-y-1">
                {d.topSchools.map((s, i) => (
                  <li key={s.id}>
                    <button onClick={() => onOpenSchool(s.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-muted">
                      <span className="w-4 text-xs font-semibold text-muted">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      <span className="tabular-nums text-muted">{s.students.toLocaleString("en-IN")}</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">No students yet.</p>
            )
          ) : (
            <Skeleton className="h-36" />
          )}
        </Panel>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold">Needs attention</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <ActionList title="Trials ending in 3 days" empty="No trials ending soon." rows={d?.lists.trialsEnding} onOpen={onOpenSchool} meta={(s) => endsText(s.subscription)} />
        <ActionList title="Renewals in the next 30 days" empty="No renewals due." rows={d?.lists.renewalsDue} onOpen={onOpenSchool} meta={(s) => `${endsText(s.subscription)} · ${formatMoney(s.mrr)}/mo`} />
        <ActionList title="Expired" empty="No expired schools." rows={d?.lists.expired} onOpen={onOpenSchool} meta={(s) => endsText(s.subscription)} />
        <ActionList
          title="Quiet or never used"
          empty="Every school is using EduFlow."
          rows={d?.lists.quiet}
          onOpen={onOpenSchool}
          meta={(s) => (s.lastActiveAt ? `Last seen ${new Date(s.lastActiveAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : HEALTH_META[s.health].label)}
        />
      </div>
      <button onClick={() => onGo("schools")} className="mt-4 text-sm font-medium text-accent hover:underline">
        All schools →
      </button>
    </>
  );
}

function Kpi({ label, value, sub, tone, subTone }: { label: string; value: string | null; sub: string; tone?: "success"; subTone?: string }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      {value === null ? <Skeleton className="mt-2 h-8 w-24" /> : <p className={cx("mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl", tone === "success" && "text-success")}>{value}</p>}
      <p className={cx("mt-0.5 truncate text-xs", subTone ?? "text-muted")}>{sub || " "}</p>
    </section>
  );
}

function Panel({ title, hint, className, children }: { title: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cx("rounded-xl border border-border bg-surface p-4", className)}>
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** Small bar chart; the value shows on hover and on the last bar. */
function Bars({ data, tone }: { data: { label: string; value: number; text: string }[]; tone: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const every = Math.ceil(data.length / 6);
  return (
    <div>
      <div className="flex h-36 items-end gap-1">
        {data.map((d, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end" title={`${d.label}: ${d.text}`}>
            <div className={cx("w-full rounded-t-md opacity-80 transition-opacity group-hover:opacity-100", tone, d.value === 0 && "opacity-20")} style={{ height: `${Math.max((d.value / max) * 100, 2)}%` }} />
            <span className={cx("pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background opacity-0 group-hover:opacity-100", i === data.length - 1 && "opacity-100")}>
              {d.text}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1">
        {data.map((d, i) => (
          <span key={i} className="flex-1 truncate text-center text-[10px] text-muted">
            {i % every === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function ActionList({ title, empty, rows, onOpen, meta }: { title: string; empty: string; rows?: SchoolRow[]; onOpen: (id: string) => void; meta: (s: SchoolRow) => string }) {
  return (
    <section className="rounded-xl border border-border bg-surface">
      <h3 className="flex items-center justify-between border-b border-border px-4 py-3 text-sm font-semibold">
        {title}
        {rows && rows.length > 0 && <span className="rounded-full bg-surface-muted px-2 text-xs font-medium tabular-nums">{rows.length}</span>}
      </h3>
      {!rows ? (
        <Skeleton className="m-4 h-16" />
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((s) => (
            <li key={s.id}>
              <button onClick={() => onOpen(s.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-muted">
                <span className={cx("size-2 shrink-0 rounded-full", HEALTH_META[s.health].dot)} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-muted">{meta(s)}</span>
                </span>
                <Badge tone={STATUS_META[s.subscription.status].tone}>{STATUS_META[s.subscription.status].label}</Badge>
                <Icon d="M9 6l6 6-6 6" className="text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
