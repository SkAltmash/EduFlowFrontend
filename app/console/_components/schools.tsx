"use client";

import { useState } from "react";
import { Alert, Badge, ICONS, Icon, Input, Select, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/fees";
import { HEALTH_META, STATUS_META, endsText, type SchoolRow } from "@/lib/platform";
import { Card, PageHeader, Pager, formatDate, query, useDebounced, useResource, type Pagination } from "./shared";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "trial", label: "Trial" },
  { id: "paying", label: "Paying" },
  { id: "overdue", label: "Payment due" },
  { id: "expired", label: "Expired" },
  { id: "suspended", label: "Suspended" },
  { id: "none", label: "No plan" },
] as const;

/** Every school with its plan, health and value; click one for the full picture. */
export function Schools({ onOpenSchool }: { onOpenSchool: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]["id"]>("all");
  const [health, setHealth] = useState("all");
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  const path = `/api/admin/schools${query({ search: q, status, health, page, limit: 25 })}`;
  const list = useResource(() => api<{ schools: SchoolRow[]; pagination: Pagination }>(path), path);
  const rows = list.data?.schools ?? [];

  return (
    <>
      <PageHeader title="Schools" description="Plans, renewals and how much each school uses EduFlow." icon="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Icon d={ICONS.search} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              className="pl-9"
              placeholder="Name or school ID"
              aria-label="Search schools"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            aria-label="Usage"
            className="w-40"
            value={health}
            onChange={(e) => {
              setHealth(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Any usage</option>
            {(Object.keys(HEALTH_META) as SchoolRow["health"][]).map((h) => (
              <option key={h} value={h}>
                {HEALTH_META[h].label}
              </option>
            ))}
          </Select>
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setStatus(f.id);
                setPage(1);
              }}
              aria-pressed={status === f.id}
              className={cx("shrink-0 rounded-full border px-3 py-1 text-sm transition-colors", status === f.id ? "border-accent bg-accent-soft font-medium text-accent" : "border-border bg-surface text-muted hover:text-foreground")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {list.error && <Alert>{list.error}</Alert>}
      <Card>
        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Ends</th>
                <th className="px-4 py-3 text-right font-medium">Students</th>
                <th className="px-4 py-3 text-right font-medium">MRR</th>
                <th className="px-4 py-3 font-medium">Usage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.loading && !list.data && (
                <tr>
                  <td colSpan={6} className="p-4">
                    <Skeleton className="h-32" />
                  </td>
                </tr>
              )}
              {rows.map((s) => (
                <tr key={s.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => onOpenSchool(s.id)}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted">
                      {s.slug} · joined {formatDate(s.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS_META[s.subscription.status].tone}>{STATUS_META[s.subscription.status].label}</Badge>
                      <span className="text-muted">{s.subscription.planName ?? ""}</span>
                    </div>
                  </td>
                  <td className={cx("whitespace-nowrap px-4 py-3", (s.subscription.daysLeft ?? 99) < 0 ? "text-danger" : (s.subscription.daysLeft ?? 99) <= 3 ? "text-warning" : "text-muted")}>{endsText(s.subscription)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.students ?? 0}
                    {s.subscription.studentLimit > 0 && <span className="text-xs text-muted"> / {s.subscription.studentLimit}</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.mrr ? formatMoney(s.mrr) : <span className="text-muted">—</span>}</td>
                  <td className="px-4 py-3">
                    <Health s={s} />
                  </td>
                </tr>
              ))}
              {list.data && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted">
                    No schools match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Phones: cards */}
        <ul className="divide-y divide-border md:hidden">
          {list.loading && !list.data && <Skeleton className="m-4 h-32" />}
          {rows.map((s) => (
            <li key={s.id}>
              <button onClick={() => onOpenSchool(s.id)} className="w-full px-4 py-3 text-left active:bg-surface-muted">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {s.students ?? 0} students · {endsText(s.subscription)}
                    </span>
                  </span>
                  <Badge tone={STATUS_META[s.subscription.status].tone}>{STATUS_META[s.subscription.status].label}</Badge>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <Health s={s} />
                  {s.mrr > 0 && <span className="font-medium tabular-nums">{formatMoney(s.mrr)}/mo</span>}
                </div>
              </button>
            </li>
          ))}
          {list.data && rows.length === 0 && <li className="px-4 py-12 text-center text-sm text-muted">No schools match.</li>}
        </ul>
        <Pager pagination={list.data?.pagination} onPage={setPage} />
      </Card>
    </>
  );
}

function Health({ s }: { s: SchoolRow }) {
  const h = HEALTH_META[s.health];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted">
      <span className={cx("size-2 rounded-full", h.dot)} aria-hidden />
      {h.label}
      {!s.isActive && <Badge tone="danger">Blocked</Badge>}
    </span>
  );
}
