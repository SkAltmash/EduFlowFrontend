"use client";

import { useState } from "react";
import { Drawer, Pager, query, useDebounced, useResource, type Pagination } from "@/components/data";
import { Button, ICONS, Icon, Select, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { STUDENT_STATUSES, type Student, type StudentFilters, type StudentStatus } from "@/lib/students";
import { Avatar, STATUS_LABEL, Skeleton, StatusBadge, classLabel } from "./_components/bits";
import { ExportDrawer } from "./_components/export-drawer";
import { ImportDrawer } from "./_components/import-drawer";
import { StudentDrawer } from "./_components/student-drawer";

const SORTS = [
  ["newest", "Newest first"],
  ["oldest", "Oldest first"],
  ["name", "Name (A–Z)"],
  ["admissionNo", "Admission no"],
  ["grade", "Class & roll no"],
] as const;

type StatusFilter = StudentStatus | "all";

export default function StudentsPage() {
  const { session } = useAuth();
  const role = session.status === "authenticated" ? session.role : undefined;
  const canManage = role === "owner" || role === "admin";

  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  // undefined = closed, null = new student, string = existing student id
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const q = useDebounced(search.trim());

  const path = `/api/students${query({ search: q, grade, section, status, sort, page, limit: 25 })}`;
  const list = useResource(() => api<{ students: Student[]; pagination: Pagination }>(path), path);
  const filters = useResource(() => api<StudentFilters>("/api/students/filters"), "filters");
  const students = list.data?.students ?? [];
  const counts = filters.data?.counts;

  // Any filter change goes back to page 1
  const reset = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  const refresh = () => {
    list.reload();
    filters.reload();
  };

  const clearFilters = () => {
    setSearch("");
    setGrade("");
    setSection("");
    setStatus("all");
    setPage(1);
  };

  const extraFilters = [grade, section].filter(Boolean).length + (sort !== "newest" ? 1 : 0);
  const anyFilter = Boolean(q || grade || section || status !== "all");
  const firstLoad = list.loading && !list.data;
  const noStudentsAtAll = counts?.total === 0;

  const filterSelects = (
    <>
      <Select aria-label="Class" value={grade} onChange={(e) => reset(setGrade)(e.target.value)}>
        <option value="">All classes</option>
        {filters.data?.grades.map((g) => (
          <option key={g} value={g}>
            Class {g}
          </option>
        ))}
      </Select>
      <Select aria-label="Section" value={section} onChange={(e) => reset(setSection)(e.target.value)}>
        <option value="">All sections</option>
        {filters.data?.sections.map((s) => (
          <option key={s} value={s}>
            Section {s}
          </option>
        ))}
      </Select>
      <Select aria-label="Sort by" value={sort} onChange={(e) => reset(setSort)(e.target.value)}>
        {SORTS.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </Select>
    </>
  );

  return (
    <div className="pb-24 md:pb-0">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="mt-1 text-sm text-muted">
            {session.status === "authenticated" && session.tenant ? session.tenant.name : "Your institute"}
            {counts ? ` · ${counts.total.toLocaleString()} enrolled` : ""}
          </p>
        </div>
        {canManage && (
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="icon" className="sm:hidden" aria-label="Export" onClick={() => setExporting(true)}>
              <Icon d={ICONS.download} />
            </Button>
            <Button variant="secondary" size="icon" className="sm:hidden" aria-label="Import" onClick={() => setImporting(true)}>
              <Icon d={ICONS.upload} />
            </Button>
            {/* Wrapped: the buttons' own inline-flex would override `hidden` */}
            <div className="hidden gap-2 sm:flex">
              <Button variant="secondary" onClick={() => setExporting(true)}>
                <Icon d={ICONS.download} />
                Export
              </Button>
              <Button variant="secondary" onClick={() => setImporting(true)}>
                <Icon d={ICONS.upload} />
                Import
              </Button>
              <Button onClick={() => setOpenId(null)}>
                <Icon d={ICONS.plus} />
                Add student
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Status tiles double as the status filter */}
      <div className="-mx-4 mb-5 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0 sm:pb-0">
        {(["all", ...STUDENT_STATUSES] as StatusFilter[]).map((s) => {
          const value = s === "all" ? counts?.total : (counts?.[s] ?? 0);
          const selected = status === s;
          return (
            <button
              key={s}
              onClick={() => reset(setStatus)(s)}
              aria-pressed={selected}
              className={cx(
                "min-w-28 shrink-0 snap-start rounded-xl border px-4 py-3 text-left transition-colors sm:min-w-0",
                selected ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-muted"
              )}
            >
              <span className={cx("block text-xs font-medium", selected ? "text-accent" : "text-muted")}>
                {s === "all" ? "All students" : STATUS_LABEL[s]}
              </span>
              <span className="mt-1 block text-xl font-semibold tabular-nums">
                {value === undefined ? <Skeleton className="mt-1 h-6 w-10" /> : value.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex gap-2">
        <div className="relative min-w-0 flex-1 md:max-w-sm">
          <Icon d={ICONS.search} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            inputMode="search"
            placeholder="Search students…"
            aria-label="Search by name, admission number or phone"
            value={search}
            onChange={(e) => reset(setSearch)(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-9 text-base outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button
              aria-label="Clear search"
              onClick={() => reset(setSearch)("")}
              className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-surface-muted hover:text-foreground"
            >
              <Icon d={ICONS.x} className="size-3.5" />
            </button>
          )}
        </div>
        <div className="hidden gap-2 md:flex [&>select]:w-auto">{filterSelects}</div>
        <Button variant="secondary" className="relative md:hidden" onClick={() => setFiltersOpen(true)} aria-label="Filters and sort">
          <Icon d={ICONS.filter} />
          Filters
          {extraFilters > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
              {extraFilters}
            </span>
          )}
        </Button>
      </div>

      {/* Active filter chips */}
      {(grade || section || anyFilter) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {grade && <Chip label={`Class ${grade}`} onRemove={() => reset(setGrade)("")} />}
          {section && <Chip label={`Section ${section}`} onRemove={() => reset(setSection)("")} />}
          {status !== "all" && <Chip label={STATUS_LABEL[status]} onRemove={() => reset(setStatus)("all")} />}
          {anyFilter && (
            <button onClick={clearFilters} className="px-1 text-sm font-medium text-accent hover:underline">
              Clear all
            </button>
          )}
        </div>
      )}

      {/* List */}
      <div className={cx("overflow-hidden rounded-xl border border-border bg-surface transition-opacity", list.loading && list.data && "opacity-60")}>
        {list.error ? (
          <div className="px-4 py-14 text-center">
            <p className="text-sm text-danger">{list.error}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={list.reload}>
              Try again
            </Button>
          </div>
        ) : firstLoad ? (
          <LoadingRows />
        ) : students.length === 0 ? (
          <EmptyState
            filtered={anyFilter && !noStudentsAtAll}
            canManage={canManage}
            onAdd={() => setOpenId(null)}
            onImport={() => setImporting(true)}
            onClear={clearFilters}
          />
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-border bg-surface-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Class</th>
                  <th className="px-4 py-3 font-medium">Guardian</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.map((s) => (
                  <tr
                    key={s.id}
                    tabIndex={0}
                    onClick={() => setOpenId(s.id)}
                    onKeyDown={(e) => e.key === "Enter" && setOpenId(s.id)}
                    className="group cursor-pointer outline-none hover:bg-surface-muted focus-visible:bg-surface-muted"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.fullName} seed={s.id} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{s.fullName}</div>
                          <div className="font-mono text-xs text-muted">{s.admissionNo}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {s.grade ? (
                        <>
                          <div>{classLabel(s, false)}</div>
                          {s.rollNo && <div className="text-xs text-muted">Roll {s.rollNo}</div>}
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.guardianName || s.guardianPhone ? (
                        <>
                          <div className="truncate">{s.guardianName || "—"}</div>
                          {s.guardianPhone && (
                            <a
                              href={`tel:${s.guardianPhone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-muted hover:text-accent hover:underline"
                            >
                              {s.guardianPhone}
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <Icon d={ICONS.chevronRight} className="opacity-0 transition-opacity group-hover:opacity-100" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="divide-y divide-border md:hidden">
              {students.map((s) => (
                <li key={s.id} className="flex items-center gap-3 pr-2">
                  <button onClick={() => setOpenId(s.id)} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left active:bg-surface-muted">
                    <Avatar name={s.fullName} seed={s.id} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{s.fullName}</span>
                        {s.status !== "active" && <StatusBadge status={s.status} />}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        <span className="font-mono">{s.admissionNo}</span>
                        {s.grade && ` · Class ${classLabel(s)}`}
                      </span>
                      {s.guardianName && <span className="block truncate text-xs text-muted">{s.guardianName}</span>}
                    </span>
                  </button>
                  {s.guardianPhone && (
                    <a
                      href={`tel:${s.guardianPhone}`}
                      aria-label={`Call ${s.guardianName || "guardian"}`}
                      className="grid size-10 shrink-0 place-items-center rounded-full text-accent hover:bg-accent-soft active:bg-accent-soft"
                    >
                      <Icon d={ICONS.phone} />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        <Pager pagination={list.data?.pagination} onPage={setPage} />
      </div>

      {/* Mobile: floating add button */}
      {canManage && (
        <button
          onClick={() => setOpenId(null)}
          aria-label="Add student"
          className="fixed bottom-[calc(var(--bottom-nav-h,0px)+1rem)] right-5 z-30 grid size-14 place-items-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 transition-transform active:scale-95 sm:hidden"
        >
          <Icon d={ICONS.plus} className="size-6" />
        </button>
      )}

      {filtersOpen && (
        <Drawer
          side="bottom"
          title="Filters & sort"
          onClose={() => setFiltersOpen(false)}
          footer={
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setGrade("");
                  setSection("");
                  setSort("newest");
                  setPage(1);
                }}
              >
                Reset
              </Button>
              <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
                Show {list.data ? list.data.pagination.total.toLocaleString() : ""} students
              </Button>
            </div>
          }
        >
          <div className="space-y-3 [&>select]:h-12">{filterSelects}</div>
        </Drawer>
      )}

      {openId !== undefined && (
        <StudentDrawer studentId={openId} canManage={canManage} onClose={() => setOpenId(undefined)} onSaved={refresh} />
      )}
      {importing && <ImportDrawer onClose={() => setImporting(false)} onImported={refresh} />}
      {exporting && (
        <ExportDrawer
          filters={{ search: q, grade, section, status, sort }}
          filteredCount={list.data?.pagination.total}
          totalCount={counts?.total}
          onClose={() => setExporting(false)}
        />
      )}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-surface pl-3 pr-1 text-xs font-medium">
      {label}
      <button onClick={onRemove} aria-label={`Remove ${label} filter`} className="grid size-5 place-items-center rounded-full text-muted hover:bg-surface-muted hover:text-foreground">
        <Icon d={ICONS.x} className="size-3" />
      </button>
    </span>
  );
}

function LoadingRows() {
  return (
    <ul aria-label="Loading students" className="divide-y divide-border">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40 max-w-[60%]" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="hidden h-5 w-16 rounded-full md:block" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({
  filtered,
  canManage,
  onAdd,
  onImport,
  onClear,
}: {
  filtered: boolean;
  canManage: boolean;
  onAdd: () => void;
  onImport: () => void;
  onClear: () => void;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
        <Icon d={filtered ? ICONS.search : ICONS.users} className="size-6" />
      </span>
      {filtered ? (
        <>
          <p className="mt-4 font-medium">No matching students</p>
          <p className="mt-1 text-sm text-muted">Try a different search or remove some filters.</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={onClear}>
            Clear filters
          </Button>
        </>
      ) : (
        <>
          <p className="mt-4 font-medium">No students yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            {canManage
              ? "Add students one at a time, or bring in your existing list from an Excel or CSV file."
              : "Students will appear here once an owner or admin adds them."}
          </p>
          {canManage && (
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <Button onClick={onAdd}>
                <Icon d={ICONS.plus} />
                Add student
              </Button>
              <Button variant="secondary" onClick={onImport}>
                <Icon d={ICONS.upload} />
                Import CSV / Excel
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
