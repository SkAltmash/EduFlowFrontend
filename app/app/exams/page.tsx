"use client";

import { useState } from "react";
import { Pager, query, useDebounced, useResource, type Pagination } from "@/components/data";
import { Badge, Button, ICONS, Icon, Input, Select, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDay, localToday, type ClassSummary } from "@/lib/attendance";
import { classLabel, formatPct, type ExamListItem } from "@/lib/exams";
import { ExamEditor } from "./_components/exam-editor";
import { MarksSheet } from "./_components/marks-sheet";
import { MonthlyReports } from "./_components/monthly";

type Tab = "tests" | "monthly";

export default function ExamsPage() {
  const { session } = useAuth();
  const role = session.status === "authenticated" ? session.role : undefined;
  const allowed = role === "owner" || role === "admin" || role === "teacher";

  const [tab, setTab] = useState<Tab>("tests");
  const [openExam, setOpenExam] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [grade, setGrade] = useState("");
  const [month, setMonth] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const q = useDebounced(search.trim());

  const classes = useResource(() => api<{ classes: ClassSummary[] }>(`/api/attendance/classes?date=${localToday()}`), "classes");
  const grades = [...new Set(classes.data?.classes.map((c) => c.grade))];
  const path = `/api/exams${query({ grade, month, search: q, page, limit: 18 })}`;
  const list = useResource(() => api<{ exams: ExamListItem[]; pagination: Pagination }>(path), `${path}#${refreshKey}`);

  if (!allowed) {
    return <p className="rounded-xl border border-border bg-surface px-6 py-14 text-center text-sm text-muted">Tests are managed by owners, admins and teachers.</p>;
  }

  if (openExam) {
    return (
      <MarksSheet
        examId={openExam}
        onBack={() => setOpenExam(null)}
        onChanged={() => setRefreshKey((k) => k + 1)}
        onDeleted={() => {
          setOpenExam(null);
          setRefreshKey((k) => k + 1);
        }}
      />
    );
  }

  const exams = list.data?.exams ?? [];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tests & report cards</h1>
          <p className="mt-1 text-sm text-muted">Enter marks, share results and send monthly progress reports to parents.</p>
        </div>
        {tab === "tests" && (
          <Button onClick={() => setCreating(true)}>
            <Icon d={ICONS.plus} />
            New test
          </Button>
        )}
      </div>

      <div role="tablist" className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
        {(
          [
            ["tests", "Tests"],
            ["monthly", "Monthly report"],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cx("shrink-0 border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors", tab === t ? "border-accent font-medium text-foreground" : "border-transparent text-muted hover:text-foreground")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "monthly" ? (
        <MonthlyReports />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <Input className="w-full sm:w-64" type="search" placeholder="Search tests…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <div className="w-40">
              <Select aria-label="Class" value={grade} onChange={(e) => { setGrade(e.target.value); setPage(1); }}>
                <option value="">All classes</option>
                {grades.map((g) => (
                  <option key={g} value={g}>
                    Class {g}
                  </option>
                ))}
              </Select>
            </div>
            <input
              type="month"
              aria-label="Month"
              value={month}
              onChange={(e) => { setMonth(e.target.value); setPage(1); }}
              className="h-10 rounded-lg border border-border bg-surface px-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm"
            />
            {month && (
              <Button variant="ghost" onClick={() => setMonth("")}>
                Any month
              </Button>
            )}
          </div>

          {list.error ? (
            <p className="text-sm text-danger">{list.error}</p>
          ) : !list.data ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : exams.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
                <Icon d="M9 4h6M8 4H6v16h12V4h-2M9 10h6M9 14h6M9 18h3" className="size-6" />
              </span>
              <p className="mt-4 font-medium">{grade || month || q ? "No tests match" : "No tests yet"}</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Create a test for a class, enter marks, and EduFlow works out totals, grades and ranks for you.</p>
              <Button className="mt-5" onClick={() => setCreating(true)}>
                <Icon d={ICONS.plus} />
                New test
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {exams.map((e) => {
                  const done = e.stats.completed >= e.stats.students && e.stats.students > 0;
                  return (
                    <button
                      key={e.id}
                      onClick={() => setOpenExam(e.id)}
                      className="group flex flex-col rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent/60 focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{e.name}</p>
                          <p className="text-xs text-muted">
                            Class {classLabel(e.grade, e.section)} · {formatDay(e.date, "short")}
                          </p>
                        </div>
                        {done ? <Badge tone="success">Marked</Badge> : e.stats.completed > 0 ? <Badge tone="accent">In progress</Badge> : <Badge>Not marked</Badge>}
                      </div>
                      <p className="mt-2 truncate text-xs text-muted">
                        {e.subjects.map((s) => s.name).join(" · ")} · out of {e.maxTotal}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-muted">
                          {e.stats.completed}/{e.stats.students} marked
                        </span>
                        {e.stats.average !== null && <span className="font-medium tabular-nums">avg {formatPct(e.stats.average)}</span>}
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${e.stats.students ? (e.stats.completed / e.stats.students) * 100 : 0}%` }} />
                      </div>
                      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent">
                        {done ? "View results" : "Enter marks"}
                        <Icon d={ICONS.chevronRight} className="transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
              {list.data.pagination.totalPages > 1 && (
                <div className="mt-4 overflow-hidden rounded-xl border border-border">
                  <Pager pagination={list.data.pagination} onPage={setPage} />
                </div>
              )}
            </>
          )}
        </>
      )}

      {creating && (
        <ExamEditor
          exam={null}
          defaults={{ grade }}
          onClose={() => setCreating(false)}
          onSaved={(v) => {
            setCreating(false);
            setRefreshKey((k) => k + 1);
            // Straight to marks entry
            setOpenExam(v.exam.id);
          }}
        />
      )}
    </div>
  );
}
