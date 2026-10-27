"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { PageIcon } from "@/components/data";
import { ICONS, Icon, cx } from "@/components/ui";
import { WA_ICON } from "@/components/whatsapp-send";
import { useAuth } from "@/lib/auth";
import { AccountSettings } from "./_components/account";
import { BillingSettings } from "./_components/billing";
import { ClassesSettings } from "./_components/classes";
import { GradingCard } from "./_components/grading";
import { ProfileSettings } from "./_components/profile";
import { TeamSettings } from "./_components/team";
import { MessageHistory, WhatsAppSettingsCard } from "./_components/whatsapp";
import { YearSettings } from "./_components/years";

interface Tab {
  id: string;
  label: string;
  hint: string;
  icon: string;
  adminOnly?: boolean;
  render: () => ReactNode;
}

const TABS: Tab[] = [
  {
    id: "school",
    label: "School profile",
    hint: "Name, contact, address",
    icon: "M4 21V5a1 1 0 011-1h9a1 1 0 011 1v16M15 9h4a1 1 0 011 1v11M3 21h18M8 8h3M8 12h3M8 16h3",
    adminOnly: true,
    render: () => <ProfileSettings />,
  },
  {
    id: "classes",
    label: "Classes & subjects",
    hint: "Classes, sections, subjects",
    icon: "M3 7l9-4 9 4-9 4-9-4zM7 9.5V15c0 1.5 2.2 3 5 3s5-1.5 5-3V9.5M21 7v6",
    adminOnly: true,
    render: () => <ClassesSettings />,
  },
  {
    id: "year",
    label: "Academic year",
    hint: "Years and promotion",
    icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M12 13v4M10 15l2-2 2 2",
    adminOnly: true,
    render: () => <YearSettings />,
  },
  { id: "team", label: "Team & roles", hint: "Staff and their access", icon: ICONS.users, adminOnly: true, render: () => <TeamSettings /> },
  {
    id: "whatsapp",
    label: "WhatsApp",
    hint: "Messages to parents",
    icon: WA_ICON,
    adminOnly: true,
    render: () => (
      <div className="space-y-6">
        <WhatsAppSettingsCard />
        <MessageHistory />
      </div>
    ),
  },
  {
    id: "billing",
    label: "Plan & billing",
    hint: "Your EduFlow plan",
    icon: "M3 7h18v10H3zM3 11h18M7 15h3",
    adminOnly: true,
    render: () => <BillingSettings />,
  },
  { id: "grading", label: "Grading", hint: "Grades and pass marks", icon: "M4 20h16M6 16l4-11 4 11M7.5 12h5M18 7v6M15 10h6", adminOnly: true, render: () => <GradingCard /> },
  { id: "account", label: "My account", hint: "Name, password, theme", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0", render: () => <AccountSettings /> },
];

// The open section lives in the URL hash (#team), so it survives reloads and can be linked to
const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};
const useHash = () => useSyncExternalStore(subscribe, () => window.location.hash.slice(1), () => "");
function open(id: string) {
  window.location.hash = id;
}

export default function SettingsPage() {
  const { session } = useAuth();
  const role = session.status === "authenticated" ? session.role : undefined;
  const isAdmin = role === "owner" || role === "admin";
  const tabs = TABS.filter((t) => isAdmin || !t.adminOnly);
  const hash = useHash();
  const active = tabs.find((t) => t.id === hash) ?? tabs[0];
  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <PageIcon d={"M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"} />
        <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">{isAdmin ? "Your school, your team and how EduFlow works for you." : "Your account and preferences."}</p>
        </div>
      </div>

      <div className="md:grid md:grid-cols-[14rem_minmax(0,1fr)] md:gap-8">
        {/* Phones: a scrollable row of sections */}
        {tabs.length > 1 && (
          <nav aria-label="Settings sections" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => open(t.id)}
                aria-current={t.id === active.id ? "page" : undefined}
                className={cx(
                  "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors",
                  t.id === active.id ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-muted"
                )}
              >
                <Icon d={t.icon} />
                {t.label}
              </button>
            ))}
          </nav>
        )}

        {/* Desktop: a side menu */}
        <nav aria-label="Settings sections" className="hidden md:block">
          <ul className="sticky top-8 space-y-1">
            {tabs.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => open(t.id)}
                  aria-current={t.id === active.id ? "page" : undefined}
                  className={cx(
                    "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    t.id === active.id ? "bg-accent-soft" : "hover:bg-surface-muted"
                  )}
                >
                  <Icon d={t.icon} className={cx("mt-0.5", t.id === active.id ? "text-accent" : "text-muted")} />
                  <span className="min-w-0">
                    <span className={cx("block text-sm", t.id === active.id ? "font-medium text-accent" : "text-foreground")}>{t.label}</span>
                    <span className="block truncate text-xs text-muted">{t.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div key={active.id} className="min-w-0">
          {active.render()}
        </div>
      </div>
    </div>
  );
}
