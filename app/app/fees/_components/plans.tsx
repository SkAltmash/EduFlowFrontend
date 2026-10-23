"use client";

import { useState } from "react";
import { Drawer, Section, errorMessage, useResource } from "@/components/data";
import { Alert, Badge, Button, Field, ICONS, Icon, Input, Select, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { className, formatDay, localToday, type ClassSummary } from "@/lib/attendance";
import { formatMoney, parseMoney, type FeePlan } from "@/lib/fees";
import { MoneyInput } from "./collect-drawer";
import { PlanEditor } from "./plan-editor";

export function Plans({ onChanged }: { onChanged: () => void }) {
  const [showArchived, setShowArchived] = useState(false);
  const path = `/api/fees/plans?archived=${showArchived ? "all" : "false"}`;
  const list = useResource(() => api<{ plans: FeePlan[] }>(path), path);
  // undefined = closed, null = new plan
  const [editing, setEditing] = useState<FeePlan | null | undefined>(undefined);
  const [assigning, setAssigning] = useState<FeePlan | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function setArchived(plan: FeePlan, archived: boolean) {
    try {
      await api(`/api/fees/plans/${plan.id}`, { method: "PATCH", body: { archived } });
      list.reload();
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    }
  }

  async function remove(plan: FeePlan) {
    if (!confirm(`Delete “${plan.name}”?`)) return;
    try {
      await api(`/api/fees/plans/${plan.id}`, { method: "DELETE" });
      list.reload();
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    }
  }

  const plans = list.data?.plans;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-4 accent-accent" />
          Show archived
        </label>
        <Button onClick={() => setEditing(null)}>
          <Icon d={ICONS.plus} />
          New fee plan
        </Button>
      </div>

      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      {list.error ? (
        <Alert>{list.error}</Alert>
      ) : !plans ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
            <Icon d="M4 7h16v12H4zM4 11h16M8 15h3" className="size-6" />
          </span>
          <p className="mt-4 font-medium">No fee plans yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            A fee plan lists what a class pays and when, e.g. tuition every quarter plus a one-time admission fee. Create one, then assign it to a class.
          </p>
          <Button className="mt-5" onClick={() => setEditing(null)}>
            <Icon d={ICONS.plus} />
            Create fee plan
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {plans.map((p) => {
            const collected = p.stats && p.stats.billed ? Math.round((p.stats.paid / p.stats.billed) * 100) : null;
            return (
              <div key={p.id} className={cx("flex flex-col rounded-xl border border-border bg-surface p-4", p.archived && "opacity-60")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-xs text-muted">
                      {[p.academicYear, p.grade && `Class ${p.grade}`, `${p.installments.length} installment${p.installments.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {p.archived ? <Badge>Archived</Badge> : <p className="shrink-0 text-lg font-semibold tabular-nums">{formatMoney(p.total)}</p>}
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {p.installments.slice(0, 4).map((i) => (
                    <li key={i.id} className="flex justify-between gap-3 text-muted">
                      <span className="truncate">
                        {i.label} <span className="text-xs">· {formatDay(i.dueDate, "short")}</span>
                      </span>
                      <span className="tabular-nums text-foreground">{formatMoney(i.total)}</span>
                    </li>
                  ))}
                  {p.installments.length > 4 && <li className="text-xs text-muted">+ {p.installments.length - 4} more</li>}
                </ul>
                <div className="mt-3 border-t border-border pt-3 text-sm">
                  {p.stats?.students ? (
                    <>
                      <div className="flex justify-between text-muted">
                        <span>{p.stats.students} students</span>
                        <span>
                          {formatMoney(p.stats.paid)} of {formatMoney(p.stats.billed)} collected
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                        <div className="h-full rounded-full bg-success" style={{ width: `${collected ?? 0}%` }} />
                      </div>
                    </>
                  ) : (
                    <p className="text-muted">Not assigned to anyone yet</p>
                  )}
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {!p.archived && (
                    <Button size="sm" onClick={() => setAssigning(p)}>
                      Assign to students
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                  {p.stats?.students ? (
                    <Button size="sm" variant="ghost" onClick={() => setArchived(p, !p.archived)}>
                      {p.archived ? "Restore" : "Archive"}
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="text-danger" onClick={() => remove(p)}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing !== undefined && (
        <PlanEditor
          plan={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(plan) => {
            setEditing(undefined);
            list.reload();
            setMessage({ tone: "success", text: `“${plan.name}” saved.` });
            // New plans go straight to assigning
            if (editing === null) setAssigning(plan);
          }}
        />
      )}
      {assigning && (
        <AssignDrawer
          plan={assigning}
          onClose={() => setAssigning(null)}
          onAssigned={(text) => {
            setAssigning(null);
            setMessage({ tone: "success", text });
            list.reload();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function AssignDrawer({ plan, onClose, onAssigned }: { plan: FeePlan; onClose: () => void; onAssigned: (message: string) => void }) {
  const classes = useResource(() => api<{ classes: ClassSummary[] }>(`/api/attendance/classes?date=${localToday()}`), "classes");
  const grades = [...new Set(classes.data?.classes.map((c) => c.grade))];
  const [grade, setGrade] = useState(plan.grade);
  const [section, setSection] = useState("");
  const sections = classes.data?.classes.filter((c) => c.grade === grade) ?? [];
  const studentCount = section ? sections.find((c) => c.section === section)?.students ?? 0 : sections.reduce((t, c) => t + c.students, 0);

  const [concessionType, setConcessionType] = useState<"none" | "percent" | "amount">("none");
  const [concessionValue, setConcessionValue] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = concessionType === "percent" ? Number(concessionValue) : concessionType === "amount" ? parseMoney(concessionValue) : 0;
  const invalid = concessionType !== "none" && (value === null || Number.isNaN(value) || value < 0 || (concessionType === "percent" && (value ?? 0) > 100));

  async function assign() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ students: number; created: number; skipped: number }>(`/api/fees/plans/${plan.id}/assign`, {
        method: "POST",
        body: {
          grade,
          ...(section ? { section } : {}),
          ...(concessionType !== "none" && value ? { concession: { type: concessionType, value, reason: reason.trim() } } : {}),
        },
      });
      onAssigned(
        res.created === 0
          ? `Everyone in Class ${className(grade, section)} already had “${plan.name}”. Nothing new to add.`
          : `“${plan.name}” assigned: ${res.created} dues created for ${res.students} students${res.skipped ? ` (${res.skipped} already existed)` : ""}.`
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={`Assign ${plan.name}`}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {grade ? `${studentCount} students × ${plan.installments.length} installments` : "Choose a class"}
          </p>
          <Button onClick={assign} loading={busy} disabled={!grade || studentCount === 0 || invalid}>
            Assign
          </Button>
        </div>
      }
    >
      {error && <Alert>{error}</Alert>}
      <p className="text-sm text-muted">
        Each active student in the class gets this plan&apos;s {plan.installments.length} installments ({formatMoney(plan.total)} in total). Students
        who already have it are skipped, so it&apos;s safe to run again after admitting new students.
      </p>
      <Section title="Students">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Class" htmlFor="as-grade">
            <Select id="as-grade" value={grade} onChange={(e) => { setGrade(e.target.value); setSection(""); }}>
              <option value="">Choose…</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  Class {g}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Section" htmlFor="as-section">
            <Select id="as-section" value={section} onChange={(e) => setSection(e.target.value)} disabled={!grade}>
              <option value="">All sections</option>
              {sections.filter((c) => c.section).map((c) => (
                <option key={c.section} value={c.section}>
                  {c.section} ({c.students})
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>
      <Section title="Concession (optional)">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["none", "None"],
              ["percent", "% off"],
              ["amount", "₹ off each"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setConcessionType(v)}
              aria-pressed={concessionType === v}
              className={cx("h-10 rounded-lg border text-sm font-medium", concessionType === v ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface hover:bg-surface-muted")}
            >
              {label}
            </button>
          ))}
        </div>
        {concessionType !== "none" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label={concessionType === "percent" ? "Percent" : "Amount off each installment"} htmlFor="as-value" error={invalid ? "Enter a valid value" : undefined}>
              {concessionType === "percent" ? (
                <Input id="as-value" inputMode="decimal" value={concessionValue} onChange={(e) => setConcessionValue(e.target.value)} placeholder="e.g. 10" />
              ) : (
                <MoneyInput id="as-value" value={concessionValue} onChange={setConcessionValue} />
              )}
            </Field>
            <Field label="Reason" htmlFor="as-reason">
              <Input id="as-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Staff ward" />
            </Field>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">For one student&apos;s concession, assign first and then edit their due from their fee account.</p>
      </Section>
    </Drawer>
  );
}
