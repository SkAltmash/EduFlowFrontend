"use client";

import { useState } from "react";
import { Avatar } from "@/app/app/students/_components/bits";
import { Pager, query, useDebounced, useResource, type Pagination } from "@/components/data";
import { Button, ICONS, Icon, Select, Skeleton, cx } from "@/components/ui";
import { WhatsAppButton, WhatsAppDrawer } from "@/components/whatsapp-send";
import { errorMessage } from "@/components/data";
import { api } from "@/lib/api";
import { className, formatDay, localToday } from "@/lib/attendance";
import { formatMoney, type FeeTotals, type RegisterRow } from "@/lib/fees";
import type { StudentFilters } from "@/lib/students";

type Status = "all" | "overdue" | "due" | "paid" | "none";
const STATUSES: [Status, string][] = [
  ["all", "All"],
  ["overdue", "Overdue"],
  ["due", "Has balance"],
  ["paid", "Fully paid"],
  ["none", "No fees"],
];

export function FeeRegister({
  refreshKey,
  onOpen,
  onCollect,
  initialStatus = "all",
  initialSort = "name",
}: {
  refreshKey: number;
  onOpen: (id: string) => void;
  onCollect: (id: string) => void;
  initialStatus?: Status;
  initialSort?: string;
}) {
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [status, setStatus] = useState<Status>(initialStatus);
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());

  const path = `/api/fees/register${query({ search: q, grade, section, status, sort, page, limit: 25, today: localToday() })}`;
  const list = useResource(() => api<{ students: RegisterRow[]; totals: FeeTotals; pagination: Pagination }>(path), `${path}#${refreshKey}`);
  const filters = useResource(() => api<StudentFilters>("/api/students/filters"), "filters");
  const rows = list.data?.students ?? [];
  const totals = list.data?.totals;

  // Bulk reminders: everyone matching the current filters who still owes money
  const [reminderIds, setReminderIds] = useState<string[] | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const remindStatus = status === "overdue" ? "overdue" : "due";
  const canRemind = status !== "paid" && status !== "none" && (totals?.balance ?? 0) > 0;

  async function startReminders() {
    setCollecting(true);
    setBulkError(null);
    try {
      const ids: string[] = [];
      for (let p = 1; ; p++) {
        const res = await api<{ students: RegisterRow[]; pagination: Pagination }>(
          `/api/fees/register${query({ search: q, grade, section, status: remindStatus, sort: "overdue", page: p, limit: 100, today: localToday() })}`
        );
        ids.push(...res.students.map((r) => r.id));
        if (p >= res.pagination.totalPages || ids.length >= 500) break;
      }
      setReminderIds(ids.slice(0, 500));
    } catch (err) {
      setBulkError(errorMessage(err));
    } finally {
      setCollecting(false);
    }
  }

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <div>
      {/* Totals for the current filter */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total fees", value: totals ? totals.billed - totals.discount : null, hint: totals?.discount ? `after ${formatMoney(totals.discount)} concessions` : "after concessions" },
          { label: "Collected", value: totals?.paid ?? null, tone: "text-success" },
          { label: "Balance", value: totals?.balance ?? null },
          { label: "Overdue", value: totals?.overdue ?? null, tone: totals?.overdue ? "text-danger" : "" },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium text-muted">{t.label}</p>
            {t.value === null ? <Skeleton className="mt-2 h-7 w-24" /> : <p className={cx("mt-1 text-xl font-semibold tabular-nums tracking-tight", t.tone)}>{formatMoney(t.value)}</p>}
            {t.hint && <p className="truncate text-[11px] text-muted">{t.hint}</p>}
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-auto md:max-w-xs">
          <Icon d={ICONS.search} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Search student or guardian…"
            value={search}
            onChange={(e) => reset(setSearch)(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-base outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm"
          />
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:[&>select]:w-40">
          <Select aria-label="Class" value={grade} onChange={(e) => reset(setGrade)(e.target.value)}>
            <option value="">Class</option>
            {filters.data?.grades.map((g) => (
              <option key={g} value={g}>
                Class {g}
              </option>
            ))}
          </Select>
          <Select aria-label="Section" value={section} onChange={(e) => reset(setSection)(e.target.value)}>
            <option value="">Section</option>
            {filters.data?.sections.map((s) => (
              <option key={s} value={s}>
                Sec {s}
              </option>
            ))}
          </Select>
          <Select aria-label="Sort" value={sort} onChange={(e) => reset(setSort)(e.target.value)}>
            <option value="name">Name</option>
            <option value="overdue">Most overdue</option>
            <option value="balance">Highest balance</option>
            <option value="grade">Class & roll</option>
          </Select>
        </div>
      </div>

      {canRemind && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-sm text-muted">
            {status === "overdue" ? "Remind the parents of every overdue student in this list." : "Remind the parents of every student with a balance in this list."}
          </p>
          <WhatsAppButton size="sm" onClick={startReminders} disabled={collecting}>
            {collecting ? "Preparing…" : "Send reminders"}
          </WhatsAppButton>
        </div>
      )}
      {bulkError && <p className="mb-3 text-sm text-danger">{bulkError}</p>}
      {reminderIds && (
        <WhatsAppDrawer
          type="fee_reminder"
          refs={reminderIds.map((id) => ({ studentId: id }))}
          title={`Fee reminders · ${reminderIds.length} student${reminderIds.length === 1 ? "" : "s"}`}
          description={`${status === "overdue" ? "Overdue" : "Pending"} fees${grade ? ` · Class ${grade}${section ? ` - ${section}` : ""}` : ""}${q ? ` · “${q}”` : ""}`}
          onClose={() => setReminderIds(null)}
        />
      )}

      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {STATUSES.map(([v, label]) => (
          <button
            key={v}
            onClick={() => reset(setStatus)(v)}
            aria-pressed={status === v}
            className={cx(
              "h-8 shrink-0 rounded-full border px-3 text-sm transition-colors",
              status === v ? "border-accent bg-accent-soft font-medium text-accent" : "border-border bg-surface text-muted hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={cx("overflow-hidden rounded-xl border border-border bg-surface transition-opacity", list.loading && list.data && "opacity-60")}>
        {list.error ? (
          <p className="px-4 py-12 text-center text-sm text-danger">{list.error}</p>
        ) : !list.data ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <Skeleton className="size-10 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-14 text-center text-sm text-muted">
            {status === "overdue" ? "No overdue fees. 🎉" : status === "none" ? "Every active student has fees assigned." : "No students match."}
          </p>
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-border bg-surface-muted/50 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 text-right font-medium">Total fee</th>
                  <th className="px-4 py-3 text-right font-medium">Paid</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                  <th className="px-4 py-3 font-medium">Next due</th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="group cursor-pointer hover:bg-surface-muted" onClick={() => onOpen(r.id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.fullName} seed={r.id} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{r.fullName}</div>
                          <div className="text-xs text-muted">
                            <span className="font-mono">{r.admissionNo}</span>
                            {r.grade && ` · ${className(r.grade, r.section)}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.dues ? formatMoney(r.billed - r.discount) : <span className="text-muted">—</span>}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-success">{r.paid ? formatMoney(r.paid) : <span className="text-muted">—</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-medium tabular-nums">{r.dues ? formatMoney(r.balance) : <span className="text-muted">—</span>}</div>
                      {r.overdue > 0 && <div className="text-xs text-danger">{formatMoney(r.overdue)} overdue</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{r.nextDue ? formatDay(r.nextDue, "short") : r.dues ? "Paid up" : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {r.balance > 0 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCollect(r.id);
                          }}
                        >
                          Collect
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-border md:hidden">
              {rows.map((r) => (
                <li key={r.id}>
                  <button onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-muted">
                    <Avatar name={r.fullName} seed={r.id} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.fullName}</span>
                      <span className="block truncate text-xs text-muted">
                        {r.admissionNo}
                        {r.grade && ` · ${className(r.grade, r.section)}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      {r.dues ? (
                        <>
                          <span className={cx("block font-medium tabular-nums", r.balance <= 0 && "text-success")}>{r.balance > 0 ? formatMoney(r.balance) : "Paid"}</span>
                          {r.overdue > 0 ? (
                            <span className="block text-xs text-danger">{formatMoney(r.overdue)} overdue</span>
                          ) : (
                            r.nextDue && <span className="block text-xs text-muted">due {formatDay(r.nextDue, "short")}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted">No fees</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <Pager pagination={list.data?.pagination} onPage={setPage} />
      </div>
    </div>
  );
}
