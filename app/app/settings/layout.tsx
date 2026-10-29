"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ICONS, Icon, Input, cx } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { SETTINGS_GROUPS, matches, sectionById, sectionsFor } from "./_components/sections";

/** Every settings page: a grouped, searchable menu beside the page on wider screens. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session } = useAuth();
  const role = session.status === "authenticated" ? session.role : undefined;
  const sections = sectionsFor(role === "owner" || role === "admin");
  const activeId = pathname.split("/")[3] ?? "";
  const [q, setQ] = useState("");
  const shown = sections.filter((s) => matches(s, q));
  // Pages with a side-by-side preview get the room: the menu shrinks to icons
  const compact = Boolean(sectionById(activeId)?.wide);

  if (compact) {
    return (
      <div className="md:grid md:grid-cols-[3rem_minmax(0,1fr)] md:gap-6">
        <aside className="hidden md:block">
          <nav aria-label="Settings" className="sticky top-20 flex flex-col items-center gap-1">
            <Link href="/app/settings" title="All settings" aria-label="All settings" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground">
              <Icon d="M4 13h6V4H4zM14 20h6v-9h-6zM14 4v3h6V4zM4 20h6v-3H4z" />
            </Link>
            <span aria-hidden className="my-1 h-px w-6 bg-border" />
            {sections.map((s) => (
              <Link
                key={s.id}
                href={`/app/settings/${s.id}`}
                title={s.label}
                aria-label={s.label}
                aria-current={s.id === activeId ? "page" : undefined}
                className={cx("grid size-10 place-items-center rounded-lg transition-colors", s.id === activeId ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-muted hover:text-foreground")}
              >
                <Icon d={s.icon} />
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    );
  }

  return (
    <div className="md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:gap-8">
      <aside className="hidden md:block">
        <div className="sticky top-20 space-y-4">
          <Link href="/app/settings" className={cx("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold", !activeId ? "bg-accent-soft text-accent" : "hover:bg-surface-muted")}>
            <Icon d="M4 13h6V4H4zM14 20h6v-9h-6zM14 4v3h6V4zM4 20h6v-3H4z" />
            All settings
          </Link>
          {/* The home page has its own big search box */}
          {sections.length > 3 && activeId && (
            <div className="relative">
              <Icon d={ICONS.search} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a setting" aria-label="Find a setting" className="h-9 pl-9 text-sm" />
            </div>
          )}
          <nav aria-label="Settings" className="space-y-4">
            {SETTINGS_GROUPS.map((g) => {
              const items = shown.filter((s) => s.group === g);
              if (!items.length) return null;
              return (
                <div key={g}>
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/80">{g}</p>
                  <ul className="space-y-0.5">
                    {items.map((s) => {
                      const active = s.id === activeId;
                      return (
                        <li key={s.id}>
                          <Link
                            href={`/app/settings/${s.id}`}
                            aria-current={active ? "page" : undefined}
                            className={cx("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors", active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-muted hover:text-foreground")}
                          >
                            <Icon d={s.icon} />
                            <span className="truncate">{s.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {shown.length === 0 && <p className="px-3 text-sm text-muted">No setting matches “{q}”.</p>}
          </nav>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
