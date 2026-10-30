"use client";

import { useRouter } from "next/navigation";
import { Dashboard } from "./_components/dashboard";
import { pathFor, useConsole } from "./_components/shell";

export default function ConsoleHome() {
  const router = useRouter();
  const { version } = useConsole();
  return <Dashboard key={version} onOpenSchool={(id) => router.push(`/console/schools?school=${id}`)} onGo={(t) => router.push(pathFor(t))} />;
}
