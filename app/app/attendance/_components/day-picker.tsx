"use client";

import { Button, ICONS, Icon } from "@/components/ui";
import { addDays, formatDay, localToday } from "@/lib/attendance";

/** ‹ Thursday, 23 October › with a native date input and a Today shortcut. Future days are blocked. */
export function DayPicker({ value, onChange }: { value: string; onChange: (day: string) => void }) {
  const today = localToday();
  const isToday = value === today;
  const label = isToday ? "Today" : value === addDays(today, -1) ? "Yesterday" : null;

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="icon" aria-label="Previous day" onClick={() => onChange(addDays(value, -1))}>
        <Icon d={ICONS.chevronLeft} />
      </Button>
      <label className="relative flex h-10 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm sm:flex-none sm:min-w-56">
        <Icon d={ICONS.calendar} className="text-muted" />
        <span className="truncate font-medium">
          {label && <span className="text-accent">{label} · </span>}
          {formatDay(value)}
        </span>
        {/* Invisible native picker over the label: opens the OS calendar on tap */}
        <input
          type="date"
          aria-label="Choose date"
          value={value}
          max={today}
          onChange={(e) => e.target.value && onChange(e.target.value > today ? today : e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:size-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
        />
      </label>
      <Button variant="secondary" size="icon" aria-label="Next day" disabled={value >= today} onClick={() => onChange(addDays(value, 1))}>
        <Icon d={ICONS.chevronRight} />
      </Button>
      {!isToday && (
        <Button variant="ghost" className="max-sm:hidden" onClick={() => onChange(today)}>
          Today
        </Button>
      )}
    </div>
  );
}
