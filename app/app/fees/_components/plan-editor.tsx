"use client";

import { useState } from "react";
import { fieldErrors } from "@/components/auth-shell";
import { Drawer, Section, errorMessage, useResource } from "@/components/data";
import { Alert, Button, Field, ICONS, Icon, Input, Select, cx } from "@/components/ui";
import { loadClassList, loadYears } from "@/lib/academics";
import { ApiError, api } from "@/lib/api";
import { localToday } from "@/lib/attendance";
import { formatMoney, moneyInput, parseMoney, type FeePlan } from "@/lib/fees";
import { MoneyInput } from "./collect-drawer";

type Frequency = "monthly" | "quarterly" | "half-yearly" | "annual" | "once";
const FREQUENCIES: { value: Frequency; label: string; months: number; count: number }[] = [
  { value: "monthly", label: "Monthly", months: 1, count: 12 },
  { value: "quarterly", label: "Quarterly", months: 3, count: 4 },
  { value: "half-yearly", label: "Half-yearly", months: 6, count: 2 },
  { value: "annual", label: "Annually", months: 12, count: 1 },
  { value: "once", label: "One-time", months: 0, count: 1 },
];

interface ItemRow {
  name: string;
  amount: string;
  /** every = charged in each installment, first = only in the first one (e.g. admission fee) */
  charge: "every" | "first";
}

interface InstallmentRow {
  _id?: string;
  label: string;
  dueDate: string;
  items: { name: string; amount: string }[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function addMonths(ym: string, n: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
}

/** Academic year starting April: in Jan–Mar we're still in the year that began last April. */
function defaultStartMonth() {
  const [y, m] = localToday().split("-").map(Number);
  return `${m >= 4 ? y : y - 1}-04`;
}

function generate(items: ItemRow[], frequency: Frequency, startMonth: string, dueDay: number, count: number): InstallmentRow[] {
  const f = FREQUENCIES.find((x) => x.value === frequency)!;
  const n = f.value === "monthly" ? count : f.count;
  return Array.from({ length: n }, (_, i) => {
    const { y, m } = addMonths(startMonth, i * f.months);
    const end = addMonths(startMonth, i * f.months + f.months - 1);
    const label =
      frequency === "monthly"
        ? `${FULL_MONTHS[m]} ${y}`
        : frequency === "quarterly"
          ? `Q${i + 1} (${MONTHS[m]}–${MONTHS[end.m]})`
          : frequency === "half-yearly"
            ? `Term ${i + 1} (${MONTHS[m]}–${MONTHS[end.m]})`
            : frequency === "annual"
              ? "Annual fee"
              : "One-time fee";
    const day = Math.min(dueDay, 28);
    return {
      label,
      dueDate: `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      items: items.filter((it) => it.name.trim() && (it.charge === "every" || i === 0)).map((it) => ({ name: it.name.trim(), amount: it.amount })),
    };
  });
}

const rowTotal = (row: InstallmentRow) => row.items.reduce((t, it) => t + (parseMoney(it.amount) ?? 0), 0);

export function PlanEditor({ plan, onClose, onSaved }: { plan: FeePlan | null; onClose: () => void; onSaved: (plan: FeePlan) => void }) {
  const [name, setName] = useState(plan?.name ?? "");
  const [academicYear, setAcademicYear] = useState(plan?.academicYear ?? (() => {
    const y = Number(defaultStartMonth().slice(0, 4));
    return `${y}-${String(y + 1).slice(2)}`;
  })());
  const [grade, setGrade] = useState(plan?.grade ?? "");
  // Suggestions from Settings → Classes and Academic year
  const years = useResource(loadYears, "academics-years");
  const classList = useResource(loadClassList, "academics-classes");
  const [description, setDescription] = useState(plan?.description ?? "");

  // Generator inputs (only used to (re)build the installment list)
  const [items, setItems] = useState<ItemRow[]>([
    { name: "Tuition fee", amount: "", charge: "every" },
    { name: "Admission fee", amount: "", charge: "first" },
  ]);
  const [frequency, setFrequency] = useState<Frequency>("quarterly");
  const [startMonth, setStartMonth] = useState(defaultStartMonth);
  const [dueDay, setDueDay] = useState(10);
  const [count, setCount] = useState(12);

  const [installments, setInstallments] = useState<InstallmentRow[]>(
    plan?.installments.map((i) => ({ _id: i.id, label: i.label, dueDate: i.dueDate, items: i.items.map((it) => ({ name: it.name, amount: moneyInput(it.amount) })) })) ?? []
  );
  const [expanded, setExpanded] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const total = installments.reduce((t, r) => t + rowTotal(r), 0);
  const itemsValid = items.some((it) => it.name.trim() && (parseMoney(it.amount) ?? 0) > 0);

  function build() {
    if (installments.length && !confirm("Replace the current installments with a new schedule?")) return;
    setInstallments(generate(items, frequency, startMonth, dueDay, count));
    setExpanded(null);
  }

  const updateInst = (i: number, patch: Partial<InstallmentRow>) => setInstallments((list) => list.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  async function save() {
    setError(null);
    const local: Record<string, string> = {};
    if (name.trim().length < 2) local.name = "Give the plan a name";
    if (installments.length === 0) local.installments = "Build the installments first";
    const bad = installments.findIndex((r) => !r.label.trim() || !r.dueDate || r.items.length === 0 || r.items.some((it) => !it.name.trim() || parseMoney(it.amount) === null));
    if (bad >= 0) local.installments = `Check installment ${bad + 1}: every item needs a name and a valid amount`;
    setErrors(local);
    if (Object.keys(local).length) return;

    setBusy(true);
    try {
      const body = {
        name: name.trim(),
        academicYear: academicYear.trim(),
        grade: grade.trim(),
        description: description.trim(),
        installments: installments.map((r) => ({
          ...(r._id ? { _id: r._id } : {}),
          label: r.label.trim(),
          dueDate: r.dueDate,
          items: r.items.map((it) => ({ name: it.name.trim(), amount: parseMoney(it.amount)! })),
        })),
      };
      const res = plan
        ? await api<{ plan: FeePlan }>(`/api/fees/plans/${plan.id}`, { method: "PATCH", body })
        : await api<{ plan: FeePlan }>("/api/fees/plans", { method: "POST", body });
      onSaved(res.plan);
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) setErrors(fieldErrors(err.details));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={plan ? `Edit ${plan.name}` : "New fee plan"}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <p className="text-muted">Per student</p>
            <p className="text-lg font-semibold tabular-nums">{formatMoney(total)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              {plan ? "Save plan" : "Create plan"}
            </Button>
          </div>
        </div>
      }
    >
      {error && <Alert>{error}</Alert>}
      {plan?.stats?.students ? (
        <Alert tone="warning">
          Already assigned to {plan.stats.students} students. Changes apply to students you assign from now on; existing dues keep their amounts.
        </Alert>
      ) : null}

      <Section title="Plan">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Name *" htmlFor="plan-name" error={errors.name}>
              <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Class 5 · 2026-27" autoFocus={!plan} />
            </Field>
          </div>
          <Field label="Academic year" htmlFor="plan-year">
            <Input id="plan-year" list="plan-years" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2026-27" />
            <datalist id="plan-years">
              {years.data?.years.map((y) => (
                <option key={y.id} value={y.name} />
              ))}
            </datalist>
          </Field>
          <Field label="For class" htmlFor="plan-grade" hint="Optional, for reference">
            <Input id="plan-grade" list="plan-grades" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 5" />
            <datalist id="plan-grades">
              {classList.data?.classes.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="plan-desc">
              <Input id="plan-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="1 · Fee items">
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2 sm:grid-cols-[1fr_8rem_9rem_auto]">
              <Input aria-label="Fee item" value={it.name} placeholder="e.g. Transport" onChange={(e) => setItems((l) => l.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
              <MoneyInput value={it.amount} onChange={(v) => setItems((l) => l.map((x, k) => (k === i ? { ...x, amount: v } : x)))} />
              <Select
                aria-label="Charged"
                className="col-span-2 sm:col-span-1"
                value={it.charge}
                onChange={(e) => setItems((l) => l.map((x, k) => (k === i ? { ...x, charge: e.target.value as ItemRow["charge"] } : x)))}
              >
                <option value="every">Every installment</option>
                <option value="first">First only</option>
              </Select>
              <Button variant="ghost" size="icon" aria-label="Remove item" className="row-start-1 col-start-3 sm:col-start-4" onClick={() => setItems((l) => l.filter((_, k) => k !== i))}>
                <Icon d={ICONS.x} />
              </Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setItems((l) => [...l, { name: "", amount: "", charge: "every" }])}>
            <Icon d={ICONS.plus} />
            Add item
          </Button>
        </div>
      </Section>

      <Section title="2 · Schedule">
        <div className="grid grid-cols-2 gap-3">
          <Field label="How often" htmlFor="plan-freq">
            <Select id="plan-freq" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Starting" htmlFor="plan-start">
            <Input id="plan-start" type="month" value={startMonth} onChange={(e) => e.target.value && setStartMonth(e.target.value)} />
          </Field>
          <Field label="Due on day" htmlFor="plan-day">
            <Input id="plan-day" type="number" inputMode="numeric" min={1} max={28} value={dueDay} onChange={(e) => setDueDay(Math.max(1, Math.min(28, Number(e.target.value) || 1)))} />
          </Field>
          {frequency === "monthly" && (
            <Field label="Months" htmlFor="plan-count">
              <Input id="plan-count" type="number" inputMode="numeric" min={1} max={24} value={count} onChange={(e) => setCount(Math.max(1, Math.min(24, Number(e.target.value) || 1)))} />
            </Field>
          )}
        </div>
        <Button variant="secondary" className="mt-3 w-full sm:w-auto" onClick={build} disabled={!itemsValid}>
          {installments.length ? "Rebuild installments" : "Build installments"}
        </Button>
        {!itemsValid && <p className="mt-2 text-xs text-muted">Add at least one fee item with an amount.</p>}
      </Section>

      <Section title={`3 · Installments (${installments.length})`}>
        {errors.installments && <p className="mb-2 text-sm text-danger">{errors.installments}</p>}
        {installments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">Add fee items and build the schedule.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {installments.map((r, i) => (
              <li key={r._id ?? i} className="px-3 py-2.5">
                {/* Phones: label on its own line, then date + amount */}
                <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                  <Input aria-label="Installment label" className="h-9 min-w-0 basis-full sm:basis-0 sm:flex-1" value={r.label} onChange={(e) => updateInst(i, { label: e.target.value })} />
                  <Input aria-label="Due date" type="date" className="h-9 w-40 shrink-0" value={r.dueDate} onChange={(e) => e.target.value && updateInst(i, { dueDate: e.target.value })} />
                  <button
                    onClick={() => setExpanded(expanded === i ? null : i)}
                    aria-expanded={expanded === i}
                    className="ml-auto flex h-9 w-28 shrink-0 items-center justify-end gap-1 text-sm font-medium tabular-nums hover:text-accent"
                  >
                    {formatMoney(rowTotal(r))}
                    <Icon d={ICONS.chevronRight} className={cx("transition-transform", expanded === i && "rotate-90")} />
                  </button>
                </div>
                {expanded === i && (
                  <div className="mt-2 space-y-2 rounded-lg bg-surface-muted/60 p-2">
                    {r.items.map((it, k) => (
                      <div key={k} className="flex gap-2">
                        <Input aria-label="Item" className="h-9" value={it.name} onChange={(e) => updateInst(i, { items: r.items.map((x, j) => (j === k ? { ...x, name: e.target.value } : x)) })} />
                        <MoneyInput className="w-32 shrink-0 [&_input]:h-9" value={it.amount} onChange={(v) => updateInst(i, { items: r.items.map((x, j) => (j === k ? { ...x, amount: v } : x)) })} />
                        <Button variant="ghost" size="icon-sm" className="mt-0.5" aria-label="Remove" onClick={() => updateInst(i, { items: r.items.filter((_, j) => j !== k) })}>
                          <Icon d={ICONS.x} />
                        </Button>
                      </div>
                    ))}
                    <div className="flex justify-between">
                      <Button variant="ghost" size="sm" onClick={() => updateInst(i, { items: [...r.items, { name: "", amount: "" }] })}>
                        <Icon d={ICONS.plus} />
                        Item
                      </Button>
                      <Button variant="ghost" size="sm" className="text-danger" onClick={() => setInstallments((l) => l.filter((_, k) => k !== i))}>
                        Remove installment
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {installments.length > 0 && (
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setInstallments((l) => [...l, { label: `Installment ${l.length + 1}`, dueDate: localToday(), items: [{ name: "Fee", amount: "" }] }])}>
            <Icon d={ICONS.plus} />
            Add installment
          </Button>
        )}
      </Section>
    </Drawer>
  );
}
