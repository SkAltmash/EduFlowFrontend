"use client";

import type { ReactNode } from "react";
import { useResource } from "@/components/data";
import { addressLine, loadSchool, type School } from "@/lib/school";

type Details = Pick<School, "name" | "address" | "city" | "state" | "pincode" | "phone" | "email" | "website">;

/** School name and contact lines heading printed documents. Fixed paper colours, like the documents themselves. */
export function Letterhead({ school, title, right }: { school: Details; title: string; right?: ReactNode }) {
  const contact = [school.phone && `Ph ${school.phone}`, school.email, school.website].filter(Boolean).join(" · ");
  const address = addressLine(school);
  return (
    <div className="flex items-start justify-between gap-4 border-b-2 border-zinc-900 pb-3">
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight">{school.name}</p>
        {address && <p className="mt-0.5 text-[11px] leading-snug text-zinc-600">{address}</p>}
        {contact && <p className="text-[11px] leading-snug text-zinc-600">{contact}</p>}
        <p className="mt-1 text-xs uppercase tracking-widest text-zinc-500">{title}</p>
      </div>
      {right && <div className="shrink-0 text-right">{right}</div>}
    </div>
  );
}

/** Loads the school's profile; until it arrives (or if it can't), shows `name` alone. */
export function SchoolLetterhead({ name, title, right }: { name: string; title: string; right?: ReactNode }) {
  const { data } = useResource(loadSchool, "school-profile");
  const school: Details = data ?? { name, address: "", city: "", state: "", pincode: "", phone: "", email: "", website: "" };
  return <Letterhead school={school} title={title} right={right} />;
}

/** The school's own note under a receipt (e.g. refund policy), if it set one. */
export function useSchoolProfile() {
  return useResource(loadSchool, "school-profile").data;
}
