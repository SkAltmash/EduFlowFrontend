"use client";

import { useState } from "react";
import { Pager, errorMessage, query, useDebounced, useResource, type Pagination } from "@/components/data";
import { Alert, Badge, Button, ICONS, Icon, Input, Select, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { addDays, className, formatDay, localToday } from "@/lib/attendance";
import { MODE_LABEL, PAYMENT_MODES, formatMoney, type Payment } from "@/lib/fees";
import { downloadSpreadsheet, type SpreadsheetFormat } from "@/lib/spreadsheet";

type Range = "today" | "7d" | "month" | "custom";

function rangeDates(range: Range, custom: { from: string; to: string }) {
  const today = localToday();
  if (range === "today") return { from: today, to: today };
  if (range === "7d") return { from: addDays(today, -6), to: today };
  if (range === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  return custom;
}

export function Payments({ refreshKey, onOpen }: { refreshKey: number; onOpen: (id: string) => void }) {
  const [range, setRange] = useState<Range>("month");
  const [custom, setCustom] = useState(() => ({ from: addDays(localToday(), -30), to: localToday() }));
  const [mode, setMode] = useState("all");
  const [search, setSearch] = useState("");
  const [showVoided, setShowVoided] = useState(true);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState<SpreadsheetFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = useDebounced(search.trim());
  const { from, to } = rangeDates(range, custom);

  const params = { from, to, mode, search: q, includeVoided: String(showVoided) };
  const path = `/api/fees/payments${query({ ...params, page, limit: 25 })}`;
  const list = useResource(() => api<{ payments: Payment[]; totals: { amount: number; count: number }; pagination: Pagination }>(path), `${path}#${refreshKey}`);
  const payments = list.data?.payments ?? [];

  async function exportFile(format: SpreadsheetFormat) {
    setExporting(format);
    setError(null);
    try {
      const res = await api<{ payments: Payment[] }>(`/api/fees/payments/export${query(params)}`);
      const rows = [
        ["Receipt no", "Date", "Admission no", "Student", "Class", "Amount (₹)", "Mode", "Reference", "Towards", "Received by", "Status", "Void reason"],
        ...res.payments.map((p) => [
          p.receiptNo,
          p.date,
          p.student.admissionNo,
          p.student.fullName,
          p.student.grade ? className(p.student.grade, p.student.section) : "",
          (p.amount / 100).toFixed(2),
          MODE_LABEL[p.mode],
          p.reference,
          p.allocations.map((a) => `${a.label} (${(a.amount / 100).toFixed(2)})`).join("; "),
          p.receivedByName,
          p.voided ? "Void" : "Valid",
          p.voided?.reason ?? "",
        ]),
      ];
      await downloadSpreadsheet(`fee-collections-${from}-to-${to}`, rows, format, { dateColumns: [1], sheetName: "Collections" });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(null);
    }
  }

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm">
          {(
            [
              ["today", "Today"],
              ["7d", "7 days"],
              ["month", "This month"],
              ["custom", "Custom"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => reset(setRange)(v)}
              className={cx("rounded-md px-3 py-1.5 transition-colors", range === v ? "bg-surface-muted font-medium" : "text-muted hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <Input aria-label="From" type="date" className="w-auto" value={custom.from} max={custom.to} onChange={(e) => e.target.value && reset(setCustom)({ ...custom, from: e.target.value })} />
            <span className="text-muted">–</span>
            <Input aria-label="To" type="date" className="w-auto" value={custom.to} min={custom.from} max={localToday()} onChange={(e) => e.target.value && reset(setCustom)({ ...custom, to: e.target.value })} />
          </div>
        )}
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="secondary" onClick={() => exportFile("xlsx")} loading={exporting === "xlsx"} disabled={exporting !== null || !list.data?.pagination.total}>
            <Icon d={ICONS.download} />
            Excel
          </Button>
          <Button variant="secondary" onClick={() => exportFile("csv")} loading={exporting === "csv"} disabled={exporting !== null || !list.data?.pagination.total}>
            CSV
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-auto md:max-w-xs">
          <Icon d={ICONS.search} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Receipt no, student, reference…"
            value={search}
            onChange={(e) => reset(setSearch)(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-base outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm"
          />
        </div>
        <div className="w-36">
          <Select aria-label="Mode" value={mode} onChange={(e) => reset(setMode)(e.target.value)}>
            <option value="all">All modes</option>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showVoided} onChange={(e) => reset(setShowVoided)(e.target.checked)} className="size-4 accent-accent" />
          Show voided
        </label>
      </div>

      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mb-3 flex items-baseline justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <span className="text-sm text-muted">
          {formatDay(from, "short")}
          {from !== to && ` – ${formatDay(to, "short")}`}
          {list.data && ` · ${list.data.totals.count} receipt${list.data.totals.count === 1 ? "" : "s"}`}
        </span>
        <span className="text-xl font-semibold tabular-nums">{list.data ? formatMoney(list.data.totals.amount) : "…"}</span>
      </div>

      <div className={cx("overflow-hidden rounded-xl border border-border bg-surface transition-opacity", list.loading && list.data && "opacity-60")}>
        {list.error ? (
          <p className="px-4 py-12 text-center text-sm text-danger">{list.error}</p>
        ) : !list.data ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <p className="px-4 py-14 text-center text-sm text-muted">No payments in this period.</p>
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-border bg-surface-muted/50 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Receipt</th>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Mode</th>
                  <th className="px-4 py-3 font-medium">Received by</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => onOpen(p.id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-mono font-medium">
                        {p.receiptNo}
                        {p.voided && <Badge tone="danger">Void</Badge>}
                      </div>
                      <div className="text-xs text-muted">{formatDay(p.date, "short")}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.student.fullName}</div>
                      <div className="text-xs text-muted">
                        {p.student.admissionNo}
                        {p.student.grade && ` · ${className(p.student.grade, p.student.section)}`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{MODE_LABEL[p.mode]}</div>
                      {p.reference && <div className="max-w-40 truncate text-xs text-muted">{p.reference}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted">{p.receivedByName}</td>
                    <td className={cx("px-4 py-3 text-right font-medium tabular-nums", p.voided && "text-muted line-through")}>{formatMoney(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-border md:hidden">
              {payments.map((p) => (
                <li key={p.id}>
                  <button onClick={() => onOpen(p.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-surface-muted">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.student.fullName}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted">
                        <span className="font-mono">{p.receiptNo}</span> · {formatDay(p.date, "short")} · {MODE_LABEL[p.mode]}
                        {p.voided && <Badge tone="danger">Void</Badge>}
                      </span>
                    </span>
                    <span className={cx("shrink-0 font-medium tabular-nums", p.voided && "text-muted line-through")}>{formatMoney(p.amount)}</span>
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
