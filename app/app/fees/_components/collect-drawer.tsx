"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/app/app/students/_components/bits";
import { Drawer, Section, errorMessage, query, useDebounced, useResource } from "@/components/data";
import { Alert, Badge, Button, Field, ICONS, Icon, Input, Spinner, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { className, formatDay, localToday } from "@/lib/attendance";
import {
  MODE_LABEL,
  MODE_REFERENCE,
  PAYMENT_MODES,
  STATUS_BADGE,
  formatMoney,
  moneyInput,
  parseMoney,
  type Ledger,
  type PaymentMode,
  type Receipt,
  type RegisterRow,
} from "@/lib/fees";
import { PrintableReceipt, ReceiptDocument, ReceiptShare, useReceiptRef } from "./receipt";

/** Rupee amount field: types rupees, reports paise (null when invalid). */
export function MoneyInput({
  id,
  value,
  onChange,
  invalid,
  autoFocus,
  className: extra,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("relative", extra)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">₹</span>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        autoFocus={autoFocus}
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        className="pl-7 tabular-nums"
      />
    </div>
  );
}

/** Student search for when the drawer opens without a student. */
function StudentPicker({ onPick }: { onPick: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const path = `/api/fees/register${query({ search: q, status: "due", sort: "name", limit: 8, today: localToday() })}`;
  const { data, loading } = useResource(() => api<{ students: RegisterRow[] }>(path), path);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Icon d={ICONS.search} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input autoFocus className="pl-9" placeholder="Search student, admission no, guardian…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <p className="text-xs text-muted">Showing students with a balance.</p>
      {loading && !data ? (
        <Spinner className="mx-auto" />
      ) : data?.students.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No students with dues match.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {data?.students.map((s) => (
            <li key={s.id}>
              <button onClick={() => onPick(s.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted">
                <Avatar name={s.fullName} seed={s.id} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.fullName}</span>
                  <span className="block truncate text-xs text-muted">
                    {s.admissionNo}
                    {s.grade && ` · Class ${className(s.grade, s.section)}`}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-medium tabular-nums">{formatMoney(s.balance)}</span>
                  {s.overdue > 0 && <span className="block text-xs text-danger">{formatMoney(s.overdue)} overdue</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CollectDrawer({
  studentId: initialStudentId,
  onClose,
  onCollected,
}: {
  studentId?: string;
  onClose: () => void;
  onCollected: () => void;
}) {
  const [studentId, setStudentId] = useState(initialStudentId ?? null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const docRef = useReceiptRef();

  if (receipt) {
    return (
      <Drawer
        title="Payment recorded"
        onClose={onClose}
        footer={
          <div className="flex justify-between gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setReceipt(null);
                setStudentId(initialStudentId ?? null);
              }}
            >
              {initialStudentId ? "Collect more" : "Next student"}
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => window.print()}>
                Print
              </Button>
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        }
      >
        <Alert tone="success">
          {formatMoney(receipt.payment.amount)} received from {receipt.payment.student.fullName}. Receipt {receipt.payment.receiptNo}.
        </Alert>
        <ReceiptShare receipt={receipt} docRef={docRef} />
        <ReceiptDocument receipt={receipt} ref={docRef} />
        <PrintableReceipt receipt={receipt} />
      </Drawer>
    );
  }

  if (!studentId) {
    return (
      <Drawer title="Collect fee" onClose={onClose}>
        <StudentPicker onPick={setStudentId} />
      </Drawer>
    );
  }

  return (
    <CollectForm
      key={studentId}
      studentId={studentId}
      onBack={initialStudentId ? undefined : () => setStudentId(null)}
      onClose={onClose}
      onDone={(r) => {
        setReceipt(r);
        onCollected();
      }}
    />
  );
}

function CollectForm({
  studentId,
  onBack,
  onClose,
  onDone,
}: {
  studentId: string;
  onBack?: () => void;
  onClose: () => void;
  onDone: (r: Receipt) => void;
}) {
  const today = localToday();
  const ledger = useResource(() => api<Ledger>(`/api/fees/students/${studentId}?today=${today}`), studentId);
  const open = useMemo(() => (ledger.data?.dues ?? []).filter((d) => d.balance > 0), [ledger.data]);

  // Selected dues (all open dues by default) and the amount, which follows the selection until edited
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const selected = open.filter((d) => !deselected.has(d.id));
  const selectedTotal = selected.reduce((t, d) => t + d.balance, 0);
  const [amountText, setAmountText] = useState<string | null>(null);
  const amountValue = amountText ?? (selectedTotal ? moneyInput(selectedTotal) : "");
  const amount = parseMoney(amountValue);

  const [mode, setMode] = useState<PaymentMode>("cash");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Split the amount across the selected dues, oldest first
  const allocations: { invoiceId: string; amount: number }[] = [];
  let left = amount ?? 0;
  for (const d of selected) {
    const take = Math.min(left, d.balance);
    if (take > 0) allocations.push({ invoiceId: d.id, amount: take });
    left -= take;
  }

  const amountError =
    amountValue && amount === null
      ? "Enter a valid amount"
      : amount !== null && amount > selectedTotal
        ? `More than the selected dues (${formatMoney(selectedTotal)})`
        : amount === 0
          ? "Amount must be more than zero"
          : null;
  const canSubmit = amount !== null && amount > 0 && !amountError && allocations.length > 0;

  function toggle(id: string) {
    setDeselected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAmountText(null);
  }

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      onDone(
        await api<Receipt>("/api/fees/payments", {
          method: "POST",
          body: { studentId, amount, date, mode, reference: reference.trim(), note: note.trim(), allocations },
        })
      );
    } catch (err) {
      setError(errorMessage(err));
      ledger.reload();
    } finally {
      setBusy(false);
    }
  }

  const s = ledger.data?.student;
  const allocatedById = new Map(allocations.map((a) => [a.invoiceId, a.amount]));

  return (
    <Drawer
      title={
        <span className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="icon-sm" aria-label="Choose another student" onClick={onBack}>
              <Icon d={ICONS.chevronLeft} />
            </Button>
          )}
          Collect fee
        </span>
      }
      onClose={onClose}
      footer={
        open.length > 0 && (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 text-sm">
              <p className="text-muted">Receiving</p>
              <p className="text-lg font-semibold tabular-nums">{amount ? formatMoney(amount) : "₹0"}</p>
            </div>
            <Button onClick={submit} loading={busy} disabled={!canSubmit} className="min-w-40">
              Record payment
            </Button>
          </div>
        )
      }
    >
      {ledger.error ? (
        <Alert>{ledger.error}</Alert>
      ) : !ledger.data || !s ? (
        <Spinner className="mx-auto my-16" />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Avatar name={s.fullName} seed={s.id} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{s.fullName}</p>
              <p className="truncate text-xs text-muted">
                {s.admissionNo}
                {s.grade && ` · Class ${className(s.grade, s.section)}`}
                {s.guardianName && ` · ${s.guardianName}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">Balance</p>
              <p className="font-semibold tabular-nums">{formatMoney(ledger.data.totals.balance)}</p>
            </div>
          </div>

          {error && <Alert>{error}</Alert>}

          {open.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface px-6 py-10 text-center">
              <p className="font-medium">Nothing to collect</p>
              <p className="mt-1 text-sm text-muted">This student has no unpaid dues.</p>
            </div>
          ) : (
            <>
              <Section title="Dues to pay">
                <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
                  {open.map((d) => {
                    const checked = !deselected.has(d.id);
                    const applied = allocatedById.get(d.id) ?? 0;
                    return (
                      <li key={d.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                          <input type="checkbox" checked={checked} onChange={() => toggle(d.id)} className="size-4 accent-accent" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-medium">{d.label}</span>
                              <Badge tone={STATUS_BADGE[d.status].tone}>{STATUS_BADGE[d.status].label}</Badge>
                            </span>
                            <span className="block truncate text-xs text-muted">
                              {d.planName} · due {formatDay(d.dueDate, "short")}
                            </span>
                          </span>
                          <span className="text-right">
                            <span className="block font-medium tabular-nums">{formatMoney(d.balance)}</span>
                            {checked && applied > 0 && applied < d.balance && (
                              <span className="block text-xs text-accent">paying {formatMoney(applied)}</span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </Section>

              <Section title="Payment">
                <div className="space-y-4">
                  <Field
                    label="Amount"
                    htmlFor="pay-amount"
                    error={amountError ?? undefined}
                    hint={amount && amount < selectedTotal ? "Part payment: applied to the oldest selected dues first." : undefined}
                  >
                    <MoneyInput id="pay-amount" value={amountValue} onChange={setAmountText} invalid={Boolean(amountError)} />
                  </Field>

                  <div>
                    <p className="mb-1.5 text-sm font-medium">Mode</p>
                    <div className="grid grid-cols-3 gap-2">
                      {PAYMENT_MODES.map((m) => (
                        <button
                          key={m}
                          type="button"
                          aria-pressed={mode === m}
                          onClick={() => setMode(m)}
                          className={cx(
                            "h-10 rounded-lg border text-sm font-medium transition-colors",
                            mode === m ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface hover:bg-surface-muted"
                          )}
                        >
                          {MODE_LABEL[m]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {MODE_REFERENCE[mode] && (
                      <Field label={MODE_REFERENCE[mode]} htmlFor="pay-ref">
                        <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} autoComplete="off" />
                      </Field>
                    )}
                    <Field label="Date received" htmlFor="pay-date">
                      <Input id="pay-date" type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Note" htmlFor="pay-note" hint="Optional, printed on the receipt">
                    <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
                  </Field>
                </div>
              </Section>
            </>
          )}
        </>
      )}
    </Drawer>
  );
}
