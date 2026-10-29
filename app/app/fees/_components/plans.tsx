"use client";

import { useState } from "react";
import { Drawer, errorMessage, useResource } from "@/components/data";
import { Alert, Badge, Button, Field, ICONS, Icon, Select, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { className, formatDay, localToday, type ClassSummary } from "@/lib/attendance";
import { concessionDiscount, concessionShort, formatMoney, parseMoney, type Concession, type FeePlan } from "@/lib/fees";
import { MoneyInput } from "./collect-drawer";
import { presetToConcession, usePresets } from "./concession";
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
    const n = plan.stats?.students ?? 0;
    const warning = n
      ? `Delete “${plan.name}”?\n\nIt's assigned to ${n} student${n === 1 ? "" : "s"}. Their dues for this plan will be deleted too. Nothing has been collected on it. This can't be undone.`
      : `Delete “${plan.name}”?`;
    if (!confirm(warning)) return;
    try {
      const res = await api<{ duesDeleted: number }>(`/api/fees/plans/${plan.id}`, { method: "DELETE" });
      setMessage({ tone: "success", text: `“${plan.name}” deleted${res.duesDeleted ? ` with ${res.duesDeleted} unpaid due${res.duesDeleted === 1 ? "" : "s"}` : ""}.` });
      list.reload();
      onChanged();
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
                {Boolean(p.stats?.students && p.stats.missing) && (
                  <button
                    onClick={() => setAssigning(p)}
                    className="mt-3 flex w-full items-center gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-left text-xs transition-colors hover:border-warning"
                  >
                    <span className="size-2 shrink-0 rounded-full bg-warning" />
                    <span className="flex-1">
                      <span className="font-semibold">{p.stats!.missing} new student{p.stats!.missing === 1 ? "" : "s"}</span> in Class {p.grade} {p.stats!.missing === 1 ? "doesn't" : "don't"} have this plan yet
                    </span>
                    <span className="font-semibold text-accent">Assign →</span>
                  </button>
                )}
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
                  ) : null}
                  {/* Nothing collected yet (e.g. a demo plan): it can go, dues and all */}
                  {!p.stats?.paid && (
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

type Choice = "saved" | "none" | "custom-pays" | "custom-off" | `preset:${string}`;

interface PreviewStudent {
  id: string;
  fullName: string;
  admissionNo: string;
  rollNo: string;
  section: string;
  concession: Concession | null;
  assigned: boolean;
  advance?: number;
}

/**
 * Pick a class, then see every student with what they'll pay. Saved concessions are filled
 * in; any student can be changed with one dropdown (or everyone at once).
 */
function AssignDrawer({ plan, onClose, onAssigned }: { plan: FeePlan; onClose: () => void; onAssigned: (message: string) => void }) {
  const classes = useResource(() => api<{ classes: ClassSummary[] }>(`/api/attendance/classes?date=${localToday()}`), "classes");
  const grades = [...new Set(classes.data?.classes.map((c) => c.grade))];
  const presets = usePresets();
  const [grade, setGrade] = useState(plan.grade);
  const [section, setSection] = useState("");
  const sections = classes.data?.classes.filter((c) => c.grade === grade) ?? [];
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  // Typed amounts for "Custom amount" choices, as rupees text
  const [customs, setCustoms] = useState<Record<string, string>>({});
  const [showAssigned, setShowAssigned] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewPath = grade ? `/api/fees/plans/${plan.id}/preview?grade=${encodeURIComponent(grade)}${section ? `&section=${encodeURIComponent(section)}` : ""}` : null;
  const preview = useResource(
    () => (previewPath ? api<{ installments: { label: string; amount: number }[]; students: PreviewStudent[] }>(previewPath) : Promise.resolve({ installments: [], students: [] as PreviewStudent[] })),
    previewPath ?? "none"
  );
  const students = preview.data?.students ?? [];
  const fresh = students.filter((st) => !st.assigned);
  const presetList = presets.data?.presets ?? [];

  const choiceOf = (st: PreviewStudent): Choice => choices[st.id] ?? (st.concession ? "saved" : "none");
  const concessionFor = (st: PreviewStudent): Concession | null => {
    const c = choiceOf(st);
    if (c === "saved") return st.concession;
    if (c === "none") return null;
    if (c === "custom-pays" || c === "custom-off") {
      const v = parseMoney(customs[st.id] ?? "");
      if (v === null || (c === "custom-off" && v === 0)) return null;
      return { type: c === "custom-pays" ? "fixed" : "amount", value: v, reason: "Custom" };
    }
    const p = presetList.find((x) => `preset:${x.id ?? x.name}` === c);
    return p ? presetToConcession(p) : null;
  };
  const perInstallment = plan.installments.map((i) => i.items.reduce((t, it) => t + it.amount, 0));
  const yearly = (c: Concession | null) => perInstallment.reduce((t, a) => t + a - concessionDiscount(a, c), 0);
  const total = fresh.reduce((t, st) => t + yearly(concessionFor(st)), 0);
  const withConcession = fresh.filter((st) => concessionFor(st)).length;
  // A "Custom" choice without a valid amount would quietly charge the full fee
  const missingCustom = fresh.filter((st) => (choiceOf(st) === "custom-pays" || choiceOf(st) === "custom-off") && !concessionFor(st)).length;

  function setAll(c: Choice | "") {
    if (!c) return;
    setChoices(Object.fromEntries(fresh.map((st) => [st.id, c === "saved" && !st.concession ? "none" : c])));
  }

  async function assign() {
    setBusy(true);
    setError(null);
    try {
      // Only students whose choice differs from what's saved on them
      const concessions = fresh
        .filter((st) => choices[st.id] && choices[st.id] !== "saved" && !(choices[st.id] === "none" && !st.concession))
        .map((st) => ({ studentId: st.id, concession: concessionFor(st) }));
      const res = await api<{ students: number; created: number; skipped: number; advanceApplied?: number; advanceStudents?: number }>(`/api/fees/plans/${plan.id}/assign`, {
        method: "POST",
        body: { grade, ...(section ? { section } : {}), concessions, remember },
      });
      onAssigned(
        res.created === 0
          ? `Everyone in Class ${className(grade, section)} already had “${plan.name}”. Nothing new to add.`
          : `“${plan.name}” assigned to ${res.created / Math.max(1, plan.installments.length)} students${withConcession ? `, ${withConcession} with concessions` : ""}.${res.skipped ? ` ${res.skipped / Math.max(1, plan.installments.length)} already had it.` : ""}${res.advanceApplied ? ` ${formatMoney(res.advanceApplied)} already paid by ${res.advanceStudents} student${res.advanceStudents === 1 ? "" : "s"} was applied.` : ""}`
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
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {grade && preview.data ? (
              <>
                <span className="font-semibold text-foreground">{fresh.length}</span> student{fresh.length === 1 ? "" : "s"} · <span className="font-semibold text-foreground">{formatMoney(total)}</span>
                {withConcession > 0 && <span className="text-success"> · {withConcession} with concession</span>}
              </>
            ) : (
              "Choose a class"
            )}
          </p>
          {missingCustom > 0 && <span className="text-xs text-danger">Enter the custom amount for {missingCustom} student{missingCustom === 1 ? "" : "s"}</span>}
          <Button onClick={assign} loading={busy} disabled={!grade || fresh.length === 0 || missingCustom > 0} className="w-full sm:w-auto">
            Assign to {fresh.length} student{fresh.length === 1 ? "" : "s"}
          </Button>
        </div>
      }
    >
      {error && <Alert>{error}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Class" htmlFor="as-grade">
          <Select id="as-grade" value={grade} onChange={(e) => { setGrade(e.target.value); setSection(""); setChoices({}); }}>
            <option value="">Choose…</option>
            {grades.map((g) => (
              <option key={g} value={g}>
                Class {g}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Section" htmlFor="as-section">
          <Select id="as-section" value={section} onChange={(e) => { setSection(e.target.value); setChoices({}); }} disabled={!grade}>
            <option value="">All sections</option>
            {sections.filter((c) => c.section).map((c) => (
              <option key={c.section} value={c.section}>
                {c.section} ({c.students})
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {grade && (
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Who pays what</p>
              <p className="text-xs text-muted">
                Full fee {formatMoney(plan.total)} · {plan.installments.length} installment{plan.installments.length === 1 ? "" : "s"}. Saved concessions are already filled in.
              </p>
            </div>
            {fresh.length > 1 && (
              <Select aria-label="Set everyone's concession" value="" onChange={(e) => setAll(e.target.value as Choice)} className="h-10 w-full text-sm sm:h-9 sm:w-48">
                <option value="">Set everyone to…</option>
                <option value="saved">Their saved concession</option>
                <option value="none">No concession</option>
                {presetList.map((p) => (
                  <option key={p.id ?? p.name} value={`preset:${p.id ?? p.name}`}>
                    {p.name} · {concessionShort(p)}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {!preview.data ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : students.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">No active students in this class.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {/* New students first; those who already have the plan fold away */}
              {[...fresh, ...(showAssigned ? students.filter((x) => x.assigned) : [])].map((st) => {
                const c = concessionFor(st);
                const pays = yearly(c);
                return (
                  // Phones: name + price on top, the dropdown full width below. Wider screens: one line.
                  <li key={st.id} className={cx("grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:flex sm:py-2", st.assigned && "opacity-50")}>
                    <span className="shrink-0 text-right font-mono text-xs text-muted sm:w-7">{st.rollNo || "–"}</span>
                    <span className="min-w-0 sm:flex-1">
                      <span className="block truncate text-sm font-medium">{st.fullName}</span>
                      <span className="block truncate text-xs text-muted">
                        {st.section && `${grade}-${st.section} · `}
                        {st.assigned ? "Already has this plan" : st.concession ? `Saved: ${st.concession.label}` : st.admissionNo}
                      </span>
                      {!st.assigned && (st.advance ?? 0) > 0 && <span className="block text-xs font-medium text-success">{formatMoney(st.advance!)} already paid · used first</span>}
                    </span>
                    {!st.assigned && (
                      <>
                        <span className="shrink-0 text-right text-sm tabular-nums sm:order-last sm:w-24">
                          {c && <span className="block text-[11px] text-muted line-through">{formatMoney(plan.total)}</span>}
                          <span className={cx("font-semibold", c && "text-success")}>{formatMoney(pays)}</span>
                        </span>
                        <div className="col-span-3 flex gap-2 pl-[calc(1.75rem+0.75rem)] sm:col-span-1 sm:pl-0">
                          <Select
                            aria-label={`Concession for ${st.fullName}`}
                            value={choiceOf(st)}
                            onChange={(e) => setChoices((m) => ({ ...m, [st.id]: e.target.value as Choice }))}
                            className={cx("h-10 min-w-0 flex-1 text-sm sm:h-9 sm:w-44 sm:flex-none", c && "border-success/50 text-success")}
                          >
                            {st.concession && <option value="saved">{st.concession.reason || "Saved"} · {concessionShort(st.concession)}</option>}
                            <option value="none">No concession</option>
                            {presetList.map((p) => (
                              <option key={p.id ?? p.name} value={`preset:${p.id ?? p.name}`}>
                                {p.name} · {concessionShort(p)}
                              </option>
                            ))}
                            <option value="custom-pays">Custom: pays ₹…</option>
                            <option value="custom-off">Custom: ₹ … off</option>
                          </Select>
                          {(choiceOf(st) === "custom-pays" || choiceOf(st) === "custom-off") && (
                            <div className="w-28 shrink-0">
                              <MoneyInput
                                id={`custom-${st.id}`}
                                value={customs[st.id] ?? ""}
                                onChange={(v) => setCustoms((m) => ({ ...m, [st.id]: v }))}
                                invalid={Boolean(customs[st.id]) && !c}
                              />
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
              {students.some((x) => x.assigned) && (
                <li>
                  <button onClick={() => setShowAssigned((v) => !v)} className="w-full px-3 py-2.5 text-left text-xs font-medium text-muted hover:bg-surface-muted">
                    {showAssigned ? "Hide" : "Show"} {students.filter((x) => x.assigned).length} student{students.filter((x) => x.assigned).length === 1 ? "" : "s"} who already have this plan
                  </button>
                </li>
              )}
            </ul>
          )}
          {Object.keys(choices).length > 0 && (
            <label className="mt-3 flex items-start gap-3 text-sm">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
              <span>
                Remember these concessions for future plans
                <span className="block text-xs text-muted">Saved on each student; you can change it from their fee account anytime.</span>
              </span>
            </label>
          )}
          <p className="mt-3 text-xs text-muted">New students joining later? Open Assign again: only those without this plan are added. Custom amounts can be changed later from the student&apos;s fee account → Concession.</p>
        </section>
      )}
    </Drawer>
  );
}
