"use client";

import Link from "next/link";
import { PageIcon } from "@/components/data";
import { ICONS, Icon, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { sectionById } from "./sections";

/** One settings page: title, what it's for, then its settings. */
export function SectionPage({ id }: { id: string }) {
  const { session } = useAuth();
  const section = sectionById(id)!;
  const role = session.status === "authenticated" ? session.role : undefined;
  const allowed = !section.adminOnly || role === "owner" || role === "admin";

  return (
    <div>
      {/* Phones have no side menu: a way back to all settings */}
      <Link href="/app/settings" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground md:hidden">
        <Icon d={ICONS.chevronLeft} />
        Settings
      </Link>
      <div className="mb-6 flex items-center gap-4">
        <PageIcon d={section.icon} />
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{section.group}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{section.label}</h1>
          <p className="mt-1 text-sm text-muted">{section.description}</p>
        </div>
      </div>
      {session.status !== "authenticated" ? (
        <Spinner className="mx-auto my-16" />
      ) : allowed ? (
        section.render()
      ) : (
        <p className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-sm text-muted">Only the school&apos;s owners and admins can change this.</p>
      )}
    </div>
  );
}
