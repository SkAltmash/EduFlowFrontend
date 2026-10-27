"use client";

import { useState } from "react";
import { errorMessage, useResource } from "@/components/data";
import { Alert, Button, ICONS, Icon, Input, Select, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { className } from "@/lib/attendance";
import { concessionShort, formatMoney, moneyInput, parseMoney, type Concession, type ConcessionPreset, type ConcessionType } from "@/lib/fees";
import { ConcessionTag, usePresets } from "./concession";

interface ReportRow {
  id: string;
  fullName: string;
  admissionNo: string;
  grade: string;
  section: string;
  status: string;
  concession: Concession | null;
  amount: number;
  dues: number;
  reasons: string[];
}

interface Report {
  students: ReportRow[];
  totals: { students: number; amount: number };
  byReason: { reason: string; students: number; amount: number }[];
}

/** Everyone paying less, by how much and why, plus the school's ready-made concessions. */
export function ConcessionsTab({ onOpen, refreshKey }: { onOpen: (studentId: string) => void; refreshKey: number }) {
  const report = useResource(() => api<Report>("/api/fees/concessions"), `concessions#${refreshKey}`);
  const [q, setQ] = useState("");
  const data = report.data;
  const rows = (data?.students ?? []).filter((r) => !q.trim() || r.fullName.toLowerCase().includes(q.trim().toLowerCase()) || r.admissionNo.toLowerCase().includes(q.trim().toLowerCase()));
  const max = Math.max(1, ...(data?.byReason.map((g) => g.amount) ?? [1]));

  return (
    <div className="space-y-6">
      {report.error && <Alert>{report.error}</Alert>}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-muted">Concessions given</p>
          {data ? <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-success">{formatMoney(data.totals.amount)}</p> : <Skeleton className="mt-2 h-9 w-32" />}
          <p className="mt-0.5 text-xs text-muted">{data ? `${data.totals.students} student${data.totals.students === 1 ? "" : "s"} pay less` : " "}</p>
        </section>
        <section className="rounded-xl border border-border bg-surface p-4 lg:col-span-2">
          <p className="mb-3 text-sm font-semibold">By reason</p>
          {!data ? (
            <Skeleton className="h-20" />
          ) : data.byReason.length === 0 ? (
            <p className="text-sm text-muted">No concessions yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.byReason.map((g) => (
                <li key={g.reason}>
                  <div className="flex justify-between text-sm">
                    <span>
                      {g.reason} <span className="text-xs text-muted">· {g.students}</span>
                    </span>
                    <span className="font-medium tabular-nums">{formatMoney(g.amount)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-success" style={{ width: `${(g.amount / max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h3 className="font-semibold">Students with a concession</h3>
          <div className="relative w-full sm:w-56">
            <Icon d={ICONS.search} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a student" className="h-9 pl-9 text-sm" aria-label="Find a student" />
          </div>
        </div>
        {!data ? (
          <Skeleton className="m-4 h-32" />
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">{q ? "No match." : "Give a concession from a student's fee account, or while assigning a fee plan."}</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id}>
                <button onClick={() => onOpen(r.id)} className="flex w-full flex-wrap items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-muted">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {r.fullName}
                      {r.status !== "active" && <span className="ml-1.5 text-xs font-normal text-muted">({r.status})</span>}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {r.admissionNo}
                      {r.grade && ` · Class ${className(r.grade, r.section)}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    {r.concession ? <ConcessionTag c={r.concession} /> : <span className="text-xs text-muted">{r.reasons[0] ?? "On a single due"}</span>}
                    <span className="w-24 text-right text-sm font-semibold tabular-nums text-success">−{formatMoney(r.amount)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PresetEditor />
    </div>
  );
}

type Row = { id: string | null; name: string; type: ConcessionType; value: string };
const toRow = (p: ConcessionPreset): Row => ({ id: p.id, name: p.name, type: p.type, value: p.type === "percent" ? String(p.value) : p.type === "free" ? "" : moneyInput(p.value) });

/** Ready-made concessions staff pick with one tap. */
function PresetEditor() {
  const presets = usePresets();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const list = rows ?? presets.data?.presets.map(toRow) ?? [];
  const update = (i: number, patch: Partial<Row>) => setRows(list.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const body = {
        presets: list
          .filter((r) => r.name.trim())
          .map((r) => ({ ...(r.id ? { id: r.id } : {}), name: r.name.trim(), type: r.type, value: r.type === "percent" ? Number(r.value) || 0 : r.type === "free" ? 0 : (parseMoney(r.value) ?? 0) })),
      };
      const res = await api<{ presets: ConcessionPreset[] }>("/api/fees/concession-presets", { method: "PUT", body });
      presets.setData({ presets: res.presets, isDefault: false });
      setRows(null);
      setMessage({ tone: "success", text: "Ready-made concessions saved." });
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-semibold">Ready-made concessions</h3>
        <p className="text-xs text-muted">Shown as one-tap choices when giving a concession or assigning a plan. Changing one here doesn&apos;t change concessions already given.</p>
      </div>
      <div className="space-y-2 p-4">
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        {!presets.data ? (
          <Skeleton className="h-32" />
        ) : (
          list.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_8rem_7rem_auto] items-center gap-2">
              <Input aria-label="Name" value={r.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="e.g. Sibling" maxLength={60} />
              <Select aria-label="Type" value={r.type} onChange={(e) => update(i, { type: e.target.value as ConcessionType, value: "" })}>
                <option value="percent">% off</option>
                <option value="amount">₹ off</option>
                <option value="fixed">Fixed fee</option>
                <option value="free">Free</option>
              </Select>
              {r.type === "free" ? (
                <span className="text-sm text-muted">Nothing to pay</span>
              ) : (
                <Input aria-label="Value" inputMode="decimal" value={r.value} onChange={(e) => update(i, { value: e.target.value.replace(/[^\d.]/g, "") })} placeholder={r.type === "percent" ? "%" : "₹"} />
              )}
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${r.name}`} onClick={() => setRows(list.filter((_, k) => k !== i))}>
                <Icon d={ICONS.x} />
              </Button>
            </div>
          ))
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={() => setRows([...list, { id: null, name: "", type: "percent", value: "" }])}>
            <Icon d={ICONS.plus} />
            Add
          </Button>
          <div className="flex items-center gap-2">
            {list.length > 0 && <span className={cx("hidden text-xs text-muted sm:inline")}>{list.filter((r) => r.name).map((r) => `${r.name}: ${concessionShort({ type: r.type, value: r.type === "percent" ? Number(r.value) || 0 : (parseMoney(r.value) ?? 0) })}`).slice(0, 3).join(" · ")}</span>}
            <Button size="sm" onClick={save} loading={busy} disabled={rows === null && !presets.data?.isDefault}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
