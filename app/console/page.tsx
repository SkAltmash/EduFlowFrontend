"use client";

import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { ConsoleShell } from "./_components/shell";

/** Super admin console: schools, plans and billing, growth, announcements and platform health. */
export default function ConsolePage() {
  return (
    <Suspense
      fallback={
        <main className="grid flex-1 place-items-center">
          <Spinner className="size-6 text-muted" />
        </main>
      }
    >
      <ConsoleShell />
    </Suspense>
  );
}
