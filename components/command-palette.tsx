"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ICONS, Icon, Spinner, cx } from "@/components/ui";
import { api } from "@/lib/api";
import type { Student } from "@/lib/students";

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  href: string;
  group: "Pages" | "Actions" | "Students";
}

export const OPEN_PALETTE_EVENT = "eduflow:palette";
export const openPalette = () => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));

/**
 * Ctrl/⌘ + K (or "/") search across the app: jump to a page, start a common action,
 * or open a student by name, admission number or guardian phone.
 */
export function CommandPalette({ pages, actions }: { pages: PaletteItem[]; actions: PaletteItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [students, setStudents] = useState<PaletteItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable=true]");
      if ((e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  // Student search, debounced
  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) return;
    let cancelled = false;
    const id = setTimeout(() => {
      setSearching(true);
      api<{ students: Student[] }>(`/api/students?search=${encodeURIComponent(term)}&limit=6&status=active`)
        .then((r) => {
          if (cancelled) return;
          setStudents(
            r.students.map((s) => ({
              id: `s:${s.id}`,
              label: s.fullName,
              hint: [s.admissionNo, s.grade && (s.section ? `${s.grade} - ${s.section}` : s.grade)].filter(Boolean).join(" · "),
              icon: ICONS.users,
              href: `/app/students?student=${s.id}`,
              group: "Students" as const,
            }))
          );
        })
        .catch(() => !cancelled && setStudents([]))
        .finally(() => !cancelled && setSearching(false));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [q, open]);

  if (!open) return null;

  const term = q.trim().toLowerCase();
  const match = (i: PaletteItem) => !term || i.label.toLowerCase().includes(term) || i.hint?.toLowerCase().includes(term);
  const items = [...pages.filter(match), ...actions.filter(match), ...(term.length >= 2 ? students : [])];
  const current = Math.min(active, Math.max(0, items.length - 1));

  const close = () => {
    setOpen(false);
    setQ("");
    setStudents([]);
    setActive(0);
  };
  const go = (item?: PaletteItem) => {
    if (!item) return;
    close();
    router.push(item.href);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
      <button aria-label="Close search" className="absolute inset-0 bg-black/40 backdrop-blur-[2px] motion-safe:animate-fade-in" onClick={close} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl motion-safe:animate-fade-in">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Icon d={ICONS.search} className="size-5 text-muted" />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(items[current]);
              }
            }}
            placeholder="Search students, pages and actions…"
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
          {searching ? <Spinner className="text-muted" /> : <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>}
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted">{term.length >= 2 && !searching ? `Nothing found for “${q}”.` : "Type to search."}</p>
          ) : (
            (["Pages", "Actions", "Students"] as const).map((group) => {
              const list = items.filter((i) => i.group === group);
              if (!list.length) return null;
              return (
                <div key={group} className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{group}</p>
                  {list.map((item) => {
                    const index = items.indexOf(item);
                    return (
                      <button
                        key={item.id}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => go(item)}
                        className={cx("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm", index === current ? "bg-accent-soft text-accent" : "hover:bg-surface-muted")}
                      >
                        <span className={cx("grid size-8 shrink-0 place-items-center rounded-lg", index === current ? "bg-accent text-accent-foreground" : "bg-surface-muted text-muted")}>
                          <Icon d={item.icon} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-foreground">{item.label}</span>
                          {item.hint && <span className="block truncate text-xs text-muted">{item.hint}</span>}
                        </span>
                        {index === current && <Icon d="M9 10l-4 4 4 4M5 14h11a4 4 0 004-4V5" className="text-muted" />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-border bg-surface px-4 py-2 text-[11px] text-muted">
          <span>
            <kbd className="font-sans">↑↓</kbd> to move
          </span>
          <span>
            <kbd className="font-sans">Enter</kbd> to open
          </span>
          <span className="ml-auto">
            <kbd className="font-sans">Ctrl K</kbd> anytime
          </span>
        </div>
      </div>
    </div>
  );
}
