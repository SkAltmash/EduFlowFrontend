"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";
import { Button, Logo, buttonClass } from "./ui";

export function SiteNav() {
  const { session, logout } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <ThemeToggle className="mr-1" />
          {session.status === "authenticated" ? (
            <>
              <span className="hidden text-sm text-muted sm:inline">
                {session.user.name}
                {session.tenant && <> · {session.tenant.name}</>}
              </span>
              <Link href={session.isSuperAdmin ? "/console" : "/app"} className={buttonClass("secondary", "sm")}>
                {session.isSuperAdmin ? "Console" : "Open app"}
              </Link>
              <Button variant="ghost" size="sm" onClick={logout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className={buttonClass("ghost", "sm")}>
                Log in
              </Link>
              <Link href="/register" className={buttonClass("primary", "sm")}>
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
