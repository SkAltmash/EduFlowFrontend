"use client";

// Generic data-page building blocks shared by the console and the tenant app.
import { useCallback, useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { Alert, Button, Spinner, cx } from "@/components/ui";
import { ApiError } from "@/lib/api";

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type StatusFilter = "all" | "active" | "inactive";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function errorMessage(err: unknown) {
  if (err instanceof ApiError) return err.details?.[0]?.message ?? err.message;
  return "Something went wrong";
}

export function formatDate(value: string, withTime = false) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function query(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** Loads data whenever `key` changes; `reload()` refetches with the same key. */
export function useResource<T>(load: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  // Loading until the response for the current key/tick has arrived
  const requestKey = `${key}#${tick}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const run = useEffectEvent(load);

  useEffect(() => {
    let cancelled = false;
    run()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setSettledKey(requestKey));
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, setData, error, loading: settledKey !== requestKey, reload };
}

/** Debounces a value (used for search boxes). */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-xl border border-border bg-surface", className)}>{children}</div>;
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function TableState({ cols, loading, error, empty }: { cols: number; loading: boolean; error: string | null; empty: boolean }) {
  if (!loading && !error && !empty) return null;
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-10 text-center text-sm text-muted">
        {loading ? (
          <Spinner className="mx-auto" />
        ) : error ? (
          <span className="text-danger">{error}</span>
        ) : (
          "Nothing to show"
        )}
      </td>
    </tr>
  );
}

export function Pager({ pagination, onPage }: { pagination?: Pagination; onPage: (page: number) => void }) {
  if (!pagination || pagination.total === 0) return null;
  const { page, totalPages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const arrow = (d: string) => (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3 text-sm text-muted">
      <span className="tabular-nums">
        <span className="hidden sm:inline">Showing </span>
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        <span className="hidden tabular-nums sm:inline">
          Page {page} of {totalPages}
        </span>
        <Button variant="secondary" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {arrow("M15 6l-6 6 6 6")}
        </Button>
        <Button variant="secondary" size="icon-sm" aria-label="Next page" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          {arrow("M9 6l6 6-6 6")}
        </Button>
      </div>
    </div>
  );
}

export function StatusTabs({ value, onChange }: { value: StatusFilter; onChange: (v: StatusFilter) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm">
      {(["all", "active", "inactive"] as const).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={cx(
            "rounded-md px-3 py-1.5 capitalize transition-colors",
            value === s ? "bg-surface-muted font-medium" : "text-muted hover:text-foreground"
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

/**
 * Slide-over panel. `side="right"` is a full-height panel (full screen on phones);
 * `side="bottom"` is a sheet that rises from the bottom (used for mobile filters).
 */
export function Drawer({
  title,
  onClose,
  children,
  footer,
  side = "right",
  size = "md",
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Pinned under the scrolling body, e.g. Save / Cancel */
  footer?: ReactNode;
  side?: "right" | "bottom";
  /** Width of a right-side panel: "lg" for big tables (e.g. year-end promotion) */
  size?: "md" | "lg";
}) {
  const close = useEffectEvent(onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    // Keep the page behind from scrolling while the panel is open
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  const bottom = side === "bottom";

  return (
    <div className={cx("fixed inset-0 z-50 flex", bottom ? "items-end" : "justify-end")} role="dialog" aria-modal="true">
      <button aria-label="Close" className="absolute inset-0 bg-black/40 motion-safe:animate-fade-in" onClick={onClose} />
      <aside
        className={cx(
          "relative flex w-full flex-col bg-background shadow-xl",
          bottom
            ? "max-h-[88dvh] rounded-t-2xl border-t border-border motion-safe:animate-slide-in-up"
            : cx("h-dvh border-l border-border motion-safe:animate-slide-in-right", size === "lg" ? "max-w-3xl" : "max-w-lg")
        )}
      >
        {bottom && <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border" />}
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
          <div className="min-w-0 flex-1 font-semibold">{title}</div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </Button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain p-5">{children}</div>
        {footer && (
          <div className="border-t border-border bg-background px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

export function Notice({ message }: { message: { tone: "success" | "danger"; text: string } | null }) {
  return message ? <Alert tone={message.tone}>{message.text}</Alert> : null;
}
