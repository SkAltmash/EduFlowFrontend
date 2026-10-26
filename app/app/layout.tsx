"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Drawer } from "@/components/data";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge, Button, ICONS, Icon, Logo, Spinner, cx } from "@/components/ui";
import { useAuth } from "@/lib/auth";

const NAV: { href: string; label: string; icon: string; roles?: string[] }[] = [
  { href: "/app/students", label: "Students", icon: ICONS.users },
  { href: "/app/attendance", label: "Attendance", icon: ICONS.calendarCheck },
  { href: "/app/exams", label: "Tests", icon: "M9 4h6M8 4H6v16h12V4h-2M9 10h6M9 14h6M9 18h3", roles: ["owner", "admin", "teacher"] },
  // Teachers don't handle money
  { href: "/app/fees", label: "Fees", icon: "M7 4h10M7 8h10M7 4c4 0 6 2 6 4s-2 4-6 4l7 8", roles: ["owner", "admin", "accountant"] },
  {
    href: "/app/settings",
    label: "Settings",
    icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
    roles: ["owner", "admin"],
  },
];

/** Shell for tenant members (owner, admin, teacher, accountant). */
export default function AppLayout({ children }: LayoutProps<"/app">) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (session.status === "anonymous") router.replace("/login");
    // Super admins have no tenant session; their home is the console
    else if (session.status === "authenticated" && !session.tenant) router.replace("/console");
  }, [session, router]);

  if (session.status !== "authenticated" || !session.tenant) {
    return (
      <main className="grid flex-1 place-items-center">
        <Spinner className="size-6 text-muted" />
      </main>
    );
  }

  const signOut = () => logout().then(() => router.replace("/login"));
  const initials = session.user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const nav = NAV.filter((item) => !item.roles || item.roles.includes(session.role ?? ""));

  const navLinks = (onNavigate?: () => void) =>
    nav.map((item) => (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={cx(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
          pathname.startsWith(item.href)
            ? "bg-accent-soft font-medium text-accent"
            : "text-muted hover:bg-surface-muted hover:text-foreground"
        )}
      >
        <Icon d={item.icon} />
        {item.label}
      </Link>
    ));

  return (
    <div className="flex min-h-dvh flex-1 flex-col md:flex-row">
      {/* Mobile top bar + section tabs */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Logo href="/app/students" />
            <span className="truncate border-l border-border pl-3 text-sm text-muted">{session.tenant.name}</span>
          </div>
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Account menu"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
          >
            {initials}
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "flex shrink-0 items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors",
                  active ? "border-accent font-medium text-foreground" : "border-transparent text-muted"
                )}
              >
                <Icon d={item.icon} className={active ? "text-accent" : undefined} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden border-r border-border bg-surface md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:flex-col">
        <div className="px-5 py-4">
          <Logo href="/app/students" />
        </div>
        <div className="mx-3 mb-3 rounded-lg bg-surface-muted px-3 py-2.5">
          <p className="truncate text-sm font-medium">{session.tenant.name}</p>
          <div className="mt-1">
            <Badge tone="accent">{session.role}</Badge>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">{navLinks()}</nav>
        <div className="border-t border-border p-4">
          <ThemeToggle className="mb-4" />
          <p className="truncate text-sm font-medium">{session.user.name}</p>
          <p className="truncate text-xs text-muted">{session.user.email}</p>
          <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={signOut}>
            Log out
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {menuOpen && (
        <Drawer side="bottom" title="Account" onClose={() => setMenuOpen(false)}>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-accent-soft font-semibold text-accent">{initials}</span>
            <div className="min-w-0">
              <p className="truncate font-medium">{session.user.name}</p>
              <p className="truncate text-sm text-muted">{session.user.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{session.tenant.name}</p>
              <p className="text-xs text-muted">Your role</p>
            </div>
            <Badge tone="accent">{session.role}</Badge>
          </div>
          <nav className="space-y-1">{navLinks(() => setMenuOpen(false))}</nav>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Theme</span>
            <ThemeToggle />
          </div>
          <Button variant="secondary" className="h-12 w-full" onClick={signOut}>
            Log out
          </Button>
        </Drawer>
      )}
    </div>
  );
}
