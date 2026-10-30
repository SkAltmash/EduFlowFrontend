"use client";

import { Schools } from "../_components/schools";
import { useConsole } from "../_components/shell";

export default function Page() {
  const { openSchool, version } = useConsole();
  return <Schools key={version} onOpenSchool={openSchool} />;
}
