"use client";

import type { ReactNode } from "react";
import { useResource } from "@/components/data";
import { addressLine, loadSchool, type School } from "@/lib/school";

type Details = Pick<School, "name" | "address" | "city" | "state" | "pincode" | "phone" | "email" | "website"> & { logoUrl?: string };

/** School name and contact lines heading printed documents. Fixed paper colours, like the documents themselves. */
export function Letterhead({
  school,
  title,
  right,
  showLogo = true,
  showName = true,
  showContact = true,
  ruleClass = "border-zinc-900",
  titleClass = "text-zinc-500",
}: {
  school: Details;
  title: string;
  right?: ReactNode;
  showLogo?: boolean;
  /** Off when the logo already has the name; ignored without a logo */
  showName?: boolean;
  showContact?: boolean;
  /** Colour of the line under the letterhead */
  ruleClass?: string;
  titleClass?: string;
}) {
  const contact = showContact ? [school.phone && `Ph ${school.phone}`, school.email, school.website].filter(Boolean).join(" · ") : "";
  const address = showContact ? addressLine(school) : "";
  const logo = showLogo && school.logoUrl;
  // Never a header with neither name nor logo
  const logoOnly = Boolean(logo) && !showName;
  return (
    <div className={`flex items-start justify-between gap-4 border-b-2 pb-3 ${ruleClass}`}>
      {/* A plain <img> (not next/image) so it's captured in shared images and PDFs */}
      {logo && !logoOnly && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={school.logoUrl} alt="" crossOrigin="anonymous" className="size-14 shrink-0 rounded object-contain" />
      )}
      <div className="min-w-0 flex-1">
        {logoOnly ? (
          // The logo takes the name's place, above the address and title
          // eslint-disable-next-line @next/next/no-img-element
          <img src={school.logoUrl} alt={school.name} crossOrigin="anonymous" className="mb-1 h-16 w-auto max-w-full rounded object-contain object-left" />
        ) : (
          <p className="text-lg font-bold leading-tight">{school.name}</p>
        )}
        {address && <p className="mt-0.5 text-[11px] leading-snug text-zinc-600">{address}</p>}
        {contact && <p className="text-[11px] leading-snug text-zinc-600">{contact}</p>}
        {title && <p className={`mt-1 text-xs font-medium uppercase tracking-widest ${titleClass}`}>{title}</p>}
      </div>
      {right && <div className="shrink-0 text-right">{right}</div>}
    </div>
  );
}

/** Loads the school's profile; until it arrives (or if it can't), shows `name` alone. */
export function SchoolLetterhead({ name, ...props }: { name: string } & Omit<React.ComponentProps<typeof Letterhead>, "school">) {
  const { data } = useResource(loadSchool, "school-profile");
  const school: Details = data ?? { name, address: "", city: "", state: "", pincode: "", phone: "", email: "", website: "" };
  return <Letterhead school={school} {...props} />;
}

/** The school's own note under a receipt (e.g. refund policy), if it set one. */
export function useSchoolProfile() {
  return useResource(loadSchool, "school-profile").data;
}
