import type { ReactNode } from "react";

/** One settings section: a titled card with an optional footer for its Save button. */
export function SettingsCard({ title, description, action, footer, children }: { title: string; description?: string; action?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-5 p-5">{children}</div>
      {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
    </section>
  );
}
