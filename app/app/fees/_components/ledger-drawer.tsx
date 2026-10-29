"use client";

import { useState } from "react";
import { Avatar } from "@/app/app/students/_components/bits";
import { Drawer, Section, errorMessage, useResource } from "@/components/data";
import { Alert, Badge, Button, Field, ICONS, Icon, Input, Spinner, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { className, formatDay, localToday } from "@/lib/attendance";
import { WhatsAppButton, WhatsAppDrawer } from "@/components/whatsapp-send";
import { MODE_LABEL, STATUS_BADGE, formatMoney, moneyInput, parseMoney, type Due, type FeePlan, type Ledger } from "@/lib/fees";
import { MoneyInput } from "./collect-drawer";
import { ConcessionDrawer } from "./concession";
import { PlanEditor } from "./plan-editor";

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
  const [concessionOpen, setConcessionOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const data = ledger.data;
  const s = data?.student;

  const [planEditing, setPlanEditing] = useState<FeePlan | null>(null);
  const [adding, setAdding] = useState(false);

  async function openPlanEditor(planId: string) {
    try {
      setPlanEditing((await api<{ plan: FeePlan }>(`/api/fees/plans/${planId}`)).plan);
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    }
  }

  async function removePlan(planId: string, name: string, paid: number) {
    if (!confirm(`Remove “${name}” from this student? Its dues are deleted.${paid ? ` The ${formatMoney(paid)} already paid on it becomes advance and goes to their other fees.` : ""}`)) return;
    try {
      const res = await api<{ duesDeleted: number; movedToAdvance: number }>(`/api/fees/students/${studentId}/plans/${planId}`, { method: "DELETE" });
      setMessage({
        tone: "success",
        text: `“${name}” removed (${res.duesDeleted} due${res.duesDeleted === 1 ? "" : "s"}).${res.movedToAdvance ? ` ${formatMoney(res.movedToAdvance)} paid on it is now advance.` : ""}`,
      });
      ledger.reload();
      onChanged();
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    }
  }

  async function removeDue(d: Due) {
    if (!confirm(`Remove “${d.label}” (${formatMoney(d.amount)}) from this student?${d.paid ? ` The ${formatMoney(d.paid)} paid on it becomes advance.` : ""}`)) return;
    try {
      await api(`/api/fees/dues/${d.id}`, { method: "DELETE" });
      setMessage({ tone: "success", text: `${d.label} removed.${d.paid ? ` ${formatMoney(d.paid)} is now advance.` : ""}` });
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
        data && (
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <p className="text-muted">Balance</p>
              <p className="text-lg font-semibold tabular-nums">{formatMoney(data.totals.balance)}</p>
            </div>
            <Button onClick={onCollect} variant={data.totals.balance > 0 ? "primary" : "secondary"} className="min-w-36">
              <Icon d={ICONS.plus} />
              {data.totals.balance > 0 ? "Collect fee" : "Record advance"}
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

          {(data.totals.advance ?? 0) > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-success/40 bg-success-soft px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success text-white">
                <Icon d="M12 3v18M17 7.5C17 5.6 14.8 4.5 12 4.5S7 5.6 7 7.5 9.2 10.3 12 11s5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-success">Advance {formatMoney(data.totals.advance!)}</p>
                <p className="text-xs text-muted">Already paid, not on any fee yet. Pays the next fees automatically when a fee plan is assigned.</p>
              </div>
            </div>
          )}

          {/* Standing concession: one place for "this student pays less" */}
          <div className={cx("flex items-center gap-3 rounded-xl border px-4 py-3", s.concession ? "border-success/40 bg-success-soft" : "border-dashed border-border")}>
            <span className={cx("grid size-9 shrink-0 place-items-center rounded-full", s.concession ? "bg-success text-white" : "bg-surface-muted text-muted")}>
              <Icon d="M9 14l6-6M9.5 8.5h.01M14.5 13.5h.01M5 3h14v18l-3.5-2-3.5 2-3.5-2L5 21z" />
            </span>
            <div className="min-w-0 flex-1">
              {s.concession ? (
                <>
                  <p className="text-sm font-semibold text-success">{s.concession.label}</p>
                  <p className="truncate text-xs text-muted">Applies to every fee plan{s.concession.updatedByName && ` · set by ${s.concession.updatedByName}`}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">No concession</p>
                  <p className="text-xs text-muted">Sibling, staff child, RTE, scholarship…</p>
                </>
              )}
            </div>
            <Button size="sm" variant={s.concession ? "secondary" : "primary"} onClick={() => setConcessionOpen(true)}>
              {s.concession ? "Change" : "Give concession"}
            </Button>
          </div>
          {notice && <Alert tone="success">{notice}</Alert>}

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
          {planEditing && (
        <PlanEditor
          plan={planEditing}
          onClose={() => setPlanEditing(null)}
          onSaved={(plan) => {
            setPlanEditing(null);
            setMessage({ tone: "success", text: `“${plan.name}” saved. Unpaid dues of every student on this plan now match it.` });
            ledger.reload();
            onChanged();
          }}
        />
      )}
      {concessionOpen && data && s && (
        <ConcessionDrawer
          studentId={s.id}
          studentName={s.fullName}
          current={s.concession}
          dues={data.dues}
          onClose={() => setConcessionOpen(false)}
          onSaved={(text) => {
            setConcessionOpen(false);
            setNotice(text);
            ledger.reload();
            onChanged();
          }}
        />
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

          <Section title="Fee plans">
            <div className="space-y-2">
              {[...new Map(data.dues.map((d) => [d.planId, d.planName])).entries()].map(([planId, name]) => {
                const mine = data.dues.filter((d) => d.planId === planId);
                const fee = mine.reduce((t, d) => t + d.amount - d.discount, 0);
                const paid = mine.reduce((t, d) => t + d.paid, 0);
                return (
                  <div key={planId} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{name}</span>
                      <span className="text-xs text-muted">
                        {mine.length} due{mine.length === 1 ? "" : "s"} · {formatMoney(fee)}
                        {paid > 0 && ` · ${formatMoney(paid)} paid`}
                      </span>
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => openPlanEditor(planId)}>
                      <Icon d={ICONS.edit} />
                      Edit plan
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger" onClick={() => removePlan(planId, name, paid)}>
                      Remove
                    </Button>
                  </div>
                );
              })}
              {adding ? (
                <AddPlan
                  studentId={studentId}
                  has={new Set(data.dues.map((d) => d.planId))}
                  onCancel={() => setAdding(false)}
                  onAdded={(text) => {
                    setAdding(false);
                    setMessage({ tone: "success", text });
                    ledger.reload();
                    onChanged();
                  }}
                />
              ) : (
                <button onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm font-medium text-accent hover:bg-surface-muted">
                  <Icon d={ICONS.plus} />
                  Add fee plan
                </button>
              )}
            </div>
          </Section>

          <Section title={`Dues (${data.dues.length})`}>
            {data.dues.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
                No fees yet. Use “Add fee plan” above.
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
                      <div className="flex shrink-0 items-start gap-1.5">
                      <div className="text-right">
                        <p className="font-medium tabular-nums">{formatMoney(d.balance > 0 ? d.balance : d.paid)}</p>
                        <p className="text-xs text-muted">
                          {d.balance > 0 ? (d.paid > 0 ? `of ${formatMoney(d.amount - d.discount)}` : "to pay") : "paid"}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${d.label}`} title="Concession or due date for this due" onClick={() => setEditing(editing === d.id ? null : d.id)}>
                        <Icon d={ICONS.edit} />
                      </Button>
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
                        <button className="font-medium text-danger hover:underline" onClick={() => removeDue(d)}>
                          Remove
                        </button>
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
                          {p.kind === "opening" && <Badge>Paid before EduFlow</Badge>}
                        </span>
                        <span className="block text-xs text-muted">
                          {formatDay(p.date, "short")} · {MODE_LABEL[p.mode]}
                          {!p.voided && (p.advance ?? 0) > 0 && <span className="text-success"> · {formatMoney(p.advance!)} advance</span>}
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

/** Adds one more fee plan to this student only (their saved concession applies). */
function AddPlan({ studentId, has, onCancel, onAdded }: { studentId: string; has: Set<string>; onCancel: () => void; onAdded: (message: string) => void }) {
  const plans = useResource(() => api<{ plans: FeePlan[] }>("/api/fees/plans?archived=false"), "fee-plans-active");
  const options = (plans.data?.plans ?? []).filter((p) => !has.has(p.id));
  const [planId, setPlanId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = options.find((p) => p.id === planId);

  async function add() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ advanceApplied?: number }>(`/api/fees/plans/${chosen.id}/assign`, { method: "POST", body: { studentIds: [studentId] } });
      onAdded(
        `“${chosen.name}” added (${chosen.installments.length} due${chosen.installments.length === 1 ? "" : "s"}).${res.advanceApplied ? ` ${formatMoney(res.advanceApplied)} advance was applied to it.` : ""}`
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-accent/40 bg-surface p-3">
      {error && <Alert>{error}</Alert>}
      {plans.data && options.length === 0 ? (
        <p className="text-sm text-muted">No other active plans. Create one in the Fee plans tab.</p>
      ) : (
        <select value={planId} onChange={(e) => setPlanId(e.target.value)} aria-label="Fee plan" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-accent">
          <option value="">Choose a plan…</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {formatMoney(p.total)}
            </option>
          ))}
        </select>
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={add} loading={busy} disabled={!chosen}>
          Add plan
        </Button>
      </div>
      <p className="text-[11px] text-muted">Their saved concession is applied automatically.</p>
    </div>
  );
}
