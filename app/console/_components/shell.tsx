"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Drawer } from "@/components/data";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge, Button, ICONS, Icon, Logo, Spinner, buttonClass, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { isEnteringSchool, useAuth } from "@/lib/auth";
import { Admins } from "./admins";
import { Announcements } from "./announcements";
import { AuditLogs } from "./audit-logs";
import { Dashboard } from "./dashboard";
import { Plans } from "./plans";
import { SchoolDrawer } from "./school-drawer";
import { Schools } from "./schools";
import { Security } from "./security";
import { PlatformSettings } from "./settings";
import { SystemHealth } from "./system";
import { Users } from "./users";

type Group = "Overview" | "Customers" | "Billing" | "Engage" | "Platform";

const TABS = [
  { id: "overview", label: "Dashboard", group: "Overview", icon: "M4 13h6V4H4zM14 20h6v-9h-6zM14 4v3h6V4zM4 20h6v-3H4z" },
  { id: "schools", label: "Schools", group: "Customers", icon: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" },
  { id: "users", label: "Users", group: "Customers", icon: ICONS.users },
  { id: "plans", label: "Plans", group: "Billing", icon: "M3 7h18v10H3zM3 11h18M7 15h3" },
  { id: "announcements", label: "Announcements", group: "Engage", icon: "M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1zM16 8a5 5 0 010 8M19 5a9 9 0 010 14" },
  { id: "system", label: "System health", group: "Platform", icon: "M3 12h4l3-8 4 16 3-8h4" },
  { id: "audit", label: "Audit log", group: "Platform", icon: "M9 4h6M8 4H6v16h12V4h-2M9 10h6M9 14h6M9 18h3" },
  { id: "admins", label: "Admins", group: "Platform", icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM12 11a2 2 0 100-4 2 2 0 000 4zM8.5 15.5c.6-1.5 2-2.5 3.5-2.5s2.9 1 3.5 2.5" },
  { id: "security", label: "Security", group: "Platform", icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4" },
  { id: "settings", label: "Settings", group: "Platform", icon: "M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4" },
] as const satisfies readonly { id: string; label: string; group: Group; icon: string }[];

export type ConsoleTab = (typeof TABS)[number]["id"];
const GROUPS: Group[] = ["Overview", "Customers", "Billing", "Engage", "Platform"];
/** Phones: these get a tab of their own, the rest go under "More". */
const PHONE_TABS: ConsoleTab[] = ["overview", "schools", "users", "plans"];
const MORE_ICON = "M5 12h.01M12 12h.01M19 12h.01";
const LOGOUT_ICON = "M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l5-5-5-5M15 12H4";

/** Console URL state: ?tab=schools&school=<id>. */
export function useConsoleNav() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab: ConsoleTab = TABS.some((t) => t.id === raw) ? (raw as ConsoleTab) : "overview";
  const school = params.get("school");
  const go = useCallback(
    (patch: { tab?: ConsoleTab; school?: string | null }) => {
      const next = new URLSearchParams(params.toString());
      if (patch.tab) next.set("tab", patch.tab);
      if (patch.school === null) next.delete("school");
      else if (patch.school) next.set("school", patch.school);
      if (next.get("tab") === "overview") next.delete("tab");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );
  return { tab, school, go };
}

export function ConsoleShell() {
  const router = useRouter();
  const { session, logout, leaveSchool } = useAuth();
  const { tab, school, go } = useConsoleNav();
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Changes made in a school's drawer refresh the list and dashboard behind it
  const [version, setVersion] = useState(0);

  // Back from inside a school (button, back arrow or link): switch to the console session again
  const inside = session.status === "authenticated" && Boolean(session.impersonating);
  useEffect(() => {
    if (inside && !isEnteringSchool()) void leaveSchool().catch(() => router.replace("/login"));
  }, [inside, leaveSchool, router]);

  useEffect(() => {
    if (session.status === "anonymous") router.replace("/login");
  }, [session.status, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable=true]");
      if ((e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (session.status !== "authenticated" || inside) {
    return (
      <main className="grid flex-1 place-items-center">
        <Spinner className="size-6 text-muted" />
      </main>
    );
  }

  const signOut = () => logout().then(() => router.replace("/login"));

  if (!session.isSuperAdmin) {
    return (
      <main className="grid flex-1 place-items-center px-4 text-center">
        <div>
          <h1 className="text-xl font-semibold">Super admins only</h1>
          <p className="mt-2 text-sm text-muted">You&apos;re signed in as {session.user.email}, which doesn&apos;t have platform access.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/" className={buttonClass("secondary")}>
              Go home
            </Link>
            <Button variant="ghost" onClick={signOut}>
              Switch account
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const current = TABS.find((t) => t.id === tab)!;
  const openSchool = (id: string) => go({ school: id });
  const more = TABS.filter((t) => !PHONE_TABS.includes(t.id));

  return (
    <div className="flex min-h-dvh flex-1 flex-col md:flex-row">
      {/* Phones: slim top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <Logo href="/console" />
            <Badge tone="accent">Console</Badge>
          </div>
          <button onClick={() => setSearchOpen(true)} aria-label="Search" className="grid size-9 place-items-center rounded-full text-muted active:bg-surface-muted">
            <Icon d={ICONS.search} className="size-5" />
          </button>
        </div>
      </header>

      {/* Desktop: sidebar */}
      <aside className="hidden border-r border-border bg-surface md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:shrink-0 md:flex-col">
        <div className="flex items-center justify-between pb-3 pl-5 pr-3 pt-4">
          <Logo href="/console" />
          <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">Console</span>
        </div>
        <nav aria-label="Console" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
          {GROUPS.flatMap((group, gi) => [
            <p key={`h:${group}`} className={cx("px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/80", gi > 0 && "pt-4")}>
              {group}
            </p>,
            ...TABS.filter((t) => t.group === group).map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  onClick={() => go({ tab: t.id, school: null })}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-muted hover:text-foreground"
                  )}
                >
                  {active && <span aria-hidden className="absolute inset-y-1.5 -left-3 w-1 rounded-r-full bg-accent" />}
                  <Icon d={t.icon} />
                  {t.label}
                </button>
              );
            }),
          ])}
        </nav>
        <div className="space-y-3 border-t border-border p-3">
          <div className="flex items-center gap-3 px-1">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{session.user.name.trim()[0]?.toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{session.user.name}</span>
              <span className="block truncate text-xs text-muted">{session.user.email}</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="text-danger" onClick={signOut}>
              <Icon d={LOGOUT_ICON} />
              Log out
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop: top bar */}
        <header className="sticky top-0 z-30 hidden h-14 items-center gap-4 border-b border-border bg-background/80 px-8 backdrop-blur-lg md:flex">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
            <span className="text-muted">Console</span>
            <Icon d={ICONS.chevronRight} className="size-3.5 shrink-0 text-muted/60" />
            <span className="truncate font-medium">{current.label}</span>
          </nav>
          <button
            onClick={() => setSearchOpen(true)}
            className="ml-auto flex h-9 w-72 items-center gap-2.5 rounded-lg border border-border bg-surface px-3 text-sm text-muted shadow-sm transition-colors hover:border-accent/40 hover:text-foreground lg:w-96"
          >
            <Icon d={ICONS.search} />
            <span className="flex-1 text-left">Search schools, people, phone…</span>
            <kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 font-sans text-[10px]">Ctrl K</kbd>
          </button>
        </header>

        <main className="app-canvas min-w-0 flex-1 px-4 pb-[calc(4rem+env(safe-area-inset-bottom)+1.5rem)] pt-6 sm:px-8 sm:pt-8 md:pb-10">
          <div className="mx-auto max-w-6xl">
            {tab === "overview" && <Dashboard key={version} onOpenSchool={openSchool} onGo={(t) => go({ tab: t })} />}
            {tab === "schools" && <Schools key={version} onOpenSchool={openSchool} />}
            {tab === "users" && <Users onOpenSchool={openSchool} />}
            {tab === "plans" && <Plans />}
            {tab === "announcements" && <Announcements />}
            {tab === "system" && <SystemHealth />}
            {tab === "audit" && <AuditLogs />}
            {tab === "security" && <Security />}
            {tab === "admins" && <Admins />}
            {tab === "settings" && <PlatformSettings />}
          </div>
        </main>
      </div>

      {/* Phones: bottom tabs */}
      <nav aria-label="Console" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
        <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {PHONE_TABS.map((id) => {
            const t = TABS.find((x) => x.id === id)!;
            const active = id === tab;
            return (
              <li key={id}>
                <button onClick={() => go({ tab: id, school: null })} aria-current={active ? "page" : undefined} className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] active:scale-95">
                  <span className={cx("grid h-7 w-14 place-items-center rounded-full transition-colors", active ? "bg-accent-soft text-accent" : "text-muted")}>
                    <Icon d={t.icon} className="size-5" />
                  </span>
                  <span className={cx("leading-none", active ? "font-semibold text-foreground" : "text-muted")}>{t.label === "Dashboard" ? "Home" : t.label}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button onClick={() => setMoreOpen(true)} className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] active:scale-95">
              <span className={cx("grid h-7 w-14 place-items-center rounded-full", more.some((t) => t.id === tab) ? "bg-accent-soft text-accent" : "text-muted")}>
                <Icon d={MORE_ICON} className="size-5 [stroke-width:3]" />
              </span>
              <span className="leading-none text-muted">More</span>
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <Drawer side="bottom" title="More" onClose={() => setMoreOpen(false)}>
          <nav className="grid grid-cols-3 gap-2">
            {more.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setMoreOpen(false);
                  go({ tab: t.id, school: null });
                }}
                className={cx("flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-medium", t.id === tab ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface")}
              >
                <Icon d={t.icon} className="size-5" />
                {t.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-accent-soft font-semibold text-accent">{session.user.name.trim()[0]?.toUpperCase()}</span>
            <div className="min-w-0">
              <p className="truncate font-medium">{session.user.name}</p>
              <p className="truncate text-sm text-muted">{session.user.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Theme</span>
            <ThemeToggle />
          </div>
          <Button variant="secondary" className="h-12 w-full text-danger" onClick={signOut}>
            <Icon d={LOGOUT_ICON} />
            Log out
          </Button>
        </Drawer>
      )}

      {searchOpen && (
        <GlobalSearch
          onClose={() => setSearchOpen(false)}
          onOpenSchool={(id) => {
            setSearchOpen(false);
            go({ tab: tab === "overview" ? "schools" : tab, school: id });
          }}
          onGo={(t) => {
            setSearchOpen(false);
            go({ tab: t, school: null });
          }}
        />
      )}

      {school && <SchoolDrawer id={school} onClose={() => go({ school: null })} onChanged={() => setVersion((v) => v + 1)} />}
    </div>
  );
}

interface SearchResult {
  schools: { id: string; name: string; slug: string }[];
  users: { id: string; name: string; email: string; schools: { id: string; name: string; role: string }[] }[];
}

/** Ctrl+K: find a school by name, ID, phone, email or city, or a person by name or email. */
function GlobalSearch({ onClose, onOpenSchool, onGo }: { onClose: () => void; onOpenSchool: (id: string) => void; onGo: (tab: ConsoleTab) => void }) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let cancelled = false;
    const id = setTimeout(() => {
      setBusy(true);
      api<SearchResult>(`/api/admin/search?q=${encodeURIComponent(term)}`)
        .then((r) => !cancelled && setResult(r))
        .catch(() => !cancelled && setResult({ schools: [], users: [] }))
        .finally(() => !cancelled && setBusy(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [q]);

  const term = q.trim();
  const pages = TABS.filter((t) => term && t.label.toLowerCase().includes(term.toLowerCase()));
  const shown = term.length >= 2 ? result : null;
  const empty = shown && !shown.schools.length && !shown.users.length && !pages.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Search">
      <button aria-label="Close" className="absolute inset-0 bg-black/40 motion-safe:animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Icon d={ICONS.search} className="text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="School name, ID, phone, city, person or email"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
          {busy && <Spinner className="size-4 text-muted" />}
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!term && <p className="px-3 py-6 text-center text-sm text-muted">Type at least 2 letters.</p>}
          {empty && <p className="px-3 py-6 text-center text-sm text-muted">Nothing found for “{term}”.</p>}
          {pages.length > 0 && (
            <SearchGroup title="Pages">
              {pages.map((t) => (
                <SearchRow key={t.id} icon={t.icon} title={t.label} onClick={() => onGo(t.id)} />
              ))}
            </SearchGroup>
          )}
          {shown && shown.schools.length > 0 && (
            <SearchGroup title="Schools">
              {shown.schools.map((s) => (
                <SearchRow key={s.id} icon={TABS[1].icon} title={s.name} sub={s.slug} onClick={() => onOpenSchool(s.id)} />
              ))}
            </SearchGroup>
          )}
          {shown && shown.users.length > 0 && (
            <SearchGroup title="People">
              {shown.users.map((u) => (
                <div key={u.id} className="rounded-lg px-3 py-2">
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-muted">{u.email}</p>
                  {u.schools.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {u.schools.map((s) => (
                        <button key={s.id} onClick={() => onOpenSchool(s.id)} className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-surface-muted">
                          {s.name} · <span className="text-muted">{s.role}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </SearchGroup>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</p>
      {children}
    </div>
  );
}

function SearchRow({ icon, title, sub, onClick }: { icon: string; title: string; sub?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface-muted focus-visible:bg-surface-muted">
      <span className="grid size-8 place-items-center rounded-lg bg-surface-muted text-muted">
        <Icon d={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
      <Icon d={ICONS.chevronRight} className="text-muted" />
    </button>
  );
}
