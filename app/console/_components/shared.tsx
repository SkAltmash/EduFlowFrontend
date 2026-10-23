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

export interface Stats {
  tenants: { total: number; active: number; inactive: number; last30Days: number };
  users: { total: number; active: number; inactive: number; last30Days: number };
  memberships: number;
  activeSessions: number;
}

