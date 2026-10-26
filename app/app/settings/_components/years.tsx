"use client";

import { useState } from "react";
import { Drawer, errorMessage, formatDate, useResource } from "@/components/data";
import { Alert, Badge, Button, Field, ICONS, Icon, Input, Select, Skeleton, cx } from "@/components/ui";
import { OUTCOME_LABEL, loadYears, type AcademicYear, type Outcome, type PromotionPreview, type PromotionSummary } from "@/lib/academics";
import { api } from "@/lib/api";
import { formatDay } from "@/lib/attendance";
import { SettingsCard } from "./card";

type Message = { tone: "success" | "danger"; text: string } | null;
const plural = (n: number, w: string) => `${n} ${n === 1 ? w : w.endsWith("s") ? `${w}es` : `${w}s`}`;
const dayRange = (a: string, b: string) => `${formatDay(a, "short")} ${a.slice(0, 4)} – ${formatDay(b, "short")} ${b.slice(0, 4)}`;

export function YearSettings() {
  const years = useResource(loadYears, "academics-years");
  const history = useResource(() => api<{ promotions: PromotionSummary[] }>("/api/academics/promotions"), "academics-promotions");
  const [promoting, setPromoting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => {
    years.reload();
    history.reload();
  };

  async function act(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      setMessage({ tone: "success", text: success });
      refresh();
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  if (years.error) return <Alert>{years.error}</Alert>;
  if (!years.data) return <Skeleton className="h-80 rounded-2xl" />;
  const { current } = years.data;

  return (
    <div className="space-y-6">
      <SettingsCard title="Academic year" description="The year your school is in now. Promotion closes it and starts the next one.">
        {message && <Alert tone={message.tone}>{message.text}</Alert>}

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-accent/30 bg-accent-soft/40 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Current year</p>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight">{current.name}</p>
            <p className="text-sm text-muted">{dayRange(current.startDate, current.endDate)}</p>
          </div>
          <Button onClick={() => setPromoting(true)}>
            <Icon d="M12 19V5M5 12l7-7 7 7" />
            Promote students
          </Button>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">All years</h3>
            <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}>
              <Icon d={ICONS.plus} />
              Add year
            </Button>
          </div>
          {adding && <AddYear after={years.data.years[0]} onAdded={() => { setAdding(false); refresh(); setMessage({ tone: "success", text: "Year added." }); }} />}
          <ul className="-mx-5 divide-y divide-border border-y border-border">
            {years.data.years.map((y) => (
              <li key={y.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {y.name} {y.isCurrent && <Badge tone="accent">Current</Badge>}
                  </p>
                  <p className="text-xs text-muted">{dayRange(y.startDate, y.endDate)}</p>
                </div>
                {!y.isCurrent && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" loading={busy === `cur:${y.id}`} onClick={() => confirm(`Make ${y.name} the current year? Students don't move; use Promote students for that.`) && act(`cur:${y.id}`, () => api(`/api/academics/years/${y.id}`, { method: "PATCH", body: { isCurrent: true } }), `${y.name} is now the current year.`)}>
                      Make current
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Delete ${y.name}`} loading={busy === `del:${y.id}`} onClick={() => confirm(`Delete year ${y.name}?`) && act(`del:${y.id}`, () => api(`/api/academics/years/${y.id}`, { method: "DELETE" }), `Year ${y.name} deleted.`)}>
                      <Icon d={ICONS.x} />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </SettingsCard>

      <SettingsCard title="Promotion history" description="Each year-end promotion. The most recent one can be undone.">
        {history.error ? (
          <Alert>{history.error}</Alert>
        ) : !history.data ? (
          <Skeleton className="h-20" />
        ) : history.data.promotions.length === 0 ? (
          <p className="text-sm text-muted">No promotions yet. At the end of {current.name}, use Promote students to move everyone up.</p>
        ) : (
          <ul className="-mx-5 divide-y divide-border border-y border-border">
            {history.data.promotions.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {p.fromYear} → {p.toYear} {p.undone && <Badge tone="danger">Undone</Badge>}
                  </p>
                  <p className="text-xs text-muted">
                    {(Object.keys(OUTCOME_LABEL) as Outcome[])
                      .filter((o) => p.counts[o])
                      .map((o) => `${p.counts[o]} ${OUTCOME_LABEL[o].toLowerCase()}`)
                      .join(" · ")}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(p.createdAt, true)}
                    {p.createdByName && ` by ${p.createdByName}`}
                    {p.undone && ` · undone ${formatDate(p.undone.at)}${p.undone.skipped ? ` (${p.undone.skipped} changed since, left as they were)` : ""}`}
                  </p>
                </div>
                {p.canUndo && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy === `undo:${p.id}`}
                    onClick={() =>
                      confirm(`Undo the ${p.fromYear} → ${p.toYear} promotion? Students go back to their ${p.fromYear} classes and ${p.fromYear} becomes the current year again. Students you've edited since are left as they are.`) &&
                      act(`undo:${p.id}`, () => api(`/api/academics/promotions/${p.id}/undo`, { method: "POST" }), `Promotion undone. ${p.fromYear} is the current year again.`)
                    }
                  >
                    Undo
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>

      {promoting && (
        <PromoteDrawer
          onClose={() => setPromoting(false)}
          onDone={(text) => {
            refresh();
            setMessage({ tone: "success", text });
          }}
        />
      )}
    </div>
  );
}

function AddYear({ after, onAdded }: { after?: AcademicYear; onAdded: () => void }) {
  const nextStart = after ? new Date(Date.parse(`${after.endDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10) : "";
  const nextEnd = after ? `${Number(after.endDate.slice(0, 4)) + 1}${after.endDate.slice(4)}` : "";
  const nextName = after ? `${nextStart.slice(0, 4)}-${String((Number(nextStart.slice(0, 4)) + 1) % 100).padStart(2, "0")}` : "";
  const [name, setName] = useState(nextName);
  const [start, setStart] = useState(nextStart);
  const [end, setEnd] = useState(nextEnd);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/academics/years", { method: "POST", body: { name: name.trim(), startDate: start, endDate: end } });
      onAdded();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 space-y-3 rounded-xl border border-border p-4">
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name" htmlFor="y-name">
          <Input id="y-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="2027-28" />
        </Field>
        <Field label="Starts" htmlFor="y-start">
          <Input id="y-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Ends" htmlFor="y-end">
          <Input id="y-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={save} loading={busy} disabled={!name.trim() || !start || !end}>
          Add year
        </Button>
      </div>
    </div>
  );
}

type Action = "follow" | "retain" | "leave" | "graduate";

const ACTION_LABEL: Record<Action, string> = { follow: "With class", retain: "Repeats year", leave: "Leaves", graduate: "Graduates" };

/** Year-end promotion: where each class goes, exceptions per student, then one confirm. */
function PromoteDrawer({ onClose, onDone }: { onClose: () => void; onDone: (text: string) => void }) {
  const preview = useResource(() => api<PromotionPreview>("/api/academics/promotions/preview"), "promotion-preview");
  const [year, setYear] = useState<{ name: string; startDate: string; endDate: string } | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [exceptions, setExceptions] = useState<Record<string, Exclude<Action, "follow">>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [clearRolls, setClearRolls] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ promotion: PromotionSummary; noSection: number } | null>(null);

  const p = preview.data;
  const toYear = year ?? p?.nextYear;
  const active = p?.classes.filter((c) => c.roster.length > 0) ?? [];
  const targetOf = (id: string) => targets[id] ?? p!.classes.find((c) => c.id === id)!.suggestedTarget;

  // What happens to everyone, as the server will do it
  const counts: Record<Outcome, number> = { promoted: 0, retained: 0, graduated: 0, left: 0 };
  let needSection = 0;
  for (const c of active) {
    const t = targetOf(c.id);
    const targetClass = p!.classes.find((x) => x.id === t);
    for (const s of c.roster) {
      const ex = exceptions[s.id];
      const outcome: Outcome = ex === "retain" ? "retained" : ex === "leave" ? "left" : ex === "graduate" ? "graduated" : t === "graduate" ? "graduated" : t === "stay" ? "retained" : "promoted";
      counts[outcome] += 1;
      if (outcome === "promoted" && targetClass && targetClass.sections.length > 1 && !targetClass.sections.some((x) => x.toLowerCase() === s.section.toLowerCase())) needSection += 1;
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  async function submit() {
    if (!p || !toYear) return;
    if (!confirm(`Promote ${plural(total, "student")} into ${toYear.name}?\n\n${counts.promoted} promoted · ${counts.retained} repeat · ${counts.graduated} graduate · ${counts.left} leave\n\nYou can undo this afterwards.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ promotion: PromotionSummary; noSection: number }>("/api/academics/promotions", {
        method: "POST",
        body: {
          toYear,
          moves: active.map((c) => ({ classId: c.id, target: targetOf(c.id) })),
          exceptions: Object.entries(exceptions).map(([studentId, action]) => ({ studentId, action })),
          clearRollNumbers: clearRolls,
        },
      });
      setResult(res);
      onDone(`Promoted to ${res.promotion.toYear}. ${res.promotion.toYear} is now the current year.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const c = result.promotion.counts;
    return (
      <Drawer title="Promotion done" onClose={onClose} size="lg" footer={<div className="flex justify-end"><Button onClick={onClose}>Done</Button></div>}>
        <Alert tone="success">Welcome to {result.promotion.toYear}! Every student&apos;s {result.promotion.fromYear} class is saved in their history.</Alert>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => (
            <div key={o} className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted">{OUTCOME_LABEL[o]}</p>
              <p className="text-2xl font-semibold tabular-nums">{c[o]}</p>
            </div>
          ))}
        </div>
        {result.noSection > 0 && <Alert tone="warning">{plural(result.noSection, "student")} moved into a class whose sections don&apos;t match their old one, so they have no section yet. Filter Students by class to set it.</Alert>}
        {clearRolls && <p className="text-sm text-muted">Roll numbers were cleared for the new year.</p>}
        <p className="text-sm text-muted">Made a mistake? Undo it from Promotion history.</p>
      </Drawer>
    );
  }

  return (
    <Drawer
      title="Promote students"
      onClose={onClose}
      size="lg"
      footer={
        p && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              <span className="font-medium text-foreground">{counts.promoted}</span> up · {counts.retained} repeat · {counts.graduated} graduate · {counts.left} leave
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={submit} loading={busy} disabled={!total || !toYear?.name.trim()}>
                Promote {plural(total, "student")}
              </Button>
            </div>
          </div>
        )
      }
    >
      {error && <Alert>{error}</Alert>}
      {preview.error && <Alert>{preview.error}</Alert>}
      {!p ? (
        !preview.error && <Skeleton className="h-96" />
      ) : p.classes.length === 0 ? (
        <Alert tone="warning">Set up your classes first (Settings → Classes &amp; subjects). Promotion moves students down that list.</Alert>
      ) : (
        <>
          <section>
            <h3 className="mb-1 text-sm font-semibold">1. New year</h3>
            <p className="mb-3 text-xs text-muted">
              Closing <span className="font-medium text-foreground">{p.currentYear.name}</span>. Students start this year in their new class.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Name" htmlFor="p-name">
                <Input id="p-name" value={toYear!.name} onChange={(e) => setYear({ ...toYear!, name: e.target.value })} />
              </Field>
              <Field label="Starts" htmlFor="p-start">
                <Input id="p-start" type="date" value={toYear!.startDate} onChange={(e) => setYear({ ...toYear!, startDate: e.target.value })} />
              </Field>
              <Field label="Ends" htmlFor="p-end">
                <Input id="p-end" type="date" value={toYear!.endDate} onChange={(e) => setYear({ ...toYear!, endDate: e.target.value })} />
              </Field>
            </div>
          </section>

          {(p.unknown.length > 0 || p.unassigned > 0) && (
            <Alert tone="warning">
              Not included:{" "}
              {[
                p.unknown.length > 0 && `${plural(p.unknown.reduce((n, u) => n + u.students, 0), "student")} whose class isn't in your list (fix in Classes & subjects)`,
                p.unassigned > 0 && `${plural(p.unassigned, "student")} without a class`,
              ]
                .filter(Boolean)
                .join("; ")}
              .
            </Alert>
          )}

          <section>
            <h3 className="mb-1 text-sm font-semibold">2. Where each class goes</h3>
            <p className="mb-3 text-xs text-muted">Students keep their section letter when the new class has it. Open a class to mark students who repeat, leave or graduate early.</p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {active.map((c) => {
                const t = targetOf(c.id);
                const changed = c.roster.filter((s) => exceptions[s.id]).length;
                return (
                  <li key={c.id}>
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <button onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <Icon d={ICONS.chevronRight} className={cx("shrink-0 text-muted transition-transform", open === c.id && "rotate-90")} />
                        <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-surface-muted px-2 text-sm font-semibold">{c.name}</span>
                        <span className="min-w-0 text-sm">
                          {plural(c.roster.length, "student")}
                          {changed > 0 && <span className="text-accent"> · {changed} exception{changed === 1 ? "" : "s"}</span>}
                        </span>
                      </button>
                      <div className="flex items-center gap-2">
                        <Icon d="M5 12h14M13 6l6 6-6 6" className="text-muted" />
                        <Select aria-label={`Class ${c.name} moves to`} value={t} onChange={(e) => setTargets((m) => ({ ...m, [c.id]: e.target.value }))} className="h-9 w-44 text-sm">
                          {p.classes
                            .filter((x) => x.id !== c.id)
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                Class {x.name}
                              </option>
                            ))}
                          <option value="graduate">Graduate (leave school)</option>
                          <option value="stay">Stay in {c.name}</option>
                        </Select>
                      </div>
                    </div>
                    {open === c.id && (
                      <ul className="border-t border-border bg-surface-muted/50">
                        {c.roster.map((s) => (
                          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 pl-12 text-sm">
                            <span className="min-w-0">
                              <span className="font-medium">{s.fullName}</span>
                              <span className="text-xs text-muted">
                                {" "}
                                · {s.admissionNo}
                                {s.section && ` · ${c.name}-${s.section}`}
                              </span>
                            </span>
                            <Select
                              aria-label={`What happens to ${s.fullName}`}
                              value={exceptions[s.id] ?? "follow"}
                              onChange={(e) =>
                                setExceptions((m) => {
                                  const next = { ...m };
                                  if (e.target.value === "follow") delete next[s.id];
                                  else next[s.id] = e.target.value as Exclude<Action, "follow">;
                                  return next;
                                })
                              }
                              className={cx("h-8 w-36 text-xs", exceptions[s.id] && "border-accent text-accent")}
                            >
                              {(Object.keys(ACTION_LABEL) as Action[]).map((a) => (
                                <option key={a} value={a}>
                                  {ACTION_LABEL[a]}
                                </option>
                              ))}
                            </Select>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">3. Options</h3>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={clearRolls} onChange={(e) => setClearRolls(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
              <span>
                Clear roll numbers
                <span className="block text-xs text-muted">New classes usually get new roll numbers.</span>
              </span>
            </label>
            {needSection > 0 && <p className="mt-3 text-xs text-warning">{plural(needSection, "student")} will move into a class without their section letter and will need a section set afterwards.</p>}
          </section>
        </>
      )}
    </Drawer>
  );
}
