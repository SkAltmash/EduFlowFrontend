"use client";

import { useConsole } from "../_components/shell";
import { Users } from "../_components/users";

export default function Page() {
  const { openSchool } = useConsole();
  return <Users onOpenSchool={openSchool} />;
}
