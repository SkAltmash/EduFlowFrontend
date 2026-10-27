"use client";

import { useState } from "react";
import { SubjectChip } from "@/components/academic-bits";
import { errorMessage, useResource } from "@/components/data";
import { Alert, Button, ICONS, Icon, Select, Skeleton, cx } from "@/components/ui";
import { loadClassList } from "@/lib/academics";
import { api } from "@/lib/api";
import { formatDay } from "@/lib/attendance";
import type { Topic } from "@/lib/classroom";
import { loadMyClasses, subjectsIn, teaches } from "@/lib/teaching";

/** Chapters per class and subject, ticked off per section as they're taught. */
export function Syllabus() {
  const classList = useResource(loadClassList, "academics-classes");
  const my = useResource(loadMyClasses, "my-classes");
  const classes = (classList.data?.classes ?? []).filter((c) => teaches(my.data, c.name));
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const g = grade || classes[0]?.name || "";
  const cls = classes.find((c) => c.name === g);
  const allowed = subjectsIn(my.data, g);
  const subjects = (cls?.subjects.map((s) => s.name) ?? []).filter((s) => !allowed || allowed.some((a) => a.toLowerCase() === s.toLowerCase()));
  const subj = subject && subjects.includes(subject) ? subject : subjects[0] ?? "";
  const sections = cls?.sections.length ? cls.sections.filter((s) => teaches(my.data, g, s)) : [""];

  const path = g && subj ? `/api/syllabus?grade=${encodeURIComponent(g)}&subject=${encodeURIComponent(subj)}` : null;
  const topics = useResource(() => (path ? api<{ topics: Topic[] }>(path) : Promise.resolve({ topics: [] as Topic[] })), path ?? "none");
  const list = topics.data?.topics ?? [];

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await action();
      topics.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (classList.data && classes.length === 0) {
    return <Alert tone="warning">Set up classes and their subjects first (Settings → Classes &amp; subjects).</Alert>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Class" value={g} onChange={(e) => { setGrade(e.target.value); setSubject(""); }} className="h-9 w-36 text-sm">
          {classes.map((c) => (
            <option key={c.id} value={c.name}>
              Class {c.name}
            </option>
          ))}
        </Select>
        <div className="flex flex-wrap gap-1.5">
          {subjects.map((s) => (
            <button key={s} onClick={() => setSubject(s)} aria-pressed={subj === s} className={cx("rounded-full border px-3 py-1 text-sm transition-colors", subj === s ? "border-accent bg-accent-soft font-medium text-accent" : "border-border hover:bg-surface-muted")}>
              {s}
            </button>
          ))}
        </div>
      </div>
      {error && <Alert>{error}</Alert>}

      {!subj ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center text-sm text-muted">Add subjects to Class {g} in Settings → Classes &amp; subjects to track its syllabus.</p>
      ) : !topics.data ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <SubjectChip name={subj} />
              <span className="text-sm text-muted">
                Class {g} · {list.length} topic{list.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {sections.map((sec) => {
                const done = list.filter((t) => t.completed.some((c) => c.section === sec)).length;
                const pct = list.length ? Math.round((done / list.length) * 100) : 0;
                return (
                  <div key={sec || "all"} className="w-40">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{sec ? `Section ${sec}` : "Progress"}</span>
                      <span className="tabular-nums text-muted">{pct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent to-brand-green transition-[width] duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {list.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">No topics yet. Add the chapters below, one per line.</p>
          ) : (
            <ol className="divide-y divide-border">
              {list.map((t, i) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="w-6 text-right text-xs tabular-nums text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 text-sm">{t.title}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {sections.map((sec) => {
                      const c = t.completed.find((x) => x.section === sec);
                      return (
                        <button
                          key={sec || "all"}
                          disabled={busy === `${t.id}|${sec}`}
                          onClick={() => run(`${t.id}|${sec}`, () => api(`/api/syllabus/${t.id}`, { method: "PATCH", body: { done: { section: sec, value: !c } } }))}
                          title={c ? `Done ${formatDay(c.date, "short")}${c.byName ? ` by ${c.byName}` : ""}` : "Mark as taught"}
                          className={cx(
                            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
                            c ? "border-success/40 bg-success-soft text-success" : "border-border text-muted hover:border-accent hover:text-accent"
                          )}
                        >
                          <Icon d={c ? "M5 12l5 5L20 7" : ICONS.plus} className="size-3.5" />
                          {sec || (c ? "Done" : "Mark done")}
                        </button>
                      );
                    })}
                  </span>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${t.title}`} onClick={() => confirm(`Remove “${t.title}”?`) && run(`del:${t.id}`, () => api(`/api/syllabus/${t.id}`, { method: "DELETE" }))}>
                    <Icon d={ICONS.x} />
                  </Button>
                </li>
              ))}
            </ol>
          )}

          <div className="border-t border-border bg-surface-muted/40 p-4">
            <textarea
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              rows={3}
              placeholder={"Add topics, one per line\ne.g. Chapter 1: Fractions"}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm"
            />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                loading={busy === "add"}
                disabled={!adding.trim()}
                onClick={() =>
                  run("add", async () => {
                    await api("/api/syllabus", { method: "POST", body: { grade: g, subject: subj, titles: adding.split("\n").map((l) => l.trim()).filter(Boolean) } });
                    setAdding("");
                  })
                }
              >
                <Icon d={ICONS.plus} />
                Add topics
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
