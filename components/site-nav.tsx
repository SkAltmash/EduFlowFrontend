"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";
import { Button, Logo, buttonClass } from "./ui";

const LINKS = [
  ["#features", "Features"],
  ["#how-it-works", "How it works"],
  ["#pricing", "Free trial"],
  ["#faq", "FAQ"],
] as const;

export function SiteNav() {
  const { session, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className="rounded-md px-3 py-2 text-sm text-muted transition-colors hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle className="mr-1 max-sm:hidden" />
          {session.status === "authenticated" ? (
            <>
              <Link href={session.isSuperAdmin ? "/console" : "/app/students"} className={buttonClass("primary", "sm")}>
                {session.isSuperAdmin ? "Console" : "Open app"}
              </Link>
              <Button variant="ghost" size="sm" onClick={logout} className="max-sm:hidden">
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className={buttonClass("ghost", "sm")}>
                Log in
              </Link>
              <Link href="/register" className={buttonClass("primary", "sm")}>
                <span className="sm:hidden">Free trial</span>
                <span className="max-sm:hidden">Start free trial</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
