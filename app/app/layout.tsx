"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CommandPalette, openPalette, type PaletteItem } from "@/components/command-palette";
import { Drawer } from "@/components/data";
import { PlanBanners, useTenantStatus } from "@/components/plan-banner";
import { InstallAppButton, InstallCard } from "@/components/pwa";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge, Button, ICONS, Icon, Logo, Spinner, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { schoolOpened, useAuth } from "@/lib/auth";
import { NAV_ICONS, NOTICES_CHANGED_EVENT } from "@/lib/classroom";
import { flushPending } from "@/lib/offline-attendance";
import type { Feature } from "@/lib/platform";

type NavGroup = "Overview" | "Academics" | "Communication" | "Finance" | "Admin";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  group: NavGroup;
  roles?: string[];
  /** Hidden when the school's plan doesn't include it */
  feature?: Feature;
}

const TEACHING = ["owner", "admin", "teacher"];

const SETTINGS_ICON =
  "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z";
const PANEL_ICON = "M4 5h16v14H4zM9 5v14";
const LOGOUT_ICON = "M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l5-5-5-5M15 12H4";
const USER_ICON = "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0";

const NAV: NavItem[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: "M4 13h6V4H4zM14 20h6v-9h-6zM14 4v3h6V4zM4 20h6v-3H4z", group: "Overview" },
  { href: "/app/students", label: "Students", icon: ICONS.users, group: "Academics" },
  // Attendance is for teaching staff; accountants only handle fees
  { href: "/app/attendance", label: "Attendance", icon: ICONS.calendarCheck, group: "Academics", roles: TEACHING },
  { href: "/app/homework", label: "Homework", icon: NAV_ICONS.homework, group: "Academics", roles: TEACHING, feature: "homework" },
  { href: "/app/exams", label: "Tests", icon: "M9 4h6M8 4H6v16h12V4h-2M9 10h6M9 14h6M9 18h3", group: "Academics", roles: TEACHING },
  // Rankings combine tests and attendance, so the same roles as both
  { href: "/app/performance", label: "Performance", icon: "M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3", group: "Academics", roles: TEACHING, feature: "performance" },
  { href: "/app/timetable", label: "Timetable", icon: NAV_ICONS.timetable, group: "Academics", roles: TEACHING, feature: "timetable" },
  { href: "/app/notices", label: "Notices", icon: NAV_ICONS.notices, group: "Communication" },
  // Teachers don't handle money
  { href: "/app/fees", label: "Fees", icon: "M7 4h10M7 8h10M7 4c4 0 6 2 6 4s-2 4-6 4l7 8", group: "Finance", roles: ["owner", "admin", "accountant"] },
  // Everyone has "My account"; owners and admins also get the school's settings
  { href: "/app/settings", label: "Settings", icon: SETTINGS_ICON, group: "Admin" },
];

const GROUPS: NavGroup[] = ["Overview", "Academics", "Communication", "Finance", "Admin"];

/** Phones fit five tabs; with more pages the fifth becomes "More". */
const MAX_TABS = 5;
/** Which pages keep a tab of their own on phones, most used first, per role. */
const MOBILE_PRIORITY: Record<string, string[]> = {
  owner: ["/app/dashboard", "/app/students", "/app/attendance", "/app/fees"],
  admin: ["/app/dashboard", "/app/students", "/app/attendance", "/app/fees"],
  teacher: ["/app/dashboard", "/app/attendance", "/app/homework", "/app/exams"],
  accountant: ["/app/dashboard", "/app/students", "/app/fees", "/app/notices"],
};

/** Quick actions offered in the command palette. */
const ACTIONS: (Omit<PaletteItem, "group"> & { roles?: string[]; feature?: Feature })[] = [
  { id: "a:attendance", label: "Mark attendance", hint: "Open today's register", icon: ICONS.calendarCheck, href: "/app/attendance", roles: TEACHING },
  { id: "a:homework", label: "Give homework", hint: "Post to a class and send to parents", icon: NAV_ICONS.homework, href: "/app/homework?new=1", roles: TEACHING, feature: "homework" },
  { id: "a:notice", label: "Post a notice", hint: "To staff or parents", icon: NAV_ICONS.notices, href: "/app/notices?new=1", roles: TEACHING },
  { id: "a:fee", label: "Collect fee", hint: "Record a payment and print a receipt", icon: "M7 4h10M7 8h10M7 4c4 0 6 2 6 4s-2 4-6 4l7 8", href: "/app/fees", roles: ["owner", "admin", "accountant"] },
  { id: "a:student", label: "Add student", icon: ICONS.plus, href: "/app/students", roles: ["owner", "admin"] },
  { id: "a:account", label: "Change my password", icon: USER_ICON, href: "/app/settings/account" },
];

/** Unread staff notices for the bell; refreshed every few minutes and when notices are read. */
function useUnreadNotices(enabled: boolean) {
  const [unread, setUnread] = useState(0);
  const load = useCallback(() => {
    api<{ unread: number }>("/api/notices")
      .then((r) => setUnread(r.unread))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!enabled) return;
    load();
    const id = setInterval(load, 180_000);
    window.addEventListener(NOTICES_CHANGED_EVENT, load);
    return () => {
      clearInterval(id);
      window.removeEventListener(NOTICES_CHANGED_EVENT, load);
    };
  }, [enabled, load]);
  return unread;
}
const MORE_ICON = "M5 12h.01M12 12h.01M19 12h.01";

// ---------------------------------------------------------------------------
// Collapsed sidebar, remembered per device
// ---------------------------------------------------------------------------

const COLLAPSED_KEY = "eduflow.sidebar.collapsed";
const COLLAPSED_EVENT = "eduflow:sidebar";

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COLLAPSED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function setCollapsed(value: boolean) {
  try {
    if (value) localStorage.setItem(COLLAPSED_KEY, "1");
    else localStorage.removeItem(COLLAPSED_KEY);
  } catch {
    // Storage blocked: the toggle still works until the page reloads
  }
  window.dispatchEvent(new Event(COLLAPSED_EVENT));
}

const useCollapsed = () => useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** Shell for tenant members (owner, admin, teacher, accountant). */
export default function AppLayout({ children }: LayoutProps<"/app">) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const collapsed = useCollapsed();
  const tenantStatus = useTenantStatus();
  const unread = useUnreadNotices(session.status === "authenticated" && Boolean(session.tenant));

  // A super admin entering from the console has arrived
  useEffect(() => {
    if (session.status === "authenticated" && session.impersonating) schoolOpened();
  }, [session]);

  // Attendance saved offline goes out as soon as there's a connection
  useEffect(() => {
    if (session.status !== "authenticated" || !session.tenant) return;
    const flush = () => void flushPending();
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [session]);

  useEffect(() => {
    if (session.status === "anonymous") router.replace("/login");
    // Super admins have no tenant session; their home is the console
    else if (session.status === "authenticated" && !session.tenant) router.replace("/console");
  }, [session, router]);

  // Ctrl/⌘ + B toggles the sidebar (not while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "b" || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true]")) return;
      e.preventDefault();
      setCollapsed(!readCollapsed());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const features = tenantStatus?.subscription.features;
  const nav = NAV.filter((item) => (!item.roles || item.roles.includes(session.role ?? "")) && (!item.feature || !features || features[item.feature]));
  const isActive = (href: string) => pathname.startsWith(href);
  const priority = MOBILE_PRIORITY[session.role ?? ""] ?? MOBILE_PRIORITY.owner;
  const tabs = nav.length <= MAX_TABS ? nav : priority.map((href) => nav.find((i) => i.href === href)).filter((i): i is NavItem => Boolean(i)).slice(0, MAX_TABS - 1);
  const current = nav.find((i) => isActive(i.href));
  const pages: PaletteItem[] = nav.map((i) => ({ id: `p:${i.href}`, label: i.label, hint: i.group, icon: i.icon, href: i.href, group: "Pages" }));
  const actions: PaletteItem[] = ACTIONS.filter((a) => (!a.roles || a.roles.includes(session.role ?? "")) && (!a.feature || !features || features[a.feature])).map((a) => ({ ...a, group: "Actions" }));
  // Everything else lives under "More" (in menu order)
  const more = nav.filter((i) => !tabs.includes(i));
  const moreActive = more.some((i) => isActive(i.href));
  const settingsInTabs = tabs.some((t) => t.href === "/app/settings");

  return (
    <div
      className={cx(
        // Fixed bars inside pages (save bars, add buttons) read these to stay clear of the navigation
        "flex min-h-dvh flex-1 flex-col md:flex-row",
        "[--bottom-nav-h:calc(4rem+env(safe-area-inset-bottom))] md:[--bottom-nav-h:0px]",
        collapsed ? "md:[--sidebar-w:4.5rem]" : "md:[--sidebar-w:15rem]"
      )}
    >
      {/* Phones: slim top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Logo href="/app/dashboard" />
            <span className="truncate border-l border-border pl-3 text-sm text-muted">{session.tenant.name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={openPalette} aria-label="Search" className="grid size-9 place-items-center rounded-full text-muted active:bg-surface-muted">
              <Icon d={NAV_ICONS.search} className="size-5" />
            </button>
            <BellLink unread={unread} />
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Account menu"
              className="ml-1 grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent transition-transform active:scale-95"
            >
              {initials}
            </button>
          </div>
        </div>
      </header>

      {/* Desktop: collapsible sidebar */}
      <aside
        className={cx(
          "hidden border-r border-border bg-surface transition-[width] duration-200 ease-out md:sticky md:top-0 md:flex md:h-dvh md:shrink-0 md:flex-col",
          "md:w-[var(--sidebar-w)]"
        )}
      >
        <div className={cx("flex items-center gap-2 pb-3 pt-4", collapsed ? "flex-col px-3" : "justify-between pl-5 pr-3")}>
          {collapsed ? (
            <Link href="/app/dashboard" aria-label="EduFlow home" className="grid size-10 place-items-center">
              <Image src="/images/brand/icon-192.png" alt="" width={36} height={36} className="size-9 rounded-lg" />
            </Link>
          ) : (
            <Logo href="/app/dashboard" />
          )}
          <Tip label={collapsed ? "Expand sidebar" : "Collapse sidebar"} hint="Ctrl B" show={collapsed}>
            <button
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              title={collapsed ? undefined : "Collapse sidebar (Ctrl+B)"}
              className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={PANEL_ICON} />
                <path d={collapsed ? "M13 10l2 2-2 2" : "M16 10l-2 2 2 2"} />
              </svg>
            </button>
          </Tip>
        </div>

        {/* School */}
        {collapsed ? (
          <Tip label={session.tenant.name} hint={session.role} show className="mx-auto mb-3">
            <span className="grid size-10 place-items-center rounded-lg bg-surface-muted text-sm font-semibold">{session.tenant.name.trim()[0]?.toUpperCase()}</span>
          </Tip>
        ) : (
          <div className="mx-3 mb-3 rounded-lg bg-surface-muted px-3 py-2.5">
            <p className="truncate text-sm font-medium">{session.tenant.name}</p>
            <div className="mt-1">
              <Badge tone="accent">{session.role}</Badge>
            </div>
          </div>
        )}

        <nav aria-label="Main" className={cx("flex flex-1 flex-col gap-0.5 overflow-y-auto pb-3", collapsed ? "items-center px-3" : "px-3")}>
          {GROUPS.flatMap((group, gi) => {
            const items = nav.filter((i) => i.group === group);
            if (!items.length) return [];
            const heading = collapsed ? (
              gi > 0 ? <span key={`h:${group}`} aria-hidden className="my-2 h-px w-6 bg-border" /> : null
            ) : (
              <p key={`h:${group}`} className={cx("px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/80", gi > 0 && "pt-4")}>
                {group}
              </p>
            );
            return [heading, ...items.map((item) => {
            const active = isActive(item.href);
            const badge = item.href === "/app/notices" && unread > 0 ? unread : 0;
            return (
              <Tip key={item.href} label={item.label} show={collapsed} className={collapsed ? undefined : "w-full"}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={cx(
                    "relative flex items-center rounded-lg text-sm transition-colors",
                    collapsed ? "size-10 justify-center" : "gap-2.5 px-3 py-2",
                    active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-muted hover:text-foreground"
                  )}
                >
                  {active && !collapsed && <span aria-hidden className="absolute inset-y-1.5 -left-3 w-1 rounded-r-full bg-accent" />}
                  <Icon d={item.icon} className={collapsed ? "size-[18px]" : undefined} />
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {badge > 0 &&
                    (collapsed ? (
                      <span aria-label={`${badge} unread`} className="absolute right-1.5 top-1.5 size-2 rounded-full bg-danger ring-2 ring-surface" />
                    ) : (
                      <span className="rounded-full bg-danger px-1.5 text-[10px] font-semibold leading-4 text-white">{badge}</span>
                    ))}
                </Link>
              </Tip>
            );
          })];
          })}
        </nav>

        <div className={cx("border-t border-border", collapsed ? "flex justify-center p-3" : "p-3")}>
          <UserMenu
            collapsed={collapsed}
            initials={initials}
            name={session.user.name}
            email={session.user.email}
            onSignOut={signOut}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop: top bar with where you are, search and notices */}
        <header className="sticky top-0 z-30 hidden h-14 items-center gap-4 border-b border-border bg-background/80 px-8 backdrop-blur-lg md:flex">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
            <span className="truncate text-muted">{session.tenant.name}</span>
            {current && (
              <>
                <Icon d={ICONS.chevronRight} className="size-3.5 shrink-0 text-muted/60" />
                <span className="truncate font-medium">{current.label}</span>
              </>
            )}
          </nav>
          <button
            onClick={openPalette}
            className="ml-auto flex h-9 w-72 items-center gap-2.5 rounded-lg border border-border bg-surface px-3 text-sm text-muted shadow-sm transition-colors hover:border-accent/40 hover:text-foreground lg:w-80"
          >
            <Icon d={NAV_ICONS.search} />
            <span className="flex-1 text-left">Search students, pages…</span>
            <kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 font-sans text-[10px]">Ctrl K</kbd>
          </button>
          <BellLink unread={unread} />
        </header>

        <main className="app-canvas min-w-0 flex-1 px-4 pb-[calc(var(--bottom-nav-h)+1.5rem)] pt-6 sm:px-8 sm:pt-8 md:pb-10">
          <div className="mx-auto max-w-6xl">
            {session.impersonating && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-2.5 text-sm">
                <span>
                  <strong>Super admin view.</strong> You&apos;re inside {session.tenant.name} as its owner; everything you do is logged.
                </span>
                {/* The console switches back to the super admin session when it opens */}
                <Button size="sm" variant="secondary" onClick={() => router.push("/console/schools")}>
                  Back to console
                </Button>
              </div>
            )}
            {pathname === "/app/dashboard" && <InstallCard className="mb-4" />}
            <PlanBanners canManage={session.role === "owner" || session.role === "admin"} />
            {children}
          </div>
        </main>
      </div>

      <CommandPalette pages={pages} actions={actions} />

      {/* Phones: bottom tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-lg" style={{ gridTemplateColumns: `repeat(${tabs.length + (more.length ? 1 : 0)}, minmax(0, 1fr))` }}>
          {tabs.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="flex h-full flex-col items-center justify-center gap-1 text-[11px] transition-transform active:scale-95"
                >
                  <span
                    className={cx(
                      "grid h-7 w-14 place-items-center rounded-full transition-colors duration-200",
                      active ? "bg-accent-soft text-accent" : "text-muted"
                    )}
                  >
                    <Icon d={item.icon} className="size-5" />
                  </span>
                  <span className={cx("max-w-full truncate px-1 leading-none", active ? "font-semibold text-foreground" : "text-muted")}>{item.label}</span>
                </Link>
              </li>
            );
          })}
          {more.length > 0 && (
            <li>
              <button
                onClick={() => setMenuOpen(true)}
                aria-current={moreActive ? "page" : undefined}
                className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] transition-transform active:scale-95"
              >
                <span className={cx("grid h-7 w-14 place-items-center rounded-full transition-colors duration-200", moreActive ? "bg-accent-soft text-accent" : "text-muted")}>
                  <Icon d={MORE_ICON} className="size-5 [stroke-width:3]" />
                </span>
                <span className={cx("leading-none", moreActive ? "font-semibold text-foreground" : "text-muted")}>More</span>
              </button>
            </li>
          )}
        </ul>
      </nav>

      {menuOpen && (
        <Drawer side="bottom" title={more.length ? "More" : "Account"} onClose={() => setMenuOpen(false)}>
          {more.filter((i) => i.href !== "/app/settings").length > 0 && (
            <nav className="grid grid-cols-3 gap-2">
              {more
                .filter((i) => i.href !== "/app/settings")
                .map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cx(
                      "flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-medium transition-colors",
                      isActive(item.href) ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface hover:bg-surface-muted"
                    )}
                  >
                    <Icon d={item.icon} className="size-5" />
                    {item.label}
                  </Link>
                ))}
            </nav>
          )}
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
          <nav className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {!settingsInTabs && (
              <Link href="/app/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface-muted">
                <Icon d={SETTINGS_ICON} className="text-muted" />
                <span className="flex-1">Settings</span>
                <Icon d={ICONS.chevronRight} className="text-muted" />
              </Link>
            )}
            <Link href="/app/settings/account" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface-muted">
              <Icon d={USER_ICON} className="text-muted" />
              <span className="flex-1">My account</span>
              <Icon d={ICONS.chevronRight} className="text-muted" />
            </Link>
          </nav>
          <InstallAppButton className="rounded-xl border border-border bg-surface p-1.5" onDone={() => setMenuOpen(false)} />
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
    </div>
  );
}

/** Label shown beside an item when the sidebar is collapsed (on hover or keyboard focus). */
function Tip({ label, hint, show, className, children }: { label: string; hint?: string; show: boolean; className?: string; children: React.ReactNode }) {
  if (!show) return <div className={className}>{children}</div>;
  return (
    <div className={cx("group/tip relative", className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 translate-x-[-4px] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-all duration-150 group-hover/tip:translate-x-0 group-hover/tip:opacity-100 group-has-[:focus-visible]/tip:translate-x-0 group-has-[:focus-visible]/tip:opacity-100"
      >
        {label}
        {hint && <span className="ml-1.5 font-normal capitalize opacity-60">{hint}</span>}
      </span>
    </div>
  );
}

/** The signed-in user at the bottom of the sidebar; opens a small menu upwards (or sideways when collapsed). */
function UserMenu({ collapsed, initials, name, email, onSignOut }: { collapsed: boolean; initials: string; name: string; email: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const avatar = <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{initials}</span>;

  return (
    <div ref={ref} className={cx("relative", !collapsed && "w-full")}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={collapsed ? `Account: ${name}` : undefined}
        className={cx(
          "flex items-center gap-3 rounded-lg text-left transition-colors hover:bg-surface-muted",
          collapsed ? "p-0.5" : "w-full p-2",
          open && "bg-surface-muted"
        )}
      >
        {avatar}
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{name}</span>
              <span className="block truncate text-xs text-muted">{email}</span>
            </span>
            <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
            </svg>
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cx(
            "absolute z-50 w-64 rounded-xl border border-border bg-background p-1.5 shadow-xl",
            collapsed ? "bottom-0 left-full ml-3" : "inset-x-0 bottom-full mb-2 w-auto"
          )}
        >
          <div className="flex items-center gap-3 px-2.5 py-2">
            {avatar}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-muted">{email}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link role="menuitem" href="/app/settings/account" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-surface-muted">
            <Icon d={USER_ICON} className="text-muted" />
            My account
          </Link>
          <InstallAppButton onDone={() => setOpen(false)} />
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
            <span className="text-sm">Theme</span>
            <ThemeToggle />
          </div>
          <div className="my-1 h-px bg-border" />
          <button role="menuitem" onClick={onSignOut} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-danger hover:bg-danger-soft">
            <Icon d={LOGOUT_ICON} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

/** Notices with the unread count. */
function BellLink({ unread }: { unread: number }) {
  return (
    <Link href="/app/notices" aria-label={unread ? `Notices, ${unread} unread` : "Notices"} className="relative grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-muted hover:text-foreground">
      <Icon d={NAV_ICONS.bell} className="size-5" />
      {unread > 0 && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold leading-4 text-white ring-2 ring-background">{unread > 9 ? "9+" : unread}</span>}
    </Link>
  );
}
