"use client";

// Small shared pieces for class-based pages (homework, timetable, notices…).
import { useResource } from "@/components/data";
import { Select } from "@/components/ui";
import { loadClassList } from "@/lib/academics";

const SUBJECT_HUES = [221, 152, 32, 276, 350, 190, 48, 12];
function subjectHue(name: string) {
  let h = 0;
  for (const c of name.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 997;
  return SUBJECT_HUES[h % SUBJECT_HUES.length];
}
export function SubjectChip({ name }: { name: string }) {
  const h = subjectHue(name);
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: `color-mix(in oklab, hsl(${h} 75% 50%) 14%, var(--surface))`, color: `color-mix(in oklab, hsl(${h} 70% 40%) 85%, var(--foreground))` }}
    >
      {name}
    </span>
  );
}

/** Class (and section) picker from the class list, or only the given options. */
export function ClassSelect({ value, onChange, only, allLabel = "All classes" }: { value: string; onChange: (v: string) => void; only?: { v: string; label: string }[] | null; allLabel?: string }) {
  const classList = useResource(loadClassList, "academics-classes");
  const options = only ?? (classList.data?.classes ?? []).flatMap((c) => [{ v: `${c.name}|`, label: `Class ${c.name}` }, ...c.sections.map((s) => ({ v: `${c.name}|${s}`, label: `${c.name} - ${s}` }))]);
  return (
    <Select aria-label="Class" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-40 text-sm">
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

