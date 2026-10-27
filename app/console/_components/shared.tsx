"use client";

import type { Role, Tenant, User } from "@/lib/api";

export * from "@/components/data";

// ---------------------------------------------------------------------------
// API shapes for /api/admin
// ---------------------------------------------------------------------------

export interface AdminTenant extends Tenant {
  isActive: boolean;
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser extends User {
  isSuperAdmin: boolean;
  tenantCount?: number;
}

export interface Member {
  userId: string;
  name: string;
  email: string;
  isActive: boolean;
  role: Role;
  joinedAt: string;
}

export interface AuditLog {
  _id: string;
  action: string;
  targetType: string;
  targetId?: string;
  tenantId?: string;
  metadata?: unknown;
  ip?: string;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}


// ---------------------------------------------------------------------------
// Sharing login details
// ---------------------------------------------------------------------------

/** A random password that passes the strong-password rules (no look-alike characters). */
export function generatePassword() {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "@#$%&*!?"];
  const all = sets.join("");
  const pick = (s: string) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  const chars = [...sets.map(pick), ...Array.from({ length: 8 }, () => pick(all))];
  // Shuffle so the required characters aren't always first
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** WhatsApp link with someone's EduFlow login (they pick the contact if no phone is given). */
export function loginShareLink({ name, email, password, phone }: { name: string; email: string; password: string; phone?: string }) {
  const site = typeof window === "undefined" ? "" : window.location.origin;
  const text = [`Hi ${name.split(" ")[0]}, here are your EduFlow login details:`, "", `Link: ${site}/login`, `Email: ${email}`, `Password: ${password}`, "", "Please change your password after signing in (Settings → My account)."].join("\n");
  const digits = (phone ?? "").replace(/\D/g, "");
  const to = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}
