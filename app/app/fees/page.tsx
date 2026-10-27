"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, ICONS, Icon, cx } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { CollectDrawer } from "./_components/collect-drawer";
import { FeeRegister } from "./_components/fee-register";
import { LedgerDrawer } from "./_components/ledger-drawer";
import { Overview } from "./_components/overview";
import { Payments } from "./_components/payments";
import { Plans } from "./_components/plans";
import { ReceiptDrawer } from "./_components/receipt";
import { PageIcon } from "@/components/data";
import { ConcessionsTab } from "./_components/concessions-tab";

type Tab = "overview" | "students" | "payments" | "plans" | "concessions";
const TABS: [Tab, string][] = [
  ["overview", "Overview"],
  ["students", "Students"],
  ["payments", "Payments"],
  ["plans", "Fee plans"],
  ["concessions", "Concessions"],
];

export default function FeesPage() {
  // useSearchParams needs a Suspense boundary; the page itself renders on the client
  return (
    <Suspense fallback={null}>
      <FeesView />
    </Suspense>
  );
}

const TAB_IDS = TABS.map(([t]) => t);

/**
 * The open tab (?tab=), fee account (?student=) and collect form (?collect=<id>|new) live in
 * the URL, so they can be linked, reloaded and closed with Back.
 */
function FeesView() {
  const { session } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const role = session.status === "authenticated" ? session.role : undefined;
  const allowed = role === "owner" || role === "admin" || role === "accountant";
  const canVoid = role === "owner" || role === "admin";

  const tabParam = params.get("tab") as Tab | null;
  const tab: Tab = tabParam && TAB_IDS.includes(tabParam) ? tabParam : "overview";
  const ledgerId = params.get("student");
  const collectParam = params.get("collect");
  // undefined = closed, null = pick a student first
  const collectFor: string | null | undefined = collectParam === null ? undefined : collectParam === "new" ? null : collectParam;
  /** Changes some of the URL's parameters; opening something adds a history entry so Back closes it. */
  const go = (patch: Record<string, string | null>, push = true) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const url = next.toString() ? `/app/fees?${next}` : "/app/fees";
    if (push) router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  };
  const setTab = (t: Tab) => go({ tab: t === "overview" ? null : t }, false);
  const setLedgerId = (id: string | null) => go({ student: id, collect: null }, id !== null);
  const setCollectFor = (id: string | null | undefined) => go({ collect: id === undefined ? null : (id ?? "new"), student: null }, id !== undefined);
  // Bumped after any change so every list refetches
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [registerKey, setRegisterKey] = useState(0);

  if (!allowed) {
    return (
      <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center">
        <p className="font-medium">Fees are managed by owners, admins and accountants</p>
        <p className="mt-1 text-sm text-muted">Ask an admin if you need access.</p>
      </div>
    );
  }

  return (
    <div className="pb-24 sm:pb-0">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <PageIcon d="M7 4h10M7 8h10M7 4c4 0 6 2 6 4s-2 4-6 4l7 8" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Fees</h1>
            <p className="mt-1 text-sm text-muted">Plans, dues, collections and receipts.</p>
          </div>
        </div>
        <Button onClick={() => setCollectFor(null)} className="shrink-0">
          <Icon d={ICONS.plus} />
          Collect fee
        </Button>
      </div>

      <div role="tablist" className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cx(
              "shrink-0 border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors",
              tab === t ? "border-accent font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Overview
          refreshKey={refreshKey}
          onOpenReceipt={setReceiptId}
          onViewOverdue={() => {
            setRegisterKey((k) => k + 1);
            setTab("students");
          }}
        />
      )}
      {tab === "students" && <FeeRegisterWithDefault key={registerKey} overdueFirst={registerKey > 0} refreshKey={refreshKey} onOpen={setLedgerId} onCollect={setCollectFor} />}
      {tab === "payments" && <Payments refreshKey={refreshKey} onOpen={setReceiptId} />}
      {tab === "plans" && <Plans onChanged={refresh} />}
      {tab === "concessions" && <ConcessionsTab onOpen={setLedgerId} refreshKey={refreshKey} />}

      {/* Phones: labelled floating button within thumb reach, above the tab bar */}
      <button
        onClick={() => setCollectFor(null)}
        className="fixed bottom-[calc(var(--bottom-nav-h,0px)+1rem)] right-4 z-30 flex h-12 items-center gap-2 rounded-full bg-accent pl-4 pr-5 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/30 transition-transform active:scale-95 sm:hidden"
      >
        <span className="text-lg leading-none">₹</span>
        Collect fee
      </button>

      {ledgerId && (
        <LedgerDrawer
          studentId={ledgerId}
          onClose={() => setLedgerId(null)}
          // One URL change: closes the account and opens the collect form for this student
          onCollect={() => setCollectFor(ledgerId)}
          onOpenReceipt={(id) => setReceiptId(id)}
          onChanged={refresh}
        />
      )}
      {collectFor !== undefined && <CollectDrawer studentId={collectFor ?? undefined} onClose={() => setCollectFor(undefined)} onCollected={refresh} />}
      {receiptId && <ReceiptDrawer paymentId={receiptId} canVoid={canVoid} onClose={() => setReceiptId(null)} onChanged={refresh} />}
    </div>
  );
}

/** "View defaulters" opens the register already filtered to overdue, sorted by most overdue. */
function FeeRegisterWithDefault({ overdueFirst, ...props }: { overdueFirst: boolean } & React.ComponentProps<typeof FeeRegister>) {
  return <FeeRegister {...props} initialStatus={overdueFirst ? "overdue" : "all"} initialSort={overdueFirst ? "overdue" : "name"} />;
}
