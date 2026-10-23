import { cx } from "./ui";

// Mirrors strongPassword in backend/src/modules/auth/auth.validation.js
export const PASSWORD_RULES = [
  { label: "8+ characters", test: (v: string) => v.length >= 8 },
  { label: "Uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "Lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { label: "Number", test: (v: string) => /\d/.test(v) },
  { label: "Symbol", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
  { label: "At most 72 bytes", test: (v: string) => new TextEncoder().encode(v).length <= 72 },
];

export function isStrongPassword(value: string) {
  return PASSWORD_RULES.every((r) => r.test(value));
}

export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      {PASSWORD_RULES.slice(0, 5).map((r) => {
        const ok = r.test(value);
        return (
          <li key={r.label} className={cx("flex items-center gap-1.5", ok ? "text-success" : "text-muted")}>
            <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
              {ok ? <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" /> : <circle cx="8" cy="8" r="5" />}
            </svg>
            {r.label}
          </li>
        );
      })}
    </ul>
  );
}
