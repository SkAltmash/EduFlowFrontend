"use client";

import { Badge, ICONS, Icon, Skeleton, cx } from "@/components/ui";
import { ATTENDANCE_STATUSES, STATUS_META, className, formatRate, type ClassSummary } from "@/lib/attendance";

/** Proportional bar of present / late / absent / leave, with the unmarked part left empty. */
export function StatusBar({ counts, total, className: extra }: { counts: ClassSummary["counts"]; total: number; className?: string }) {
  return (
    <div className={cx("flex h-1.5 overflow-hidden rounded-full bg-surface-muted", extra)}>
      {total > 0 &&
        (["present", "late", "absent", "leave"] as const).map((s) =>
          counts[s] ? <span key={s} className={STATUS_META[s].dot} style={{ width: `${(counts[s] / total) * 100}%` }} /> : null
        )}
    </div>
  );
}

export function ClassGrid({
  classes,
  loading,
  onOpen,
}: {
  classes: ClassSummary[] | undefined;
  loading: boolean;
  onOpen: (c: ClassSummary) => void;
}) {
  if (loading && !classes) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border bg-surface p-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-1.5 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {classes?.map((c) => {
        const done = c.students > 0 && c.marked >= c.students;
        const started = c.marked > 0;
        return (
          <button
            key={`${c.grade}|${c.section}`}
            onClick={() => onOpen(c)}
            className="group rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent/60 hover:bg-surface-muted/50 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-muted">Class</p>
                <p className="text-xl font-semibold tracking-tight">{className(c.grade, c.section)}</p>
              </div>
              {done ? (
                <Badge tone="success">Done</Badge>
              ) : started ? (
                <Badge tone="accent">In progress</Badge>
              ) : (
                <Badge>Not marked</Badge>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted">
                {c.marked} / {c.students} marked
              </span>
              {started && <span className="font-medium tabular-nums">{formatRate(c.rate)}</span>}
            </div>
            <StatusBar counts={c.counts} total={c.students} className="mt-2" />
            {started && (
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                {ATTENDANCE_STATUSES.map((s) =>
                  c.counts[s] ? (
                    <span key={s} className="inline-flex items-center gap-1.5">
                      <span className={cx("size-2 rounded-full", STATUS_META[s].dot)} />
                      {c.counts[s]} {STATUS_META[s].label.toLowerCase()}
                    </span>
                  ) : null
                )}
              </div>
            )}
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent">
              {done ? "Review" : started ? "Continue" : "Take attendance"}
              <Icon d={ICONS.chevronRight} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
