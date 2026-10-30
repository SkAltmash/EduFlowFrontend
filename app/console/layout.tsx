"use client";

import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { ConsoleShell } from "./_components/shell";

/** Super admin console: every section is its own page inside the same shell. */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="grid flex-1 place-items-center">
          <Spinner className="size-6 text-muted" />
        </main>
      }
    >
      <ConsoleShell>{children}</ConsoleShell>
    </Suspense>
  );
}
