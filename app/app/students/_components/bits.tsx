import { Badge, cx } from "@/components/ui";
import type { Student, StudentStatus } from "@/lib/students";

export const STATUS_TONE: Record<StudentStatus, "success" | "neutral" | "accent" | "danger"> = {
  active: "success",
  inactive: "neutral",
  graduated: "accent",
  left: "danger",
};

export const STATUS_LABEL: Record<StudentStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  graduated: "Graduated",
  left: "Left",
};

export function StatusBadge({ status }: { status: StudentStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

/** "5 - A · Roll 12", or "" when no class is set. */
export function classLabel(s: Pick<Student, "grade" | "section" | "rollNo">, withRoll = true) {
  if (!s.grade) return "";
  const cls = s.section ? `${s.grade} - ${s.section}` : s.grade;
  return withRoll && s.rollNo ? `${cls} · Roll ${s.rollNo}` : cls;
}

function hue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

/** Initials on a colour derived from the name. Mixing with theme tokens keeps it readable in light and dark. */
export function Avatar({ name, seed, size = "md" }: { name: string; seed: string; size?: "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const h = hue(seed);
  return (
    <span
      aria-hidden
      className={cx(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        size === "lg" ? "size-16 text-xl" : "size-10 text-sm"
      )}
      style={{
        backgroundColor: `color-mix(in oklab, hsl(${h} 70% 55%) 20%, var(--surface))`,
        color: `color-mix(in oklab, hsl(${h} 65% 45%) 75%, var(--foreground))`,
      }}
    >
      {initials || "?"}
    </span>
  );
}

export { Skeleton } from "@/components/ui";
