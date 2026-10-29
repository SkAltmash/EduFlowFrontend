"use client";

import type { ReactNode } from "react";
import { ICONS } from "@/components/ui";
import { WA_ICON } from "@/components/whatsapp-send";
import { AccountSettings } from "./account";
import { BillingSettings } from "./billing";
import { ClassesSettings } from "./classes";
import { GradingCard } from "./grading";
import { ProfileSettings } from "./profile";
import { ReceiptSettingsCard } from "./receipt-settings";
import { ReportCardSettingsCard } from "./report-card-settings";
import { TeamSettings } from "./team";
import { MessageHistory, WhatsAppSettingsCard } from "./whatsapp";
import { YearSettings } from "./years";

export type SettingsGroup = "School" | "People" | "Fees & results" | "Messages" | "Plan" | "You";
export const SETTINGS_GROUPS: SettingsGroup[] = ["School", "People", "Fees & results", "Messages", "Plan", "You"];

export interface SettingsSection {
  id: string;
  label: string;
  /** One line under the label in menus */
  hint: string;
  /** A sentence at the top of the page and on the Settings home cards */
  description: string;
  icon: string;
  group: SettingsGroup;
  adminOnly?: boolean;
  /** Extra words the search box matches */
  keywords: string;
  /** Pages with a side preview use the full width */
  wide?: boolean;
  render: () => ReactNode;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "school",
    label: "School profile",
    hint: "Name, logo, contact, address",
    description: "Your school or tuition centre's name, logo and contact details. They head every receipt and report card.",
    icon: "M4 21V5a1 1 0 011-1h9a1 1 0 011 1v16M15 9h4a1 1 0 011 1v11M3 21h18M8 8h3M8 12h3M8 16h3",
    group: "School",
    adminOnly: true,
    keywords: "name logo phone email address city state pincode board type tuition website",
    render: () => <ProfileSettings />,
  },
  {
    id: "classes",
    label: "Classes & subjects",
    hint: "Classes, sections, subjects",
    description: "The classes or batches you teach, their sections and subjects. Used everywhere students are grouped.",
    icon: "M3 7l9-4 9 4-9 4-9-4zM7 9.5V15c0 1.5 2.2 3 5 3s5-1.5 5-3V9.5M21 7v6",
    group: "School",
    adminOnly: true,
    keywords: "class section batch subject standard division",
    render: () => <ClassesSettings />,
  },
  {
    id: "year",
    label: "Academic year",
    hint: "Years and promotion",
    description: "Start a new academic year and promote students to their next class.",
    icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M12 13v4M10 15l2-2 2 2",
    group: "School",
    adminOnly: true,
    keywords: "session promote promotion new year april",
    render: () => <YearSettings />,
  },
  {
    id: "team",
    label: "Team & roles",
    hint: "Staff and their access",
    description: "Invite teachers, accountants and admins, and choose what each of them can see and do.",
    icon: ICONS.users,
    group: "People",
    adminOnly: true,
    keywords: "staff teacher accountant admin owner invite role permission member",
    render: () => <TeamSettings />,
  },
  {
    id: "receipts",
    label: "Receipts",
    hint: "Look, numbering, copies",
    description: "How fee receipts look: colour, title, what's shown, receipt numbers, paper size and copies.",
    icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
    group: "Fees & results",
    adminOnly: true,
    keywords: "receipt fee number prefix signature pdf print copy colour note",
    wide: true,
    render: () => <ReceiptSettingsCard />,
  },
  {
    id: "report-cards",
    label: "Report cards",
    hint: "Results look, signatures",
    description: "How test report cards and monthly progress reports look: colour, titles, what's shown and signatures.",
    icon: "M9 4h6M8 4H6v16h12V4h-2M9 10h6M9 14h6M9 18h3",
    group: "Fees & results",
    adminOnly: true,
    keywords: "report card result marksheet progress signature rank pdf",
    wide: true,
    render: () => <ReportCardSettingsCard />,
  },
  {
    id: "grading",
    label: "Grading",
    hint: "Grades and pass marks",
    description: "The grading scale and pass percentage used for test results.",
    icon: "M4 20h16M6 16l4-11 4 11M7.5 12h5M18 7v6M15 10h6",
    group: "Fees & results",
    adminOnly: true,
    keywords: "grade cbse pass marks percentage scale",
    render: () => <GradingCard />,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    hint: "Messages to parents",
    description: "Send receipts, reminders, absence alerts and report cards to parents on WhatsApp, and see what was sent.",
    icon: WA_ICON,
    group: "Messages",
    adminOnly: true,
    keywords: "whatsapp message parents sms template token api history",
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
    description: "Your EduFlow plan, what it includes, when it renews, and how to upgrade.",
    icon: "M3 7h18v10H3zM3 11h18M7 15h3",
    group: "Plan",
    adminOnly: true,
    keywords: "plan subscription trial renew upgrade pro basic payment",
    render: () => <BillingSettings />,
  },
  {
    id: "account",
    label: "My account",
    hint: "Name, password, theme",
    description: "Your own name, password and theme.",
    icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
    group: "You",
    keywords: "password name email theme dark light profile",
    render: () => <AccountSettings />,
  },
];

export const sectionById = (id: string) => SETTINGS_SECTIONS.find((s) => s.id === id);

export function sectionsFor(isAdmin: boolean) {
  return SETTINGS_SECTIONS.filter((s) => isAdmin || !s.adminOnly);
}

export function matches(s: SettingsSection, q: string) {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  return [s.label, s.hint, s.description, s.keywords, s.group].join(" ").toLowerCase().includes(term);
}
