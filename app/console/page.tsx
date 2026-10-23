"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Logo, Spinner, buttonClass, cx } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { AuditLogs } from "./_components/audit-logs";
import { Overview } from "./_components/overview";
import { Tenants } from "./_components/tenants";
import { Users } from "./_components/users";

const SECTIONS = [
  { id: "overview", label: "Overview", icon: "M4 13h6V4H4zM14 20h6V11h-6zM4 20h6v-3H4zM14 7h6V4h-6z" },
  { id: "tenants", label: "Organisations", icon: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" },
  { id: "users", label: "Users", icon: "M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4M12 12a3 3 0 100-6 3 3 0 000 6z" },
  { id: "audit", label: "Audit log", icon: "M9 4h6M8 4H6v16h12V4h-2M9 10h6M9 14h6M9 18h3" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default function ConsolePage() {
  const router = useRouter();
  const { session, logout } = useAuth();
  const [section, setSection] = useState<SectionId>("overview");

  useEffect(() => {
    if (session.status === "anonymous") router.replace("/login");
  }, [session.status, router]);

  if (session.status !== "authenticated") {
    return (
      <main className="grid flex-1 place-items-center">
        <Spinner className="size-6 text-muted" />
      </main>
    );
  }

  if (!session.isSuperAdmin) {
    return (
      <main className="grid flex-1 place-items-center px-4 text-center">
        <div>
          <h1 className="text-xl font-semibold">Super admins only</h1>
          <p className="mt-2 text-sm text-muted">
            You&apos;re signed in as {session.user.email}, which doesn&apos;t have platform access.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/" className={buttonClass("secondary")}>
              Go home
            </Link>
            <Button variant="ghost" onClick={() => logout().then(() => router.replace("/login"))}>
              Switch account
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <aside className="border-b border-border bg-surface md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-4 md:px-5">
          <Logo href="/console" />
          <span className="flex items-center gap-2">
            <ThemeToggle className="md:hidden" />
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
              Admin
            </span>
          </span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pb-0">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={cx(
                "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                section === s.id ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-muted hover:text-foreground"
              )}
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d={s.icon} />
              </svg>
              {s.label}
            </button>
          ))}
        </nav>
        <div className="hidden border-t border-border p-4 md:block">
          <ThemeToggle className="mb-4" />
          <p className="truncate text-sm font-medium">{session.user.name}</p>
          <p className="truncate text-xs text-muted">{session.user.email}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3 w-full"
            onClick={() => logout().then(() => router.replace("/login"))}
          >
            Log out
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-5xl">
          {section === "overview" && <Overview onOpenAudit={() => setSection("audit")} />}
          {section === "tenants" && <Tenants />}
          {section === "users" && <Users />}
          {section === "audit" && <AuditLogs />}
        </div>
      </main>
    </div>
  );
}
