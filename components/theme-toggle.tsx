"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY as STORAGE_KEY, type Theme } from "@/lib/theme";
import { cx } from "./ui";

function readTheme(): Theme {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "light" || t === "dark" ? t : "system";
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    if (theme === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage blocked (private mode): the choice just won't persist
  }
}

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  {
    value: "light",
    label: "Light",
    icon: "M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 16a4 4 0 100-8 4 4 0 000 8z",
  },
  { value: "dark", label: "Dark", icon: "M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" },
  { value: "system", label: "System", icon: "M3 5h18v11H3zM8 20h8M12 16v4" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cx("inline-flex rounded-lg border border-border bg-surface p-0.5", className)}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={theme === o.value}
          title={o.label}
          onClick={() => applyTheme(o.value)}
          className={cx(
            "grid size-7 place-items-center rounded-md transition-colors",
            theme === o.value ? "bg-surface-muted text-foreground" : "text-muted hover:text-foreground"
          )}
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d={o.icon} />
          </svg>
          <span className="sr-only">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
