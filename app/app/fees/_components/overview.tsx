"use client";

import { useState } from "react";
import { useResource } from "@/components/data";
import { Alert, Badge, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { addDays, className, formatDay, localToday } from "@/lib/attendance";
import { MODE_LABEL, formatMoney, formatMoneyCompact, type FeeSummary } from "@/lib/fees";

type Range = "month" | "30d" | "year";

function rangeDates(range: Range) {
  const today = localToday();
  if (range === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (range === "30d") return { from: addDays(today, -29), to: today };
  // Academic year from 1 April
  const [y, m] = today.split("-").map(Number);
  return { from: `${m >= 4 ? y : y - 1}-04-01`, to: today };
}

const MONTH_SHORT = new Intl.DateTimeFormat(undefined, { month: "short", timeZone: "UTC" });

/** One bar per day for short ranges, per month for long ones (every day/month shown, zeros included). */
function buckets(byDay: FeeSummary["byDay"], from: string, to: string) {
  const amounts = new Map(byDay.map((d) => [d.date, d.amount]));
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  if (days <= 62) {
    return Array.from({ length: days }, (_, i) => {
      const date = addDays(from, i);
      return { key: date, label: formatDay(date, "short"), tick: date.slice(8) === "01" || i === 0 ? formatDay(date, "short").replace(/^\w+,?\s*/, "") : String(Number(date.slice(8))), amount: amounts.get(date) ?? 0 };
    });
  }
  const months = new Map<string, number>();
  for (let d = from; d <= to; d = addDays(d, 1)) months.set(d.slice(0, 7), (months.get(d.slice(0, 7)) ?? 0) + (amounts.get(d) ?? 0));
  return [...months].map(([ym, amount]) => {
    const name = MONTH_SHORT.format(new Date(`${ym}-01T00:00:00Z`));
    return { key: ym, label: `${name} ${ym.slice(0, 4)}`, tick: name, amount };
  });
}

function CollectionChart({ data, from, to }: { data: FeeSummary["byDay"]; from: string; to: string }) {
  const [asTable, setAsTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const bars = buckets(data, from, to);
  const max = Math.max(...bars.map((b) => b.amount), 1);
  // Round the axis top up to a friendly number
  const step = 10 ** Math.floor(Math.log10(max));
  const top = Math.ceil(max / step) * step;
  const tickEvery = Math.ceil(bars.length / 8);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Collections</h3>
          <p className="text-xs text-muted">{bars.length > 62 || bars[0]?.key.length === 7 ? "Per month" : "Per day"}, voided receipts excluded</p>
        </div>
        <button onClick={() => setAsTable((v) => !v)} className="text-xs font-medium text-accent hover:underline">
          {asTable ? "Show chart" : "Show as table"}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {bars.filter((b) => b.amount > 0).map((b) => (
                <tr key={b.key}>
                  <td className="py-1.5 text-muted">{b.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatMoney(b.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {bars.every((b) => b.amount === 0) && <p className="py-6 text-center text-sm text-muted">No collections in this period.</p>}
        </div>
      ) : (
        <div className="flex gap-2">
          {/* Y axis: recessive labels */}
          <div className="flex h-44 flex-col justify-between pb-5 text-right text-[10px] tabular-nums text-muted">
            <span>{formatMoneyCompact(top)}</span>
            <span>{formatMoneyCompact(top / 2)}</span>
            <span>₹0</span>
          </div>
          <div className="relative min-w-0 flex-1">
            {/* Gridlines */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[calc(100%-1.25rem)]">
              {[0, 50, 100].map((p) => (
                <div key={p} className="absolute inset-x-0 border-t border-border/70" style={{ top: `${p}%` }} />
              ))}
            </div>
            <div className="relative flex h-44 items-end gap-[2px] pb-5" role="img" aria-label="Collections bar chart" onMouseLeave={() => setHover(null)}>
              {bars.map((b, i) => (
                <div
                  key={b.key}
                  className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  tabIndex={b.amount ? 0 : -1}
                >
                  <div
                    className={cx("w-full rounded-t-[4px] transition-colors", hover === i ? "bg-accent-hover" : "bg-accent")}
                    style={{ height: b.amount ? `max(2px, ${(b.amount / top) * 100}%)` : 0 }}
                  />
                  {i % tickEvery === 0 && (
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted">{b.tick}</span>
                  )}
                  {hover === i && (
                    <div
                      className={cx(
                        "pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs shadow-lg",
                        i < bars.length / 2 ? "left-0" : "right-0"
                      )}
                    >
                      <p className="text-muted">{b.label}</p>
                      <p className="font-semibold tabular-nums">{formatMoney(b.amount)}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, tone, action }: { label: string; value: string | null; hint?: string; tone?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      {value === null ? <Skeleton className="mt-2 h-8 w-28" /> : <p className={cx("mt-1 text-2xl font-semibold tabular-nums tracking-tight", tone)}>{value}</p>}
      {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
      {action}
    </div>
  );
}

export function Overview({ refreshKey, onViewOverdue, onOpenReceipt }: { refreshKey: number; onViewOverdue: () => void; onOpenReceipt: (id: string) => void }) {
  const [range, setRange] = useState<Range>("month");
  const { from, to } = rangeDates(range);
  const path = `/api/fees/summary?from=${from}&to=${to}&today=${localToday()}`;
  const { data, error } = useResource(() => api<FeeSummary>(path), `${path}#${refreshKey}`);
  const modeMax = Math.max(...(data?.byMode.map((m) => m.amount) ?? [0]), 1);
  const rangeLabel = range === "month" ? "This month" : range === "30d" ? "Last 30 days" : "This academic year";

  if (error) return <Alert>{error}</Alert>;

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm">
        {(
          [
            ["month", "This month"],
            ["30d", "30 days"],
            ["year", "Academic year"],
          ] as const
        ).map(([v, label]) => (
          <button key={v} onClick={() => setRange(v)} className={cx("rounded-md px-3 py-1.5 transition-colors", range === v ? "bg-surface-muted font-medium" : "text-muted hover:text-foreground")}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={`Collected · ${rangeLabel.toLowerCase()}`} value={data ? formatMoney(data.collected.amount) : null} hint={data ? `${data.collected.count} receipts` : undefined} tone="text-success" />
        <Kpi label="Outstanding" value={data ? formatMoney(data.dues.balance) : null} hint={data ? `${formatMoney(data.upcoming.amount)} due in next 30 days` : undefined} />
        <Kpi
          label="Overdue"
          value={data ? formatMoney(data.dues.overdue) : null}
          tone={data?.dues.overdue ? "text-danger" : undefined}
          hint={data ? `${data.dues.overdueStudents} student${data.dues.overdueStudents === 1 ? "" : "s"}` : undefined}
          action={
            data?.dues.overdueStudents ? (
              <button onClick={onViewOverdue} className="mt-1 text-xs font-medium text-accent hover:underline">
                View defaulters →
              </button>
            ) : null
          }
        />
        <Kpi
          label="Collection rate"
          value={data ? (data.dues.collectionRate === null ? "—" : `${data.dues.collectionRate}%`) : null}
          hint={data ? `${formatMoney(data.dues.paid)} of ${formatMoney(data.dues.billed - data.dues.discount)} billed` : undefined}
        />
      </div>

      {data ? <CollectionChart data={data.byDay} from={from} to={to} /> : <Skeleton className="h-64 rounded-xl" />}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-3 font-semibold">By payment mode</h3>
          {!data ? (
            <Skeleton className="h-24" />
          ) : data.byMode.length === 0 ? (
            <p className="text-sm text-muted">No collections in this period.</p>
          ) : (
            <ul className="space-y-3">
              {data.byMode
                .slice()
                .sort((a, b) => b.amount - a.amount)
                .map((m) => (
                  <li key={m.mode}>
                    <div className="flex justify-between text-sm">
                      <span>
                        {MODE_LABEL[m.mode]} <span className="text-xs text-muted">· {m.count}</span>
                      </span>
                      <span className="font-medium tabular-nums">{formatMoney(m.amount)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(m.amount / modeMax) * 100}%` }} />
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-3 font-semibold">Dues by class</h3>
          {!data ? (
            <Skeleton className="h-24" />
          ) : data.byClass.length === 0 ? (
            <p className="text-sm text-muted">No fees assigned yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-2 font-medium">Class</th>
                  <th className="pb-2 font-medium">Collected</th>
                  <th className="pb-2 text-right font-medium">Balance</th>
                  <th className="pb-2 text-right font-medium">Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.byClass.map((c) => {
                  const pct = c.billed ? Math.round((c.paid / c.billed) * 100) : 0;
                  return (
                    <tr key={`${c.grade}|${c.section}`}>
                      <td className="py-2 font-medium">{c.grade ? className(c.grade, c.section) : "No class"}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-14 rounded-full bg-surface-muted">
                            <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-muted">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatMoney(c.balance)}</td>
                      <td className={cx("py-2 text-right tabular-nums", c.overdue ? "text-danger" : "text-muted")}>{formatMoney(c.overdue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface">
        <h3 className="border-b border-border px-4 py-3 font-semibold">Recent payments</h3>
        {!data ? (
          <Skeleton className="m-4 h-20" />
        ) : data.recent.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No payments yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.recent.map((p) => (
              <li key={p.id}>
                <button onClick={() => onOpenReceipt(p.id)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-muted">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.student.fullName}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <span className="font-mono">{p.receiptNo}</span> · {formatDay(p.date, "short")} · {MODE_LABEL[p.mode]}
                      {p.voided && <Badge tone="danger">Void</Badge>}
                    </span>
                  </span>
                  <span className={cx("font-medium tabular-nums", p.voided && "text-muted line-through")}>{formatMoney(p.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

