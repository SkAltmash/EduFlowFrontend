"use client";

import { useState } from "react";
import { Avatar } from "@/app/app/students/_components/bits";
import { Drawer, Section, errorMessage, useResource } from "@/components/data";
import { Alert, Badge, Button, Field, ICONS, Icon, Input, Spinner, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { className, formatDay, localToday } from "@/lib/attendance";
import { WhatsAppButton, WhatsAppDrawer } from "@/components/whatsapp-send";
import { MODE_LABEL, STATUS_BADGE, formatMoney, moneyInput, parseMoney, type Due, type Ledger } from "@/lib/fees";
import { MoneyInput } from "./collect-drawer";

export function LedgerDrawer({
  studentId,
  onClose,
  onCollect,
  onOpenReceipt,
  onChanged,
}: {
  studentId: string;
  onClose: () => void;
  onCollect: () => void;
  onOpenReceipt: (paymentId: string) => void;
  onChanged: () => void;
}) {
  const [reminding, setReminding] = useState(false);
  const today = localToday();
  const path = `/api/fees/students/${studentId}?today=${today}`;
  const ledger = useResource(() => api<Ledger>(path), path);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const data = ledger.data;
  const s = data?.student;

  async function removeDue(d: Due) {
    if (!confirm(`Remove “${d.label}” (${formatMoney(d.amount)}) from this student?`)) return;
    try {
      await api(`/api/fees/dues/${d.id}`, { method: "DELETE" });
      setMessage({ tone: "success", text: `${d.label} removed.` });
      ledger.reload();
      onChanged();
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    }
  }

  return (
    <Drawer
      title="Fee account"
      onClose={onClose}
      footer={
        data &&
        data.totals.balance > 0 && (
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <p className="text-muted">Balance</p>
              <p className="text-lg font-semibold tabular-nums">{formatMoney(data.totals.balance)}</p>
            </div>
            <Button onClick={onCollect} className="min-w-36">
              <Icon d={ICONS.plus} />
              Collect fee
            </Button>
          </div>
        )
      }
    >
      {ledger.error ? (
        <Alert>{ledger.error}</Alert>
      ) : !data || !s ? (
        <Spinner className="mx-auto my-16" />
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Avatar name={s.fullName} seed={s.id} size="lg" />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">{s.fullName}</h2>
              <p className="truncate text-sm text-muted">
                <span className="font-mono">{s.admissionNo}</span>
                {s.grade && ` · Class ${className(s.grade, s.section)}`}
              </p>
              {s.guardianName && <p className="truncate text-sm text-muted">{s.guardianName}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Total fee", value: data.totals.billed - data.totals.discount, sub: data.totals.discount ? `${formatMoney(data.totals.discount)} concession` : "" },
              { label: "Paid", value: data.totals.paid, tone: "text-success" },
              { label: "Balance", value: data.totals.balance, sub: data.totals.overdue ? `${formatMoney(data.totals.overdue)} overdue` : "", tone: data.totals.overdue ? "text-danger" : "" },
            ].map((t) => (
              <div key={t.label} className="rounded-xl border border-border bg-surface p-3">
                <p className="text-xs text-muted">{t.label}</p>
                <p className={cx("mt-0.5 font-semibold tabular-nums", t.tone)}>{formatMoney(t.value)}</p>
                {t.sub && <p className={cx("truncate text-[11px]", t.tone || "text-muted")}>{t.sub}</p>}
              </div>
            ))}
          </div>

          {data.totals.balance > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <WhatsAppButton onClick={() => setReminding(true)}>Send reminder</WhatsAppButton>
              {s.guardianPhone ? (
                <a
                  href={`tel:${s.guardianPhone}`}
                  className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium text-accent hover:bg-accent-soft"
                >
                  <Icon d={ICONS.phone} />
                  Call guardian
                </a>
              ) : (
                <span className="flex h-10 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted">No guardian phone</span>
              )}
            </div>
          )}
          {reminding && (
            <WhatsAppDrawer
              type="fee_reminder"
              refs={[{ studentId: s.id }]}
              title="Fee reminder on WhatsApp"
              onClose={() => setReminding(false)}
            />
          )}

          {message && <Alert tone={message.tone}>{message.text}</Alert>}

          <Section title={`Dues (${data.dues.length})`}>
            {data.dues.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
                No fee plan assigned yet. Assign one from the Fee plans tab.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
                {data.dues.map((d) => (
                  <li key={d.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{d.label}</span>
                          <Badge tone={STATUS_BADGE[d.status].tone}>{STATUS_BADGE[d.status].label}</Badge>
                        </p>
                        <p className="truncate text-xs text-muted">
                          {d.planName} · due {formatDay(d.dueDate, "short")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-medium tabular-nums">{formatMoney(d.balance > 0 ? d.balance : d.paid)}</p>
                        <p className="text-xs text-muted">
                          {d.balance > 0 ? (d.paid > 0 ? `of ${formatMoney(d.amount - d.discount)}` : "to pay") : "paid"}
                        </p>
                      </div>
                    </div>
                    <details className="group mt-1.5 text-xs">
                      <summary className="cursor-pointer list-none text-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
                        <span className="group-open:hidden">Details</span>
                        <span className="hidden group-open:inline">Hide details</span>
                      </summary>
                      <dl className="mt-2 space-y-1 rounded-lg bg-surface-muted/60 p-3">
                        {d.items.map((it, i) => (
                          <div key={i} className="flex justify-between">
                            <dt className="text-muted">{it.name}</dt>
                            <dd className="tabular-nums">{formatMoney(it.amount)}</dd>
                          </div>
                        ))}
                        {d.discount > 0 && (
                          <div className="flex justify-between text-success">
                            <dt>Concession{d.discountReason && ` (${d.discountReason})`}</dt>
                            <dd className="tabular-nums">−{formatMoney(d.discount)}</dd>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <dt className="text-muted">Paid</dt>
                          <dd className="tabular-nums">{formatMoney(d.paid)}</dd>
                        </div>
                        <div className="flex justify-between border-t border-border pt-1 font-medium">
                          <dt>Balance</dt>
                          <dd className="tabular-nums">{formatMoney(Math.max(0, d.balance))}</dd>
                        </div>
                      </dl>
                      <div className="mt-2 flex gap-3">
                        <button className="font-medium text-accent hover:underline" onClick={() => setEditing(editing === d.id ? null : d.id)}>
                          Edit concession / due date
                        </button>
                        {d.paid === 0 && (
                          <button className="font-medium text-danger hover:underline" onClick={() => removeDue(d)}>
                            Remove
                          </button>
                        )}
                      </div>
                    </details>
                    {editing === d.id && (
                      <EditDue
                        due={d}
                        onCancel={() => setEditing(null)}
                        onSaved={() => {
                          setEditing(null);
                          setMessage({ tone: "success", text: `${d.label} updated.` });
                          ledger.reload();
                          onChanged();
                        }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={`Payments (${data.payments.length})`}>
            {data.payments.length === 0 ? (
              <p className="text-sm text-muted">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
                {data.payments.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => onOpenReceipt(p.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-muted">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">{p.receiptNo}</span>
                          {p.voided && <Badge tone="danger">Void</Badge>}
                        </span>
                        <span className="block text-xs text-muted">
                          {formatDay(p.date, "short")} · {MODE_LABEL[p.mode]}
                        </span>
                      </span>
                      <span className={cx("font-medium tabular-nums", p.voided && "text-muted line-through")}>{formatMoney(p.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </Drawer>
  );
}

function EditDue({ due, onCancel, onSaved }: { due: Due; onCancel: () => void; onSaved: () => void }) {
  const [discount, setDiscount] = useState(due.discount ? moneyInput(due.discount) : "");
  const [reason, setReason] = useState(due.discountReason);
  const [dueDate, setDueDate] = useState(due.dueDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const discountPaise = discount ? parseMoney(discount) : 0;
  const max = due.amount - due.paid;
  const invalid = discountPaise === null || discountPaise > max;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/fees/dues/${due.id}`, { method: "PATCH", body: { discount: discountPaise, discountReason: reason.trim(), dueDate } });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border p-3">
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Concession" htmlFor={`disc-${due.id}`} error={invalid ? `At most ${formatMoney(max)}` : undefined}>
          <MoneyInput id={`disc-${due.id}`} value={discount} onChange={setDiscount} invalid={invalid} />
        </Field>
        <Field label="Due date" htmlFor={`date-${due.id}`}>
          <Input id={`date-${due.id}`} type="date" value={dueDate} onChange={(e) => e.target.value && setDueDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Reason" htmlFor={`reason-${due.id}`}>
        <Input id={`reason-${due.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Scholarship, sibling, staff ward" maxLength={200} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} loading={busy} disabled={invalid}>
          Save
        </Button>
      </div>
    </div>
  );
}
