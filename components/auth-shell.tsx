import type { ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";
import { Logo } from "./ui";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: ReactNode; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="relative flex flex-1 items-center justify-center px-4 py-12">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">{children}</div>
        <p className="mt-6 text-center text-sm text-muted">{footer}</p>
      </div>
    </main>
  );
}

/** Maps the API's VALIDATION_ERROR details to { field: message } (first message wins). */
export function fieldErrors(details?: { field: string; message: string }[]) {
  const out: Record<string, string> = {};
  for (const d of details ?? []) out[d.field] ??= d.message;
  return out;
}
